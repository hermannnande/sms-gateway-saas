-- Migration: Ajouter android_id à devices pour réutiliser un appareil après désinstallation/réinstallation
-- Date: 6 janvier 2026

-- Ajouter la colonne android_id (nullable, car les anciens devices n'en ont pas)
ALTER TABLE public.devices
ADD COLUMN android_id TEXT;

-- Créer un index pour les recherches rapides par android_id + org_id
CREATE INDEX idx_devices_android_id_org_id ON public.devices(android_id, org_id)
WHERE android_id IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN public.devices.android_id IS 'Identifiant unique Android (Android ID). Permet de réutiliser un appareil après désinstallation/réinstallation.';

