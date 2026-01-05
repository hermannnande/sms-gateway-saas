# 📚 Index Documentation (FR) — SMS Gateway SaaS

Ce fichier sert d’**index unique** pour retrouver rapidement toute la documentation du repo.

> ⚠️ **Sécurité**
> - Ne committez jamais de secrets (Supabase `service_role`, mots de passe keystore, clés Payfonte).
> - Préférez: **Vercel Env Vars**, `web/.env.local` (gitignored), et un gestionnaire de mots de passe.

---

## 🚀 Démarrage rapide (dev)

### Web (Next.js)
- **Installer / lancer**
  - `cd web`
  - `npm install`
  - `npm run dev`

### Mobile (Flutter)
- **Installer / lancer**
  - `cd flutter_app`
  - `flutter pub get`
  - `flutter run`
- **Build APK release**
  - `flutter build apk --release`

### Backend (Supabase)
- **Migrations**: `supabase/migrations/*.sql`
- **Edge Functions**: `supabase/functions/*`
- **Déploiement functions** (exemples):
  - `supabase functions deploy claim_messages --project-ref <project_ref> --yes`
  - `supabase functions deploy heartbeat --project-ref <project_ref> --yes`

---

## 🧭 Docs “principales”

- **`PROJECT_SUMMARY.md`**: résumé complet (architecture, workflows, déploiements).
- **`COMPREHENSION_PROJET_COMPLETE.md`**: compréhension détaillée (stack, DB, billing/quota, admin, bugs résolus).
- **`DEPLOYMENT_STATUS.md`**: état de déploiement (fonctions, secrets, checklist).
- **`SETUP_SUPABASE_CLOUD.md`**: mise en place Supabase + variables env côté web.
- **`GUIDE_INSTALLATION_CLIENT.md`**: guide d’installation APK (client final).
- **`LIENS_IMPORTANTS.md`**: liens utiles (Vercel/Supabase) + règles de gestion des secrets.

---

## 🎨 Design / UI

- **`DESIGN_SYSTEM.md`**: design system web (couleurs, typo, composants, animations).
- **`DESIGN_HANDOFF_CLAUDE.md`**: handoff design (notes).
- **`DESIGN_COMPLETED_SUMMARY.md`**: récap design final.
- **`web/HOME_DESIGN_CHECKLIST.md`**: checklist homepage web.
- **`flutter_app/DESIGN_SYSTEM.md`**: design system mobile.
- **`flutter_app/SCREENSHOTS.md`**: captures mobile.

---

## ✅ Tests / étapes / sessions

- **`ETAPE_1_TESTS.md`** → **`ETAPE_8_COMPLETE.md`**: étapes de test / validation (ordre chronologique).
- **`SESSION_2025_01_04_QUOTA_FIX.md`**: session de fix quota + background.
- **`TESTS_DEVICES_FIX.md`**: tests autour de la gestion des appareils.
- **`CHANGELOG_DEVICES.md`**: changelog device-related.
- **`FIX_STATUS_ONLINE.md`**: correctifs “status online”.
- **`FIX_DELETE_APPAREILS.md`**: correctifs suppression appareils.
- **`ACTION_PRIORITAIRE_MAINTENANT.md`**: checklist d’actions manuelles “prioritaires”.

---

## 📱 Mobile (Flutter) — docs

- **`flutter_app/README.md`**: setup Flutter, build, permissions, dépannage.
- **`android/README.md`**: ancien module Android natif (déprécié si vous utilisez Flutter).

---

## 🧩 SQL / scripts (support)

Ces fichiers ne sont pas de la “doc” mais servent au support / debug:
- `ADMIN_SETUP_COMPLETE.sql`
- `ADMIN_DEBUG.sql`
- `COMPLETE_SETUP.sql`
- `CHECK_AUTH.sql`
- `CREATE_USER_SETTINGS.sql`


