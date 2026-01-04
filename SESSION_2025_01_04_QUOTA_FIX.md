# SESSION 04/01/2025 - FIX QUOTA 100 SMS + ENVOI ARRIÈRE-PLAN

## 🎯 PROBLÈME RÉSOLU

### 1. Quota 100 SMS (plan gratuit) pas respecté
**Symptôme** : Plus de 100 SMS envoyés sur un compte gratuit, l'app affichait "10000 SMS".

**Cause racine** :
- L'organisation utilisait un **ancien abonnement "legacy"** (plan masqué) avec quota 10000 ou illimité
- La fonction `get_effective_plan()` ne filtrait pas les plans cachés (`is_visible = false`)
- Le calcul du quota côté `claim_messages` comptait les SMS **créés** (`created_at`) au lieu des SMS **réellement envoyés** (`sent_at` + `status='sent'`)

**Correctifs appliqués** :
1. ✅ Migration `20260104072000_fix_billing_effective_plan_and_quota.sql`
   - Corrige `get_effective_plan()` pour ignorer les plans cachés
   - Corrige `enforce_sms_quota()` pour compter uniquement les SMS envoyés (`status='sent'`)
   
2. ✅ Migration `20260104073000_expire_hidden_subscriptions.sql`
   - Expire automatiquement tous les abonnements actifs sur des plans cachés (legacy)
   
3. ✅ Edge Function `claim_messages/index.ts`
   - Calcul quota basé sur `status='sent'` ET `sent_at >= month_start`
   - Retourne `messages: []` quand quota atteint (au lieu d'erreur)
   - Expose `plan`, `sms_used_this_month`, `quota_remaining` dans la réponse
   
4. ✅ Edge Function `heartbeat/index.ts`
   - Retourne le **plan effectif** + quota/usage dans la réponse
   - Permet à l'app d'afficher les vraies valeurs en temps réel

5. ✅ Flutter App `main.dart`
   - `refreshSubscription()` et `refreshDeviceStatus()` mettent à jour `planName`, `planSmsQuotaMonth` depuis les réponses serveur
   - L'affichage abonnement montre maintenant les valeurs correctes

6. ✅ APK mis à jour
   - Version **v1.0.1+7**
   - Disponible sur `https://smsenvoie.com/sms-gateway.apk`

---

### 2. Envoi SMS en arrière-plan (notification + pause/stop)
**Demande** : Permettre l'envoi en arrière-plan avec notification de progression et boutons pause/stop.

**Implémentation** :
1. ✅ Package `flutter_foreground_task` v9.2.0
2. ✅ Service `background_sync_service.dart`
   - Foreground service Android
   - Notification persistante : "Envoi 3/10 • reste 7 [███░░░]"
   - Boutons : **Pause**, **Reprendre**, **Stop**
   
3. ✅ AndroidManifest.xml
   - Permissions : `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`
   - Service déclaré : `com.pravera.flutter_foreground_task.service.ForegroundService`
   
4. ✅ UI Paramètres (app)
   - Toggle : **Continuer en arrière-plan**
   - Boutons : **Pause/Reprendre**, **Arrêter**
   
5. ✅ APK mis à jour
   - Version **v1.0.1+6** (background sync)
   - Version **v1.0.1+7** (quota fix + background sync)

---

## 📂 FICHIERS MODIFIÉS

### Migrations SQL (exécutées sur Supabase)
```
supabase/migrations/20260104072000_fix_billing_effective_plan_and_quota.sql
supabase/migrations/20260104073000_expire_hidden_subscriptions.sql
```

### Edge Functions (redéployées sur Supabase)
```
supabase/functions/claim_messages/index.ts
supabase/functions/heartbeat/index.ts
```

### Flutter App
```
flutter_app/lib/main.dart
flutter_app/lib/services/background_sync_service.dart (nouveau)
flutter_app/android/app/src/main/AndroidManifest.xml
flutter_app/pubspec.yaml (v1.0.1+7)
```

### Web
```
web/public/app/latest.json (v1.0.1+7)
web/public/sms-gateway.apk (70.9 MB)
```

---

## ✅ ACTIONS DÉJÀ FAITES

### 1. Migrations SQL
```bash
# Exécutées dans Supabase SQL Editor
supabase/migrations/20260104072000_fix_billing_effective_plan_and_quota.sql
supabase/migrations/20260104073000_expire_hidden_subscriptions.sql
```

### 2. Redéploiement Edge Functions
```bash
cd "C:\Users\nande\Desktop\SMS ENVOIE"
supabase functions deploy claim_messages --project-ref gamumybcoxxanhjakpde --yes
supabase functions deploy heartbeat --project-ref gamumybcoxxanhjakpde --yes
```
✅ **Déployé avec succès** le 04/01/2025

### 3. APK publié
- Version : **v1.0.1+7**
- Taille : 70.9 MB
- URL : `https://smsenvoie.com/sms-gateway.apk`

### 4. Commits Git
```bash
# Commit 1: Background sync (v1.0.1+6)
git commit -m "feat(app): envoi SMS en arrière-plan + notification progression + pause/stop (v1.0.1+6)"

# Commit 2: Quota fix (v1.0.1+7)
git commit -m "fix(billing): quota plan gratuit (100 SMS) + ignore legacy plans + affichage app"

git push origin main
```

---

## 🧪 TEST À FAIRE (PRIORITAIRE)

### Vérifier le quota 100 SMS
1. **Installer la nouvelle APK** : `https://smsenvoie.com/sms-gateway.apk` (v1.0.1+7)

2. **Vérifier l'affichage du plan dans l'app** :
   - Ouvrir l'app → **Abonnement**
   - Appuyer sur **"Actualiser mes infos"** (icône refresh)
   - ✅ Doit afficher : **"Plan: Gratuit"** + **"Quota SMS mensuel: 100 / 100"** (pas 10000)

3. **Tester l'envoi réel** :
   - Créer une **nouvelle campagne** de **150 SMS**
   - Activer **"Continuer en arrière-plan"** dans Paramètres
   - Lancer l'envoi
   - ✅ **Résultat attendu** : L'envoi s'arrête automatiquement à **100 SMS envoyés** (mois en cours)
   - La notification doit afficher : "Envoi 100/100 • reste 0"

4. **Vérifier côté Dashboard Web** :
   - Aller sur `https://smsenvoie.com/dashboard/campaigns/[id]`
   - ✅ Statut campagne : `running` ou `done`
   - ✅ Compteur : **100 SMS envoyés** (même si 150 dans la file)

---

## 🔍 VÉRIFICATION RAPIDE (SQL)

### Vérifier le plan effectif appliqué
Exécuter dans **Supabase SQL Editor** :
```sql
SELECT
  o.id AS org_id,
  o.name AS org_name,
  (public.get_effective_plan(o.id)).id AS plan_id,
  (public.get_effective_plan(o.id)).name AS plan_name,
  (public.get_effective_plan(o.id)).sms_quota_month AS sms_quota_month
FROM public.organizations o
JOIN public.org_members m ON m.org_id = o.id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'hermannnande@gmail.com';
```

**Résultat attendu** :
```
plan_id: 'free'
plan_name: 'Gratuit'
sms_quota_month: 100
```

### Compter les SMS envoyés ce mois
```sql
SELECT
  o.name AS org_name,
  COUNT(*) AS sms_sent_this_month
FROM public.messages m
JOIN public.organizations o ON o.id = m.org_id
JOIN public.org_members om ON om.org_id = o.id
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'hermannnande@gmail.com'
  AND m.status = 'sent'
  AND m.sent_at >= date_trunc('month', now())
GROUP BY o.name;
```

**Si le résultat > 100** : c'est normal, c'est des SMS envoyés **avant** le correctif. Le quota ne s'applique qu'aux **nouveaux claims** après redéploiement.

---

## 📋 SI ÇA NE MARCHE PAS

### Problème : L'app affiche toujours "10000 SMS"
**Solution** :
1. Désinstaller complètement l'ancienne app
2. Réinstaller la v1.0.1+7 depuis `https://smsenvoie.com/sms-gateway.apk`
3. Se reconnecter
4. Appuyer sur "Actualiser mes infos" dans l'onglet **Abonnement**

### Problème : Les SMS continuent après 100
**Causes possibles** :
1. **L'app a déjà "claim" un batch avant le redéploiement**
   - Solution : Arrêter l'envoi (bouton Stop), attendre 1 min, relancer une nouvelle campagne
   
2. **L'Edge Function n'est pas redéployée**
   - Vérifier : `https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/functions`
   - Redéployer manuellement depuis le Dashboard si besoin

3. **La migration SQL n'est pas exécutée**
   - Re-exécuter les 2 migrations SQL (ordre important)

---

## 🔐 INFORMATIONS SYSTÈME

### Supabase
- **Project Ref** : `gamumybcoxxanhjakpde`
- **URL** : `https://gamumybcoxxanhjakpde.supabase.co`
- **Dashboard** : `https://supabase.com/dashboard/project/gamumybcoxxanhjakpde`

### Plans définis
```
free       : Gratuit (100 SMS/mois, 1 appareil)
monthly_1  : 9900 XOF/mois (illimité, 1 appareil)
monthly_3  : 15900 XOF/mois (illimité, 3 appareils)
monthly_5  : 22900 XOF/mois (illimité, 5 appareils)
```

### Environnement
- Flutter : 3.x
- Supabase CLI : v2.67.1
- APK : v1.0.1+7 (70.9 MB)
- Git : main branch (f04da91)

---

## 🚀 PROCHAINES ÉTAPES (APRÈS VALIDATION)

### Si le test quota 100 SMS fonctionne ✅
1. Proposer aux clients de mettre à jour l'app (notification in-app ou email)
2. Surveiller les métriques admin (`/admin`) pour voir l'usage réel
3. Éventuellement ajuster le quota gratuit (50 SMS ? 200 SMS ?)

### Si des clients doivent être "réinitialisés"
Si des orgs ont dépassé 100 SMS avant le correctif, tu peux soit :
- Les laisser (pas de pénalité rétroactive)
- Ou réinitialiser manuellement leur compteur (SQL) :
```sql
-- (NE PAS EXÉCUTER SANS CONFIRMATION)
-- DELETE FROM public.messages
-- WHERE org_id = 'xxx' AND created_at >= date_trunc('month', now());
```

---

## 📞 CONTACT / DEBUG

### Logs en temps réel (Supabase)
`https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/logs`

### Filtrer par fonction
- `claim_messages` : voir les claims + quota refusés
- `heartbeat` : voir les pings d'app + plan renvoyé

### Test manuel API (PowerShell)
```powershell
# Test heartbeat (retourne plan + quota)
$headers = @{ "Content-Type" = "application/json" }
$body = @{ device_token = "VOTRE_TOKEN" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://smsenvoie.com/api/mobile/heartbeat" -Method POST -Headers $headers -Body $body
```

---

## ✅ RÉSUMÉ (1 LIGNE)
**Quota 100 SMS appliqué + envoi arrière-plan fonctionnel. APK v1.0.1+7 en ligne. Edge Functions redéployées. À tester : nouvelle campagne doit s'arrêter à 100.**

---

*Sauvegarde créée le 04/01/2025 à 20h (heure de Côte d'Ivoire)*

