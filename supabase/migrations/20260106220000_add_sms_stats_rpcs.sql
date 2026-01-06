-- Migration: RPCs pour statistiques SMS détaillées (admin)
-- Date: 6 janvier 2026

-- RPC: Statistiques SMS par jour (30 derniers jours)
CREATE OR REPLACE FUNCTION admin_sms_stats_by_day(p_days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_sent BIGINT,
  total_failed BIGINT,
  total_messages BIGINT
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
    DATE(sent_at) as date,
    COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
    COUNT(*) as total_messages
  FROM messages
  WHERE sent_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY DATE(sent_at)
  ORDER BY date DESC;
END;
$$;

-- RPC: Statistiques SMS par mois (12 derniers mois)
CREATE OR REPLACE FUNCTION admin_sms_stats_by_month(p_months INT DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  year INT,
  total_sent BIGINT,
  total_failed BIGINT,
  total_messages BIGINT
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
    TO_CHAR(DATE_TRUNC('month', sent_at), 'Month') as month,
    EXTRACT(YEAR FROM sent_at)::INT as year,
    COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
    COUNT(*) as total_messages
  FROM messages
  WHERE sent_at >= DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::INTERVAL)
  GROUP BY DATE_TRUNC('month', sent_at)
  ORDER BY DATE_TRUNC('month', sent_at) DESC;
END;
$$;

-- RPC: Top organisations par nombre de SMS envoyés
CREATE OR REPLACE FUNCTION admin_top_orgs_by_sms(p_limit INT DEFAULT 10, p_days INT DEFAULT 30)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  total_sent BIGINT,
  total_failed BIGINT,
  success_rate NUMERIC
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
    m.org_id,
    o.name as org_name,
    COUNT(*) FILTER (WHERE m.status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE m.status = 'failed') as total_failed,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE m.status = 'sent')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
      ELSE 0
    END as success_rate
  FROM messages m
  INNER JOIN organizations o ON m.org_id = o.id
  WHERE m.sent_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY m.org_id, o.name
  ORDER BY total_sent DESC
  LIMIT p_limit;
END;
$$;

-- RPC: Statistiques globales (overview)
CREATE OR REPLACE FUNCTION admin_sms_global_stats()
RETURNS TABLE (
  total_messages_all_time BIGINT,
  total_sent_all_time BIGINT,
  total_failed_all_time BIGINT,
  total_today BIGINT,
  total_this_month BIGINT,
  total_last_30_days BIGINT,
  avg_per_day_last_30 NUMERIC
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
    (SELECT COUNT(*) FROM messages) as total_messages_all_time,
    (SELECT COUNT(*) FROM messages WHERE status = 'sent') as total_sent_all_time,
    (SELECT COUNT(*) FROM messages WHERE status = 'failed') as total_failed_all_time,
    (SELECT COUNT(*) FROM messages WHERE DATE(sent_at) = CURRENT_DATE) as total_today,
    (SELECT COUNT(*) FROM messages WHERE DATE_TRUNC('month', sent_at) = DATE_TRUNC('month', CURRENT_DATE)) as total_this_month,
    (SELECT COUNT(*) FROM messages WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days') as total_last_30_days,
    (SELECT ROUND(COUNT(*)::NUMERIC / 30, 2) FROM messages WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days') as avg_per_day_last_30;
END;
$$;

-- Commentaires
COMMENT ON FUNCTION admin_sms_stats_by_day IS 'Statistiques SMS par jour (admin)';
COMMENT ON FUNCTION admin_sms_stats_by_month IS 'Statistiques SMS par mois (admin)';
COMMENT ON FUNCTION admin_top_orgs_by_sms IS 'Top organisations par nombre de SMS (admin)';
COMMENT ON FUNCTION admin_sms_global_stats IS 'Statistiques SMS globales (admin)';

