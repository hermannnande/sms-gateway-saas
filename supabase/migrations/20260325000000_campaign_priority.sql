-- Add priority to campaigns (higher = processed first)
-- 0 = normal (default), 1 = high, 2 = urgent
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON campaigns(org_id, priority DESC, created_at ASC);

-- Recreate claim_messages_atomic to sort by priority DESC first
DROP FUNCTION IF EXISTS public.claim_messages_atomic(uuid, uuid, text, integer, text[]);

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
    SELECT m.id, c.sim_slot_index, c.priority
    FROM messages m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.org_id = p_org_id
      AND m.status = 'queued'
      AND c.status = 'running'
      AND NOT (m.to_phone_e164 = ANY(p_optout_phones))
    ORDER BY c.priority DESC, m.created_at ASC
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
