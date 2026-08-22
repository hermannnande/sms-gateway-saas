-- Suppression sûre, atomique et multi-tenant des SMS encore en attente.
-- Les lignes déjà récupérées par un appareil (status = sending) ne peuvent
-- pas être supprimées, même si une récupération arrive en même temps.

CREATE OR REPLACE FUNCTION public.delete_queued_messages(
  p_org_id UUID,
  p_message_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(deleted_count BIGINT, skipped_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT := 0;
  v_campaign_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1
        FROM public.org_members om
       WHERE om.user_id = auth.uid()
         AND om.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH deleted AS (
    DELETE FROM public.messages m
     WHERE m.org_id = p_org_id
       AND m.status = 'queued'
       AND (p_message_ids IS NULL OR m.id = ANY(p_message_ids))
     RETURNING m.campaign_id
  )
  SELECT
    COUNT(*),
    COALESCE(
      ARRAY_AGG(DISTINCT campaign_id) FILTER (WHERE campaign_id IS NOT NULL),
      ARRAY[]::UUID[]
    )
    INTO v_deleted_count, v_campaign_ids
    FROM deleted;

  -- Le nombre total de chaque campagne doit suivre les messages réellement
  -- conservés. Cela évite qu'une campagne reste éternellement "running"
  -- après une suppression individuelle ou massive.
  IF CARDINALITY(v_campaign_ids) > 0 THEN
    WITH stats AS (
      SELECT
        c.id,
        COUNT(m.id)::INTEGER AS total_count,
        COUNT(m.id) FILTER (WHERE m.status = 'sent')::INTEGER AS sent_count,
        COUNT(m.id) FILTER (
          WHERE m.status IN ('sent', 'failed', 'skipped_optout')
        )::INTEGER AS terminal_count
      FROM public.campaigns c
      LEFT JOIN public.messages m ON m.campaign_id = c.id
      WHERE c.id = ANY(v_campaign_ids)
        AND c.org_id = p_org_id
      GROUP BY c.id
    )
    UPDATE public.campaigns c
       SET total_count = stats.total_count,
           sent_count = stats.sent_count,
           status = CASE
             WHEN c.status IN ('queued', 'running', 'paused')
                  AND stats.total_count = 0 THEN 'canceled'
             WHEN c.status IN ('queued', 'running', 'paused')
                  AND stats.terminal_count >= stats.total_count THEN 'done'
             ELSE c.status
           END,
           updated_at = NOW()
      FROM stats
     WHERE c.id = stats.id;
  END IF;

  RETURN QUERY
  SELECT
    v_deleted_count,
    CASE
      WHEN p_message_ids IS NULL THEN 0::BIGINT
      ELSE GREATEST(CARDINALITY(p_message_ids)::BIGINT - v_deleted_count, 0::BIGINT)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_queued_messages(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_queued_messages(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_queued_messages(UUID, UUID[]) TO service_role;

COMMENT ON FUNCTION public.delete_queued_messages(UUID, UUID[]) IS
  'Supprime atomiquement les SMS queued d une organisation et recalcule leurs campagnes.';
