-- =============================================
-- Billing v2: plans mensuels + quota gratuit + limites (devices/SMS)
-- Objectifs:
--  - À l'inscription: plan GRATUIT => 1 appareil + 100 SMS offerts
--  - Abonnements mensuels:
--      * 1 appareil: 9 900 XOF / mois (SMS illimités)
--      * 3 appareils: 15 900 XOF / mois (SMS illimités)
--      * 5 appareils: 22 900 XOF / mois (SMS illimités)
--  - Les limites doivent être appliquées côté DB (triggers), y compris service role
-- =============================================

-- 1) Étendre la table plans pour stocker l'offre/fonctionnalités
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS highlight BOOLEAN NOT NULL DEFAULT false;

-- Convention:
--  - sms_quota_month = 0 => illimité
--  - sms_quota_month > 0 => quota mensuel (mois calendaire en cours)

-- 2) Upsert des plans
INSERT INTO public.plans (id, name, price_xof, sms_quota_month, max_devices, rate_limit_per_min, features, highlight)
VALUES
  (
    'free',
    'Gratuit',
    0,
    100,
    1,
    30,
    '[
      "100 SMS offerts",
      "1 appareil"
    ]'::jsonb,
    false
  ),
  (
    'monthly_1',
    'Mensuel - 1 appareil',
    9900,
    0,
    1,
    180,
    '[
      "Envoyez ou recevez des SMS illimités",
      "Envoi illimité de SMS groupés",
      "Liste Excel ou txt pour l\\u2019envoi de SMS illimités",
      "Messages de relecture automatique illimités",
      "SMS programmés illimités",
      "Marketing SMS bidirectionnel illimité",
      "Intégration de Google Sheets",
      "Plugin SMS WordPress",
      "Appels API",
      "Effectuer l\\u2019intégration",
      "Webhooks",
      "Annulation possible à tout moment",
      "Soutien prioritaire"
    ]'::jsonb,
    true
  ),
  (
    'monthly_3',
    'Mensuel - 3 appareils',
    15900,
    0,
    3,
    240,
    '[
      "Envoyez ou recevez des SMS illimités",
      "Envoi illimité de SMS groupés",
      "Liste Excel ou txt pour l\\u2019envoi de SMS illimités",
      "Messages de relecture automatique illimités",
      "SMS programmés illimités",
      "Marketing SMS bidirectionnel illimité",
      "Intégration de Google Sheets",
      "Plugin SMS WordPress",
      "Appels API",
      "Effectuer l\\u2019intégration",
      "Webhooks",
      "Annulation possible à tout moment",
      "Soutien prioritaire"
    ]'::jsonb,
    false
  ),
  (
    'monthly_5',
    'Mensuel - 5 appareils',
    22900,
    0,
    5,
    300,
    '[
      "Envoyez ou recevez des SMS illimités",
      "Envoi illimité de SMS groupés",
      "Liste Excel ou txt pour l\\u2019envoi de SMS illimités",
      "Messages de relecture automatique illimités",
      "SMS programmés illimités",
      "Marketing SMS bidirectionnel illimité",
      "Intégration de Google Sheets",
      "Plugin SMS WordPress",
      "Appels API",
      "Effectuer l\\u2019intégration",
      "Webhooks",
      "Annulation possible à tout moment",
      "Soutien prioritaire"
    ]'::jsonb,
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_xof = EXCLUDED.price_xof,
  sms_quota_month = EXCLUDED.sms_quota_month,
  max_devices = EXCLUDED.max_devices,
  rate_limit_per_min = EXCLUDED.rate_limit_per_min,
  features = EXCLUDED.features,
  highlight = EXCLUDED.highlight;

-- 2bis) Backfill: pour les organisations existantes sans abonnement actif => activer le plan gratuit
INSERT INTO public.subscriptions (org_id, plan_id, status, current_period_start, current_period_end, provider)
SELECT
  o.id,
  'free',
  'active',
  now(),
  NULL,
  'free'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.org_id = o.id
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR now() <= s.current_period_end)
);

-- 3) Helper: plan effectif d'une org (abonnement actif sinon gratuit)
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_org_id UUID)
RETURNS public.plans
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH active_sub AS (
    SELECT s.plan_id
    FROM public.subscriptions s
    WHERE s.org_id = p_org_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR now() <= s.current_period_end)
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT p.*
  FROM public.plans p
  WHERE p.id = COALESCE((SELECT plan_id FROM active_sub), 'free')
  LIMIT 1;
$$;

-- 4) Auto: à la création d'une organisation => créer un abonnement gratuit actif
CREATE OR REPLACE FUNCTION public.ensure_free_subscription_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si l'org a déjà un abonnement actif (rare), ne rien faire
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.org_id = NEW.id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR now() <= s.current_period_end)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (
    org_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    provider
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    now(),
    NULL,
    'free'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_free_subscription_for_org ON public.organizations;
CREATE TRIGGER trg_ensure_free_subscription_for_org
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.ensure_free_subscription_for_org();

-- 5) Enforcer: limite max_devices (s'applique à tout le monde, y compris service role)
CREATE OR REPLACE FUNCTION public.enforce_max_devices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan public.plans;
  v_current_devices INTEGER;
BEGIN
  v_plan := public.get_effective_plan(NEW.org_id);

  SELECT COUNT(*) INTO v_current_devices
  FROM public.devices d
  WHERE d.org_id = NEW.org_id;

  IF v_current_devices >= v_plan.max_devices THEN
    RAISE EXCEPTION 'Limite d''appareils atteinte (%/%). Passez à un plan supérieur.',
      v_current_devices, v_plan.max_devices
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_devices ON public.devices;
CREATE TRIGGER trg_enforce_max_devices
BEFORE INSERT ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_max_devices();

-- 6) Enforcer: quota SMS mensuel (mois calendaire)
-- Convention: sms_quota_month = 0 => illimité
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

  IF v_quota = 0 THEN
    RETURN NEW; -- illimité
  END IF;

  v_month_start := date_trunc('month', now());

  SELECT COUNT(*) INTO v_used
  FROM public.messages m
  WHERE m.org_id = NEW.org_id
    AND m.created_at >= v_month_start;

  IF v_used >= v_quota THEN
    RAISE EXCEPTION 'Quota SMS atteint (%/%). Souscrivez à un abonnement mensuel pour continuer.',
      v_used, v_quota
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sms_quota ON public.messages;
CREATE TRIGGER trg_enforce_sms_quota
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sms_quota();


