-- Helper: finalize a campaign as 'done' when all its messages are in a
-- terminal state (sent, failed, skipped_optout). Returns TRUE if updated.
CREATE OR REPLACE FUNCTION finalize_campaign_if_complete(p_campaign_id UUID)
RETURNS BOOLEAN AS $func$
DECLARE
  v_total INT;
  v_terminal INT;
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM campaigns WHERE id = p_campaign_id;
  IF v_status IS NULL OR v_status IN ('done', 'canceled') THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_total FROM messages WHERE campaign_id = p_campaign_id;
  SELECT COUNT(*) INTO v_terminal
    FROM messages
   WHERE campaign_id = p_campaign_id
     AND status IN ('sent', 'failed', 'skipped_optout');

  IF v_total > 0 AND v_terminal >= v_total THEN
    UPDATE campaigns
       SET status = 'done',
           updated_at = NOW()
     WHERE id = p_campaign_id
       AND status NOT IN ('done', 'canceled');
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
