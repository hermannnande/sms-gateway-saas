-- Add SIM selection on campaigns (slot index), and propagate it when claiming messages.

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS sim_slot_index INTEGER;

-- Optional constraint: only SIM1/SIM2 supported for now.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_sim_slot_index_check'
  ) THEN
    ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_sim_slot_index_check
    CHECK (sim_slot_index IS NULL OR sim_slot_index IN (0, 1));
  END IF;
END $$;

-- Update claim_messages_atomic to apply campaign SIM choice:
-- - If campaign.sim_slot_index is set, store "slot:<index>" into messages.sim_subscription_id.
-- - Also return sim_subscription_id so the mobile app can route SMS to the right SIM.
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
) AS $$
DECLARE
  rec RECORD;
  v_sim_token TEXT;
BEGIN
  FOR rec IN
    SELECT m.id, c.sim_slot_index
    FROM messages m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.org_id = p_org_id
      AND m.status = 'queued'
      AND c.status = 'running'
      AND NOT (m.to_phone_e164 = ANY(p_optout_phones))
    ORDER BY m.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_sim_token := CASE
      WHEN rec.sim_slot_index IS NOT NULL THEN 'slot:' || rec.sim_slot_index::text
      ELSE p_sim_subscription_id
    END;

    UPDATE messages
    SET
      status = 'sending',
      device_id = p_device_id,
      sim_subscription_id = v_sim_token
    WHERE messages.id = rec.id;

    RETURN QUERY
    SELECT
      messages.id,
      messages.to_phone_e164,
      messages.body_final,
      messages.campaign_id,
      messages.sim_subscription_id
    FROM messages
    WHERE messages.id = rec.id;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;


