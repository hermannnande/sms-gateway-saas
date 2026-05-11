-- Backfill #1: for every existing organization, mark queued messages whose
-- phone is already in optouts as skipped_optout so old campaigns can
-- progress and eventually complete.
DO $backfill$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM organizations LOOP
    PERFORM mark_optout_messages_as_skipped(v_org.id);
  END LOOP;
END
$backfill$;
