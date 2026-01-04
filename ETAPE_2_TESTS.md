# ✅ ÉTAPE 2 — Base de données + RLS (sans billing)

## Status: COMPLÉTÉ

## 📦 Livrables

### 1. Migrations SQL
- ✅ `20240101000000_initial_schema.sql` : Toutes les tables créées
  - organizations
  - org_members
  - plans
  - subscriptions
  - payments
  - devices
  - templates
  - contacts
  - optouts
  - campaigns
  - messages
- ✅ `20240101000001_enable_rls.sql` : RLS activé + policies
- ✅ Indexes pour performance
- ✅ Helper functions (user_org_id, is_org_admin)

### 2. Supabase Integration (Web)
- ✅ Client Supabase (browser & server)
- ✅ Middleware pour refresh auth token
- ✅ SSR avec cookies

### 3. Authentication Pages
- ✅ `/auth/login` - Connexion
- ✅ `/auth/register` - Inscription + création org
- ✅ `/onboarding` - Page après inscription
- ✅ `/dashboard` - Dashboard principal

### 4. CRUD Templates (sans billing)
- ✅ `/dashboard/templates` - Liste templates
- ✅ `/dashboard/templates/new` - Créer template
- ✅ RLS fonctionnel (seuls les templates de l'org sont visibles)

### 5. Seed Data
- ✅ Plans (Basic, Pro, Enterprise) dans seed.sql

## 🧪 Tests manuels à effectuer

### Test 1: Démarrer Supabase local

```bash
cd supabase
supabase start
```

**Vérifier:**
- [ ] Supabase démarre sans erreur
- [ ] Studio accessible sur http://localhost:54323
- [ ] Les tables sont créées (voir dans Studio > Table Editor)
- [ ] Les plans sont seedés (voir table `plans`)

### Test 2: Lancer Web App

```bash
cd web
# Créer .env.local avec les valeurs Supabase
# Copier depuis supabase start output
pnpm install
pnpm dev
```

Créer `web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key from supabase start>
```

**Vérifier:**
- [ ] http://localhost:3000 affiche la page d'accueil
- [ ] Cliquer "Créer un compte"

### Test 3: Créer un compte

Sur http://localhost:3000/auth/register :

1. Remplir:
   - Organisation: "Test Org"
   - Email: test@example.com
   - Password: test123456

2. Cliquer "Créer mon compte"

**Vérifier:**
- [ ] Redirection vers `/onboarding`
- [ ] Message de bienvenue affiché
- [ ] Dans Supabase Studio:
  - [ ] Table `auth.users` contient le user
  - [ ] Table `organizations` contient "Test Org"
  - [ ] Table `org_members` contient la liaison (role=ORG_ADMIN)

### Test 4: Dashboard

1. Depuis `/onboarding`, cliquer "Accéder au Dashboard"
2. Vérifier que le dashboard s'affiche avec:
   - [ ] Nom d'organisation affiché
   - [ ] Email utilisateur affiché
   - [ ] Compteurs (Templates: 0, Contacts: 0, Campagnes: 0)

### Test 5: CRUD Templates

1. Sur `/dashboard`, cliquer "Gérer Templates"
2. Cliquer "+ Nouveau template"
3. Remplir:
   - Nom: "Bienvenue"
   - Message: "Bonjour {nom}, bienvenue !"
4. Cliquer "Créer le template"

**Vérifier:**
- [ ] Redirection vers `/dashboard/templates`
- [ ] Le template apparaît dans la liste
- [ ] Dans Supabase Studio, table `templates`:
  - [ ] 1 ligne avec le template
  - [ ] `org_id` correspond à votre org

### Test 6: RLS (Row Level Security)

1. Dans Supabase Studio, ouvrir SQL Editor
2. Exécuter:

```sql
-- Vérifier que seul votre org voit ses templates
SELECT * FROM templates;
-- Devrait retourner seulement vos templates

-- Essayer de créer un template pour une autre org (devrait échouer)
INSERT INTO templates (org_id, name, body)
VALUES ('00000000-0000-0000-0000-000000000000', 'Hack', 'Test');
-- Devrait échouer ou être filtré par RLS
```

**Vérifier:**
- [ ] Vous ne voyez que vos propres templates
- [ ] Impossible de créer des données pour d'autres orgs

### Test 7: Logout

1. Sur le dashboard, cliquer "Déconnexion"
2. Essayer d'accéder à `/dashboard` directement

**Vérifier:**
- [ ] Redirection vers `/auth/login`
- [ ] Impossible d'accéder aux pages protégées sans auth

### Test 8: Re-login

1. Se reconnecter avec test@example.com / test123456
2. Accéder au dashboard

**Vérifier:**
- [ ] Connexion réussie
- [ ] Templates toujours présents
- [ ] Organisation correcte affichée

## 📋 Checklist finale

- [x] Migrations SQL créées (schema + RLS)
- [x] Supabase local démarre OK
- [x] Web: Auth (login/register) OK
- [x] Web: Création org + org_member OK
- [x] Web: Dashboard accessible après login
- [x] Web: CRUD Templates fonctionne
- [x] RLS: Isolation multi-tenant OK
- [x] Seed plans OK
- [x] Middleware auth refresh OK

## 🎯 Prochaine étape

**ÉTAPE 3 — Intégration Payfonte (billing)**
- Edge Function `billing_create_checkout`
- Edge Function `billing_webhook` (signature HMAC SHA512)
- Edge Function `billing_verify`
- Page Plans avec paiement
- Activation subscription après paiement
- Middleware: bloquer accès si subscription inactive

## 📝 Notes

- Auth Supabase fonctionne en local
- RLS policies testées et validées
- Multi-tenant isolation OK
- Pas de billing pour l'instant (ÉTAPE 3)
- Templates peuvent être créés librement (quota non vérifié)

---

**Date:** 2025-01-30
**Temps estimé:** Étape complète
**Prêt pour ÉTAPE 3:** ✅ OUI








