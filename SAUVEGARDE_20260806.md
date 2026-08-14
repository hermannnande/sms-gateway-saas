# SAUVEGARDE PROJET SMSenvoie
## Mise a jour : 6 Aout 2026

> Remplace SAUVEGARDE_20260214.md (APK v1.0.9+43 → v1.3.18+65)

---

## 1. INFORMATIONS GENERALES

| Element | Valeur |
|---------|--------|
| Nom du projet | SMSenvoie |
| URL web | https://smsenvoie.com |
| Repository | https://github.com/hermannnande/sms-gateway-saas.git |
| Branche | main |
| Dernier commit | e1d5e2f - feat(api): revocation definitive - annule les campagnes en cours de la cle |
| Total commits | 195 |
| Version APK | 1.3.19+66 |
| Taille APK | ~29 Mo (arm64-v8a) |
| Hebergement web | Vercel |
| Base de donnees | Supabase (PostgreSQL) |
| URL Supabase | https://gamumybcoxxanhjakpde.supabase.co |

---

## 2. STRUCTURE DU PROJET

```
SMS ENVOIE/
├── web/                          # Application Next.js 14 (Vercel) - 121 fichiers source
│   ├── src/app/
│   │   ├── dashboard/            # Pages utilisateur
│   │   │   ├── campaigns/        # Campagnes (create, list, detail, priorite, selection appareil)
│   │   │   ├── contacts/         # Contacts
│   │   │   ├── devices/          # Appareils connectes
│   │   │   ├── inbox/            # Boite de reception + blocage liste noire en 1 clic
│   │   │   ├── messages/         # Messages envoyes (pagination, filtres, recherche)
│   │   │   ├── optouts/          # Liste noire (blacklist)
│   │   │   ├── profile/          # Profil + reglage delai d'envoi SMS
│   │   │   ├── promo/            # Codes promo
│   │   │   └── templates/        # Modeles SMS
│   │   ├── admin/                # Panel administrateur
│   │   │   ├── activate/         # Activation abonnements
│   │   │   ├── activity/         # Activite
│   │   │   ├── devices-stats/    # Stats appareils
│   │   │   ├── events/           # Evenements
│   │   │   ├── orgs/             # Organisations
│   │   │   ├── promo-codes/      # Codes promo
│   │   │   ├── sms-stats/        # Stats SMS
│   │   │   ├── subscriptions/    # Abonnements
│   │   │   ├── traffic/          # Trafic
│   │   │   └── users/            # Utilisateurs
│   │   ├── api/                  # API Routes
│   │   │   ├── admin/            # APIs admin
│   │   │   ├── mobile/           # APIs mobile (7 endpoints)
│   │   │   ├── redeem-promo-code/
│   │   │   ├── webhook/          # Webhook paiement
│   │   │   └── track/            # Tracking
│   │   ├── app/                  # Download APK + pairing
│   │   ├── auth/                 # Login / Register / Logout
│   │   ├── billing/              # Plans + paiement
│   │   └── onboarding/           # Premiere connexion
│   ├── public/app/               # APK (sms-gateway.apk) + latest.json
│   └── vercel.json               # Headers no-cache pour APK
│
├── flutter_app/                  # Application Android (Flutter/Dart) v1.3.18+65
│   ├── lib/
│   │   ├── main.dart             # App principale
│   │   ├── config.dart           # Configuration (URLs Supabase)
│   │   ├── models/               # inbox_message, message, outbox_message
│   │   └── services/             # app_update, auth_session, background_sync,
│   │                             # device_service, sms_sender, token_storage
│   └── android/app/src/main/AndroidManifest.xml
│
├── supabase/
│   ├── migrations/               # 43 fichiers SQL
│   └── functions/                # 9 Edge Functions (Deno) + _shared
│
└── SAUVEGARDE_20260806.md        # Ce fichier
```

---

## 3. NOUVEAUTES DEPUIS LE 14 FEVRIER 2026

### App mobile (v1.0.9+43 → v1.3.18+65)

**Gestion campagnes dans l'app**
- v1.1.0+44 : gestion complete des campagnes depuis le mobile (creation, liste, detail, controle)
- v1.2.0+46 : pagination campagnes + import fichiers (TXT, CSV, Excel) directement dans l'app
- Banner de mise a jour global + fix resolution appareil (fallback via heartbeat Edge Function)

**Fiabilite d'envoi**
- v1.3.0+47 : confirmation reelle d'envoi SMS via PendingIntent (SMS_SENT receiver)
- v1.3.2+49 : retour au fire-and-forget (l'attente 25s bloquait les campagnes)
- Enregistrement des SMS envoyes dans la boite "Envoyes" systeme (visibles dans Messages)
- Correctifs background : envoi automatique continu, enchainement des batchs, auto-resume,
  maintien actif en veille, canal natif SMS sur moteur background
- Supabase : auto-requeue agressif des messages bloques en "sending" a chaque cycle de claim
- Fix `claim_messages_atomic` (ambiguite campaign_id via alias CTE)

**Delai d'envoi configurable**
- v1.3.3+50 / v1.3.4+51 : delai entre SMS configurable depuis le profil web, synchronise
  automatiquement vers l'app (table `user_settings`) + compte a rebours dans la notification

**Multi-SIM / multi-appareils**
- Routage strict de la SIM choisie par campagne (v1.3.7+54, v1.3.14+61)
- Selection de l'appareil avant lancement de campagne (multi-devices) - migration `campaign_device_id`
- v1.3.13+60 : isolation du token appareil par compte (securite multi-comptes)

**Boite de reception (inbox)**
- Activation de la reception des SMS entrants vers la boite de reception web
- Blocage liste noire en 1 clic depuis l'inbox web
- Filtrage blacklist corrige + finalisation auto des campagnes

**Suite anti-spam (v1.3.15 a v1.3.18)** — objectif : eviter le blocage operateur
- v1.3.15+62 : delais d'envoi aleatoires + variantes de message
- v1.3.16+63 : pause aleatoire par lot de SMS
- v1.3.17+64 : variation automatique du texte + delais aleatoires par defaut
- v1.3.18+65 : delai aleatoire TOUJOURS actif par defaut (min → min+3s), meme sans reglage ;
  les anciens delais fixes repassent en aleatoire apres mise a jour

### Backend (28 → 43 migrations)

Nouvelles migrations :
```
20260511000000_mark_optout_messages_function.sql
20260511000001_finalize_campaign_function.sql
20260511000002_claim_messages_atomic_with_optouts.sql
20260511000003_backfill_optouts_and_finalize.sql
20260511000004_backfill_finalize_running_campaigns.sql
20260511010000_fix_claim_messages_ambiguous_column.sql
20260511020000_unstick_sending_messages.sql
20260511030000_create_user_settings_if_missing.sql
20260511030001_user_settings_rls.sql
20260511030002_user_settings_trigger.sql
20260626120000_campaign_device_id.sql
20260703000000_restore_claim_sim_routing.sql
20260703120000_user_settings_delay_max.sql
20260707000000_user_settings_batch_pause.sql
20260806000000_api_keys.sql
20260814140000_campaigns_api_key_id.sql
```

---

## 4. FONCTIONNALITES IMPLEMENTEES (etat actuel)

### Web (Next.js / Vercel)
- Authentification via Supabase Auth
- Dashboard utilisateur temps reel + barre campagne active
- Campagnes SMS (creer, lancer, pause, reprendre, annuler) + priorite (Normale/Haute/Urgente)
- Selection de l'appareil d'envoi avant lancement (multi-devices)
- Import contacts CSV, Excel (XLS/XLSX), TXT avec drag-drop + parsing international (smartParsePhone)
- Templates SMS avec variables
- Appareils (pairing QR code / 1-clic)
- Messages envoyes avec pagination serveur, filtres, recherche
- Boite de reception : SMS entrants + blocage liste noire en 1 clic
- Liste noire (optouts) avec detection STOP automatique
- Profil utilisateur + reglage delai d'envoi SMS (min/max)
- Abonnements et facturation (Payfonte) + codes promo
- Panel admin complet (users, orgs, subscriptions, stats SMS/appareils, events, traffic, activity, activation)
- Telechargement APK avec cache-busting

### Mobile (Flutter / Android)
- Ecran de permissions complet au demarrage
- Authentification + pairing QR code / deep link
- Gestion complete des campagnes dans l'app (creation, import fichiers, controle)
- Envoi SMS en arriere-plan entierement automatique (Foreground Service)
- Confirmation reelle d'envoi (PendingIntent) + sauvegarde dans boite Envoyes systeme
- **Anti-spam integre** : delai aleatoire toujours actif, variation du texte, pause par lot
- File d'attente avec priorite (claim_messages_atomic) + filtrage optouts
- Controle campagne depuis notification (Pause/Reprendre) + compte a rebours
- Detection multi-SIM avec routage strict par campagne
- Isolation du token appareil par compte
- **Connexion permanente (v1.3.19)** : refresh token rote sauvegarde a chaque rotation
  (listener onAuthStateChange + init + refreshActiveCampaign) - fini les deconnexions
- **Redemarrage auto au boot** : BootReceiver flutter_foreground_task relance le service SMS
- Heartbeat + mise a jour auto (latest.json)
- Reception des SMS entrants → boite de reception web

### Backend (Supabase)
- 45 migrations SQL (+ migrations temporaires de test non commitees), 9 Edge Functions (Deno)
- RLS sur toutes les tables (multi-tenant par org_id)
- claim_messages_atomic : SELECT FOR UPDATE SKIP LOCKED + priorite + optouts + routage SIM
- Auto-requeue des messages bloques en "sending"
- Finalisation automatique des campagnes terminees
- Plans d'abonnement avec quotas + user_settings (delais, pause par lot)

---

## 4bis. API PUBLIQUE v1 (ajoutee le 06/08/2026)

Chaque utilisateur peut generer des clefs API pour connecter ses apps/SaaS
(e-commerce, relance client, OTP, notifications) et envoyer des SMS via
son appareil Android.

### Clefs API
- Format : `sk_live_` + 48 chars hex, stockees en hash SHA-256 (jamais en clair)
- Table `api_keys` (RLS) : key_prefix visible, last_used_at, revoked_at
- Gestion : Dashboard → Clefs API (creation, suivi, revocation)
- Routes session : GET/POST `/api/keys`, DELETE `/api/keys/{id}`
- **Revocation immediate et definitive** : verifiee a chaque requete (aucun cache)
  → 401 `invalid_api_key` + **annulation automatique des campagnes en cours
  creees via cette clef** (lien `campaigns.api_key_id`, cascade : campagne
  canceled + jobs canceled + messages en attente marques 'canceled')

### Endpoints publics (auth: `Authorization: Bearer sk_live_...`)

| Route | Description |
|-------|-------------|
| POST /api/v1/sms | Envoyer 1 a 1000 SMS (variantes anti-spam, device_id, sim_slot, priorite) |
| GET /api/v1/sms | Lister les messages (page, limit<=100, status, campaign_id, phone) |
| GET /api/v1/sms/{id} | Statut d'un message |
| GET /api/v1/campaigns | Lister les campagnes |
| GET /api/v1/campaigns/{id} | Detail + stats par statut |
| GET /api/v1/devices | Appareils + statut en ligne |
| GET /api/v1/quota | Plan actif + SMS utilises + quota restant (RPC get_effective_plan) |

- Les envois respectent : quota plan, liste noire STOP, normalisation E.164,
  anti-spam cote appareil (delais aleatoires, pauses par lot, variation texte)
- Documentation publique : https://smsenvoie.com/docs/api

---

## 5. TABLES PRINCIPALES (Supabase)

| Table | Description |
|-------|-------------|
| auth.users | Utilisateurs (Supabase Auth) |
| organizations | Organisations |
| org_members | Membres par organisation |
| devices | Appareils Android (token isole par compte) |
| campaigns | Campagnes SMS (priorite + device_id + sim_slot + api_key_id) |
| campaign_jobs | Jobs de campagne |
| api_keys | Clefs API publiques (hash SHA-256, revocation definitive) |
| templates | Modeles SMS |
| messages | File d'attente SMS |
| inbox_messages | Messages recus |
| optouts | Liste noire |
| plans | Plans d'abonnement |
| subscriptions | Abonnements actifs |
| promo_codes | Codes promotionnels |
| analytics_events | Evenements de tracking |
| user_settings | Parametres (delai min/max SMS, pause par lot) |

---

## 6. APIs MOBILE (7 endpoints)

| Route | Description |
|-------|-------------|
| POST /api/mobile/device-pair | Appairer un appareil |
| POST /api/mobile/heartbeat | Signal de vie (+ quota, fallback resolution appareil) |
| POST /api/mobile/claim-messages | Reclamer des messages a envoyer |
| POST /api/mobile/update-message-status | Mettre a jour le statut d'un message |
| POST /api/mobile/campaign-control | Pause/Resume/Cancel campagne |
| POST /api/mobile/retry-failed | Retenter les messages echoues |
| POST /api/mobile/report-incoming | Signaler un SMS entrant |

---

## 7. HISTORIQUE DES VERSIONS APK

| Version | Build | Description |
|---------|-------|-------------|
| 1.3.19 | 66 | Connexion permanente (refresh token persiste) + redemarrage auto au boot |
| 1.3.18 | 65 | Delai aleatoire toujours actif par defaut |
| 1.3.17 | 64 | Variation auto texte + delais aleatoires par defaut |
| 1.3.16 | 63 | Pause aleatoire par lot de SMS |
| 1.3.15 | 62 | Delais aleatoires + variantes de message (anti-spam) |
| 1.3.14 | 61 | Respect strict SIM choisie par campagne |
| 1.3.13 | 60 | Isolation token appareil par compte |
| 1.3.11 | 58 | Auto-resume envoi sans bouton manuel |
| 1.3.8 | 55 | Envoi maintenu actif en arriere-plan et veille |
| 1.3.7 | 54 | Routage SIM par campagne |
| 1.3.6 | 53 | SMS envoyes visibles dans boite Envoyes systeme |
| 1.3.4 | 51 | Delai SMS configurable depuis profil web + sync app |
| 1.3.0 | 47 | Confirmation reelle d'envoi via PendingIntent |
| 1.2.0 | 46 | Pagination campagnes + import fichiers dans l'app |
| 1.1.0 | 44 | Gestion complete des campagnes dans l'app mobile |
| 1.0.9 | 43 | Ecran permissions complet au demarrage |
| 1.0.8 | 42 | Rebrand SMSenvoie + nouvelle icone |

---

## 8. DERNIERS COMMITS (15 derniers)

```
e1d5e2f feat(api): revocation definitive - annule les campagnes en cours de la cle
e359d20 docs: gestion des cles API (revocation definitive) dans la doc + guide client v1.3.19
d27a392 docs: maj sauvegarde v1.3.19+66
415d6b8 fix(android): connexion permanente + redemarrage auto au boot (v1.3.19+66)
dc5e32f fix(api): utiliser le bon RPC get_effective_plan pour le quota (v1/sms + v1/quota)
0dcac6f fix(migration): utiliser gen_random_uuid() pour api_keys
2655774 feat(api): API publique v1 avec clefs par utilisateur + documentation
6058881 feat(anti-spam): delai aleatoire toujours actif par defaut (v1.3.18+65)
4a2521e feat(anti-spam): variation auto du texte + delais aleatoires par defaut (v1.3.17+64)
b3a9aad feat(anti-spam): pause aleatoire par lot de SMS (v1.3.16+63)
6269e5a feat(anti-spam): delais d'envoi aleatoires + variantes de message (v1.3.15+62)
2601a22 fix(sim): respecter strictement la SIM choisie par campagne (v1.3.14+61)
3a7e529 chore(release): republier APK v1.3.13+60 en arm64 (~29 Mo)
aeb4c40 fix(android): isoler token appareil par compte (v1.3.13+60)
0602f4c feat(campaigns): selection appareil avant lancement campagne multi-devices
```

---

## 9. TECHNOLOGIES

| Composant | Technologie |
|-----------|-------------|
| Web Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Web Hosting | Vercel (deploy auto sur push main) |
| Mobile | Flutter / Dart, Kotlin (MethodChannel) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions Deno) |
| State | Riverpod (Flutter) / React hooks (Web) |
| Phone Parsing | libphonenumber-js |
| Excel Parsing | xlsx (SheetJS) |
| Background Task | flutter_foreground_task |
| Permissions | permission_handler |
| QR Scanner | mobile_scanner |
| Updates | package_info_plus + latest.json |

---

## 10. CONFIGURATION CLE

### Supabase
- URL: `https://gamumybcoxxanhjakpde.supabase.co`
- Anon Key: dans `flutter_app/lib/config.dart` et `web/src/lib/supabase/`

### Vercel
- Projet lie au repo GitHub `hermannnande/sms-gateway-saas`
- Deploiement auto sur push `main` · Domaine: `smsenvoie.com`
- `vercel.json` : no-cache sur `/app/sms-gateway.apk` et `/app/latest.json`

### APK
- Fichier: `web/public/app/sms-gateway.apk`
- Metadata: `web/public/app/latest.json` (latestVersion: 1.3.18+65)
- Split ABI: arm64-v8a (~29 Mo)

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
- Executer les migrations dans l'ordre depuis `supabase/migrations/` (43 fichiers)
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
