# 🔐 SAUVEGARDE COMPLÈTE DU PROJET SMS ENVOIE
**Date**: 6 janvier 2026, 03:20 AM  
**Version actuelle**: APK 1.0.1+19, Web déployé sur Vercel  
**Dernier commit**: `6ce8f60` - chore(release): apk 1.0.1+19

---

## 📋 TABLE DES MATIÈRES
1. [Vue d'ensemble du projet](#vue-densemble-du-projet)
2. [Architecture technique](#architecture-technique)
3. [État du déploiement](#état-du-déploiement)
4. [Configurations critiques](#configurations-critiques)
5. [Base de données Supabase](#base-de-données-supabase)
6. [Système d'abonnement](#système-dabonnement)
7. [APK Android](#apk-android)
8. [Flux de travail](#flux-de-travail)
9. [Accès et identifiants](#accès-et-identifiants)
10. [Historique des changements récents](#historique-des-changements-récents)
11. [Points d'attention](#points-dattention)

---

## 🎯 VUE D'ENSEMBLE DU PROJET

**Nom**: SMS Envoie (SMS Gateway SaaS)  
**URL Production**: https://smsenvoie.com  
**Repository Git**: https://github.com/hermannnande/sms-gateway-saas.git

### Description
Plateforme SaaS permettant aux entreprises d'envoyer des SMS en masse via des appareils Android connectés. Le système inclut:
- Dashboard web (Next.js + Supabase)
- Application Android (Flutter)
- Système de campagnes SMS
- Gestion d'abonnements multi-plans
- Panel d'administration super admin
- Système de codes promo

### Utilisateurs types
1. **Clients** : créent des campagnes, gèrent leurs appareils, consultent les stats
2. **Super Admin** : active manuellement les abonnements, génère des codes promo, surveille le système
3. **Appareils Android** : envoient les SMS en arrière-plan via foreground service

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Stack principal
```
Frontend Web:       Next.js 14 (App Router), TypeScript, TailwindCSS
Backend:            Supabase (PostgreSQL, Edge Functions Deno, Auth)
Mobile:             Flutter 3.24.5, Dart 3.5.4
Déploiement Web:    Vercel
APK:                Distribué via web/public/sms-gateway.apk (70.9 MB)
```

### Structure du repository
```
sms-gateway-saas/
├── web/                          # Next.js App (Frontend + API Routes)
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/        # Dashboard client
│   │   │   ├── admin/            # Panel admin (activate, promo-codes, users, orgs...)
│   │   │   ├── auth/             # Login, Register
│   │   │   ├── billing/          # Plans, thank-you pages
│   │   │   └── api/              # API Routes (Next.js)
│   │   │       ├── mobile/       # Endpoints pour Flutter (device-pair, etc.)
│   │   │       └── admin/        # Endpoints admin (activate-subscription, generate-promo-code, find-user, ensure-user-org)
│   │   └── lib/
│   │       ├── supabase/         # Clients Supabase (server, client, service)
│   │       └── admin/            # Guards admin (guard.ts, guard-api.ts)
│   ├── public/
│   │   ├── sms-gateway.apk       # APK publique (70.9 MB)
│   │   └── app/
│   │       └── latest.json       # Version actuelle de l'APK
│   └── .env.local                # Variables d'environnement (GITIGNORED)
│
├── flutter_app/                  # Application Android (Flutter)
│   ├── lib/
│   │   ├── main.dart             # Point d'entrée, UI principale, AppNotifier
│   │   ├── config.dart           # Configuration (API URL, délais SMS)
│   │   └── services/
│   │       ├── device_service.dart           # API device (createDeviceToken, sendHeartbeat, etc.)
│   │       ├── background_sync_service.dart  # Foreground service pour envoi SMS
│   │       └── sms_sender.dart               # Envoi SMS natif (MethodChannel)
│   ├── android/
│   │   ├── app/
│   │   │   ├── build.gradle      # Config build APK, signing
│   │   │   └── src/main/
│   │   │       ├── AndroidManifest.xml  # Permissions, deep links
│   │   │       └── kotlin/       # MainActivity, SmsSender channel
│   │   ├── key.properties        # Passwords keystore (GITIGNORED)
│   │   └── sms-gateway-release.jks  # Keystore de signature (GITIGNORED)
│   └── pubspec.yaml              # Version: 1.0.1+19
│
├── supabase/
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── device_pair/          # Créer un device + device_token
│   │   ├── claim_messages/       # Appareil récupère messages à envoyer
│   │   ├── update_message_status/# Marquer message envoyé/échoué
│   │   ├── heartbeat/            # Check appareil actif, quota, plan
│   │   └── campaign_control/     # Pause/Resume campagne
│   └── migrations/               # Migrations SQL
│       ├── 20250102000000_init_schema.sql
│       ├── 20250105_create_promo_codes.sql
│       ├── 20260106090000_fix_promo_codes_policies.sql
│       ├── 20260106120000_auto_org_per_user.sql
│       └── 20260106150000_admin_activation_rpcs.sql
│
├── DOCS_INDEX_FR.md              # Index de toute la documentation
├── README.md                     # Guide de démarrage rapide
├── PROJECT_SUMMARY.md            # Architecture & workflows détaillés
├── COMPREHENSION_PROJET_COMPLETE.md  # Analyse approfondie
├── DEPLOYMENT_STATUS.md          # État du déploiement
└── SETUP_SUPABASE_CLOUD.md       # Configuration Supabase
```

---

## 🚀 ÉTAT DU DÉPLOIEMENT

### Web (Vercel)
- **URL**: https://smsenvoie.com
- **Statut**: ✅ En ligne
- **Dernier déploiement**: Commit `6ce8f60` (6 janvier 2026)
- **Build**: Next.js production
- **Variables d'environnement Vercel**:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://yxilpnyfegdggpbrcevs.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  SUPABASE_SERVICE_ROLE_KEY=[CONFIDENTIEL - dans Vercel]
  NEXT_PUBLIC_WEB_URL=https://smsenvoie.com
  ```

### APK Android
- **Version actuelle**: `1.0.1+19`
- **URL de téléchargement**: https://smsenvoie.com/app/download?source=update
- **Taille**: 70.9 MB
- **Fichier**: `web/public/sms-gateway.apk`
- **Dernière build**: 6 janvier 2026, 03:16 AM
- **Signature**: Release signée avec `sms-gateway-release.jks`
- **Package ID**: `com.smsgateway.gateway`

### Supabase
- **URL**: https://yxilpnyfegdggpbrcevs.supabase.co
- **Projet**: SMS Gateway SaaS
- **Database**: PostgreSQL (RLS activé)
- **Auth**: Email/Password
- **Edge Functions**: 5 déployées (device_pair, claim_messages, update_message_status, heartbeat, campaign_control)
- **Storage**: Non utilisé actuellement

---

## ⚙️ CONFIGURATIONS CRITIQUES

### 1. Supabase (web/.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://yxilpnyfegdggpbrcevs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWxwbnlmZWdkZ2dwYnJjZXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwNTU3MDgsImV4cCI6MjA0OTYzMTcwOH0.EJtjP-_LaNRk3yREo5fwIMKVHAJy8gfNWaEOMHlM8rk
SUPABASE_SERVICE_ROLE_KEY=[CONFIDENTIEL - NE PAS COMMIT]
NEXT_PUBLIC_WEB_URL=https://smsenvoie.com
```

### 2. Flutter (flutter_app/lib/config.dart)
```dart
class AppConfig {
  static const webApiBaseUrl = 'https://smsenvoie.com';
  static const supabaseUrl = 'https://yxilpnyfegdggpbrcevs.supabase.co';
  static const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  static const smsDelayMs = 2000; // Délai entre chaque SMS
}
```

### 3. Android Signing (flutter_app/android/key.properties)
```properties
storePassword=smsgateway2025
keyPassword=smsgateway2025
keyAlias=smsgateway
storeFile=../sms-gateway-release.jks
```
⚠️ **IMPORTANT**: Ces fichiers sont GITIGNORED pour sécurité.

### 4. Permissions Android (AndroidManifest.xml)
```xml
<!-- SMS & Téléphone -->
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />

<!-- Foreground Service (envoi en arrière-plan) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" />

<!-- Android 13+ -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

---

## 🗄️ BASE DE DONNÉES SUPABASE

### Tables principales

#### 1. `auth.users` (Supabase Auth)
Utilisateurs authentifiés (email/password).

#### 2. `app_users` (public)
Miroir des utilisateurs auth pour accès public (contourne RLS).
```sql
Colonnes clés:
- user_id (UUID, PK, ref auth.users.id)
- email (TEXT)
- org_id (UUID, ref organizations.id) [rempli automatiquement à l'inscription]
- role (TEXT) ['user', 'admin', 'super_admin']
- created_at, updated_at
```

#### 3. `organizations` (public)
Organisations (tenants). Chaque user a sa propre org créée automatiquement à l'inscription.
```sql
Colonnes:
- id (UUID, PK)
- name (TEXT)
- created_at, updated_at
```

#### 4. `org_members` (public)
Lie users aux organisations.
```sql
Colonnes:
- id (UUID, PK)
- org_id (UUID, ref organizations.id)
- user_id (UUID, ref auth.users.id)
- role (TEXT) ['ORG_ADMIN', 'ORG_MEMBER']
- created_at
```

#### 5. `admin_users` (public)
Rôles admin pour le panel admin.
```sql
Colonnes:
- id (UUID, PK)
- user_id (UUID, ref auth.users.id)
- role (TEXT) ['SUPER_ADMIN', 'SUPPORT']
- created_at, updated_at
```

#### 6. `plans` (public)
Plans d'abonnement.
```sql
Plans actuels:
- free: 100 SMS/mois, 1 appareil (par défaut)
- monthly_1: 9 900 F CFA/mois, SMS illimités, 1 appareil
- monthly_3: 15 900 F CFA/mois, SMS illimités, 3 appareils
- monthly_5: 22 900 F CFA/mois, SMS illimités, 5 appareils
```

#### 7. `subscriptions` (public)
Abonnements actifs des organisations.
```sql
Colonnes clés:
- id (UUID, PK)
- org_id (UUID, ref organizations.id)
- plan_id (TEXT, ref plans.id)
- status (TEXT) ['active', 'cancelled', 'expired']
- current_period_start, current_period_end (TIMESTAMPTZ)
- provider (TEXT) ['manual_admin', 'promo_code', ...]
```

#### 8. `payments` (public)
Historique des paiements.
```sql
Colonnes:
- id (UUID, PK)
- org_id (UUID, ref organizations.id)
- plan_id (TEXT, ref plans.id)
- status (TEXT) ['paid', 'pending', 'failed']
- amount_minor (INTEGER) [montant en centimes/minor units]
- currency (TEXT) ['XOF', ...]
- external_reference (TEXT)
- raw_payload (JSONB)
- paid_at (TIMESTAMPTZ)
```

#### 9. `devices` (public)
Appareils Android connectés.
```sql
Colonnes:
- id (UUID, PK)
- org_id (UUID, ref organizations.id)
- device_name (TEXT)
- device_token_hash (TEXT, UNIQUE) [SHA256 du device_token]
- sim_slots (JSONB) [{slot: 0, carrier: "Orange", number: "+225..."}]
- is_active (BOOLEAN)
- last_heartbeat_at (TIMESTAMPTZ)
- created_at, updated_at
```

#### 10. `campaigns` (public)
Campagnes d'envoi SMS.
```sql
Colonnes:
- id (UUID, PK)
- org_id (UUID, ref organizations.id)
- name (TEXT)
- status (TEXT) ['draft', 'running', 'paused', 'completed', 'cancelled']
- sent_count, total_count (INTEGER)
- created_at, updated_at
```

#### 11. `messages` (public)
Messages individuels dans les campagnes.
```sql
Colonnes:
- id (UUID, PK)
- campaign_id (UUID, ref campaigns.id)
- org_id (UUID, ref organizations.id)
- to_phone (TEXT)
- body (TEXT)
- status (TEXT) ['pending', 'claimed', 'sent', 'failed']
- device_id (UUID, ref devices.id) [si claimed/sent]
- sent_at, failed_at (TIMESTAMPTZ)
- error_message (TEXT)
```

#### 12. `promo_codes` (public)
Codes promo générés par admin.
```sql
Colonnes:
- id (UUID, PK)
- code (TEXT, UNIQUE)
- plan_id (TEXT, ref plans.id)
- duration_days (INTEGER) [durée de l'abonnement activé]
- max_uses (INTEGER)
- current_uses (INTEGER)
- expires_at (TIMESTAMPTZ)
- is_active (BOOLEAN)
- notes (TEXT)
- created_by (UUID, ref auth.users.id)
- created_at
```

#### 13. `promo_code_redemptions` (public)
Historique des utilisations de codes promo.
```sql
Colonnes:
- id (UUID, PK)
- promo_code_id (UUID, ref promo_codes.id)
- org_id (UUID, ref organizations.id)
- user_email (TEXT)
- redeemed_at (TIMESTAMPTZ)
- subscription_id (UUID, ref subscriptions.id)
```

### Fonctions RPC importantes (SECURITY DEFINER)

Ces fonctions contournent RLS pour les opérations admin:

1. **`admin_role()`**: Retourne le rôle admin du user actuel ou NULL
2. **`admin_list_users(p_search, p_status, p_page, p_page_size)`**: Liste users (auth.users) avec filtre
3. **`admin_get_user_details(p_user_id)`**: Récupère user + org + subscription + stats
4. **`admin_ensure_user_organization(p_user_id, p_email, p_org_name, p_org_id_to_attach)`**: Crée/attache org à un user
5. **`admin_activate_subscription(p_plan_id, p_duration_days, ...)`**: Active abonnement pour un user/org
6. **`admin_generate_promo_code(...)`**: Génère un code promo
7. **`admin_redeem_promo_code(p_code, p_user_id, p_user_email)`**: Utilise un code promo
8. **`create_org_and_link_user(p_user_id, p_email)`**: Crée org + lie user (utilisée par trigger auto)

### Triggers importants

1. **`trg_on_auth_user_created_ensure_org`** (auth.users AFTER INSERT):
   - Crée automatiquement une organisation et lie le user lors de l'inscription
   - Appelle `create_org_and_link_user()`

### RLS (Row Level Security)

Toutes les tables `public.*` ont RLS activé avec des policies basées sur:
- `auth.uid()` pour l'utilisateur actuel
- `admin_role()` pour les accès admin
- `org_members` pour filtrer par organisation

---

## 💳 SYSTÈME D'ABONNEMENT

### Plans disponibles

| Plan ID     | Nom                | Prix         | SMS/mois  | Appareils | Statut   |
|-------------|--------------------|--------------|-----------|-----------|----------|
| `free`      | Plan Gratuit       | 0 F CFA      | 100       | 1         | Défaut   |
| `monthly_1` | 1 appareil         | 9 900 F CFA  | Illimité  | 1         | Actif    |
| `monthly_3` | 3 appareils        | 15 900 F CFA | Illimité  | 3         | Actif    |
| `monthly_5` | 5 appareils        | 22 900 F CFA | Illimité  | 5         | Actif    |

### Méthodes d'activation

#### 1. **Activation manuelle par Super Admin** (`/admin/activate`)
- Admin recherche user par email via `/api/admin/find-user`
- Admin sélectionne plan + durée (jours)
- Appel RPC `admin_activate_subscription()` via `/api/admin/activate-subscription`
- Si org manquante, création auto + rattachement
- Enregistrement dans `subscriptions` + `payments` (provider: `manual_admin`)

#### 2. **Code promo** (`/dashboard/promo`)
- Admin génère code via `/admin/promo-codes` → `/api/admin/generate-promo-code`
- Client entre code sur `/dashboard/promo`
- Appel RPC `admin_redeem_promo_code()` via `/api/redeem-promo-code`
- Activation automatique + enregistrement dans `promo_code_redemptions`

#### 3. **Thank You Pages** (paiement externe)
- Liens Chariow:
  - 1 appareil: https://coachingexpert.mychariow.shop/prd_7xnd5l/checkout
  - 2 appareils: https://coachingexpert.mychariow.shop/prd_iz04di/checkout
  - 5 appareils: https://coachingexpert.mychariow.shop/prd_oaw9yp/checkout
- Après paiement, redirection vers:
  - `/billing/thank-you/plan-1`
  - `/billing/thank-you/plan-2`
  - `/billing/thank-you/plan-5`
- Client contacte admin WhatsApp (+225 07 78 03 00 75)
- Admin active manuellement via panel admin

### Gestion du quota SMS

1. **Edge Function `heartbeat`**: Retourne quota utilisé + restant
2. **Edge Function `claim_messages`**:
   - Vérifie quota avant de renvoyer messages
   - Si quota atteint (plan gratuit): pause auto des campagnes, retourne `quota_reached: true`
3. **Flutter App**: Affiche barre de progression + alerte si quota atteint
4. **Web Dashboard**: Affiche SMS utilisés / restants + alerte

---

## 📱 APK ANDROID

### Version actuelle: `1.0.1+19`

### Fonctionnalités principales

1. **Authentification**:
   - Inscription / Connexion via Supabase Auth
   - Création auto d'organisation à l'inscription
   - Deep linking: `smsgateway://pair?device_token=...`

2. **Pairing d'appareil**:
   - Scanner QR code (web → app)
   - Lier automatiquement (1 clic) via `/api/mobile/device-pair`
   - Génération de `device_token` sécurisé

3. **Permissions requises**:
   - SMS / Téléphone (envoi SMS, lecture SIM)
   - Notifications (Android 13+)
   - Ignorer optimisation batterie (envoi continu)
   - Dialog avec raccourci vers Paramètres si batterie non autorisée

4. **Envoi SMS**:
   - Foreground Service (`flutter_foreground_task`)
   - Notification persistante avec:
     - Progression en temps réel (ex: "📤 Envoi... • Campagne ABC • ███░░ 45/100 • reste 55")
     - Boutons: Pause, Annuler
   - Claim messages via Edge Function `claim_messages`
   - Envoi natif via MethodChannel Kotlin
   - Update status via Edge Function `update_message_status`
   - Délai configurable entre SMS (2000ms)
   - Gestion du quota (pause si atteint)

5. **Synchronisation**:
   - Bouton "Synchroniser et envoyer" (foreground)
   - Background sync auto (si activé)
   - Verrou anti double-envoi (foreground vs background)
   - Heartbeat régulier pour vérifier état/quota

6. **UI**:
   - Affichage quota SMS (utilisés / restants / barre de progression)
   - Alerte si quota atteint
   - Stats: appareils, campagnes, SMS envoyés
   - Menu: Dashboard, Appareillage, Synchronisation, Admin (super admin uniquement)
   - Bouton "Ouvrir le dashboard web" → lance navigateur externe

7. **Gestion des erreurs**:
   - Vérification permissions SMS/Téléphone avant envoi
   - Vérification SIM (au moins 1 SIM détectée)
   - Messages d'erreur clairs dans notification
   - Arrêt automatique si conditions non remplies

### Build & Release

```bash
# 1. Bump version dans pubspec.yaml
cd flutter_app
flutter pub get

# 2. Build APK release
flutter build apk --release

# 3. APK générée dans:
flutter_app/build/app/outputs/flutter-apk/app-release.apk

# 4. Copier dans web/public/
Copy-Item -Force "build\app\outputs\flutter-apk\app-release.apk" "..\web\public\sms-gateway.apk"

# 5. Mettre à jour latest.json
# Edit web/public/app/latest.json → latestVersion + notes

# 6. Commit & Push
git add flutter_app/pubspec.yaml web/public/app/latest.json web/public/sms-gateway.apk
git commit -m "chore(release): apk X.X.X+XX"
git push origin main
```

---

## 🔄 FLUX DE TRAVAIL

### 1. Inscription client
```
Client → /auth/register
  → Supabase Auth: crée user dans auth.users
  → Trigger auto: crée organization + lie user (org_members)
  → Insère dans app_users (mirror)
  → Redirect → /dashboard
```

### 2. Pairing d'appareil

**Méthode A: QR Code (web → app)**
```
Web: /dashboard → génère QR avec device_token via Edge Function device_pair
App: Scanner QR → extrait device_token → sauvegarde localement
```

**Méthode B: 1 clic (dans app)**
```
App: connecté → bouton "Lier automatiquement"
  → POST /api/mobile/device-pair (avec accessToken)
  → API proxy → Edge Function device_pair
  → Retourne device_token
  → App sauvegarde localement
  → Demande permissions (SMS, Notif, Batterie)
  → Active background sync auto
```

### 3. Campagne SMS (client)
```
Web: /dashboard/campaigns → Créer campagne
  → Upload CSV ou saisie manuelle
  → Parse contacts → insère messages (status: pending)
  → Lance campagne (status: running)
```

### 4. Envoi SMS (appareil)
```
App (background service):
  1. Claim messages (POST Edge Function claim_messages avec device_token)
     → Retourne N messages (pending → claimed)
     → Retourne quota + campagne stats
  2. Pour chaque message:
     - Update notification (progression)
     - Envoi SMS natif (Kotlin MethodChannel)
     - Délai 2000ms
     - Update status (POST Edge Function update_message_status)
     - Update notification (progression)
  3. Si quota atteint: pause campagne + affiche alerte
  4. Boucle toutes les 4 secondes
```

### 5. Activation abonnement (admin)
```
Admin: /admin/activate
  → Recherche user par email (GET /api/admin/find-user via RPC)
  → Affiche infos user + org + subscription actuelle
  → Sélectionne plan + durée
  → POST /api/admin/activate-subscription (RPC admin_activate_subscription)
    → Crée/Update subscription
    → Enregistre payment (provider: manual_admin)
  → Client reçoit notification (optionnel)
```

### 6. Code promo (client)
```
Client: /dashboard/promo
  → Entre code (ex: SMS1-ABC123)
  → POST /api/redeem-promo-code (RPC admin_redeem_promo_code)
    → Valide code (actif, non expiré, usages restants)
    → Active subscription
    → Enregistre redemption
    → Incrémente current_uses
  → Redirect → /dashboard (abonnement actif)
```

---

## 🔑 ACCÈS ET IDENTIFIANTS

### Super Admin (panel admin)
- **URL**: https://smsenvoie.com/admin
- **Email**: [CONFIDENTIEL - fourni séparément]
- **Accès**: Vérifié via RPC `admin_role()` → doit retourner 'SUPER_ADMIN' ou 'SUPPORT'

### Supabase Dashboard
- **URL**: https://supabase.com/dashboard/project/yxilpnyfegdggpbrcevs
- **Accès**: Via compte Supabase lié au projet

### Vercel Dashboard
- **URL**: https://vercel.com/[team]/sms-gateway-saas
- **Accès**: Via compte Vercel propriétaire

### GitHub Repository
- **URL**: https://github.com/hermannnande/sms-gateway-saas
- **Accès**: Private repository

### Keystore Android (pour signer APK)
- **Fichier**: `flutter_app/android/sms-gateway-release.jks`
- **Passwords**: Voir `flutter_app/android/key.properties` (GITIGNORED)
- **⚠️ CRITIQUE**: Sauvegarder ces fichiers hors Git (Dropbox, USB, etc.)

---

## 📝 HISTORIQUE DES CHANGEMENTS RÉCENTS

### Version 1.0.1+19 (6 janvier 2026, 03:20 AM)
**Commit**: `6ce8f60` - chore(release): apk 1.0.1+19

**Changements**:
1. **Fix APK: Bouton "Synchroniser et envoyer" fonctionnel**
   - Ajout flag `_foregroundSendingActive` dans SharedPreferences
   - Background service vérifie ce flag pour éviter double-envoi
   - Notification mise à jour pendant envoi manuel: "⏸️ Envoi manuel en cours..."

2. **Fix APK: Affichage quota illimité**
   - Plans avec `sms_quota_month: 0` affichent "Illimité" au lieu de barre tournante

3. **Fix APK: Vérifications permissions et SIM**
   - Avant envoi: check SMS/Phone permissions + au moins 1 SIM
   - Si manquant: notification claire + arrêt service
   - Empêche "boucle silencieuse" sans envoi

### Version 1.0.1+18 (5 janvier 2026)
**Commit**: `00ed63b` - fix(apk): après connexion, dialog batterie avec bouton direct Paramètres

**Changements**:
1. Dialog avec bouton direct vers Paramètres Android si permission batterie manquante
2. Amélioration UX: demande toutes permissions à la connexion
3. Notification channel `sms_gateway_sending` avec importance DEFAULT
4. Délai entre SMS augmenté à 2000ms pour visibilité progression

### Migrations DB récentes (6 janvier 2026)
1. **`20260106150000_admin_activation_rpcs.sql`**:
   - Création RPCs admin (SECURITY DEFINER) pour contourner RLS
   - `admin_activate_subscription()`, `admin_get_user_details()`, etc.
   - Permet admin panel sans `SUPABASE_SERVICE_ROLE_KEY` exposé

2. **`20260106120000_auto_org_per_user.sql`**:
   - Trigger auto création org lors inscription
   - Fonction `create_org_and_link_user()`
   - Backfill pour users existants sans org

3. **`20260106090000_fix_promo_codes_policies.sql`**:
   - Fix RLS policies promo codes pour utiliser `admin_role()` RPC

4. **`20250105_create_promo_codes.sql`**:
   - Création tables `promo_codes` + `promo_code_redemptions`
   - Policies RLS + indexes

### Fonctionnalités ajoutées récemment
1. **Panel admin complet** (`/admin/activate`, `/admin/promo-codes`, etc.)
2. **Système codes promo** (génération + redemption)
3. **Thank you pages** pour paiements externes (Moneroo)
4. **Création auto organisation** à l'inscription (plus de champ manuel)
5. **Dashboard web accessible depuis APK** (bouton menu)
6. **Affichage quota temps réel** (APK + web)
7. **Auto-pause campagnes** si quota atteint
8. **Progression campagne en temps réel** dans notification APK

---

## ⚠️ POINTS D'ATTENTION

### Sécurité

1. **Ne jamais commit**:
   - `web/.env.local` (contient `SUPABASE_SERVICE_ROLE_KEY`)
   - `flutter_app/android/key.properties`
   - `flutter_app/android/sms-gateway-release.jks`

2. **Variables d'environnement Vercel**:
   - Toujours définir `SUPABASE_SERVICE_ROLE_KEY` dans Vercel dashboard
   - Ne pas exposer dans le code frontend

3. **RLS Supabase**:
   - Toujours actif sur toutes les tables `public.*`
   - Admin bypasse via RPCs `SECURITY DEFINER`
   - Tester policies après chaque migration

4. **Device Token**:
   - Toujours haché (SHA256) avant stockage DB
   - Jamais retourné en clair dans API responses

### Performance

1. **APK size**: 70.9 MB (GitHub warning >50MB)
   - Considérer Git LFS si problème
   - Ou héberger APK sur CDN externe (S3, etc.)

2. **Edge Functions**:
   - Timeout Supabase: 2 minutes max
   - `claim_messages`: limiter à 50-100 messages par call

3. **DB indexes**:
   - `devices.device_token_hash` (unique)
   - `messages.status`, `messages.campaign_id`
   - `campaigns.org_id`, `campaigns.status`
   - Vérifier EXPLAIN ANALYZE si lenteurs

### Maintenance

1. **Migrations Supabase**:
   - Toujours tester en local avec `supabase db reset`
   - Puis `supabase db push` en production
   - Backup DB avant migration critique

2. **APK Release Checklist**:
   - [ ] Bump version `pubspec.yaml`
   - [ ] `flutter build apk --release`
   - [ ] Copy vers `web/public/sms-gateway.apk`
   - [ ] Update `web/public/app/latest.json`
   - [ ] Commit + Push
   - [ ] Vérifier déploiement Vercel
   - [ ] Tester téléchargement APK depuis web

3. **Monitoring**:
   - Supabase Logs (Edge Functions, DB queries)
   - Vercel Analytics (web traffic)
   - Pas de monitoring APK actuellement (Firebase Crashlytics recommandé)

### Bugs connus / Limitations

1. **Paiement Moneroo**:
   - Liens non internationaux (selon user)
   - Webhook non implémenté (activation manuelle requise)

2. **APK auto-update**:
   - Notification in-app si nouvelle version
   - Mais téléchargement + install manuels (pas de Google Play)

3. **Multi-appareil**:
   - Pas de load balancing intelligent entre appareils
   - Messages distribués FIFO (premier device qui claim)

4. **SMS échecs**:
   - Retry non implémenté (message marqué failed définitivement)
   - Pas de logging détaillé des erreurs opérateur

---

## 🔧 COMMANDES UTILES

### Flutter
```bash
# Install dependencies
cd flutter_app
flutter pub get

# Run on device (debug)
flutter run

# Build APK release
flutter build apk --release

# Clean build
flutter clean
```

### Supabase (local)
```bash
# Start local Supabase
cd supabase
supabase start

# Reset DB & apply all migrations
supabase db reset

# Push migrations to production
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > ../web/src/lib/supabase/database.types.ts
```

### Git
```bash
# Status
git status

# Add & Commit
git add .
git commit -m "feat: description"

# Push to main (triggers Vercel deploy)
git push origin main

# View recent commits
git log --oneline -10
```

### Vercel (via CLI - optionnel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd web
vercel --prod
```

---

## 📚 DOCUMENTATION COMPLÈTE

Voir fichiers à la racine du projet:
- **`DOCS_INDEX_FR.md`**: Index de toute la documentation
- **`README.md`**: Guide de démarrage rapide
- **`PROJECT_SUMMARY.md`**: Architecture & workflows détaillés
- **`COMPREHENSION_PROJET_COMPLETE.md`**: Analyse approfondie du système
- **`DEPLOYMENT_STATUS.md`**: État du déploiement
- **`SETUP_SUPABASE_CLOUD.md`**: Configuration Supabase Cloud
- **`DESIGN_SYSTEM.md`**: Guidelines design (si applicable)
- **`web/HOME_DESIGN_CHECKLIST.md`**: Checklist design homepage
- **`flutter_app/README.md`**: Documentation spécifique Flutter

---

## 🎯 PROCHAINES ÉTAPES SUGGÉRÉES

1. **Monitoring & Analytics**:
   - Intégrer Firebase Crashlytics pour APK
   - Setup Sentry ou similar pour web (erreurs JS)
   - Dashboard admin: stats globales (SMS envoyés total, users actifs, etc.)

2. **Webhook Moneroo**:
   - Finaliser intégration webhook auto (si Moneroo le supporte)
   - Ou créer webhook proxy Zapier/Make

3. **UX Améliorations**:
   - Retry automatique des SMS échoués (avec backoff)
   - Load balancing intelligent entre devices d'une même org
   - Notification push (Firebase) pour alertes web → app

4. **Sécurité**:
   - Rate limiting sur API routes (Next.js middleware)
   - CAPTCHA sur inscription (si spam)
   - 2FA pour comptes admin

5. **Scalabilité**:
   - Migrate APK vers CDN (Cloudflare R2, AWS S3)
   - Implement caching (Redis) pour plans, subscriptions
   - DB connection pooling (Supavisor)

---

## 📞 SUPPORT & CONTACT

**WhatsApp Admin**: +225 07 78 03 00 75  
**Email Support**: [À définir]  
**Statut Vercel**: https://vercel.com/status  
**Statut Supabase**: https://status.supabase.com

---

**🔐 FIN DE LA SAUVEGARDE - DOCUMENT CONFIDENTIEL**

*Dernière mise à jour: 6 janvier 2026, 03:20 AM*  
*Généré automatiquement par l'assistant IA*

