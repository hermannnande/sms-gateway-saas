-- Reduction mesuree de la cadence demandee : envois et pauses plus courts,
-- tout en conservant une temporisation aleatoire et le controle manuel.

ALTER TABLE public.user_settings
  ALTER COLUMN message_delay_seconds SET DEFAULT 6,
  ALTER COLUMN message_delay_max_seconds SET DEFAULT 9,
  ALTER COLUMN batch_pause_min_seconds SET DEFAULT 45,
  ALTER COLUMN batch_pause_max_seconds SET DEFAULT 75;

-- Migrer uniquement les paires qui correspondent exactement aux anciens
-- reglages geres par le systeme. Les reglages personnalises restent intacts.
UPDATE public.user_settings
SET
  message_delay_seconds = CASE
    WHEN message_delay_seconds = 8 AND message_delay_max_seconds = 12 THEN 6
    ELSE message_delay_seconds
  END,
  message_delay_max_seconds = CASE
    WHEN message_delay_seconds = 8 AND message_delay_max_seconds = 12 THEN 9
    ELSE message_delay_max_seconds
  END,
  batch_pause_min_seconds = CASE
    WHEN batch_pause_min_seconds = 60 AND batch_pause_max_seconds = 120 THEN 45
    ELSE batch_pause_min_seconds
  END,
  batch_pause_max_seconds = CASE
    WHEN batch_pause_min_seconds = 60 AND batch_pause_max_seconds = 120 THEN 75
    ELSE batch_pause_max_seconds
  END,
  updated_at = NOW()
WHERE
  (message_delay_seconds = 8 AND message_delay_max_seconds = 12)
  OR (batch_pause_min_seconds = 60 AND batch_pause_max_seconds = 120);
