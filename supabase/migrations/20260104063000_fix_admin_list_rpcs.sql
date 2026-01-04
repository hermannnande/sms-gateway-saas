-- Fix admin_list_* RPCs: CTE scope bug ("relation paged does not exist")
-- CTEs only exist within a single SQL statement, so we compute total+items in one SELECT.

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_page INT DEFAULT 0,
  p_page_size INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_total BIGINT;
  v_items JSONB;
BEGIN
  v_role := public._require_admin();

  WITH base AS (
    SELECT
      u.id AS user_id,
      u.email,
      u.created_at,
      u.email_confirmed_at,
      u.last_sign_in_at,
      au.last_web_seen_at,
      au.last_mobile_seen_at,
      EXISTS (SELECT 1 FROM public.admin_users ad WHERE ad.user_id = u.id) AS is_admin
    FROM auth.users u
    LEFT JOIN public.app_users au ON au.user_id = u.id
    WHERE (p_search IS NULL OR p_search = '' OR u.email ILIKE '%' || p_search || '%')
      AND (
        p_status = 'all'
        OR (p_status = 'confirmed' AND u.email_confirmed_at IS NOT NULL)
        OR (p_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
      )
  ),
  counted AS (SELECT COUNT(*)::bigint AS total FROM base),
  paged AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 1)
    LIMIT GREATEST(p_page_size, 1)
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  INTO v_total, v_items
  FROM paged;

  RETURN jsonb_build_object('ok', true, 'total', COALESCE(v_total, 0), 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_orgs(
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 0,
  p_page_size INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_total BIGINT;
  v_items JSONB;
BEGIN
  v_role := public._require_admin();

  WITH base AS (
    SELECT
      o.id,
      o.name,
      o.created_at,
      (SELECT COUNT(*) FROM public.devices d WHERE d.org_id = o.id) AS devices_count,
      s.status AS subscription_status,
      s.current_period_end,
      p.name AS plan_name,
      p.max_devices,
      p.sms_quota_month,
      p.price_xof
    FROM public.organizations o
    LEFT JOIN LATERAL (
      SELECT *
      FROM public.subscriptions s1
      WHERE s1.org_id = o.id AND s1.status = 'active'
      ORDER BY COALESCE(s1.current_period_end, NOW() + INTERVAL '100 years') DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN public.plans p ON p.id = s.plan_id
    WHERE (p_search IS NULL OR p_search = '' OR o.name ILIKE '%' || p_search || '%')
  ),
  counted AS (SELECT COUNT(*)::bigint AS total FROM base),
  paged AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 1)
    LIMIT GREATEST(p_page_size, 1)
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  INTO v_total, v_items
  FROM paged;

  RETURN jsonb_build_object('ok', true, 'total', COALESCE(v_total, 0), 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(
  p_status TEXT DEFAULT 'all',
  p_page INT DEFAULT 0,
  p_page_size INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_total BIGINT;
  v_items JSONB;
BEGIN
  v_role := public._require_admin();

  WITH base AS (
    SELECT
      s.id,
      s.org_id,
      o.name AS org_name,
      s.status,
      s.current_period_start,
      s.current_period_end,
      s.provider,
      s.created_at,
      p.name AS plan_name,
      p.price_xof
    FROM public.subscriptions s
    JOIN public.organizations o ON o.id = s.org_id
    LEFT JOIN public.plans p ON p.id = s.plan_id
    WHERE (p_status = 'all' OR s.status = p_status)
  ),
  counted AS (SELECT COUNT(*)::bigint AS total FROM base),
  paged AS (
    SELECT *
    FROM base
    ORDER BY created_at DESC
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 1)
    LIMIT GREATEST(p_page_size, 1)
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  INTO v_total, v_items
  FROM paged;

  RETURN jsonb_build_object('ok', true, 'total', COALESCE(v_total, 0), 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_events(
  p_type TEXT DEFAULT 'all',
  p_page INT DEFAULT 0,
  p_page_size INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_total BIGINT;
  v_items JSONB;
BEGIN
  v_role := public._require_admin();

  WITH base AS (
    SELECT
      id,
      event_type,
      occurred_at,
      platform,
      user_id,
      org_id,
      device_id,
      meta
    FROM public.analytics_events
    WHERE (p_type = 'all' OR event_type = p_type)
  ),
  counted AS (SELECT COUNT(*)::bigint AS total FROM base),
  paged AS (
    SELECT *
    FROM base
    ORDER BY occurred_at DESC
    OFFSET GREATEST(p_page, 0) * GREATEST(p_page_size, 1)
    LIMIT GREATEST(p_page_size, 1)
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  INTO v_total, v_items
  FROM paged;

  RETURN jsonb_build_object('ok', true, 'total', COALESCE(v_total, 0), 'items', v_items);
END;
$$;

-- keep grants (idempotent)
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orgs(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_events(TEXT, INT, INT) TO authenticated;


