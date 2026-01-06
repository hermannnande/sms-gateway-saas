-- Migration: Ajouter géolocalisation et statistiques pour les appareils
-- Date: 6 janvier 2026

-- 1. Ajouter colonnes de géolocalisation à devices
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS app_version TEXT;

-- 2. Créer index pour recherches géographiques
CREATE INDEX IF NOT EXISTS idx_devices_country ON public.devices(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_city ON public.devices(city) WHERE city IS NOT NULL;

-- 3. RPC: Statistiques par appareil (nombre de SMS envoyés)
CREATE OR REPLACE FUNCTION admin_device_stats(p_days INT DEFAULT 30)
RETURNS TABLE (
  device_id UUID,
  device_name TEXT,
  org_id UUID,
  org_name TEXT,
  total_sent BIGINT,
  total_failed BIGINT,
  success_rate NUMERIC,
  last_seen_at TIMESTAMPTZ,
  country TEXT,
  city TEXT,
  app_version TEXT,
  status TEXT
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'SUPPORT')
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  SELECT 
    d.id as device_id,
    d.name as device_name,
    d.org_id,
    o.name as org_name,
    COUNT(m.*) FILTER (WHERE m.status = 'sent') as total_sent,
    COUNT(m.*) FILTER (WHERE m.status = 'failed') as total_failed,
    CASE 
      WHEN COUNT(m.*) > 0 
      THEN ROUND((COUNT(m.*) FILTER (WHERE m.status = 'sent')::NUMERIC / COUNT(m.*)::NUMERIC * 100), 2)
      ELSE 0
    END as success_rate,
    d.last_seen_at,
    d.country,
    d.city,
    d.app_version,
    d.status
  FROM devices d
  INNER JOIN organizations o ON d.org_id = o.id
  LEFT JOIN messages m ON m.device_id = d.id AND m.sent_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY d.id, d.name, d.org_id, o.name, d.last_seen_at, d.country, d.city, d.app_version, d.status
  ORDER BY total_sent DESC;
END;
$$;

-- 4. RPC: Statistiques géographiques (appareils par pays)
CREATE OR REPLACE FUNCTION admin_devices_by_country()
RETURNS TABLE (
  country TEXT,
  device_count BIGINT,
  active_devices BIGINT,
  total_sent BIGINT
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'SUPPORT')
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(d.country, 'Inconnu') as country,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'online' OR d.last_seen_at >= NOW() - INTERVAL '24 hours') as active_devices,
    COUNT(m.*) FILTER (WHERE m.status = 'sent' AND m.sent_at >= CURRENT_DATE - INTERVAL '30 days') as total_sent
  FROM devices d
  LEFT JOIN messages m ON m.device_id = d.id
  GROUP BY d.country
  ORDER BY device_count DESC;
END;
$$;

-- 5. RPC: Statistiques globales des appareils
CREATE OR REPLACE FUNCTION admin_devices_global_stats()
RETURNS TABLE (
  total_devices BIGINT,
  active_devices BIGINT,
  online_devices BIGINT,
  devices_with_geo BIGINT,
  unique_countries BIGINT,
  unique_cities BIGINT
) 
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur est admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'SUPPORT')
  ) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM devices) as total_devices,
    (SELECT COUNT(*) FROM devices WHERE last_seen_at >= NOW() - INTERVAL '24 hours') as active_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'online') as online_devices,
    (SELECT COUNT(*) FROM devices WHERE country IS NOT NULL) as devices_with_geo,
    (SELECT COUNT(DISTINCT country) FROM devices WHERE country IS NOT NULL) as unique_countries,
    (SELECT COUNT(DISTINCT city) FROM devices WHERE city IS NOT NULL) as unique_cities;
END;
$$;

-- Commentaires
COMMENT ON COLUMN public.devices.ip_address IS 'Adresse IP du dernier heartbeat';
COMMENT ON COLUMN public.devices.country IS 'Pays de l''appareil (géolocalisé via IP)';
COMMENT ON COLUMN public.devices.city IS 'Ville de l''appareil (géolocalisé via IP)';
COMMENT ON COLUMN public.devices.user_agent IS 'User agent de l''appareil';
COMMENT ON COLUMN public.devices.app_version IS 'Version de l''APK installée';

COMMENT ON FUNCTION admin_device_stats IS 'Statistiques détaillées par appareil (admin)';
COMMENT ON FUNCTION admin_devices_by_country IS 'Répartition géographique des appareils (admin)';
COMMENT ON FUNCTION admin_devices_global_stats IS 'Statistiques globales des appareils (admin)';

