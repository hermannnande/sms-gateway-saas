-- Function to atomically claim messages
-- This ensures no duplicate sends

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
  body_final TEXT
) AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Lock and update messages in one go
  -- Use FOR UPDATE SKIP LOCKED to avoid blocking
  
  FOR v_message_id IN
    SELECT m.id
    FROM messages m
    WHERE m.org_id = p_org_id
      AND m.status = 'queued'
      AND NOT (m.to_phone_e164 = ANY(p_optout_phones))
    ORDER BY m.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Update to sending status
    UPDATE messages
    SET 
      status = 'sending',
      device_id = p_device_id,
      sim_subscription_id = p_sim_subscription_id
    WHERE messages.id = v_message_id;
    
    -- Return this message
    RETURN QUERY
    SELECT 
      messages.id,
      messages.to_phone_e164,
      messages.body_final
    FROM messages
    WHERE messages.id = v_message_id;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;




