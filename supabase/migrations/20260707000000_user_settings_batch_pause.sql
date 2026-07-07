-- Pause anti-spam PAR LOT (en plus du délai aléatoire entre deux SMS).
--
-- Contexte : même avec un délai aléatoire entre chaque SMS, un opérateur
-- (MTN/Orange) peut bloquer une SIM qui envoie en continu. On ajoute donc
-- une pause plus longue, à intervalle régulier (ex. tous les 10 SMS), et
-- dont la durée est elle-même tirée AU HASARD entre un min et un max pour
-- ne pas créer un nouveau motif régulier détectable.
--
-- batch_pause_enabled     = active/désactive la fonctionnalité (défaut: activée)
-- batch_pause_count       = nombre de SMS envoyés avant de déclencher une pause
-- batch_pause_min_seconds = borne basse de la pause aléatoire (secondes)
-- batch_pause_max_seconds = borne haute de la pause aléatoire (secondes)
--                            (<= min => pause fixe égale au min)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS batch_pause_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS batch_pause_count INTEGER NOT NULL DEFAULT 10
    CHECK (batch_pause_count >= 1 AND batch_pause_count <= 500),
  ADD COLUMN IF NOT EXISTS batch_pause_min_seconds INTEGER NOT NULL DEFAULT 20
    CHECK (batch_pause_min_seconds >= 0 AND batch_pause_min_seconds <= 1800),
  ADD COLUMN IF NOT EXISTS batch_pause_max_seconds INTEGER NOT NULL DEFAULT 60
    CHECK (batch_pause_max_seconds >= 0 AND batch_pause_max_seconds <= 1800);

COMMENT ON COLUMN public.user_settings.batch_pause_enabled IS
  'Active la pause anti-spam par lot (toutes les N SMS).';
COMMENT ON COLUMN public.user_settings.batch_pause_count IS
  'Nombre de SMS envoyés avant de déclencher une pause anti-spam.';
COMMENT ON COLUMN public.user_settings.batch_pause_min_seconds IS
  'Borne basse de la pause anti-spam aléatoire (secondes).';
COMMENT ON COLUMN public.user_settings.batch_pause_max_seconds IS
  'Borne haute de la pause anti-spam aléatoire (secondes). <= min => pause fixe.';
