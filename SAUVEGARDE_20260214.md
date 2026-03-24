# SAUVEGARDE PROJET SMSenvoie
## Date : 14 Février 2026

---

## 1. INFORMATIONS GENERALES

| Element | Valeur |
|---------|--------|
| Nom du projet | SMSenvoie |
| URL web | https://smsenvoie.com |
| Repository | https://github.com/hermannnande/sms-gateway-saas.git |
| Branche | main |
| Dernier commit | 13972ae - Rebrand to SMSenvoie |
| Total commits | 152 |
| Version APK | 1.0.7+41 |
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
│   │   │   ├── campaigns/        # Campagnes SMS (create, list, detail)
│   │   │   ├── messages/         # Messages avec pagination serveur
│   │   │   ├── contacts/         # Gestion contacts + import CSV/Excel/TXT
│   │   │   ├── templates/        # Templates SMS
│   │   │   ├── devices/          # Appareils appaires
│   │   │   ├── optouts/          # Liste noire (blacklist)
│   │   │   ├── inbox/            # Messages recus
│   │   │   └── profile/          # Profil utilisateur
│   │   ├── admin/                # Panel administrateur
│   │   │   ├── activate/         # Activation abonnements
│   │   │   ├── users/            # Gestion utilisateurs
│   │   │   ├── promo-codes/      # Codes promo
│   │   │   ├── sms-stats/        # Statistiques SMS
│   │   │   └── device-stats/     # Statistiques appareils
│   │   ├── billing/              # Facturation et plans
│   │   ├── auth/                 # Authentification
│   │   ├── api/mobile/           # API pour l'app mobile
│   │   │   ├── claim-messages/
│   │   │   ├── update-message-status/
│   │   │   ├── device-pair/
│   │   │   ├── campaign-control/
│   │   │   ├── heartbeat/
│   │   │   ├── retry-failed/
│   │   │   └── report-incoming/
│   │   └── app/                  # Telechargement APK
│   └── public/app/               # APK heberge
│       ├── sms-gateway.apk       # APK v1.0.7+41 (27.2 MB)
│       └── latest.json           # Metadata mise a jour
│
├── flutter_app/                  # Application mobile Flutter
│   ├── lib/                      # 11 fichiers Dart
│   │   ├── main.dart             # App principale + UI
│   │   ├── config.dart           # Configuration (URLs)
│   │   ├── models/               # Modeles de donnees
│   │   └── services/
│   │       ├── background_sync_service.dart  # Service foreground SMS
│   │       ├── sms_sender.dart   # Envoi SMS natif
│   │       ├── device_service.dart # Pairing appareil
│   │       └── app_update_service.dart # Mise a jour auto
│   ├── android/                  # Configuration Android
│   │   └── app/src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── kotlin/.../MainActivity.kt
│   │       └── res/              # Icones SMSenvoie
│   └── assets/
│       └── icon.png              # Icone SMSenvoie
│
├── supabase/
│   ├── migrations/               # 29 migrations SQL
│   └── functions/                # 9 Edge Functions (Deno)
│       ├── claim_messages/       # Claim atomique + quota
│       ├── campaign_control/     # Pause/Resume/Cancel
│       ├── update_message_status/ # Mise a jour statut SMS
│       ├── device_pair/          # Pairing appareil
│       ├── heartbeat/            # Heartbeat device
│       ├── billing_create_checkout/ # Checkout paiement
│       ├── billing_verify/       # Verification paiement
│       ├── billing_webhook/      # Webhook paiement
│       └── device_update_sim/    # Mise a jour SIM
│
└── RELEASE/                      # Builds APK
```

---

## 3. FONCTIONNALITES IMPLEMENTEES

### 3.1 Application Web (smsenvoie.com)

- **Dashboard** : Vue d'ensemble avec statistiques, campagnes actives, quota SMS
- **Campagnes SMS** : Creation, lancement, pause, reprise, annulation
  - Import contacts : CSV, Excel (XLS/XLSX), TXT avec detection auto colonnes
  - Parsing international intelligent (tous les pays)
  - Selection SIM (Auto/SIM1/SIM2)
  - Systeme de priorite (Normale/Haute/Urgente)
  - Barre de progression temps reel
- **Messages** : Liste paginee cote serveur, filtres par statut, recherche
- **Contacts** : Gestion, import drag-and-drop, opt-in/opt-out
- **Templates** : Modeles SMS reutilisables avec variables {nom}, {name}
- **Liste noire (Opt-outs)** : Ajout/suppression manuelle, recherche, pagination
- **Appareils** : Pairing QR Code, multi-SIM, statut en ligne
- **Profil** : Informations utilisateur
- **Admin** :
  - Activation abonnements par email
  - Gestion utilisateurs (modifier mot de passe)
  - Codes promo
  - Statistiques SMS (jour/mois)
  - Statistiques appareils (ville/pays)

### 3.2 Application Mobile (APK)

- **Envoi SMS automatique** en arriere-plan (foreground service)
- **Notification** avec progression, boutons Pause/Reprendre/Annuler
- **Pairing** par QR Code ou lien deep link
- **Re-pairing automatique** apres reinstallation (Android ID)
- **Dashboard** avec statistiques detaillees (Total, Envoyes, En attente, Echecs)
- **Messages** avec filtres, recherche, pagination, detail en bottom sheet
- **Gestion file d'attente** avec priorite des campagnes
- **Mise a jour automatique** avec notification in-app
- **Multi-SIM** : detection automatique des cartes SIM

### 3.3 Systeme d'abonnement

| Plan | Prix | SMS/mois | Appareils |
|------|------|----------|-----------|
| Gratuit | 0 XOF | 100 | 1 |
| 1 appareil | 9 900 XOF/mois | Illimite | 1 |
| 2 appareils | 12 900 XOF/mois | Illimite | 2 |
| 3 appareils | 15 900 XOF/mois | Illimite | 3 |
| 5 appareils | 22 900 XOF/mois | Illimite | 5 |

- Quota automatiquement applique au claim des messages
- Campagnes auto-pausees quand quota atteint
- Activation manuelle par admin possible

### 3.4 Priorite des campagnes

- **Normale (0)** : Ordre FIFO standard
- **Haute (1)** : Passe avant les campagnes normales
- **Urgente (2)** : Envoyee en premier
- Modifiable en temps reel depuis la page detail campagne
- Appliquee dans `claim_messages_atomic` (ORDER BY priority DESC, created_at ASC)

---

## 4. MIGRATIONS SQL (29 fichiers)

1. `20240101000000_initial_schema.sql` - Schema initial (orgs, plans, subscriptions, devices, contacts, optouts, campaigns, messages)
2. `20240101000001_enable_rls.sql` - Row Level Security
3. `20240101000002_claim_function.sql` - Fonction claim_messages
4. `20240101000003_inbox_messages.sql` - Table inbox_messages
5. `20240131000005_create_user_settings.sql` - Settings utilisateur
6. `20250105_create_promo_codes.sql` - Codes promo
7. `20250201000006_campaign_queue.sql` - File d'attente campagnes
8. `20251231010000_fix_org_members_rls_recursion.sql` - Fix RLS recursion
9. `20251231020000_add_devices_delete_policy.sql` - Politique suppression devices
10. `20260104010000_campaign_sim_slot.sql` - SIM slot par campagne + claim_messages_atomic
11. `20260104020000_fix_inbox_messages_rls.sql` - Fix RLS inbox
12. `20260104030000_billing_plans_limits.sql` - Plans billing v2 + quota
13. `20260104050000_admin_analytics.sql` - Analytics admin
14. `20260104060000_add_first_admin.sql` - Premier admin
15. `20260104061000_admin_rpc.sql` - RPCs admin
16. `20260104062000_admin_lists_rpc.sql` - Listes admin
17. `20260104063000_fix_admin_list_rpcs.sql` - Fix listes admin
18. `20260104064000_analytics_events_meta_compat.sql` - Compatibilite analytics
19. `20260104072000_fix_billing_effective_plan_and_quota.sql` - Fix get_effective_plan
20. `20260104073000_expire_hidden_subscriptions.sql` - Expiration anciens plans
21. `20260106090000_fix_promo_codes_policies.sql` - Fix politiques codes promo
22. `20260106120000_auto_org_per_user.sql` - Organisation auto par utilisateur
23. `20260106150000_admin_activation_rpcs.sql` - RPCs activation admin
24. `20260106200000_add_monthly_2_plan.sql` - Plan 2 appareils
25. `20260106210000_add_android_id_to_devices.sql` - Android ID pour re-pairing
26. `20260106220000_add_sms_stats_rpcs.sql` - RPCs stats SMS
27. `20260106230000_add_device_geo_and_stats.sql` - Geolocalisation appareils
28. `20260325000000_campaign_priority.sql` - Priorite campagnes
29. `20260325010000_optouts_delete_policy.sql` - Politique suppression optouts

---

## 5. COMPTES ET ACCES

| Service | URL |
|---------|-----|
| Web App | https://smsenvoie.com |
| Admin | https://smsenvoie.com/admin |
| Supabase | https://app.supabase.com (projet gamumybcoxxanhjakpde) |
| GitHub | https://github.com/hermannnande/sms-gateway-saas |
| Vercel | Dashboard Vercel (deploiement automatique sur push) |
| APK | https://smsenvoie.com/app/sms-gateway.apk |

### Liens de paiement (Chariow)
- 1 appareil : https://coachingexpert.mychariow.shop/prd_7xnd5l/checkout
- 2 appareils : https://coachingexpert.mychariow.shop/prd_iz04di/checkout
- 5 appareils : https://coachingexpert.mychariow.shop/prd_oaw9yp/checkout

---

## 6. TECHNOLOGIES

| Composant | Technologie |
|-----------|------------|
| Frontend web | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions Deno, Realtime, RLS) |
| App mobile | Flutter 3.x (Dart) + Kotlin (Android natif) |
| Hebergement web | Vercel |
| Paiement | Chariow (Orange Money, Wave, MTN, Visa, Mastercard) |
| SMS | Android SmsManager natif via MethodChannel |
| Notifications | Flutter Foreground Task (notification persistante) |

---

## 7. DERNIERS CHANGEMENTS (Session 14 Fevrier 2026)

1. **Systeme de priorite campagnes** - Normale/Haute/Urgente avec tri dans claim_messages_atomic
2. **Liste noire complete** - Page web avec ajout/suppression/recherche/pagination
3. **API report-incoming** - Endpoint pour signaler SMS entrants
4. **Fix import fichiers** - readAsText pour CSV/TXT, detection auto colonnes et separateurs
5. **Parsing international** - Support tous les formats de numeros (CI, FR, US, CM, SN, etc.)
6. **Fix Play Protect** - Retrait permissions RECEIVE_SMS/READ_SMS
7. **Rebranding SMSenvoie** - Nouveau nom et icone sur app + web

---

## 8. COMMENT RESTAURER

```bash
# Cloner le projet
git clone https://github.com/hermannnande/sms-gateway-saas.git

# Web (Next.js)
cd web
npm install
cp .env.example .env.local   # Configurer les variables Supabase
npm run dev

# Flutter
cd flutter_app
flutter pub get
flutter run               # Debug
flutter build apk --release --split-per-abi  # Release

# Supabase
# Executer les migrations dans l'ordre depuis supabase/migrations/
# dans le SQL Editor de Supabase
```

### Variables d'environnement requises (web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://gamumybcoxxanhjakpde.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

---

*Sauvegarde generee le 14 Fevrier 2026 - Commit: 13972ae*
