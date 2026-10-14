# Priorité des SMS API — 14 octobre 2026

## Fonctionnement

- Tous les SMS créés par `/api/v1/sms` passent avant les campagnes manuelles
  admissibles sur le même téléphone, même une campagne marquée urgente.
  La priorité numérique continue de départager les envois API entre eux.
- Le serveur ne mélange pas une file API active avec une nouvelle réservation
  de campagne. Le téléphone revérifie aussi chaque SMS juste avant l’appel natif,
  pour céder la place si l’API arrive après la réservation d’un lot de 30 SMS.
- Le SMS déjà engagé se termine. Les délais et pauses de cadence configurés
  sont conservés. Les messages non commencés sont remis en file par le mécanisme
  existant de récupération lors de la réservation suivante.
- Après les confirmations d’envoi API, la campagne reprend automatiquement.
  Les accusés de réception ne bloquent pas cette reprise. Les tentatives API
  échouées gardent leur priorité jusqu’à leur succès ou leur échec définitif
  après les trois tentatives existantes.
- L’attente automatique ne modifie pas le statut persistant de la campagne :
  une pause manuelle ou une annulation n’est jamais effacée par la reprise.
- Le routage appareil/SIM, les organisations, les numéros STOP, les quotas,
  les compteurs d’envoi et les accusés de réception sont conservés.
- Une erreur du contrôle de priorité suspend l’envoi ; elle n’est jamais
  comptabilisée comme une tentative SMS échouée.

## Modifications

- Migration `20261014120000_api_sms_priority.sql` : ordonnanceur de file,
  `has_priority_api_messages` et contrôle `check_sms_dispatch`, réservés au rôle
  serveur. Le dernier contrôle ne modifie aucune ligne.
- Route mobile `/api/mobile/dispatch-check` avec authentification par empreinte
  du jeton appareil et contrôle de propriété du message dans PostgreSQL.
- Contrôle Android avant chaque SMS ; réclamation immédiate après une cession
  de priorité et après un lot API court.
- Documentation `/docs/api` et APK 1.3.32+79, versionCode arm64 2079.

## Vérifications

- 4 scénarios PostgreSQL passent : arrivée API pendant une campagne déjà réservée,
  reprise sans double comptage, échecs/reprises, pauses/annulations, routage,
  optouts et isolation des organisations. Migration réappliquée deux fois.
- Les tests existants des confirmations d’envoi et des accusés passent.
- 11 tests web passent, dont 4 pour le contrôle de priorité et son authentification.
- 33 tests Flutter passent : priorité, erreurs réseau, pauses manuelles,
  démarrage du service, rapports durables, accusés et compteurs.
- Build Next.js et APK release des trois ABI réussis. Analyse Flutter sans erreur,
  diagnostics préexistants ; type-check web : 21 erreurs préexistantes hors des
  fichiers modifiés, comme avant cette intervention.
- Signature APK identique à la version publiée précédente.
- APK arm64 : 30 485 236 octets, SHA-256
  `3954bd6e3393d948ebd73f5af8e3b929ed59bf049b0141f483da79aff73d91be`.
- Aucun SMS réel n’a été envoyé. La validation opérateur nécessite la mise à jour
  du téléphone émetteur et un essai autorisé.

## Déploiement

La migration a été appliquée en production le 14 octobre avec l’accès Supabase
local, avant la publication coordonnée du web et de l’APK.

Appliquer uniquement le manifeste `supabase/releases/api-priority-20261014.json`
avec `node scripts/deploy-reliability.mjs api-priority-20261014.json`, puis publier
le web et l’APK. L’accès Supabase local est valide ; le secret GitHub historique
est invalide. Ne jamais appliquer les migrations `temp_`.

Les anciens clients reçoivent déjà les lots API en priorité au prochain cycle.
Installer 1.3.32 pour interrompre également un lot de campagne déjà chargé.
