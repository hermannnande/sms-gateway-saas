-- Délai d'envoi ALÉATOIRE (anti-blocage opérateur).
--
-- Contexte : MTN (et Orange) bloquent une SIM grand public qui envoie en rafale
-- à cadence fixe. Pour paraître plus "humain", on veut un délai variable entre
-- deux SMS : un tirage aléatoire entre un minimum et un maximum.
--
-- message_delay_seconds        = borne MINIMALE (déjà existante)
-- message_delay_max_seconds    = borne MAXIMALE (NULL ou <= min => délai fixe,
--                                donc 100% rétro-compatible / facultatif)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS message_delay_max_seconds INTEGER
  CHECK (message_delay_max_seconds IS NULL
         OR (message_delay_max_seconds >= 0 AND message_delay_max_seconds <= 120));

COMMENT ON COLUMN public.user_settings.message_delay_max_seconds IS
  'Borne haute du délai aléatoire entre deux SMS (secondes). NULL ou <= message_delay_seconds => délai fixe.';
