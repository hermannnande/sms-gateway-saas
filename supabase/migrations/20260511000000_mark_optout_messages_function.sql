-- Helper: mark queued messages whose phone is in optouts as skipped_optout
-- Returns the number of messages updated.
CREATE OR REPLACE FUNCTION mark_optout_messages_as_skipped(p_org_id UUID)
RETURNS INT AS $func$
DECLARE
  v_count INT;
BEGIN
  WITH updated AS (
    UPDATE messages m
       SET status = 'skipped_optout',
           last_error = 'Numéro en liste noire (optout)'
     WHERE m.org_id = p_org_id
       AND m.status = 'queued'
       AND EXISTS (
         SELECT 1
           FROM optouts o
          WHERE o.org_id = p_org_id
            AND o.phone_e164 = m.to_phone_e164
       )
     RETURNING m.campaign_id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN COALESCE(v_count, 0);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
