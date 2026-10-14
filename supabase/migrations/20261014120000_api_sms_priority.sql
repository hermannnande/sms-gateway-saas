-- API traffic preempts campaign traffic on the same eligible gateway.
-- Never persist an automatic pause: manual pauses/cancellations keep their meaning.
CREATE OR REPLACE FUNCTION public.has_priority_api_messages(p_org_id UUID, p_device_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.campaigns c ON c.id = m.campaign_id AND c.org_id = m.org_id
    JOIN public.devices d ON d.id = p_device_id AND d.org_id = m.org_id
    WHERE m.org_id = p_org_id AND c.status = 'running' AND c.api_key_id IS NOT NULL
      AND (c.device_id IS NULL OR c.device_id = p_device_id)
      AND (m.status = 'queued' OR (m.status = 'sending' AND m.device_id = p_device_id))
      AND NOT EXISTS (SELECT 1 FROM public.optouts o
        WHERE o.org_id = m.org_id AND o.phone_e164 = m.to_phone_e164)
  );
$$;
REVOKE ALL ON FUNCTION public.has_priority_api_messages(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_priority_api_messages(UUID, UUID) TO service_role;

-- Recheck immediately before native dispatch: an API message can arrive AFTER
-- Android has claimed a batch of campaign messages. This is read-only; the
-- worker finishes its current SMS, discards the unstarted local batch and claims
-- again. The existing claim endpoint requeues that device's unstarted messages.
CREATE OR REPLACE FUNCTION public.check_sms_dispatch(p_device_id UUID, p_message_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_message RECORD;
BEGIN
  SELECT m.org_id, m.status, m.to_phone_e164, c.status AS campaign_status,
         c.api_key_id IS NOT NULL AS is_api, c.device_id AS campaign_device_id
    INTO v_message FROM public.messages m
    JOIN public.campaigns c ON c.id = m.campaign_id AND c.org_id = m.org_id
    JOIN public.devices d ON d.org_id = m.org_id AND d.id = p_device_id
    WHERE m.id = p_message_id AND m.device_id = p_device_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'message_unavailable');
  END IF;
  IF v_message.status <> 'sending' OR v_message.campaign_status <> 'running'
     OR (v_message.campaign_device_id IS NOT NULL AND v_message.campaign_device_id <> p_device_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'message_inactive');
  END IF;
  IF EXISTS (SELECT 1 FROM public.optouts o WHERE o.org_id = v_message.org_id
      AND o.phone_e164 = v_message.to_phone_e164) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'optout');
  END IF;
  IF NOT v_message.is_api AND public.has_priority_api_messages(v_message.org_id, p_device_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'api_priority');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'reason', 'ready', 'is_api', v_message.is_api);
END;
$$;
REVOKE ALL ON FUNCTION public.check_sms_dispatch(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_sms_dispatch(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_messages_atomic(
  p_org_id UUID, p_device_id UUID, p_sim_subscription_id TEXT,
  p_limit INT, p_optout_phones TEXT[]
)
RETURNS TABLE (id UUID, to_phone_e164 TEXT, body_final TEXT,
  campaign_id UUID, sim_subscription_id TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $func$
DECLARE
  rec RECORD;
  v_sim_token TEXT;
  v_affected_campaigns UUID[];
  v_api_priority BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.devices d WHERE d.id = p_device_id AND d.org_id = p_org_id) THEN
    RAISE EXCEPTION 'Appareil inaccessible' USING ERRCODE = '42501';
  END IF;
  WITH skipped AS (
    UPDATE public.messages m SET status = 'skipped_optout', last_error = 'Numéro en liste noire (optout)'
    WHERE m.org_id = p_org_id AND m.status = 'queued'
      AND ((p_optout_phones IS NOT NULL AND m.to_phone_e164 = ANY(p_optout_phones))
        OR EXISTS (SELECT 1 FROM public.optouts o WHERE o.org_id = p_org_id AND o.phone_e164 = m.to_phone_e164))
    RETURNING m.campaign_id AS cid
  )
  SELECT coalesce(array_agg(DISTINCT cid) FILTER (WHERE cid IS NOT NULL), ARRAY[]::UUID[])
    INTO v_affected_campaigns FROM skipped;

  v_api_priority := public.has_priority_api_messages(p_org_id, p_device_id);
  FOR rec IN
    SELECT m.id AS mid, c.sim_slot_index AS slot_idx
    FROM public.messages m
    JOIN public.campaigns c ON c.id = m.campaign_id AND c.org_id = m.org_id
    WHERE m.org_id = p_org_id AND m.status = 'queued' AND c.status = 'running'
      AND (c.device_id IS NULL OR c.device_id = p_device_id)
      AND (NOT v_api_priority OR c.api_key_id IS NOT NULL)
    ORDER BY (c.api_key_id IS NOT NULL) DESC, c.priority DESC, m.created_at ASC, m.id ASC
    LIMIT greatest(0, least(coalesce(p_limit, 20), 100))
    FOR UPDATE OF m SKIP LOCKED
  LOOP
    v_sim_token := CASE WHEN rec.slot_idx IS NOT NULL THEN 'slot:' || rec.slot_idx::text ELSE p_sim_subscription_id END;
    UPDATE public.messages SET status = 'sending', device_id = p_device_id, sim_subscription_id = v_sim_token
      WHERE messages.id = rec.mid;
    RETURN QUERY SELECT m2.id, m2.to_phone_e164, m2.body_final, m2.campaign_id, m2.sim_subscription_id
      FROM public.messages m2 WHERE m2.id = rec.mid;
  END LOOP;
  PERFORM public.finalize_campaign_if_complete(c_id) FROM unnest(v_affected_campaigns) AS c_id;
  RETURN;
END;
$func$;
REVOKE ALL ON FUNCTION public.claim_messages_atomic(UUID, UUID, TEXT, INT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_messages_atomic(UUID, UUID, TEXT, INT, TEXT[]) TO service_role;
