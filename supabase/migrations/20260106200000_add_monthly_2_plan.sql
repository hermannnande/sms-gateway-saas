-- Migration: Ajouter le plan "monthly_2" (2 appareils) pour remplacer "monthly_3"
-- Date: 6 janvier 2026

-- 1. Insérer le nouveau plan "monthly_2"
INSERT INTO public.plans (id, name, price_xof, sms_quota_month, max_devices, rate_limit_per_min, features, highlight, is_visible)
VALUES (
  'monthly_2',
  'Mensuel - 2 appareils',
  15900,
  0, -- SMS illimités
  2,
  120, -- Rate limit: 2 appareils x 60 SMS/min = 120 SMS/min
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
  false,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_xof = EXCLUDED.price_xof,
  sms_quota_month = EXCLUDED.sms_quota_month,
  max_devices = EXCLUDED.max_devices,
  rate_limit_per_min = EXCLUDED.rate_limit_per_min,
  features = EXCLUDED.features,
  highlight = EXCLUDED.highlight,
  is_visible = EXCLUDED.is_visible;

-- 2. Optionnel: Masquer l'ancien plan "monthly_3" (ne pas supprimer pour garder l'historique)
UPDATE public.plans
SET is_visible = false
WHERE id = 'monthly_3';

-- Note: Les abonnements existants sur "monthly_3" restent valides
-- L'admin peut toujours activer manuellement le plan "monthly_3" si besoin

