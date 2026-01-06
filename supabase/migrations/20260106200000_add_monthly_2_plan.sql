-- Migration: Ajouter le plan "monthly_2" (2 appareils) pour remplacer "monthly_3"
-- Date: 6 janvier 2026

-- 1. Insérer le nouveau plan "monthly_2"
INSERT INTO public.plans (id, name, price_xof, sms_quota_month, max_devices, is_active)
VALUES (
  'monthly_2',
  'Plan 2 appareils',
  15900,
  0, -- SMS illimités
  2,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_xof = EXCLUDED.price_xof,
  max_devices = EXCLUDED.max_devices,
  is_active = EXCLUDED.is_active;

-- 2. Optionnel: Désactiver l'ancien plan "monthly_3" (ne pas supprimer pour garder l'historique)
UPDATE public.plans
SET is_active = false
WHERE id = 'monthly_3';

-- Note: Les abonnements existants sur "monthly_3" restent valides
-- L'admin peut toujours activer manually le plan "monthly_3" si besoin

