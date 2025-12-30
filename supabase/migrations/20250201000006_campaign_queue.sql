-- Campaign queue & stats

-- 1) Columns on campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 2) Campaign jobs table
CREATE TABLE IF NOT EXISTS campaign_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('queued','running','paused','canceled','done')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_jobs_org_status ON campaign_jobs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign ON campaign_jobs(campaign_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaign_jobs_updated_at ON campaign_jobs;
CREATE TRIGGER trg_campaign_jobs_updated_at
BEFORE UPDATE ON campaign_jobs
FOR EACH ROW EXECUTE PROCEDURE set_timestamp();

-- 3) Update claim_messages_atomic to respect running campaigns and return campaign_id
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
  campaign_id UUID
) AS $$
DECLARE
  v_message_id UUID;
BEGIN
  FOR v_message_id IN
    SELECT m.id
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
    UPDATE messages
    SET 
      status = 'sending',
      device_id = p_device_id,
      sim_subscription_id = p_sim_subscription_id
    WHERE messages.id = v_message_id;
    
    RETURN QUERY
    SELECT 
      messages.id,
      messages.to_phone_e164,
      messages.body_final,
      messages.campaign_id
    FROM messages
    WHERE messages.id = v_message_id;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;


