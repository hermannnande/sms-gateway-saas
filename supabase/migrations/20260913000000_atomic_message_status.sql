-- A repeated report must not count a sent SMS twice. Serialize reports for
-- each campaign and derive its counters from the actual message states.
CREATE OR REPLACE FUNCTION public.report_message_status(
  p_device_id UUID,
  p_message_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_campaign_id UUID;
  v_message public.messages%ROWTYPE;
  v_campaign JSONB;
  v_sent INTEGER;
  v_total INTEGER;
  v_terminal INTEGER;
  v_result_status TEXT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'status doit être sent ou failed';
  END IF;

  SELECT org_id INTO v_org_id FROM public.devices WHERE id = p_device_id;
  SELECT campaign_id INTO v_campaign_id FROM public.messages
   WHERE id = p_message_id AND org_id = v_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message non trouvé pour cet appareil';
  END IF;

  -- Lock before changing a message: concurrent devices cannot overwrite
  -- another report's aggregate with an older value.
  IF v_campaign_id IS NOT NULL THEN
    PERFORM 1 FROM public.campaigns WHERE id = v_campaign_id FOR UPDATE;
  END IF;
  SELECT * INTO v_message FROM public.messages
   WHERE id = p_message_id AND org_id = v_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message non trouvé';
  END IF;

  IF v_message.device_id IS NOT NULL AND v_message.device_id <> p_device_id THEN
    RAISE EXCEPTION 'Message attribué à un autre appareil';
  END IF;

  IF p_status = 'sent' AND v_message.status NOT IN ('sent', 'skipped_optout', 'canceled') THEN
    UPDATE public.messages SET status = 'sent', sent_at = COALESCE(sent_at, NOW()),
      last_error = NULL WHERE id = p_message_id;
    UPDATE public.devices SET last_seen_at = NOW(), status = 'online'
     WHERE id = p_device_id;
  ELSIF p_status = 'failed' AND v_message.status = 'sending' THEN
    -- Repeated delivery of a failure while already queued is also a no-op.
    UPDATE public.messages
       SET try_count = try_count + 1,
           status = CASE WHEN try_count + 1 < 3 THEN 'queued' ELSE 'failed' END,
           device_id = CASE WHEN try_count + 1 < 3 THEN NULL ELSE device_id END,
           last_error = COALESCE(p_error, 'Unknown error')
     WHERE id = p_message_id;
  END IF;

  SELECT * INTO v_message FROM public.messages WHERE id = p_message_id;
  v_result_status := CASE WHEN v_message.status = 'queued' THEN 'queued_retry'
                          ELSE v_message.status END;

  IF v_campaign_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE status = 'sent')::INTEGER,
           COUNT(*) FILTER (WHERE status IN ('sent', 'failed', 'skipped_optout', 'canceled'))::INTEGER
      INTO v_total, v_sent, v_terminal
      FROM public.messages WHERE campaign_id = v_campaign_id;

    UPDATE public.campaigns
       SET sent_count = v_sent, total_count = v_total,
           status = CASE WHEN status IN ('running', 'queued', 'paused')
                              AND v_total > 0 AND v_terminal = v_total
                         THEN 'done' ELSE status END,
           updated_at = clock_timestamp()
     WHERE id = v_campaign_id;
    SELECT jsonb_build_object('id', id, 'org_id', org_id, 'name', name,
      'status', status, 'sent_count', sent_count, 'total_count', total_count,
      'updated_at', updated_at)
      INTO v_campaign FROM public.campaigns WHERE id = v_campaign_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', v_result_status,
    'try_count', v_message.try_count, 'campaign', v_campaign);
END;
$$;

REVOKE ALL ON FUNCTION public.report_message_status(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_message_status(UUID, UUID, TEXT, TEXT) TO service_role;
