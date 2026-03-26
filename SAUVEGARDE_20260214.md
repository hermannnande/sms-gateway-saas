# SAUVEGARDE PROJET SMSenvoie
## Mise a jour : 14 Fevrier 2026

---

## 1. INFORMATIONS GENERALES

| Element | Valeur |
|---------|--------|
| Nom du projet | SMSenvoie |
| URL web | https://smsenvoie.com |
| Repository | https://github.com/hermannnande/sms-gateway-saas.git |
| Branche | main |
| Dernier commit | 37c1b59 - v1.0.9+43: Add full permissions onboarding page at startup |
| Total commits | 156 |
| Version APK | 1.0.9+43 |
| Hebergement web | Vercel |
| Base de donnees | Supabase (PostgreSQL) |
| URL Supabase | https://gamumybcoxxanhjakpde.supabase.co |

---

## 2. STRUCTURE DU PROJET

```
SMS ENVOIE/
├── web/                          # Application Next.js 14 (Vercel)
│   ├── src/app/                  # 119 fichiers source
│   │   ├── dashboard/            # Pages utilisateur
│   │   │   ├── campaigns/        # Campagnes (create, list, detail, priorite)
│   │   │   ├── contacts/         # Contacts
│   │   │   ├── devices/          # Appareils connectes
│   │   │   ├── inbox/            # Boite de reception
│   │   │   ├── messages/         # Messages envoyes (pagination, filtres, recherche)
│   │   │   ├── optouts/          # Liste noire (blacklist)
│   │   │   ├── profile/          # Profil utilisateur
│   │   │   ├── promo/            # Codes promo
│   │   │   └── templates/        # Modeles SMS
│   │   ├── admin/                # Panel administrateur
│   │   │   ├── activate/         # Activation abonnements
│   │   │   ├── devices-stats/    # Stats appareils
│   │   │   ├── events/           # Evenements
│   │   │   ├── orgs/             # Organisations
│   │   │   ├── promo-codes/      # Codes promo
│   │   │   ├── sms-stats/        # Stats SMS
│   │   │   ├── subscriptions/    # Abonnements
│   │   │   ├── traffic/          # Trafic
│   │   │   └── users/            # Utilisateurs
│   │   ├── api/                  # API Routes
│   │   │   ├── admin/            # APIs admin (12 endpoints)
│   │   │   ├── mobile/           # APIs mobile (7 endpoints)
│   │   │   ├── webhook/          # Webhook paiement
│   │   │   └── track/            # Tracking
│   │   ├── app/                  # Download APK + pairing
│   │   ├── auth/                 # Login / Register / Logout
│   │   ├── billing/              # Plans + paiement
│   │   └── onboarding/           # Premiere connexion
│   ├── src/components/           # Composants React reutilisables
│   ├── src/lib/                  # Utilitaires (Supabase client, etc.)
│   ├── public/app/               # APK + latest.json
│   ├── vercel.json               # Headers no-cache pour APK
│   └── next.config.ts            # Config Next.js
│
├── flutter_app/                  # Application Android (Flutter/Dart)
│   ├── lib/
│   │   ├── main.dart             # App principale (~6400 lignes)
│   │   ├── config.dart           # Configuration (URLs Supabase)
│   │   ├── models/
│   │   │   ├── inbox_message.dart
│   │   │   ├── message.dart
│   │   │   └── outbox_message.dart
│   │   └── services/
│   │       ├── app_update_service.dart     # Mise a jour automatique
│   │       ├── auth_session_storage.dart   # Stockage session
│   │       ├── background_sync_service.dart # Service arriere-plan
│   │       ├── device_service.dart         # Communication serveur
│   │       ├── sms_sender.dart             # Envoi SMS natif
│   │       └── token_storage.dart          # Stockage token
│   ├── android/app/src/main/
│   │   └── AndroidManifest.xml   # Permissions Android
│   ├── assets/icon.png           # Icone app
│   └── pubspec.yaml              # Dependencies (v1.0.9+43)
│
├── supabase/                     # Backend Supabase
│   ├── migrations/               # 28 fichiers SQL
│   │   ├── 20240101000000_initial_schema.sql
│   │   ├── 20240101000001_enable_rls.sql
│   │   ├── 20240101000002_claim_function.sql
│   │   ├── 20240101000003_inbox_messages.sql
│   │   ├── 20240131000005_create_user_settings.sql
│   │   ├── 20250105_create_promo_codes.sql
│   │   ├── 20250201000006_campaign_queue.sql
│   │   ├── 20251231010000_fix_org_members_rls_recursion.sql
│   │   ├── 20251231020000_add_devices_delete_policy.sql
│   │   ├── 20260104010000_campaign_sim_slot.sql
│   │   ├── 20260104020000_fix_inbox_messages_rls.sql
│   │   ├── 20260104030000_billing_plans_limits.sql
│   │   ├── 20260104050000_admin_analytics.sql
│   │   ├── 20260104060000_add_first_admin.sql
│   │   ├── 20260104061000_admin_rpc.sql
│   │   ├── 20260104062000_admin_lists_rpc.sql
│   │   ├── 20260104063000_fix_admin_list_rpcs.sql
│   │   ├── 20260104064000_analytics_events_meta_compat.sql
│   │   ├── 20260104072000_fix_billing_effective_plan_and_quota.sql
│   │   ├── 20260104073000_expire_hidden_subscriptions.sql
│   │   ├── 20260106090000_fix_promo_codes_policies.sql
│   │   ├── 20260106120000_auto_org_per_user.sql
│   │   ├── 20260106150000_admin_activation_rpcs.sql
│   │   ├── 20260106200000_add_monthly_2_plan.sql
│   │   ├── 20260106210000_add_android_id_to_devices.sql
│   │   ├── 20260106220000_add_sms_stats_rpcs.sql
│   │   ├── 20260106230000_add_device_geo_and_stats.sql
│   │   ├── 20260325000000_campaign_priority.sql
│   │   └── 20260325010000_optouts_delete_policy.sql
│   └── functions/                # 9 Edge Functions (Deno)
│       ├── billing_create_checkout/
│       ├── billing_verify/
│       ├── billing_webhook/
│       ├── campaign_control/
│       ├── claim_messages/
│       ├── device_pair/
│       ├── device_update_sim/
│       ├── heartbeat/
│       ├── update_message_status/
│       └── _shared/
│
└── SAUVEGARDE_20260214.md        # Ce fichier
```

---

## 3. FONCTIONNALITES IMPLEMENTEES

### Web (Next.js 14 / Vercel)
- Authentification (login/register/logout) via Supabase Auth
- Dashboard utilisateur avec statistiques en temps reel
- Gestion des campagnes SMS (creer, lancer, pause, reprendre, annuler)
- Priorite des campagnes (Normale / Haute / Urgente)
- Import de contacts depuis CSV, Excel (XLS/XLSX), TXT avec drag-drop
- Parsing intelligent des numeros internationaux (smartParsePhone)
- Templates SMS avec variables
- Gestion des appareils (pairing via QR code)
- Messages envoyes avec pagination serveur, filtres, recherche
- Boite de reception
- Liste noire (optouts) avec gestion STOP
- Profil utilisateur
- Systeme d'abonnement et facturation
- Codes promotionnels
- Panel administrateur complet (users, orgs, stats, events, traffic)
- Telechargement APK avec cache-busting (vercel.json)

### Mobile (Flutter / Android)
- Ecran de permissions complet au demarrage (SMS, Telephone, Notifications, Batterie)
- Authentification (email/password + QR session)
- Pairing appareil via QR code ou lien deep link
- Envoi SMS en arriere-plan (Foreground Service)
- File d'attente SMS avec priorite (claim_messages_atomic)
- Controle campagne depuis notification (Pause/Reprendre/Annuler)
- Tableau de bord avec messages en attente, envoyes, filtres
- Detection multi-SIM avec routage par campagne
- Heartbeat pour garder l'appareil en ligne
- Mise a jour automatique de l'app (latest.json)
- Historique des messages envoyes avec pagination
- Gestion quota/abonnement
- Nom: SMSenvoie, icone personnalisee

### Backend (Supabase)
- 28 migrations SQL
- 9 Edge Functions (Deno)
- Row Level Security (RLS) sur toutes les tables
- claim_messages_atomic avec SELECT FOR UPDATE SKIP LOCKED + priorite
- Systeme d'organisations multi-utilisateurs
- Plans d'abonnement avec quotas
- Analytics et tracking

---

## 4. TABLES PRINCIPALES (Supabase)

| Table | Description |
|-------|-------------|
| auth.users | Utilisateurs (Supabase Auth) |
| organizations | Organisations |
| org_members | Membres par organisation |
| devices | Appareils Android connectes |
| campaigns | Campagnes SMS (avec priorite) |
| campaign_jobs | Jobs de campagne |
| templates | Modeles SMS |
| messages | File d'attente SMS |
| inbox_messages | Messages recus |
| optouts | Liste noire (numeros bloques) |
| plans | Plans d'abonnement |
| subscriptions | Abonnements actifs |
| promo_codes | Codes promotionnels |
| analytics_events | Evenements de tracking |
| user_settings | Parametres utilisateur |

---

## 5. APIs MOBILE (7 endpoints)

| Route | Description |
|-------|-------------|
| POST /api/mobile/device-pair | Appairer un appareil |
| POST /api/mobile/heartbeat | Signal de vie |
| POST /api/mobile/claim-messages | Reclamer des messages a envoyer |
| POST /api/mobile/update-message-status | Mettre a jour le statut d'un message |
| POST /api/mobile/campaign-control | Pause/Resume/Cancel campagne |
| POST /api/mobile/retry-failed | Retenter les messages echoues |
| POST /api/mobile/report-incoming | Signaler un SMS entrant |

---

## 6. PERMISSIONS ANDROID

| Permission | Usage |
|------------|-------|
| INTERNET | Communication serveur |
| SEND_SMS | Envoi des SMS |
| READ_PHONE_STATE | Detection SIM |
| CAMERA | Scanner QR code |
| WAKE_LOCK | Maintenir le service actif |
| POST_NOTIFICATIONS | Notification foreground (Android 13+) |
| FOREGROUND_SERVICE | Service arriere-plan |
| FOREGROUND_SERVICE_DATA_SYNC | Type de service |
| FOREGROUND_SERVICE_REMOTE_MESSAGING | Type de service |
| REQUEST_IGNORE_BATTERY_OPTIMIZATIONS | Eviter la mise en veille |

---

## 7. HISTORIQUE DES VERSIONS APK

| Version | Build | Description |
|---------|-------|-------------|
| 1.0.9 | 43 | Ecran permissions complet au demarrage |
| 1.0.8 | 42 | Rebrand SMSenvoie + nouvelle icone |
| 1.0.7 | 41 | Fix Play Protect (suppression RECEIVE_SMS/READ_SMS) |
| 1.0.6 | 40 | Priorite campagnes + detection STOP |
| 1.0.5 | 39 | Redesign dashboard + page messages |
| 1.0.4 | 38 | Pagination messages + mise a jour auto |

---

## 8. DERNIERS COMMITS (15 derniers)

```
37c1b59 v1.0.9+43: Add full permissions onboarding page at startup
b254048 Fix APK download: add vercel.json no-cache headers and cache-buster redirect
e91574d Bump to v1.0.8+42 - SMSenvoie rebrand with new icon and name
6832312 Add complete project backup documentation - Feb 14 2026
13972ae Rebrand to SMSenvoie: new name, new icon, updated all references
86528c7 Remove RECEIVE_SMS/READ_SMS permissions to fix Play Protect blocking
8108ade Smart international phone parsing: support all country formats
6de10eb Fix file import: use readAsText for CSV/TXT, smart column detection
d841c83 Build APK v1.0.6+40 with STOP detection and priority support
671b080 Add blacklist (liste noire) with STOP auto-detection and full management UI
b6aedc7 Add campaign priority system (normal/high/urgent)
f8f4599 feat: import contacts from CSV, Excel (XLS/XLSX) and TXT
70eabe1 feat: server-side pagination on web Messages page
8f2463f fix: rebuild APK with correct version 1.0.5+39
7ac6147 feat: redesign dashboard + full messages page with filters
```

---

## 9. TECHNOLOGIES

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Web Frontend | Next.js (App Router) | 14 |
| Web Hosting | Vercel | - |
| Mobile | Flutter / Dart | 3.x |
| Mobile Native | Kotlin (MethodChannel) | - |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) | - |
| Edge Functions | Deno (TypeScript) | - |
| State Management | Riverpod (Flutter) / React hooks (Web) | - |
| Phone Parsing | libphonenumber-js | - |
| Excel Parsing | xlsx (SheetJS) | - |
| Background Task | flutter_foreground_task | - |
| Permissions | permission_handler | - |
| QR Scanner | mobile_scanner | - |
| Updates | package_info_plus + latest.json | - |
| Icons | flutter_launcher_icons | - |

---

## 10. CONFIGURATION CLE

### Supabase
- URL: `https://gamumybcoxxanhjakpde.supabase.co`
- Anon Key: dans `flutter_app/lib/config.dart` et `web/src/lib/supabase/`

### Vercel
- Projet lie au repo GitHub `hermannnande/sms-gateway-saas`
- Deploiement auto sur push `main`
- Domaine: `smsenvoie.com`
- `vercel.json` : no-cache sur `/app/sms-gateway.apk` et `/app/latest.json`

### APK
- Fichier: `web/public/app/sms-gateway.apk`
- Metadata: `web/public/app/latest.json`
- Route download: `/app/download` (cache-buster `?v=1.0.9-43`)
- Split ABI: arm64-v8a (~28 MB)

---

## 11. COMMENT RESTAURER

### 1. Cloner le projet
```bash
git clone https://github.com/hermannnande/sms-gateway-saas.git
cd sms-gateway-saas
```

### 2. Web (Next.js)
```bash
cd web
npm install
# Configurer .env.local avec les cles Supabase
npm run dev
```

### 3. Mobile (Flutter)
```bash
cd flutter_app
flutter pub get
flutter run                          # Debug
flutter build apk --release --split-per-abi --android-skip-build-dependency-validation  # Release
```

### 4. Supabase
- Executer les migrations dans l'ordre depuis `supabase/migrations/`
- Deployer les Edge Functions depuis `supabase/functions/`

### 5. Deployer le web
```bash
git push origin main    # Vercel deploie automatiquement
```

### 6. Deployer l'APK
```bash
# Apres build Flutter:
cp flutter_app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk web/public/app/sms-gateway.apk
# Mettre a jour web/public/app/latest.json et web/src/app/app/download/route.ts (APK_VERSION)
git add -A && git commit -m "Deploy new APK vX.X.X" && git push
```
