-- Nouvelle reduction mesuree demandee : 5-7 secondes entre SMS et pause
-- de 30-45 secondes. Les reglages personnalises restent inchanges.

ALTER TABLE public.user_settings
  ALTER COLUMN message_delay_seconds SET DEFAULT 5,
  ALTER COLUMN message_delay_max_seconds SET DEFAULT 7,
  ALTER COLUMN batch_pause_min_seconds SET DEFAULT 30,
  ALTER COLUMN batch_pause_max_seconds SET DEFAULT 45;

-- Ne migrer que les anciennes paires par defaut gerees par le systeme.
UPDATE public.user_settings
SET
  message_delay_seconds = CASE
    WHEN message_delay_seconds = 6 AND message_delay_max_seconds = 9 THEN 5
    ELSE message_delay_seconds
  END,
  message_delay_max_seconds = CASE
    WHEN message_delay_seconds = 6 AND message_delay_max_seconds = 9 THEN 7
    ELSE message_delay_max_seconds
  END,
  batch_pause_min_seconds = CASE
    WHEN batch_pause_min_seconds = 45 AND batch_pause_max_seconds = 75 THEN 30
    ELSE batch_pause_min_seconds
  END,
  batch_pause_max_seconds = CASE
    WHEN batch_pause_min_seconds = 45 AND batch_pause_max_seconds = 75 THEN 45
    ELSE batch_pause_max_seconds
  END,
  updated_at = NOW()
WHERE
  (message_delay_seconds = 6 AND message_delay_max_seconds = 9)
  OR (batch_pause_min_seconds = 45 AND batch_pause_max_seconds = 75);
