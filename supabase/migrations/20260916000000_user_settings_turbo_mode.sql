-- Mode turbo : envoi sans aucune regulation de cadence.
--
-- Contexte : certains utilisateurs (SIM professionnelle, tests, envois internes)
-- veulent enchainer les SMS le plus vite possible. On ne peut pas simplement
-- descendre message_delay_seconds a 1 : l'application mobile applique un plancher
-- de 5000 ms sur ce reglage, la valeur serait silencieusement remontee a 5 s et la
-- fonctionnalite n'aurait aucun effet visible. D'ou un booleen dedie.
--
-- Quand turbo_mode_enabled vaut TRUE, l'app envoie un SMS par seconde, sans tirage
-- aleatoire et sans pause de lot. Les colonnes de cadence existantes
-- (message_delay_seconds, message_delay_max_seconds, batch_pause_*) sont
-- volontairement conservees telles quelles : desactiver le turbo restaure les
-- reglages personnels de l'utilisateur sans migration ni perte de donnees.
--
-- AVERTISSEMENT pour les prochaines migrations : le depot contient deja trois
-- migrations qui font un UPDATE global pour reduire la cadence par defaut
-- (20260815170000, 20260816090000, 20260816223000). Toute nouvelle migration du
-- meme genre DOIT exclure les lignes ou turbo_mode_enabled IS TRUE, sinon elle
-- re-cadencerait silencieusement un utilisateur en mode turbo.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS turbo_mode_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.turbo_mode_enabled IS
  'TRUE => envoi turbo : 1 SMS par seconde, sans delai aleatoire ni pause de lot. Les autres colonnes de cadence sont preservees, desactiver le turbo les restaure telles quelles.';
