-- Delivery is independent of sending: never change messages.status or quotas.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivery_status TEXT
  CHECK (delivery_status IN ('pending', 'delivered', 'failed'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS messages_campaign_delivery_idx ON public.messages(campaign_id, delivery_status);
CREATE INDEX IF NOT EXISTS messages_campaign_status_idx ON public.messages(campaign_id, status);

CREATE TABLE IF NOT EXISTS public.sms_delivery_attempts (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_delivery_attempts_message_idx ON public.sms_delivery_attempts(message_id);
ALTER TABLE public.sms_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sms_delivery_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.report_sms_delivery(
  p_device_id UUID, p_message_id UUID, p_attempt_id UUID, p_status TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_message public.messages%ROWTYPE;
  v_attempt public.sms_delivery_attempts%ROWTYPE;
  v_status TEXT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'delivered', 'failed') OR p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Accusé invalide';
  END IF;
  -- A single message lock serializes duplicate and concurrent receipts.
  SELECT m.* INTO v_message FROM public.messages m
    JOIN public.devices d ON d.org_id = m.org_id
    WHERE m.id = p_message_id AND d.id = p_device_id FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message inaccessible' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_attempt FROM public.sms_delivery_attempts WHERE id = p_attempt_id;
  IF FOUND THEN
    IF v_attempt.message_id <> p_message_id OR v_attempt.device_id <> p_device_id THEN
      RAISE EXCEPTION 'Tentative inaccessible' USING ERRCODE = '42501';
    END IF;
  ELSIF v_message.device_id IS DISTINCT FROM p_device_id THEN
    RAISE EXCEPTION 'Message attribué à un autre appareil' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sms_delivery_attempts(id, message_id, device_id, status)
    VALUES(p_attempt_id, p_message_id, p_device_id, p_status)
  ON CONFLICT(id) DO UPDATE SET
    status = CASE
      WHEN sms_delivery_attempts.status = 'delivered' OR excluded.status = 'delivered' THEN 'delivered'
      WHEN sms_delivery_attempts.status = 'failed' THEN 'failed'
      ELSE excluded.status END,
    updated_at = clock_timestamp()
  WHERE sms_delivery_attempts.message_id = excluded.message_id
    AND sms_delivery_attempts.device_id = excluded.device_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentative inaccessible' USING ERRCODE = '42501';
  END IF;

  -- A receipt for one successful retry is enough; never mix multipart segments
  -- from different attempts. Android reports delivered only after ALL parts.
  SELECT CASE WHEN bool_or(status = 'delivered') THEN 'delivered'
              WHEN bool_or(status = 'pending') THEN 'pending' ELSE 'failed' END
    INTO v_status FROM public.sms_delivery_attempts WHERE message_id = p_message_id;
  UPDATE public.messages SET delivery_status = v_status,
    delivered_at = CASE WHEN v_status = 'delivered' THEN coalesce(delivered_at, now()) ELSE NULL END
    WHERE id = p_message_id;
  RETURN jsonb_build_object('ok', true, 'delivery_status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.report_sms_delivery(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_sms_delivery(UUID, UUID, UUID, TEXT) TO service_role;

-- Aggregate in PostgreSQL, not over a PostgREST page capped at 1000 rows.
-- SECURITY INVOKER preserves the caller's existing campaign/message RLS.
CREATE OR REPLACE FUNCTION public.campaign_message_stats(p_campaign_ids UUID[])
RETURNS TABLE(campaign_id UUID, total BIGINT, queued BIGINT, sending BIGINT,
  sent BIGINT, failed BIGINT, skipped_optout BIGINT, delivered BIGINT,
  delivery_pending BIGINT, delivery_failed BIGINT, delivery_unknown BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, count(m.id), count(*) FILTER(WHERE m.status = 'queued'),
    count(*) FILTER(WHERE m.status = 'sending'), count(*) FILTER(WHERE m.status = 'sent'),
    count(*) FILTER(WHERE m.status = 'failed'), count(*) FILTER(WHERE m.status = 'skipped_optout'),
    count(*) FILTER(WHERE m.status = 'sent' AND m.delivery_status = 'delivered'),
    count(*) FILTER(WHERE m.status = 'sent' AND m.delivery_status = 'pending'),
    count(*) FILTER(WHERE m.status = 'sent' AND m.delivery_status = 'failed'),
    count(*) FILTER(WHERE m.status = 'sent' AND m.delivery_status IS NULL)
  FROM public.campaigns c LEFT JOIN public.messages m ON m.campaign_id = c.id AND m.org_id = c.org_id
  WHERE c.id = ANY(p_campaign_ids[1:100]) GROUP BY c.id;
$$;
REVOKE ALL ON FUNCTION public.campaign_message_stats(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_message_stats(UUID[]) TO authenticated, service_role;
