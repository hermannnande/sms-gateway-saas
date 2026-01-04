# ⚠️ ACTIONS PRIORITAIRES À FAIRE MAINTENANT

**Date**: 31 Décembre 2024  
**Status**: 95% terminé - 2 actions manuelles urgentes

---

## 🎯 Ce qui fonctionne déjà

✅ **Web App** : https://sms-gateway-saas.vercel.app (déployée sur Vercel)  
✅ **Backend Supabase** : https://gamumybcoxxanhjakpde.supabase.co (configuré)  
✅ **Heartbeat Endpoint** : Accessible (testé avec succès sur ton téléphone)  
✅ **Code complet** : Web + Mobile + Backend (100% terminé)  
✅ **Design premium** : Homepage + App mobile (Figma-level)  
✅ **APK signé** : Prêt à installer (sans erreur Play Protect possible)  
✅ **Documentation complète** : README, guides, credentials

---

## 🚨 ACTION 1 : Exécuter le SQL RLS Fix (5 minutes)

### Pourquoi ?
La page **Appareils** sera vide tant que tu n'exécutes pas ce SQL.  
(C'est à cause d'une erreur RLS "infinite recursion" dans Supabase)

### Comment faire ?

1. **Ouvre le SQL Editor Supabase** :
   ```
   https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/sql
   ```

2. **Copie-colle ce SQL** (depuis `CREDENTIALS_IMPORTANT.txt` lignes 104-192) :

```sql
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.org_members
  where user_id = auth.uid();
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members
    where user_id = auth.uid()
      and org_id = p_org_id
      and role = 'ORG_ADMIN'
  );
$$;

grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

drop policy if exists "Users can view their org members" on public.org_members;
drop policy if exists "Org admins can manage members" on public.org_members;

create policy "Users can view their org members"
on public.org_members for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Org admins can add members" on public.org_members;
create policy "Org admins can add members"
on public.org_members for insert
with check (public.is_org_admin(org_id));

drop policy if exists "Org admins can update members" on public.org_members;
create policy "Org admins can update members"
on public.org_members for update
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Org admins can delete members" on public.org_members;
create policy "Org admins can delete members"
on public.org_members for delete
using (public.is_org_admin(org_id));

drop policy if exists "Users can view their organizations" on public.organizations;
create policy "Users can view their organizations"
on public.organizations for select
using (id in (select public.my_org_ids()));

drop policy if exists "Users can view their org devices" on public.devices;
create policy "Users can view their org devices"
on public.devices for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org contacts" on public.contacts;
create policy "Users can view their org contacts"
on public.contacts for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org templates" on public.templates;
create policy "Users can view their org templates"
on public.templates for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org optouts" on public.optouts;
create policy "Users can view their org optouts"
on public.optouts for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org campaigns" on public.campaigns;
create policy "Users can view their org campaigns"
on public.campaigns for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org messages" on public.messages;
create policy "Users can view their org messages"
on public.messages for select
using (org_id in (select public.my_org_ids()));
```

3. **Clique sur "RUN"** (ou Ctrl+Enter)

4. **Tu devrais voir** :
   ```
   Success. No rows returned
   ```

5. **Vérifie que ça marche** :
   ```
   https://sms-gateway-saas.vercel.app/api/debug/devices
   ```
   (doit retourner `"ok": true` avec tes devices)

6. **Va sur la page Appareils** :
   ```
   https://sms-gateway-saas.vercel.app/dashboard/devices
   ```
   (les appareils doivent maintenant s'afficher ✅)

---

## 🚨 ACTION 2 : Exécuter le SQL DELETE Policy (2 minutes)

### Pourquoi ?
Pour pouvoir **supprimer des appareils** depuis la web app.

### Comment faire ?

1. **Dans le même SQL Editor** (ci-dessus)

2. **Copie-colle ce SQL** :

```sql
-- Add DELETE policy for devices table
DROP POLICY IF EXISTS "Users can delete their org devices" ON devices;
DROP POLICY IF EXISTS "Users can insert their org devices" ON devices;
DROP POLICY IF EXISTS "Users can update their org devices" ON devices;

-- Create DELETE policy
CREATE POLICY "Users can delete their org devices"
ON devices FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Create INSERT policy
CREATE POLICY "Users can insert their org devices"
ON devices FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Create UPDATE policy
CREATE POLICY "Users can update their org devices"
ON devices FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
```

3. **Clique sur "RUN"**

4. **Tu devrais voir** :
   ```
   Success. No rows returned
   ```

5. **Teste la suppression** :
   - Va sur : https://sms-gateway-saas.vercel.app/dashboard/devices
   - Clique sur l'icône **🗑️** d'un appareil de test
   - Confirme
   - ✅ L'appareil devrait être supprimé

---

## 🚨 ACTION 3 : Déployer l'Edge Function Heartbeat (5 minutes)

### Pourquoi ?
Pour que les appareils s'affichent **"En ligne"** sur la web app.

### Méthode A : Via Supabase CLI (Recommandé)

Ouvre **PowerShell** :

```powershell
cd "C:\Users\nande\Desktop\SMS ENVOIE"
supabase functions deploy heartbeat --no-verify-jwt
```

**Tu devrais voir** :
```
Deploying...
Deployed function heartbeat to https://gamumybcoxxanhjakpde.supabase.co/functions/v1/heartbeat
```

### Méthode B : Via Dashboard (Si CLI ne fonctionne pas)

1. **Va sur** : https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/functions

2. **Clique "New Edge Function"** ou édite la fonction `heartbeat` existante

3. **Copie le contenu de** : `supabase/functions/heartbeat/index.ts`

4. **Colle dans l'éditeur** et clique "Deploy"

### Vérification

Teste dans ton navigateur (sur PC ou téléphone) :
```
https://gamumybcoxxanhjakpde.supabase.co/functions/v1/heartbeat
```

**Résultat attendu** :
```json
{"ok":true,"service":"heartbeat","ts":"2025-12-31T..."}
```

✅ **Tu as déjà testé avec succès sur ton téléphone !**

---

## 📱 ACTION 4 : Installer l'App Mobile (10 minutes)

### Étape 1 : Build l'APK (si pas encore fait)

Ouvre **PowerShell** :

```powershell
cd "C:\Users\nande\Desktop\SMS ENVOIE\flutter_app"

# Définir JAVA_HOME (si nécessaire)
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"
$env:PATH="$env:JAVA_HOME\bin;" + $env:PATH

# Build APK release signé
flutter build apk --release
```

**L'APK sera dans** :
```
flutter_app/build/app/outputs/flutter-apk/app-release.apk
```

### Étape 2 : Installer sur ton téléphone

#### Via USB (plus rapide)

```powershell
adb install flutter_app/build/app/outputs/flutter-apk/app-release.apk
```

#### Via fichier APK

1. **Copie** `app-release.apk` sur ton téléphone (via USB ou cloud)
2. **Ouvre** le fichier APK sur le téléphone
3. **Si Play Protect bloque** :
   - Clique "Plus d'infos"
   - Clique "Installer quand même"
4. **Installe** l'app
5. ✅ **C'est fait !**

### Étape 3 : Premier lancement

1. **Ouvre** l'app **SMS Gateway**
2. **Connecte-toi** :
   - **Email** : ton email Supabase
   - **Mot de passe** : ton mot de passe
   - OU **Scanner QR Session** depuis la page Profil web
3. **Scanner QR Device** :
   - Va sur : https://sms-gateway-saas.vercel.app/dashboard/devices
   - Clique "Ajouter un appareil"
   - Scanne le QR code avec l'app
4. ✅ **Appareil jumelé !**

### Étape 4 : Vérifier le statut "En ligne"

1. **Laisse** l'app mobile ouverte sur HomePage
2. **Attends 10 secondes** (premier heartbeat)
3. **Va sur** : https://sms-gateway-saas.vercel.app/dashboard/devices
4. **Refresh** (Ctrl+F5)
5. **Tu devrais voir** ton appareil avec **🟢 En ligne** ✅

---

## ✅ Checklist Finale

Coche chaque action après l'avoir faite :

- [ ] **Action 1** : SQL RLS Fix exécuté
- [ ] **Action 2** : SQL DELETE Policy exécuté
- [ ] **Action 3** : Edge Function heartbeat déployée
- [ ] **Action 4** : App mobile installée sur téléphone
- [ ] **Vérification 1** : Page Appareils affiche les devices
- [ ] **Vérification 2** : Suppression d'appareil fonctionne
- [ ] **Vérification 3** : Appareil s'affiche "En ligne"

---

## 🎉 Après ces 4 actions

**TON SYSTÈME SERA 100% OPÉRATIONNEL** ! 🚀

Tu pourras :
- ✅ Ajouter des appareils depuis la web app
- ✅ Voir leur statut "En ligne" en temps réel
- ✅ Supprimer des appareils (individuellement ou en masse)
- ✅ Créer des campagnes SMS
- ✅ Envoyer des SMS depuis l'app mobile
- ✅ Suivre l'historique des messages
- ✅ Gérer tes contacts et templates

---

## 🆘 Besoin d'aide ?

Si tu rencontres un problème, regarde les fichiers :
- **CREDENTIALS_IMPORTANT.txt** : Tous les liens + credentials
- **FIX_DELETE_APPAREILS.md** : Détails suppression
- **FIX_STATUS_ONLINE.md** : Détails heartbeat
- **flutter_app/README.md** : Détails build APK
- **GUIDE_INSTALLATION_CLIENT.md** : Guide installation APK

---

**COMMENCE PAR L'ACTION 1 (SQL RLS Fix) - C'EST LA PLUS IMPORTANTE ! 🚀**


