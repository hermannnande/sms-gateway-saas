# SMSenvoie — version 1.3.28+75, 19 septembre 2026

## Changements

- Un seul expéditeur Android : l'interface transmet ses commandes au service.
- Service `remoteMessaging`, reprise au boot et après mise à jour, maintien CPU/Wi-Fi,
  démarrages sérialisés et respect d'une désactivation ou pause explicite.
- Sessions complètes persistées pour démarrer hors ligne. Les erreurs réseau ne
  détruisent plus l'appairage. Reconnexion après échec temporaire du SDK ; une
  révocation confirmée exige toujours une nouvelle connexion.
- Heartbeat indépendant pendant les longs lots. Repli réseau progressif jusqu'à
  60 secondes. Vérification du propriétaire avant chaque SMS et consultation des
  pauses/annulations web pendant les attentes. Rapports persistés avant HTTP.
- Archivage privé des originaux CSV/TXT/XLS/XLSX depuis campagnes web, carnet de
  contacts et Android. Plusieurs fichiers possibles pour une campagne Android.
- Historique paginé des archives, téléchargement et suppression. Export CSV
  des données restantes des anciennes campagnes sans fichier original.
- Les campagnes sont préparées en brouillon ; l'envoi démarre après conservation
  des fichiers et insertion de tous les messages.
- RLS des archives : chemin et campagne de la même organisation, taille limitée,
  identité de l'importateur vérifiée ; métadonnées non modifiables par le client.

## Validation locale

- 51 tests Flutter ciblés réussis ; compilation release des trois ABI réussie.
- 14 tests web ciblés réussis ; build Next.js réussi.
- 10 tests PostgreSQL embarqués réussis, dont isolation effective sous le rôle
  authenticated, rejet des campagnes/chemins d'une autre organisation, replay
  des migrations et idempotence des compteurs.
- Export sans session : HTTP 401. Archives sans session : redirection login.
- APK arm64 : versionName 1.3.28, versionCode 2075 ; certificat identique à
  l'ancienne APK (SHA-256 du certificat :
  47fa45994718b3fe178179fa7ef3778d7f59799b18bb2623b061a2e8f9d664a5).
- Analyse Flutter sans erreur, avertissements/dépréciations existants.
- Type-check web : 23 diagnostics préexistants restent hors périmètre ; le build
  utilise encore `ignoreBuildErrors`. Les nouveaux fichiers ne produisent aucun diagnostic.

## Déploiement

La vérification initiale de production confirme la présence de
`report_message_status` et `turbo_mode_enabled`, mais pas `campaign_import_files`.
Le workflow `release-reliability.yml` applique atomiquement les quatre migrations
explicitement listées dans `supabase/releases/reliability-20260919.json`, puis
déploie `update_message_status`. Il réutilise le secret SUPABASE_ACCESS_TOKEN
prévu par le workflow existant. Les migrations temp_ ne sont jamais utilisées.
Vercel publie le web et l'APK depuis main. Le résultat de livraison doit être
vérifié après chaque exécution ; une préparation locale ne prouve pas la livraison.

### Livraison vérifiée le 19 septembre 2026

- Code publié : `57a788655e1d232186fd630c7cecdd42fb2dcbfe`.
- GitHub Actions : https://github.com/hermannnande/sms-gateway-saas/actions/runs/35463444978
  terminé avec succès, migrations et fonction incluses.
- Vercel : état success pour ce commit.
- Manifeste public : 1.3.28+75 ; APK téléchargée : 30 415 620 octets,
  SHA-256 `d17c61f1c28d7a618a7d75699607e190489dcaf7bb9c705e18a29a8596251476`,
  identique au binaire local signé.
- Table d'archives accessible ; bucket `campaign-imports` privé, limite 25 Mio.
- Export CSV public sans session refusé avec HTTP 401.

## Limites et recette sur téléphone

Aucun téléphone n'était connecté à ADB pendant cette intervention. Aucun SMS réel
n'a été envoyé. Installer l'APK en mise à jour, autoriser SMS/Téléphone/Notifications
et l'exemption batterie, puis vérifier une campagne avec écran verrouillé,
coupure réseau/rétablissement, redémarrage et pause/reprise web.
L'arrêt forcé Android et certaines restrictions constructeur nécessitent toujours
une réouverture de l'application. Aucune application ne peut garantir la continuité
après une extinction du téléphone ou une révocation des permissions.
Les fichiers originaux jamais sauvegardés ne peuvent pas être reconstruits ;
l'export CSV contient les destinataires, messages et statuts encore en base.
