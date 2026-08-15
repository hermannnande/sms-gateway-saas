-- Cadence responsable par defaut pour les SMS sortants.
-- Cette configuration limite les rafales mais ne contourne pas les controles
-- operateur : consentement, identification et STOP restent obligatoires.

ALTER TABLE public.user_settings
  ALTER COLUMN message_delay_seconds SET DEFAULT 8,
  ALTER COLUMN message_delay_max_seconds SET DEFAULT 12,
  ALTER COLUMN batch_pause_min_seconds SET DEFAULT 60,
  ALTER COLUMN batch_pause_max_seconds SET DEFAULT 120;

-- Rehausser uniquement les reglages trop rapides. Les reglages deja plus
-- prudents restent inchanges.
UPDATE public.user_settings
SET
  message_delay_seconds = GREATEST(COALESCE(message_delay_seconds, 8), 8),
  message_delay_max_seconds = CASE
    WHEN message_delay_max_seconds IS NULL
      OR message_delay_max_seconds <= GREATEST(COALESCE(message_delay_seconds, 8), 8)
      THEN LEAST(GREATEST(COALESCE(message_delay_seconds, 8), 8) + 4, 120)
    ELSE message_delay_max_seconds
  END,
  batch_pause_min_seconds = GREATEST(COALESCE(batch_pause_min_seconds, 60), 60),
  batch_pause_max_seconds = GREATEST(
    COALESCE(batch_pause_max_seconds, 120),
    GREATEST(COALESCE(batch_pause_min_seconds, 60), 60),
    120
  ),
  updated_at = NOW()
WHERE
  message_delay_seconds IS NULL
  OR message_delay_seconds < 8
  OR message_delay_max_seconds IS NULL
  OR message_delay_max_seconds <= message_delay_seconds
  OR batch_pause_min_seconds IS NULL
  OR batch_pause_min_seconds < 60
  OR batch_pause_max_seconds IS NULL
  OR batch_pause_max_seconds < 120
  OR batch_pause_max_seconds < batch_pause_min_seconds;
