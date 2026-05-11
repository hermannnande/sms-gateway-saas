-- Backfill #2: finalize any campaign currently running/paused/queued whose
-- messages are all in a terminal state (sent / failed / skipped_optout).
DO $backfill$
DECLARE
  v_cmp RECORD;
BEGIN
  FOR v_cmp IN
    SELECT id FROM campaigns WHERE status IN ('running', 'paused', 'queued')
  LOOP
    PERFORM finalize_campaign_if_complete(v_cmp.id);
  END LOOP;
END
$backfill$;
