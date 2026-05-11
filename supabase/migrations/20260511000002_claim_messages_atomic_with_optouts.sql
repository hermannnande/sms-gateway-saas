-- Recreate claim_messages_atomic to:
--  - Pre-mark queued messages whose phone is in optouts as skipped_optout
--    (so optout-blocked messages do not stay "queued" forever).
--  - Then claim the remaining queued messages, honoring campaign priority
--    and SIM slot routing.
--  - Finalize affected campaigns when all their messages are terminal.
-- Note: signature is identical to the previous version, so CREATE OR REPLACE
-- is sufficient (no need to DROP first).
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
  -- (a) Mark optout-blocked queued messages as skipped_optout and capture
  -- impacted campaigns so we can finalize them at the end.
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
     RETURNING m.campaign_id
  )
  SELECT COALESCE(array_agg(DISTINCT campaign_id) FILTER (WHERE campaign_id IS NOT NULL), ARRAY[]::UUID[])
    INTO v_affected_campaigns
    FROM skipped;

  -- (b) Claim remaining queued messages, honoring campaign priority + SIM slot.
  FOR rec IN
    SELECT m.id, c.sim_slot_index, c.priority
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
      WHEN rec.sim_slot_index IS NOT NULL THEN 'slot:' || rec.sim_slot_index::text
      ELSE p_sim_subscription_id
    END;

    UPDATE messages
       SET status = 'sending',
           device_id = p_device_id,
           sim_subscription_id = v_sim_token
     WHERE messages.id = rec.id;

    RETURN QUERY
    SELECT messages.id,
           messages.to_phone_e164,
           messages.body_final,
           messages.campaign_id,
           messages.sim_subscription_id
      FROM messages
     WHERE messages.id = rec.id;
  END LOOP;

  -- (c) Finalize affected campaigns whose remaining messages are all terminal.
  IF v_affected_campaigns IS NOT NULL THEN
    PERFORM finalize_campaign_if_complete(cid)
       FROM unnest(v_affected_campaigns) AS cid;
  END IF;

  RETURN;
END;
$func$ LANGUAGE plpgsql;
