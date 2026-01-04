-- =============================================
-- Admin RPC (no service role key required)
-- - admin_role(): returns 'SUPER_ADMIN'/'SUPPORT' or NULL
-- - admin_metrics(): returns JSON payload for admin dashboard
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO r
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_today DATE := CURRENT_DATE;
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;

  users_total BIGINT;
  orgs_total BIGINT;
  devices_total BIGINT;
  downloads_today BIGINT;
  downloads_month BIGINT;
  downloads_total BIGINT;
  messages_total BIGINT;
  messages_today BIGINT;
  active_subscriptions BIGINT;

  downloads_series JSONB;
  users_series JSONB;
  messages_series JSONB;
BEGIN
  v_role := public.admin_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- KPIs
  SELECT COUNT(*) INTO users_total FROM auth.users;
  SELECT COUNT(*) INTO orgs_total FROM public.organizations;
  SELECT COUNT(*) INTO devices_total FROM public.devices;
  SELECT COUNT(*) INTO active_subscriptions FROM public.subscriptions WHERE status = 'active';

  SELECT COUNT(*) INTO downloads_total
  FROM public.analytics_events
  WHERE event_type = 'apk_download';

  SELECT COUNT(*) INTO downloads_today
  FROM public.analytics_events
  WHERE event_type = 'apk_download'
    AND occurred_at::date >= v_today;

  SELECT COUNT(*) INTO downloads_month
  FROM public.analytics_events
  WHERE event_type = 'apk_download'
    AND occurred_at::date >= v_month;

  SELECT COUNT(*) INTO messages_total
  FROM public.messages
  WHERE status = 'sent';

  SELECT COUNT(*) INTO messages_today
  FROM public.messages
  WHERE status = 'sent'
    AND sent_at::date >= v_today;

  -- Series (7 derniers jours)
  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'date'), '[]'::jsonb)
  INTO downloads_series
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(d::date, 'DD/MM'),
      'count', COALESCE(x.cnt, 0)
    ) AS t
    FROM generate_series((CURRENT_DATE - INTERVAL '6 days')::date, CURRENT_DATE::date, INTERVAL '1 day') d
    LEFT JOIN (
      SELECT occurred_at::date AS day, COUNT(*) AS cnt
      FROM public.analytics_events
      WHERE event_type = 'apk_download'
        AND occurred_at::date >= (CURRENT_DATE - INTERVAL '6 days')::date
      GROUP BY 1
    ) x ON x.day = d::date
  ) s;

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'date'), '[]'::jsonb)
  INTO users_series
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(d::date, 'DD/MM'),
      'count', COALESCE(x.cnt, 0)
    ) AS t
    FROM generate_series((CURRENT_DATE - INTERVAL '6 days')::date, CURRENT_DATE::date, INTERVAL '1 day') d
    LEFT JOIN (
      SELECT created_at::date AS day, COUNT(*) AS cnt
      FROM auth.users
      WHERE created_at::date >= (CURRENT_DATE - INTERVAL '6 days')::date
      GROUP BY 1
    ) x ON x.day = d::date
  ) s;

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'date'), '[]'::jsonb)
  INTO messages_series
  FROM (
    SELECT jsonb_build_object(
      'date', to_char(d::date, 'DD/MM'),
      'count', COALESCE(x.cnt, 0)
    ) AS t
    FROM generate_series((CURRENT_DATE - INTERVAL '6 days')::date, CURRENT_DATE::date, INTERVAL '1 day') d
    LEFT JOIN (
      SELECT sent_at::date AS day, COUNT(*) AS cnt
      FROM public.messages
      WHERE status = 'sent'
        AND sent_at IS NOT NULL
        AND sent_at::date >= (CURRENT_DATE - INTERVAL '6 days')::date
      GROUP BY 1
    ) x ON x.day = d::date
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'kpis', jsonb_build_object(
      'usersTotal', COALESCE(users_total, 0),
      'orgsTotal', COALESCE(orgs_total, 0),
      'devicesTotal', COALESCE(devices_total, 0),
      'downloadsMonth', COALESCE(downloads_month, 0),
      'downloadsToday', COALESCE(downloads_today, 0),
      'messagesTotal', COALESCE(messages_total, 0),
      'messagesToday', COALESCE(messages_today, 0),
      'activeSubscriptions', COALESCE(active_subscriptions, 0)
    ),
    'charts', jsonb_build_object(
      'downloads', downloads_series,
      'users', users_series,
      'messages', messages_series
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_metrics() TO authenticated;


