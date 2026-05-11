-- Fix: "column reference \"campaign_id\" is ambiguous" in claim_messages_atomic
--
-- Cause: the function declares an OUT column `campaign_id` (via RETURNS TABLE)
-- and the CTE `skipped` also exposes a column named `campaign_id`. PL/pgSQL
-- cannot decide which one to bind to inside the body, so the runtime fails on
-- every call -> the mobile app sees "Erreur claim messages" and SMS stay in
-- "queued" forever.
--
-- Fix: rename the CTE column (and any local references) so they no longer
-- collide with the OUT variable. Behavior is identical.

CREATE OR REPLACE FUNCTION claim_messages_atomic(
  p_org_id UUID,
  p_device_id UUID,
  p_sim_subscription_id TEXT,
  p_limit INT,
  p_optout_phones TEXT[]
)
RETURNS TABLE (
  id UUID,
  to_phone_e164 TEXT,
  body_final TEXT,
  campaign_id UUID,
  sim_subscription_id TEXT
) AS $func$
DECLARE
  rec RECORD;
  v_sim_token TEXT;
  v_affected_campaigns UUID[];
BEGIN
  -- (a) Mark optout-blocked queued messages as skipped_optout, and collect
  -- impacted campaign ids. We alias the CTE column to `cid` to avoid the
  -- name clash with the OUT parameter `campaign_id`.
  WITH skipped AS (
    UPDATE messages m
       SET status = 'skipped_optout',
           last_error = 'Numéro en liste noire (optout)'
     WHERE m.org_id = p_org_id
       AND m.status = 'queued'
       AND (
            (p_optout_phones IS NOT NULL AND m.to_phone_e164 = ANY(p_optout_phones))
         OR EXISTS (
              SELECT 1 FROM optouts o
               WHERE o.org_id = p_org_id
                 AND o.phone_e164 = m.to_phone_e164
            )
       )
     RETURNING m.campaign_id AS cid
  )
  SELECT COALESCE(array_agg(DISTINCT cid) FILTER (WHERE cid IS NOT NULL), ARRAY[]::UUID[])
    INTO v_affected_campaigns
    FROM skipped;

  -- (b) Claim queued messages honoring campaign priority + SIM slot.
  FOR rec IN
    SELECT m.id AS mid, c.sim_slot_index AS slot_idx, c.priority AS prio
      FROM messages m
      JOIN campaigns c ON c.id = m.campaign_id
     WHERE m.org_id = p_org_id
       AND m.status = 'queued'
       AND c.status = 'running'
     ORDER BY c.priority DESC, m.created_at ASC
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    v_sim_token := CASE
      WHEN rec.slot_idx IS NOT NULL THEN 'slot:' || rec.slot_idx::text
      ELSE p_sim_subscription_id
    END;

    UPDATE messages
       SET status = 'sending',
           device_id = p_device_id,
           sim_subscription_id = v_sim_token
     WHERE messages.id = rec.mid;

    RETURN QUERY
    SELECT m2.id,
           m2.to_phone_e164,
           m2.body_final,
           m2.campaign_id,
           m2.sim_subscription_id
      FROM messages m2
     WHERE m2.id = rec.mid;
  END LOOP;

  -- (c) Finalize affected campaigns when all their remaining messages are
  -- terminal (sent / failed / skipped_optout).
  IF v_affected_campaigns IS NOT NULL THEN
    PERFORM finalize_campaign_if_complete(c_id)
       FROM unnest(v_affected_campaigns) AS c_id;
  END IF;

  RETURN;
END;
$func$ LANGUAGE plpgsql;
