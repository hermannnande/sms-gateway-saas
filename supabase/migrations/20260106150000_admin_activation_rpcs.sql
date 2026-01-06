-- Admin RPCs to avoid service role key in the web app.
-- These functions are SECURITY DEFINER and guarded by public._require_admin() / admin_role().
-- They can read/write across orgs for admin workflows (manual activation, ensure org).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure helper exists (some installs may not have run admin_lists_rpc migration yet)
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  r TEXT;
BEGIN
  r := public.admin_role();
  IF r IS NULL THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  RETURN r;
END;
$$;

-- 1) Find a user by email + return org/subscription/stats (JSON)
CREATE OR REPLACE FUNCTION public.admin_find_user(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_user_id UUID;
  v_user_email TEXT;
  v_created_at TIMESTAMPTZ;
  v_email_confirmed_at TIMESTAMPTZ;
  v_last_sign_in_at TIMESTAMPTZ;
  v_org_id UUID;
  v_org_name TEXT;
  v_devices BIGINT := 0;
  v_sent BIGINT := 0;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_sub_id UUID;
  v_sub_status TEXT;
  v_sub_plan_id TEXT;
  v_sub_start TIMESTAMPTZ;
  v_sub_end TIMESTAMPTZ;
  v_sub_provider TEXT;
  v_plan_name TEXT;
  v_plan_price INT;
  v_plan_max_devices INT;
  v_plan_sms_quota INT;
BEGIN
  v_role := public._require_admin();

  IF v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email requis');
  END IF;

  SELECT u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at
  INTO v_user_id, v_user_email, v_created_at, v_email_confirmed_at, v_last_sign_in_at
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Aucun compte trouvé pour : %s', v_email),
      'hint', 'Invitez le client à créer un compte sur : https://smsenvoie.com/auth/register'
    );
  END IF;

  SELECT om.org_id, o.name
  INTO v_org_id, v_org_name
  FROM public.org_members om
  JOIN public.organizations o ON o.id = om.org_id
  WHERE om.user_id = v_user_id
  ORDER BY om.created_at DESC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'needsOrg', true,
      'warning', format('Compte trouvé (%s) mais aucune organisation associée.', v_user_email),
      'hint', 'Vous pouvez activer l’abonnement: le système créera automatiquement une organisation si besoin.',
      'user', jsonb_build_object(
        'user_id', v_user_id,
        'email', v_user_email,
        'created_at', v_created_at,
        'email_confirmed_at', v_email_confirmed_at,
        'last_sign_in_at', v_last_sign_in_at
      ),
      'org', NULL,
      'org_id', NULL,
      'currentSubscription', NULL,
      'devicesCount', 0,
      'messagesSentThisMonth', 0
    );
  END IF;

  SELECT COUNT(*) INTO v_devices FROM public.devices d WHERE d.org_id = v_org_id;
  SELECT COUNT(*) INTO v_sent
  FROM public.messages m
  WHERE m.org_id = v_org_id AND m.status = 'sent' AND m.sent_at >= v_month_start;

  SELECT s.id, s.status, s.plan_id, s.current_period_start, s.current_period_end, s.provider,
         p.name, p.price_xof, p.max_devices, p.sms_quota_month
  INTO v_sub_id, v_sub_status, v_sub_plan_id, v_sub_start, v_sub_end, v_sub_provider,
       v_plan_name, v_plan_price, v_plan_max_devices, v_plan_sms_quota
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.org_id = v_org_id AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'user_id', v_user_id,
      'email', v_user_email,
      'created_at', v_created_at,
      'email_confirmed_at', v_email_confirmed_at,
      'last_sign_in_at', v_last_sign_in_at
    ),
    'org', jsonb_build_object('id', v_org_id, 'name', v_org_name),
    'org_id', v_org_id,
    'devicesCount', COALESCE(v_devices, 0),
    'messagesSentThisMonth', COALESCE(v_sent, 0),
    'currentSubscription',
      CASE
        WHEN v_sub_id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', v_sub_id,
          'status', v_sub_status,
          'plan_id', v_sub_plan_id,
          'current_period_start', v_sub_start,
          'current_period_end', v_sub_end,
          'provider', v_sub_provider,
          'plans', jsonb_build_object(
            'id', v_sub_plan_id,
            'name', v_plan_name,
            'price_xof', v_plan_price,
            'max_devices', v_plan_max_devices,
            'sms_quota_month', v_plan_sms_quota
          )
        )
      END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_find_user(TEXT) TO authenticated;

-- 2) Ensure a user has an org (attach to existing org or create new)
CREATE OR REPLACE FUNCTION public.admin_ensure_user_org(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_org_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_user_email TEXT;
  v_org_id UUID;
  v_org_name TEXT;
BEGIN
  v_role := public._require_admin();

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id requis');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id LIMIT 1;
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Utilisateur introuvable');
  END IF;

  -- already has org
  SELECT om.org_id, o.name
  INTO v_org_id, v_org_name
  FROM public.org_members om
  JOIN public.organizations o ON o.id = om.org_id
  WHERE om.user_id = p_user_id
  ORDER BY om.created_at DESC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Compte déjà rattaché à une organisation', 'org', jsonb_build_object('id', v_org_id, 'name', v_org_name), 'org_id', v_org_id);
  END IF;

  -- attach to existing org
  IF p_org_id IS NOT NULL THEN
    SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id LIMIT 1;
    IF v_org_name IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Organisation introuvable (org_id invalide)');
    END IF;

    INSERT INTO public.org_members (org_id, user_id, role, created_at)
    VALUES (p_org_id, p_user_id, 'ORG_ADMIN', NOW())
    ON CONFLICT (org_id, user_id) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'message', 'Compte rattaché à une organisation existante', 'org', jsonb_build_object('id', p_org_id, 'name', v_org_name), 'org_id', p_org_id);
  END IF;

  -- create org
  v_org_name := COALESCE(NULLIF(trim(p_org_name), ''), 'Organisation ' || COALESCE(NULLIF(split_part(v_user_email, '@', 1), ''), 'client'));
  v_org_id := gen_random_uuid();

  INSERT INTO public.organizations (id, name, created_at)
  VALUES (v_org_id, v_org_name, NOW());

  INSERT INTO public.org_members (org_id, user_id, role, created_at)
  VALUES (v_org_id, p_user_id, 'ORG_ADMIN', NOW())
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'message', 'Organisation créée et compte rattaché', 'org', jsonb_build_object('id', v_org_id, 'name', v_org_name), 'org_id', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ensure_user_org(UUID, UUID, TEXT) TO authenticated;

-- 3) Activate subscription (by org_id OR by email/user_id; auto-create org if missing)
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_plan_id TEXT,
  p_duration_days INT,
  p_org_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_org_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_org_id UUID;
  v_user_id UUID;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_plan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_end TIMESTAMPTZ;
  v_sub_id UUID;
  v_ext_ref TEXT;
BEGIN
  v_role := public._require_admin();

  IF p_plan_id IS NULL OR trim(p_plan_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_id requis');
  END IF;
  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duration_days requis');
  END IF;

  -- Resolve org_id
  v_org_id := p_org_id;

  IF v_org_id IS NULL THEN
    v_user_id := p_user_id;
    IF v_user_id IS NULL THEN
      IF v_email = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'org_id ou (email/user_id) requis');
      END IF;
      SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
      IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', format('Utilisateur introuvable: %s', v_email));
      END IF;
    END IF;

    SELECT om.org_id INTO v_org_id
    FROM public.org_members om
    WHERE om.user_id = v_user_id
    ORDER BY om.created_at DESC
    LIMIT 1;

    IF v_org_id IS NULL THEN
      -- create org + membership
      PERFORM public.admin_ensure_user_org(v_user_id, NULL, p_org_name);
      SELECT om.org_id INTO v_org_id
      FROM public.org_members om
      WHERE om.user_id = v_user_id
      ORDER BY om.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Impossible de résoudre org_id');
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id LIMIT 1;
  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Plan non trouvé');
  END IF;

  v_end := v_now + make_interval(days => p_duration_days);

  SELECT id INTO v_sub_id
  FROM public.subscriptions
  WHERE org_id = v_org_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET
      plan_id = p_plan_id,
      current_period_start = v_now,
      current_period_end = v_end,
      updated_at = v_now,
      provider = 'manual_admin'
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.subscriptions (
      org_id, plan_id, status, current_period_start, current_period_end, provider, created_at, updated_at
    )
    VALUES (
      v_org_id, p_plan_id, 'active', v_now, v_end, 'manual_admin', v_now, v_now
    )
    RETURNING id INTO v_sub_id;
  END IF;

  v_ext_ref := 'manual_admin_' || v_org_id::text || '_' || (extract(epoch from v_now)::bigint)::text;

  INSERT INTO public.payments (
    org_id, plan_id, status, amount_minor, currency, external_reference, raw_payload, created_at, paid_at
  )
  VALUES (
    v_org_id,
    p_plan_id,
    'paid',
    v_plan.price_xof,
    'XOF',
    v_ext_ref,
    jsonb_build_object(
      'provider', 'manual_admin',
      'activated_by', v_role,
      'duration_days', p_duration_days
    ),
    v_now,
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Abonnement activé avec succès',
    'org_id', v_org_id,
    'subscription', jsonb_build_object(
      'id', v_sub_id,
      'plan_id', p_plan_id,
      'current_period_end', v_end
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_activate_subscription(TEXT, INT, UUID, TEXT, UUID, TEXT) TO authenticated;


