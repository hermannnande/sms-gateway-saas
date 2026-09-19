# Correctif APK 1.3.29+76 — campagne à zéro

## Diagnostic observé

Le 19 septembre 2026 vers 19:50–19:55 UTC, la campagne « zcs » était running,
avec 24 592 destinataires et zéro envoyé, affectée au téléphone « JH ».
Les événements récents de ce téléphone ne contenaient que des heartbeats,
sans récupération de messages. Les lignes consultées restaient queued,
sans appareil affecté ni erreur. Aucun téléphone n'était connecté à ADB.
La notification Android et l'état local du service ne sont pas accessibles ;
la cause exacte sur ce téléphone reste à confirmer après installation.

## Défauts corrigés

- Restaurer un token par compte rétablit aussi le token et le propriétaire
  lus par le service d'arrière-plan. Avant, un token de compte conservé avec
  les clés actives effacées permettait les heartbeats de l'interface mais
  empêchait le démarrage automatique du service.
- « Forcer l'envoi » restaure l'identité active, vérifie les permissions et
  l'état du service, puis propage les erreurs au lieu d'afficher un faux succès.
- Les échecs de démarrage automatique et les erreurs du worker sont affichés
  dans l'application ; les pauses explicites restent respectées.
- Le proxy heartbeat transmet app_version, auparavant supprimé avant l'appel
  de la fonction Supabase, pour permettre le diagnostic des versions installées.

## Validation et livraison

- 13 tests Flutter réussis, dont trois régressions d'appairage/restauration.
- Build APK release réussi pour les trois ABI ; build Next.js réussi.
- Paquet com.smsgateway.gateway, versionName 1.3.29, versionCode arm64 2076.
- APK arm64 : 30 415 624 octets ; SHA256
  414ce5cd8d8777cdc800b71dc2507e2b400fc3e6b1ba6fa7a1c79ba55010578a.
- Publication via main/Vercel ; aucune migration de base nécessaire.
- Aucun message de campagne modifié ou SMS de test envoyé pendant le diagnostic.
  Le rétablissement effectif doit être vérifié sur le téléphone.
