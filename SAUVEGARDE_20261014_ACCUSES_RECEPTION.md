# Accusés de réception SMS — 14 octobre 2026

## État de livraison

Fonctionnalité implémentée et validée **localement**, non publiée en production.
APK préparée : `RELEASE/SMSenvoie-1.3.31+78-arm64-v8a.apk`.
Compilation avec `--build-name=1.3.31 --build-number=78` ; versionCode arm64 2078.
La signature est identique à celle de l’APK publique existante.
SHA-256 de l’APK finale : `290e5a272005e9409311835bdf14c94b2d71a0f5bc672ab4f7d44344ed87540d`.
Le manifeste, l’APK et `pubspec.yaml` sont alignés localement sur 1.3.31+78,
en attente de publication coordonnée après migration de la base.
Aucun SMS réel n’a été envoyé pendant cette intervention.

## Fonctionnement

- Chaque nouvel envoi de campagne par le service Android demande un accusé
  opérateur pour chacun des segments du SMS. Les anciens SMS ne sont pas suivis
  rétroactivement.
- Le receiver Android explicite, non exporté, décode le PDU de statut. Un simple
  résultat SENT/RESULT_OK ne devient jamais un accusé de réception.
- Un SMS long n’est livré que lorsque tous les segments de la même tentative
  sont confirmés. Les codes provisoires ou inconnus restent en attente.
- Les accusés sont conservés dans SQLite avant toute requête HTTP. Les comptes
  sont isolés par empreinte du jeton appareil ; aucun numéro, texte de SMS ni
  jeton en clair n’est stocké dans cette base.
- Le service synchronise les accusés toutes les dix secondes, indépendamment
  de la boucle d’envoi, y compris pendant une pause ou après la fin d’une campagne.
  Un service désactivé ou un arrêt forcé suspend la synchronisation jusqu’à sa
  reprise. La collecte native peut fonctionner sans moteur Flutter actif.
- Les révisions empêchent la perte d’un accusé reçu pendant une requête HTTP.
  Les rapports non synchronisés sont conservés. Les entrées déjà synchronisées
  âgées de plus de trente jours sont nettoyées lors d’un acquittement.
- L’API authentifie l’appareil, traite au maximum cinquante rapports par requête
  et distingue les rejets définitifs des erreurs temporaires à rejouer.
- La RPC vérifie l’organisation, l’appareil et l’identité de la tentative.
  Les duplications ne doublent pas les comptes. Un ancien échec ou rapport
  provisoire ne remplace pas une livraison confirmée.
- La livraison est indépendante de `messages.status` : ni les quotas, ni les
  tentatives d’envoi, ni la fin de campagne ne sont modifiés par un accusé.

## Affichage

- Liste des campagnes web et Android : nombre de SMS livrés.
- Détail web et Android : livrés / envoyés, pourcentage, accusés en attente,
  non livrés confirmés et envois sans suivi. Rafraîchissement périodique du détail,
  même pour une campagne terminée.
- Web : statut de réception et date de confirmation par destinataire, filtres
  de réception sur la liste des cinquante derniers messages correspondants.
- Les statistiques sont calculées dans PostgreSQL, sans limite de mille lignes
  provenant d’une lecture PostgREST. Le taux est `livrés / envoyés`.
- « Livré » signifie réception confirmée par le réseau, pas lecture. Un accusé
  manquant ne permet pas de conclure que le destinataire n’a rien reçu.

Références Android :
[SmsManager](https://developer.android.com/reference/android/telephony/SmsManager),
[SmsMessage.getStatus](https://developer.android.com/reference/android/telephony/SmsMessage#getStatus()).

## Validation

- 25 tests Flutter ciblés passent : file des accusés, perte réseau, rapports
  concurrents, reprises, confirmations d’envoi et démarrage du service.
- 17 assertions Kotlin passent : GSM/CDMA, multipart, statuts provisoires,
  erreurs, confirmations tardives et conservation d’une livraison confirmée.
- 7 nouveaux tests web passent : authentification, validation, rejets,
  erreurs temporaires, libellés et statistiques.
- 2 suites PostgreSQL embarquées passent : nouvelle migration appliquée deux
  fois, doublons, tentatives multiples, propriété, RLS réelle sous rôle
  authenticated, rapports tardifs, campagnes de plus de mille messages,
  suppression et non-régression des compteurs d’envoi.
- Build Next.js réussi ; compilation APK release des trois ABI réussie.
- Analyse Flutter sans erreur, avertissements/dépréciations préexistants.
- Le type-check web conserve 21 diagnostics dans les fichiers préexistants
  hors de cette modification ; aucun dans les fichiers ajoutés/modifiés.
  Le build du projet ignore toujours les erreurs TypeScript.
- La réception opérateur réelle et la restitution de PDU sur le téléphone
  d’envoi restent à valider avec une petite campagne autorisée.

## Mise en production, dans cet ordre

Déploiement demandé par l’utilisateur le 14 octobre. Le commit de préparation
`559dc7c` est publié ; le workflow 38617930642 a été refusé par Supabase avec
HTTP 401 « Invalid access token ». Aucune migration n’a été appliquée par cette
exécution. Le site existant est toujours déployé avec succès sur Vercel.
Blocage résolu : l’accès Supabase conservé par le CLI dans le gestionnaire
d’identifiants Windows est valide. La migration a été appliquée directement
avec cet accès, sans exposer le jeton, puis les colonnes et le RPC de statistiques
ont été vérifiés en production. Le secret GitHub invalide n’a pas été modifié.
Le commit applicatif `be11ab6` a été publié avec la sauvegarde `3c3222d`.
Vercel confirme le succès de `3c3222d` ; les contrôles publics sur smsenvoie.com
confirment la version 1.3.31+78, la redirection de téléchargement, le rejet HTTP
400 d’un rapport sans données et le téléchargement de l’APK attendue.
APK publique : 30 485 236 octets ; SHA-256
`290e5a272005e9409311835bdf14c94b2d71a0f5bc672ab4f7d44344ed87540d`.
Aucun SMS réel n’a été envoyé pendant ces vérifications. Le test opérateur
nécessite l’installation de la nouvelle APK sur le téléphone émetteur.

1. Appliquer uniquement `supabase/migrations/20261014000000_sms_delivery_receipts.sql`.
   Le manifeste `supabase/releases/delivery-receipts-20261014.json` et le workflow
   manuel `.github/workflows/delivery-receipts.yml` sont préparés. Le script
   existant accepte désormais un manifeste explicite :
   `node scripts/deploy-reliability.mjs delivery-receipts-20261014.json`.
   Il utilise le secret de déploiement existant. Ne pas appliquer les migrations
   historiques `temp_`. Ne pas publier le nouveau web avant la migration.
2. Publier le web contenant l’API `/api/mobile/delivery-reports`. Aucune nouvelle
   Edge Function n’est nécessaire. Les anciens clients Android restent compatibles.
3. Aligner `pubspec.yaml`, `web/public/app/sms-gateway.apk`,
   `web/public/app/latest.json` et la route de téléchargement pour la 1.3.31+78,
   puis publier cette mise à jour.
4. Installer l’APK sur le téléphone émetteur et vérifier un SMS court, un SMS
   long, une réception différée et une coupure Internet suivie d’une reprise.
   Les confirmations dépendent de l’opérateur ; aucune confirmation ne doit être
   inventée pour les opérateurs qui n’en retournent pas.
