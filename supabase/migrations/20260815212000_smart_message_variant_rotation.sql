-- Ordre stable des messages d'une campagne.
--
-- Les variantes sont préparées côté application dans une rotation aléatoire
-- équilibrée. Cette position garantit que la base remet les messages au
-- téléphone dans ce même ordre, même si toutes les lignes d'un INSERT ont le
-- même created_at.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS campaign_sequence INTEGER
  CHECK (campaign_sequence IS NULL OR campaign_sequence >= 0);

COMMENT ON COLUMN public.messages.campaign_sequence IS
  'Position stable du destinataire dans la rotation de variantes de la campagne.';

CREATE INDEX IF NOT EXISTS idx_messages_campaign_sequence
  ON public.messages(campaign_id, campaign_sequence)
  WHERE status = 'queued';

-- Reprend la version finale de claim_messages_atomic (SIM, priorité,
-- device_id, statut running, optouts et finalisation), en ajoutant seulement
-- campaign_sequence à l'ordre de réclamation.
DROP FUNCTION IF EXISTS public.claim_messages_atomic(uuid, uuid, text, integer, text[]);

CREATE FUNCTION public.claim_messages_atomic(
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

  FOR rec IN
    SELECT
      m.id AS mid,
      c.sim_slot_index AS slot_idx,
      c.priority AS prio,
      c.created_at AS campaign_created_at,
      m.campaign_sequence AS sequence_no,
      m.created_at AS message_created_at
      FROM messages m
      JOIN campaigns c ON c.id = m.campaign_id
     WHERE m.org_id = p_org_id
       AND m.status = 'queued'
       AND c.status = 'running'
       AND (c.device_id IS NULL OR c.device_id = p_device_id)
     ORDER BY
       c.priority DESC,
       c.created_at ASC,
       COALESCE(m.campaign_sequence, 2147483647) ASC,
       m.created_at ASC,
       m.id ASC
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

  IF v_affected_campaigns IS NOT NULL THEN
    PERFORM finalize_campaign_if_complete(c_id)
       FROM unnest(v_affected_campaigns) AS c_id;
  END IF;

  RETURN;
END;
$func$ LANGUAGE plpgsql;
