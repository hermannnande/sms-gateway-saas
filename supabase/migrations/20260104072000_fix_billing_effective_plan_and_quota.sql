-- Fix: get_effective_plan should ignore old/hidden plans
-- Fix: enforce_sms_quota must NOT block bulk campaign inserts; quota is enforced at claim-time.

-- 1) Prefer only visible plans for active subscriptions
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_org_id UUID)
RETURNS public.plans
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH active_sub AS (
    SELECT s.plan_id
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.org_id = p_org_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR now() <= s.current_period_end)
      AND p.is_visible = true
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT p.*
  FROM public.plans p
  WHERE p.id = COALESCE((SELECT plan_id FROM active_sub), 'free')
  LIMIT 1;
$$;

-- Ensure authenticated users can execute (useful for app/web displays)
GRANT EXECUTE ON FUNCTION public.get_effective_plan(UUID) TO authenticated;

-- 2) Keep SMS quota trigger but make it non-blocking for queued inserts.
-- (Campaigns insert many queued rows; blocking would rollback the whole batch.)
CREATE OR REPLACE FUNCTION public.enforce_sms_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan public.plans;
  v_used INTEGER;
  v_quota INTEGER;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_plan := public.get_effective_plan(NEW.org_id);
  v_quota := v_plan.sms_quota_month;

  -- unlimited
  IF v_quota = 0 THEN
    RETURN NEW;
  END IF;

  -- Do not block queued inserts; quota is enforced when claiming messages.
  IF COALESCE(NEW.status, '') <> 'sent' OR NEW.sent_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', now());

  SELECT COUNT(*) INTO v_used
  FROM public.messages m
  WHERE m.org_id = NEW.org_id
    AND m.status = 'sent'
    AND m.sent_at >= v_month_start;

  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'Quota SMS atteint (%/%). Souscrivez à un abonnement mensuel pour continuer.',
      v_used, v_quota
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


