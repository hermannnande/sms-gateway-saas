# APK 1.3.30+77 — moteur d'envoi Android

## Cause reproduite sur Android

Après le signalement « toujours pareil » avec 1.3.29 effectivement reçue par
le serveur, reproduction sur un AVD Android 13 isolé, avec l'APK release x86_64
1.3.29. Aucun compte utilisateur réel ni permission SMS ; réseau désactivé.

Le service 701 était isForeground=true et la notification affichait
« Actif (en attente) ». Pourtant, logcat enregistrait à 20:09:39 UTC :

    Could not resolve main entrypoint function.
    Could not run the run main Dart entrypoint.
    Could not create root isolate.
    Could not launch engine with configuration.

Le callback d'entrée statique dans BackgroundSyncService n'était pas résolu
par le lancement AOT du moteur. isRunningService indiquait seulement le
service Android, ce qui empêchait aussi le bouton de réparer cette situation.

Autre crash reproduit : ClassNotFoundException lors de l'instanciation de
com.pravera.flutter_foreground_task.service.BootReceiver. Le plugin 9.2 fournit
RebootReceiver (avec boot et package-replaced), déjà fusionné au manifeste.

## Correctifs

- Point d'entrée Dart au niveau de la bibliothèque, préservé pour AOT.
- Vérification ping/pong du moteur, indépendante des envois en cours. Un moteur
  qui répond n'est pas redémarré ; un ancien callback sans réponse est remplacé.
- Démarrages/réparations simultanés sérialisés ; absence de réponse signalée.
- Retrait du receiver inexistant ; conservation du receiver fourni par le plugin.
- Erreurs visibles sur le dashboard ; un heartbeat réussi ne les masque plus.

Les preuves Android restent dans .verification/android-runtime/ (non versionné).

## Validation

- 62 tests Flutter ciblés réussis, dont santé du moteur, concurrence des
  démarrages, absence de faux succès, permissions et conservation des rapports.
- Build release des trois ABI réussi. Version arm64 1.3.30 / versionCode 2077.
- APK arm64 : 30 415 572 octets ; SHA256
  14de35d8855f6bb74b5130b1f0e9a5f68eb032106c125655f53f9979ce89f168.
- Installation Android 13 par-dessus 1.3.29 sans effacer les données : ancien
  callback réparé en environ 14 secondes après ouverture. Le moteur exécute
  onStart et sa boucle, qui affiche les permissions SMS/Téléphone manquantes
  attendues dans l'environnement de test.
- Passage sur HOME pendant 30 secondes : même processus, service actif,
  aucun redémarrage de moteur ni erreur de point d'entrée.
- Redémarrage complet de l'AVD : BOOT_COMPLETED déclenche le service, moteur
  lancé et permissions manquantes signalées sans ouvrir l'application ; aucun
  crash de receiver ni erreur de point d'entrée. Le téléphone doit être déverrouillé.
- Build Next.js réussi. Émulateur de test arrêté après les vérifications.

Les essais n'envoient aucun SMS réel. Le téléphone JH doit recevoir la mise à
jour et rouvrir l'application pour réparer son ancien callback enregistré.
