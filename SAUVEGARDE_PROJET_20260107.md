# 📦 SAUVEGARDE COMPLÈTE DU PROJET - 7 janvier 2026

## 🎯 Vue d'ensemble du projet

**Nom** : SMS Gateway SaaS  
**URL Production** : https://smsenvoie.com  
**Description** : Plateforme SaaS permettant aux utilisateurs d'envoyer des SMS en masse via leur smartphone Android connecté. Le système fonctionne avec une application Flutter qui transforme le téléphone en passerelle SMS, connectée à un tableau de bord web pour la gestion des campagnes.

---

## 📊 Architecture technique

### Stack technologique

**Frontend Web** :
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase Client (Auth + Realtime)
- Recharts (graphiques admin)

**Backend** :
- Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- Edge Functions (Deno) pour la logique métier

**Mobile** :
- Flutter 3.x (Dart)
- Android natif (Kotlin) pour les fonctionnalités système
- Foreground Service pour l'envoi en arrière-plan
- MethodChannel pour accéder aux API Android natives

### Architecture des composants

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT WEB (Next.js)                    │
│  - Dashboard utilisateur                                    │
│  - Gestion campagnes                                        │
│  - Admin panel (stats, users, devices, promo codes)        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS + WebSocket (Realtime)
┌──────────────────────▼──────────────────────────────────────┐
│                  SUPABASE BACKEND                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │  PostgreSQL │  │    Auth     │  │   Realtime   │       │
│  │  (Database) │  │   (JWT)     │  │  (WebSocket) │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
│  ┌──────────────────────────────────────────────────┐      │
│  │         Edge Functions (Deno)                    │      │
│  │  - claim_messages  - campaign_control            │      │
│  │  - device_pair     - heartbeat                   │      │
│  └──────────────────────────────────────────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (via proxy smsenvoie.com)
┌──────────────────────▼──────────────────────────────────────┐
│              APPLICATION MOBILE (Flutter)                   │
│  - Connexion utilisateur                                    │
│  - Jumelage appareil (via Android ID)                       │
│  - Envoi SMS foreground/background                          │
│  - Heartbeat toutes les 2 minutes (avec géolocalisation)   │
│  - Notification persistante avec progression                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Schéma de base de données (PostgreSQL)

### Tables principales

#### `organizations`
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Une organisation par utilisateur (créée automatiquement à l'inscription)
- Regroupe les appareils, campagnes, messages d'une entité

#### `organization_users`
```sql
CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('ORG_ADMIN', 'ORG_MEMBER')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);
```
- Lien entre utilisateurs et organisations
- `ORG_ADMIN` : créateur, accès complet
- `ORG_MEMBER` : membre, accès limité

#### `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id TEXT REFERENCES plans(id),
  status TEXT CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- Gère les abonnements des organisations
- Un seul abonnement actif par organisation

#### `plans`
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_xof INT DEFAULT 0,
  sms_quota_month INT DEFAULT 0, -- 0 = illimité
  max_devices INT DEFAULT 1,
  rate_limit_per_min INT DEFAULT 30,
  is_visible BOOLEAN DEFAULT true,
  features JSONB,
  highlight BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Plans disponibles : `free`, `monthly_1`, `monthly_2`, `monthly_5`
- `is_visible=false` cache les anciens plans (mais garde les abonnements actifs)

#### `devices`
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  android_id TEXT, -- Identifiant unique Android (pour réutilisation après réinstall)
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen_at TIMESTAMPTZ,
  ip_address TEXT, -- IP du dernier heartbeat
  country TEXT, -- Pays géolocalisé (via ipapi.co)
  city TEXT, -- Ville géolocalisée (via ipapi.co)
  user_agent TEXT, -- User agent de l'appareil
  app_version TEXT, -- Version APK installée (ex: "1.0.2+31")
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Appareils connectés (téléphones Android)
- `token_hash` : hash SHA-256 du device_token pour authentification
- `android_id` : utilisé pour ré-associer l'appareil après réinstallation
- Géolocalisation automatique via heartbeat

#### `campaigns`
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'paused', 'completed', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```
- Campagnes d'envoi SMS
- Workflow : `draft` → `queued` → `running` → `completed`/`canceled`

#### `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'sent', 'failed')),
  sim_slot INT,
  sent_at TIMESTAMPTZ,
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Messages individuels dans une campagne
- `claimed` : réservé par un appareil (via `claim_messages`)
- `sent` : envoyé avec succès
- `failed` : échec d'envoi

#### `admin_users`
```sql
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('SUPER_ADMIN', 'SUPPORT')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Utilisateurs admin (accès panel admin)
- `SUPER_ADMIN` : tous les droits
- `SUPPORT` : lecture seule

#### `promo_codes`
```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  plan_id TEXT REFERENCES plans(id),
  duration_days INT NOT NULL,
  max_uses INT DEFAULT 1,
  uses_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Codes promotionnels générés par les admins
- Permet d'activer un abonnement sans paiement

#### `promo_code_redemptions`
```sql
CREATE TABLE promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ DEFAULT now()
);
```
- Historique des utilisations de codes promo

---

## 🔐 Sécurité et RLS (Row Level Security)

### Politique générale
- Toutes les tables ont RLS activé (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- Les utilisateurs ne peuvent accéder qu'aux données de leur organisation
- Les Edge Functions utilisent `SUPABASE_SERVICE_ROLE_KEY` pour bypasser RLS
- Les fonctions admin utilisent `SECURITY DEFINER` avec vérification `admin_role()`

### RPC critique pour admin
```sql
CREATE OR REPLACE FUNCTION admin_role()
RETURNS TEXT
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (SELECT role FROM admin_users WHERE user_id = auth.uid());
END;
$$;
```
- Permet de vérifier le rôle admin même avec RLS
- Utilisé dans toutes les fonctions admin (`admin_device_stats`, `admin_sms_stats_by_day`, etc.)

---

## 🚀 Déploiement

### Web (Next.js)
- **Plateforme** : Vercel
- **URL** : https://smsenvoie.com
- **Repo GitHub** : https://github.com/hermannnande/sms-gateway-saas
- **Branch** : `main`
- **Déploiement automatique** : push sur `main` → déploiement Vercel

**Variables d'environnement Vercel** :
```
NEXT_PUBLIC_SUPABASE_URL=https://gamumybcoxxanhjakpde.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (à configurer si besoin)
```

### Supabase (Backend)
- **Project ID** : `gamumybcoxxanhjakpde`
- **Project Ref** : `gamumybcoxxanhjakpde`
- **URL** : `https://gamumybcoxxanhjakpde.supabase.co`
- **Database** : PostgreSQL 15.x (hébergé Supabase Cloud)

**Edge Functions déployées** :
- `claim_messages` : Réserver des messages pour un appareil
- `campaign_control` : Pause/Resume/Cancel campagne
- `device_pair` : Jumeler un appareil
- `heartbeat` : Maintenir l'appareil en ligne + géolocalisation

**Commande déploiement Edge Function** :
```bash
supabase functions deploy <function_name> --project-ref gamumybcoxxanhjakpde --no-verify-jwt
```

### APK (Flutter)
- **Version actuelle** : `1.0.2+31`
- **URL téléchargement** : https://smsenvoie.com/app/smsgateway.apk
- **Metadata** : https://smsenvoie.com/app/latest.json

**Build APK** :
```bash
cd flutter_app
flutter build apk --release
# APK généré : flutter_app/build/app/outputs/flutter-apk/app-release.apk
# Copier vers : web/public/app/smsgateway.apk
```

**Mise à jour APK** :
1. Incrémenter version dans `flutter_app/pubspec.yaml` (ex: `1.0.2+32`)
2. Build APK : `flutter build apk --release`
3. Copier APK : `cp build/app/outputs/flutter-apk/app-release.apk ../web/public/app/smsgateway.apk`
4. Mettre à jour `web/public/app/latest.json` avec nouvelle version + notes
5. Commit + Push → déploiement auto Vercel

---

## 💳 Système d'abonnement et paiement

### Plans disponibles

| Plan | Prix | SMS/mois | Appareils | ID |
|------|------|----------|-----------|-----|
| Gratuit | 0 F CFA | 100 | 1 | `free` |
| Mensuel 1 appareil | 9,900 F CFA | Illimité | 1 | `monthly_1` |
| Mensuel 2 appareils | 15,900 F CFA | Illimité | 2 | `monthly_2` |
| Mensuel 5 appareils | 22,900 F CFA | Illimité | 5 | `monthly_5` |

### Fournisseur de paiement : Chariow

**Liens de paiement directs** :
- 1 appareil : https://coachingexpert.mychariow.shop/prd_7xnd5l/checkout
- 2 appareils : https://coachingexpert.mychariow.shop/prd_iz04di/checkout
- 5 appareils : https://coachingexpert.mychariow.shop/prd_oaw9yp/checkout

**Pages "Merci"** :
- 1 appareil : `/billing/thank-you/plan-1`
- 2 appareils : `/billing/thank-you/plan-2`
- 5 appareils : `/billing/thank-you/plan-5`

### Activation manuelle (Admin)
- **URL** : `/admin/activate`
- Permet aux admins d'activer manuellement un abonnement pour un utilisateur
- Recherche par email, sélection du plan, durée personnalisée

### Codes promo
- **Génération** : `/admin/promo-codes` (admins uniquement)
- **Utilisation** : `/dashboard/promo` (clients)
- Permet d'activer un plan gratuitement avec un code

---

## 📱 Application mobile (Flutter)

### Fonctionnalités principales

1. **Authentification** : Login/Register via Supabase Auth
2. **Jumelage appareil** :
   - Bouton "Connecter cet appareil" (sans QR code)
   - Utilise `Android ID` pour identifier l'appareil de manière unique
   - Réutilise l'appareil existant si déjà connecté (évite erreur "limite atteinte")
3. **Envoi SMS** :
   - Mode manuel : "Synchroniser et envoyer" (foreground)
   - Mode automatique : Background service avec notification persistante
   - Support multi-SIM (SIM 0, SIM 1)
4. **Notification persistante** :
   - Affiche la progression de campagne en temps réel
   - Boutons Pause/Reprendre/Annuler
   - Se cache automatiquement quand campagne terminée/annulée
5. **Heartbeat** :
   - Toutes les 2 minutes quand l'app est ouverte
   - Envoie `app_version` pour tracking
   - Backend géolocalise l'IP automatiquement (pays/ville)
6. **Permissions requises** :
   - `SEND_SMS` : envoyer des SMS
   - `READ_PHONE_STATE` : détecter les SIM
   - `POST_NOTIFICATIONS` : afficher la notification persistante (Android 13+)
   - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` : éviter que l'app soit tuée en arrière-plan

### Architecture technique

**Services principaux** :
- `lib/services/device_service.dart` : Communication avec le backend (via proxy Next.js)
- `lib/services/background_sync_service.dart` : Service foreground pour envoi en arrière-plan
- `lib/services/sms_service.dart` : Envoi SMS natif (via `flutter_sms`)

**Communication Flutter ↔ Android natif** :
- `MethodChannel` pour `getAndroidId` (récupère `Settings.Secure.ANDROID_ID`)
- Fichier Kotlin : `flutter_app/android/app/src/main/kotlin/.../MainActivity.kt`

### Configuration importante

**`flutter_app/lib/config.dart`** :
```dart
static const supabaseUrl = 'https://gamumybcoxxanhjakpde.supabase.co';
static const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
static const webAppUrl = 'https://smsenvoie.com';
static const smsDelayMs = 2000; // Délai entre chaque SMS (2 secondes)
```

**`flutter_app/android/app/src/main/AndroidManifest.xml`** :
```xml
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

---

## 🔄 Workflows principaux

### 1. Inscription et jumelage

```
Utilisateur s'inscrit (web ou app)
  ↓
Organisation créée automatiquement (trigger Supabase)
  ↓
Utilisateur lié comme ORG_ADMIN
  ↓
Abonnement 'free' activé automatiquement
  ↓
Dans l'app : "Connecter cet appareil"
  ↓
Edge Function device_pair :
  - Si android_id existe déjà pour cette org → réutilise le device
  - Sinon → crée nouveau device (vérifie max_devices)
  ↓
device_token stocké localement
  ↓
Background service démarre automatiquement
  ↓
Heartbeat toutes les 2 minutes (géolocalisation)
```

### 2. Création et envoi de campagne

```
Web : Créer campagne
  ↓
Importer fichier Excel (phone_number, message_body)
  ↓
Campagne créée (status: draft)
  ↓
Lancer campagne → status: queued
  ↓
App (background service) :
  - Appel claim_messages toutes les 3 secondes
  - Récupère 10-50 messages (selon quota)
  ↓
Pour chaque message :
  - Envoie SMS via SIM (multi-SIM si dispo)
  - Délai de 2 secondes entre chaque SMS
  - Update notification avec progression (X/Y)
  ↓
Report status au backend (sent/failed)
  ↓
Campagne terminée → status: completed
  ↓
Notification disparaît automatiquement
```

### 3. Contrôle de campagne (Pause/Reprendre/Annuler)

```
Web ou App : Clic sur bouton Pause
  ↓
API /api/mobile/campaign-control
  ↓
Edge Function campaign_control :
  - Authentification via JWT ou device_token (fallback)
  - Update campaign.status → 'paused'
  ↓
Background service détecte pause
  ↓
Notification affiche "En pause" + bouton "Reprendre"
  ↓
Clic Reprendre → status: 'running'
  ↓
Envoi reprend
```

### 4. Géolocalisation automatique

```
App envoie heartbeat (toutes les 2 minutes)
  ↓
Edge Function heartbeat :
  - Extrait IP (CF-Connecting-IP ou X-Forwarded-For)
  - Appel API ipapi.co/{ip}/json/
  - Récupère country_name + city
  ↓
Update devices SET country=..., city=..., ip_address=...
  ↓
Admin panel : Affiche stats par pays/ville en temps réel
```

---

## 🛡️ Panel Admin

### Pages disponibles

#### `/admin` (Dashboard)
- Vue d'ensemble : utilisateurs, organisations, abonnements, revenus

#### `/admin/sms-stats` (Statistiques SMS)
- Graphiques journaliers (30 derniers jours)
- Graphiques mensuels (12 derniers mois)
- Top 10 organisations par SMS envoyés
- Stats globales (total all-time, aujourd'hui, ce mois)

#### `/admin/devices-stats` (Statistiques Appareils)
- Liste tous les appareils avec :
  - Organisation propriétaire
  - 🌍 **Ville + Pays** (géolocalisés)
  - Version APK
  - SMS envoyés (période configurable)
  - Taux de succès
  - Statut (En ligne / Actif / Inactif)
- Répartition géographique par pays
- Stats globales (total, actifs, géolocalisés, pays, villes)

#### `/admin/users` (Utilisateurs)
- Liste des utilisateurs
- 🔑 Modifier mot de passe (bouton modal)
- Voir organisations associées

#### `/admin/orgs` (Organisations)
- Liste des organisations
- Voir membres, appareils, campagnes

#### `/admin/subscriptions` (Abonnements)
- Liste des abonnements actifs/expirés
- Filtre par plan

#### `/admin/activate` (Activer Abonnement)
- Recherche utilisateur par email
- Active manuellement un abonnement (plan + durée)
- Crée automatiquement une organisation si manquante

#### `/admin/promo-codes` (Codes Promo)
- Générer codes promo (plan, durée, max utilisations, expiration)
- Voir historique des codes générés
- Voir utilisations

#### `/admin/traffic` (Trafic)
- Stats de trafic web (à implémenter)

#### `/admin/events` (Événements)
- Logs d'événements système (à implémenter)

### Accès admin

**Ajout manuel dans la table `admin_users`** :
```sql
INSERT INTO admin_users (user_id, role)
VALUES ('uuid-de-l-utilisateur', 'SUPER_ADMIN');
```

**Vérification du rôle** : Via RPC `admin_role()` (SECURITY DEFINER)

---

## 📊 RPCs Supabase (Remote Procedure Calls)

### Admin - Statistiques SMS

#### `admin_sms_stats_by_day(p_days INT DEFAULT 30)`
Retourne les stats SMS par jour (sent, failed, total)

#### `admin_sms_stats_by_month(p_months INT DEFAULT 12)`
Retourne les stats SMS par mois

#### `admin_top_orgs_by_sms(p_limit INT DEFAULT 10, p_days INT DEFAULT 30)`
Retourne les top organisations par nombre de SMS envoyés

#### `admin_sms_global_stats()`
Retourne les stats globales (all-time, today, this month, avg/day)

### Admin - Statistiques Appareils

#### `admin_device_stats(p_days INT DEFAULT 30)`
Retourne la liste des appareils avec stats SMS, géolocalisation, version APK

#### `admin_devices_by_country()`
Retourne la répartition géographique (pays → nombre d'appareils)

#### `admin_devices_global_stats()`
Retourne les stats globales appareils (total, actifs, géolocalisés, pays, villes)

### Admin - Activation

#### `admin_get_user_details(p_email TEXT)`
Recherche un utilisateur par email (org, sub, stats)

#### `admin_ensure_user_organization(p_user_id UUID)`
Crée une organisation pour un utilisateur s'il n'en a pas

#### `admin_activate_subscription(p_org_id UUID, p_plan_id TEXT, p_duration_days INT)`
Active un abonnement manuellement

### Admin - Codes Promo

#### `admin_generate_promo_code(...)`
Génère un code promo

#### `admin_redeem_promo_code(p_code TEXT, p_user_id UUID)`
Utilise un code promo

### Utilitaires

#### `get_effective_plan(p_org_id UUID)`
Retourne le plan effectif d'une organisation (ignore `is_visible=false`)

#### `admin_role()`
Retourne le rôle admin de l'utilisateur connecté (SECURITY DEFINER)

---

## 🔧 Commandes utiles

### Développement local

**Web (Next.js)** :
```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

**Flutter (Android)** :
```bash
cd flutter_app
flutter pub get
flutter run
# Nécessite un émulateur Android ou téléphone connecté
```

### Déploiement

**Web (automatique via GitHub)** :
```bash
git add .
git commit -m "feat: description"
git push origin main
# Déploiement Vercel automatique
```

**Edge Functions** :
```bash
supabase functions deploy claim_messages --project-ref gamumybcoxxanhjakpde --no-verify-jwt
supabase functions deploy campaign_control --project-ref gamumybcoxxanhjakpde --no-verify-jwt
supabase functions deploy device_pair --project-ref gamumybcoxxanhjakpde --no-verify-jwt
supabase functions deploy heartbeat --project-ref gamumybcoxxanhjakpde --no-verify-jwt
```

**APK Flutter** :
```bash
cd flutter_app
# 1. Incrémenter version dans pubspec.yaml (ex: 1.0.2+32)
# 2. Build
flutter build apk --release
# 3. Copier
cp build/app/outputs/flutter-apk/app-release.apk ../web/public/app/smsgateway.apk
# 4. Mettre à jour latest.json
# 5. Commit + Push
```

### Supabase (migrations)

**Exécuter une migration SQL** :
1. Aller sur https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/sql/new
2. Copier le contenu du fichier `.sql`
3. Cliquer "Run" (ou Ctrl+Enter)

**Lister les migrations appliquées** :
```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
```

---

## 📝 Migrations SQL récentes

### `20260106120000_auto_org_per_user.sql`
- Crée automatiquement une organisation à l'inscription
- Trigger sur `auth.users` (INSERT)
- Backfill pour utilisateurs existants sans org

### `20260106150000_admin_activation_rpcs.sql`
- RPCs admin : `admin_get_user_details`, `admin_ensure_user_organization`, `admin_activate_subscription`
- RPCs promo : `admin_generate_promo_code`, `admin_redeem_promo_code`
- Toutes en `SECURITY DEFINER` avec vérification `admin_role()`

### `20260106200000_add_monthly_2_plan.sql`
- Ajout du plan `monthly_2` (2 appareils, 15,900 F CFA)
- Masquage du plan `monthly_3` (`is_visible=false`)

### `20260106210000_add_android_id_to_devices.sql`
- Ajout colonne `android_id` à `devices`
- Index sur `android_id`
- Permet réutilisation appareil après réinstallation

### `20260106220000_add_sms_stats_rpcs.sql`
- RPCs stats SMS : `admin_sms_stats_by_day`, `admin_sms_stats_by_month`, `admin_top_orgs_by_sms`, `admin_sms_global_stats`
- Toutes en `SECURITY DEFINER` avec vérification admin

### `20260106230000_add_device_geo_and_stats.sql`
- Ajout colonnes géolocalisation à `devices` : `ip_address`, `country`, `city`, `user_agent`, `app_version`
- RPCs stats appareils : `admin_device_stats`, `admin_devices_by_country`, `admin_devices_global_stats`
- Index sur `country` et `city`

---

## 🐛 Points d'attention et bugs connus

### ✅ Résolus

1. ~~Notification ne s'affiche pas sur Android 13+~~
   - **Fix** : Ajout permission `POST_NOTIFICATIONS` + demande automatique au jumelage

2. ~~Barre de progression figée sur "Actif (en attente)"~~
   - **Fix** : `onlyAlertOnce=false` + `channelId` changé + update notification avant/après chaque SMS

3. ~~"Erreur serveur (401)" lors de Pause/Annuler dans APK~~
   - **Fix** : Fallback sur `device_token` si JWT expire + refresh automatique du token

4. ~~"Limite d'appareils atteinte" après réinstallation APK~~
   - **Fix** : Utilisation de `android_id` pour réutiliser l'appareil existant au lieu d'en créer un nouveau

5. ~~Organisation manquante pour certains utilisateurs~~
   - **Fix** : Trigger automatique + backfill SQL

6. ~~"Accès refusé" sur admin panel~~
   - **Fix** : RPC `admin_role()` en `SECURITY DEFINER` + vérification dans toutes les fonctions admin

### ⚠️ À surveiller

1. **Géolocalisation** : Dépend d'un service externe gratuit (`ipapi.co`). Limite : ~1000 requêtes/jour. Si dépassé, country/city resteront `NULL` (non-bloquant).

2. **Quota SMS gratuit** : Actuellement 100 SMS/mois pour le plan `free`. Vérifié côté backend uniquement (pas de vérification côté APK avant envoi).

3. **Multi-SIM** : Logique de sélection SIM basique (alterne entre SIM 0 et SIM 1). Pas de détection automatique du meilleur opérateur.

4. **Foreground Service** : Android peut tuer le service en cas de mémoire faible. Permission "Ignore battery optimizations" aide mais n'est pas garantie.

---

## 🔑 Accès et credentials

### Supabase
- **Dashboard** : https://supabase.com/dashboard/project/gamumybcoxxanhjakpde
- **Project Ref** : `gamumybcoxxanhjakpde`
- **Database Password** : (voir paramètres projet Supabase)
- **Anon Key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbXVteWJjb3h4YW5oamFrcGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MTczOTYsImV4cCI6MjA1MTQ5MzM5Nn0.n_LQEbQi1bEVxM8SUpJYm7fEq0n5MqjXBdoLQsqPc_s`
- **Service Role Key** : (secret, ne pas commit) - voir Dashboard Supabase > Settings > API

### Vercel
- **Dashboard** : https://vercel.com
- **Projet** : `sms-gateway-saas`
- **Domain** : `smsenvoie.com`

### GitHub
- **Repo** : https://github.com/hermannnande/sms-gateway-saas
- **Branch principale** : `main`

### Chariow (Paiement)
- **Dashboard** : https://coachingexpert.mychariow.shop/
- **Contact WhatsApp** : +225 0778030075

---

## 📂 Structure du projet

```
sms-gateway-saas/
├── web/                          # Application Next.js
│   ├── src/
│   │   ├── app/                  # App Router (Next.js 14)
│   │   │   ├── dashboard/        # Dashboard utilisateur
│   │   │   ├── admin/            # Panel admin
│   │   │   │   ├── devices-stats/    # Stats appareils + géolocalisation
│   │   │   │   ├── sms-stats/        # Stats SMS (graphiques)
│   │   │   │   ├── users/            # Gestion utilisateurs
│   │   │   │   ├── activate/         # Activation manuelle abonnement
│   │   │   │   └── promo-codes/      # Gestion codes promo
│   │   │   ├── billing/          # Abonnements et paiements
│   │   │   ├── auth/             # Login/Register
│   │   │   └── api/              # API Routes (proxy vers Edge Functions)
│   │   ├── components/           # Composants React réutilisables
│   │   └── lib/                  # Utils (Supabase client, etc.)
│   ├── public/
│   │   └── app/
│   │       ├── smsgateway.apk    # APK Flutter (mise à jour manuelle)
│   │       └── latest.json       # Metadata version APK
│   └── package.json
│
├── flutter_app/                  # Application mobile Flutter
│   ├── lib/
│   │   ├── main.dart             # Point d'entrée + UI principale
│   │   ├── config.dart           # Configuration (URLs, clés)
│   │   └── services/
│   │       ├── device_service.dart         # Communication backend
│   │       ├── background_sync_service.dart # Service foreground
│   │       └── sms_service.dart            # Envoi SMS natif
│   ├── android/
│   │   ├── app/src/main/
│   │   │   ├── AndroidManifest.xml         # Permissions
│   │   │   └── kotlin/.../MainActivity.kt  # Code natif Android
│   │   └── build.gradle
│   └── pubspec.yaml              # Dépendances Flutter + version
│
├── supabase/
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── claim_messages/       # Réserver messages pour appareil
│   │   ├── campaign_control/     # Contrôler campagnes (pause/cancel)
│   │   ├── device_pair/          # Jumeler appareil
│   │   ├── heartbeat/            # Maintenir appareil en ligne + géolocalisation
│   │   └── _shared/              # Utils partagés (cors, crypto, etc.)
│   └── migrations/               # Migrations SQL
│       ├── 20260106120000_auto_org_per_user.sql
│       ├── 20260106150000_admin_activation_rpcs.sql
│       ├── 20260106200000_add_monthly_2_plan.sql
│       ├── 20260106210000_add_android_id_to_devices.sql
│       ├── 20260106220000_add_sms_stats_rpcs.sql
│       └── 20260106230000_add_device_geo_and_stats.sql
│
├── SAUVEGARDE_PROJET_20260107.md # Ce fichier
└── README.md                     # Documentation projet
```

---

## 🚦 Prochaines étapes suggérées

### Court terme (Sprint 1-2 semaines)

1. **Webhook Chariow** : Implémenter un webhook pour activation automatique après paiement Chariow (actuellement manuel via `/admin/activate`)

2. **Export campagnes** : Permettre export Excel des résultats de campagne (phones envoyés/échoués)

3. **Notifications utilisateur** : Notifier par email quand campagne terminée ou quota atteint

4. **Logs événements** : Implémenter `/admin/events` pour voir logs système en temps réel

### Moyen terme (Sprint 1 mois)

1. **Multi-utilisateurs par org** : Permettre à un `ORG_ADMIN` d'inviter des `ORG_MEMBER`

2. **Templates SMS** : Sauvegarder des templates de messages réutilisables

3. **Planification campagnes** : Lancer une campagne à une date/heure précise (cron job)

4. **Statistiques utilisateur** : Dashboard détaillé pour chaque utilisateur (non-admin) avec ses propres stats

### Long terme (Sprint 3+ mois)

1. **Support iOS** : Adapter l'application pour iPhone (plus complexe, restrictions Apple)

2. **API publique** : Exposer une API REST pour intégration tierce (webhooks, envoi SMS programmé)

3. **Internationalisation** : Support multilingue (Anglais, etc.)

4. **Facturation automatique** : Intégration complète avec plateforme de paiement (renouvellement auto, webhooks)

---

## 📞 Support et contact

**Admin principal** : nande (via WhatsApp +225 0778030075)  
**Email support** : support@smsenvoie.com (à configurer)  
**Documentation** : https://smsenvoie.com/docs (à créer)

---

## 📜 Historique des versions majeures

### v1.0.2+31 (7 janvier 2026) - ACTUELLE
✅ **Nouvelles fonctionnalités** :
- 📱 Statistiques appareils avec géolocalisation automatique (pays/ville)
- 📊 Statistiques SMS détaillées (graphiques jour/mois, top orgs)
- 🔑 Modification mot de passe utilisateur (admin)
- 🎟️ Système codes promo complet
- 🌍 Géolocalisation automatique des appareils via heartbeat
- 📍 Utilisation `android_id` pour ré-appairage automatique après réinstallation
- ⚡ Optimisations notification progression (refresh en temps réel)
- 🔧 Fallback `device_token` pour contrôle campagne si JWT expiré

### v1.0.2+30 (6 janvier 2026)
✅ Admin panel activation manuelle abonnements
✅ Auto-création organisation à l'inscription
✅ Fix "Limite d'appareils atteinte" après réinstallation

### v1.0.2+29 (5 janvier 2026)
✅ Barre progression campagne in-app (APK)
✅ Contrôles Pause/Reprendre/Annuler in-app
✅ Auto-refresh campagne web dashboard

### v1.0.2+28 (5 janvier 2026)
✅ Notification persistante avec progression
✅ Boutons Pause/Annuler dans notification
✅ Fix permissions Android 13+

### v1.0.1 (4 janvier 2026)
✅ Jumelage one-click (sans QR code)
✅ Envoi background avec foreground service
✅ Quota SMS avec alertes

---

## ✅ Checklist avant mise en production majeure

- [ ] Tester inscription → jumelage → envoi campagne (flow complet)
- [ ] Vérifier tous les plans (free, monthly_1, monthly_2, monthly_5)
- [ ] Tester activation manuelle admin
- [ ] Tester génération + utilisation code promo
- [ ] Vérifier géolocalisation appareils (attendre 2-3 heartbeats)
- [ ] Tester contrôle campagne (pause/reprendre/annuler) web + app
- [ ] Vérifier notification Android (progression, boutons)
- [ ] Tester réinstallation APK (doit réutiliser appareil existant)
- [ ] Vérifier stats admin (SMS + appareils)
- [ ] Vérifier RLS (utilisateur ne peut voir que ses données)
- [ ] Backup base de données Supabase
- [ ] Vérifier variables d'environnement Vercel

---

**🎉 Fin de la sauvegarde complète - Projet fonctionnel et prêt pour production**

**Date de sauvegarde** : 7 janvier 2026  
**Version APK** : 1.0.2+31  
**Version Web** : Déployée sur smsenvoie.com (Vercel)  
**Backend** : Supabase Cloud (stable)

