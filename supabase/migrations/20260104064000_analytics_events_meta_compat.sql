-- Compatibilité: certaines installations ont public.analytics_events.metadata (ancien script),
-- alors que le code/RPC utilisent public.analytics_events.meta.
-- On ajoute meta si absent et on backfill depuis metadata si présent.

DO $$
BEGIN
  -- Ajouter meta si absent
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.analytics_events
      ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- Copier metadata -> meta si metadata existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'metadata'
  ) THEN
    UPDATE public.analytics_events
    SET meta = COALESCE(meta, metadata, '{}'::jsonb)
    WHERE (meta IS NULL OR meta = '{}'::jsonb)
      AND metadata IS NOT NULL;
  END IF;
END $$;


