# 🔧 Fix Suppression Appareils + Sélection Multiple

**Date**: 31 Décembre 2024  
**Problème**: La suppression d'appareils ne fonctionnait pas (RLS policy manquante)  
**Solution**: Ajouter policy DELETE + Sélection multiple

---

## ⚠️ URGENT : Exécuter ce SQL dans Supabase

### Pourquoi ?
La table `devices` n'avait **pas de policy RLS pour DELETE**. C'est pour ça que la suppression ne fonctionnait pas.

### Comment faire :

1. **Ouvre le SQL Editor Supabase** :
   ```
   https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/sql
   ```

2. **Copie-colle ce SQL** et clique sur **"RUN"** :

```sql
-- Add DELETE policy for devices table
-- This was missing in the initial RLS setup

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete their org devices" ON devices;
DROP POLICY IF EXISTS "Users can insert their org devices" ON devices;
DROP POLICY IF EXISTS "Users can update their org devices" ON devices;

-- Create DELETE policy
CREATE POLICY "Users can delete their org devices"
ON devices FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Create INSERT policy (allows users to create devices via web app)
CREATE POLICY "Users can insert their org devices"
ON devices FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Create UPDATE policy (allows users to update device names, etc.)
CREATE POLICY "Users can update their org devices"
ON devices FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
```

3. **Tu devrais voir** :
   ```
   Success. No rows returned
   ```

4. **C'est terminé !** 🎉

---

## ✅ Nouvelle Fonctionnalité : Sélection Multiple

Après avoir exécuté le SQL ci-dessus, la page Appareils aura :

### 1️⃣ **Barre d'actions en haut**
- ☐ Bouton **"Tout sélectionner"** / **"Tout désélectionner"**
- 📊 Compteur de sélection (ex: "3 appareils sélectionnés")
- 🗑️ Bouton **"Supprimer la sélection"** (apparaît quand au moins 1 appareil est sélectionné)

### 2️⃣ **Checkbox sur chaque appareil**
- ☐ Checkbox à gauche de chaque appareil
- ✅ Clic pour sélectionner/désélectionner
- 🎨 Card devient bleu avec bordure quand sélectionné

### 3️⃣ **Suppression individuelle** (toujours disponible)
- 🗑️ Icône de corbeille à droite
- Confirmation demandée
- Fonctionne indépendamment de la sélection

---

## 🎯 Comment utiliser la sélection multiple

### Méthode 1 : Tout sélectionner
1. Clique sur **"Tout sélectionner"** en haut
2. Tous les appareils deviennent bleus (sélectionnés)
3. Clique sur **"Supprimer la sélection"**
4. Confirme avec **"Oui, supprimer"**
5. ✅ Tous les appareils sélectionnés sont supprimés

### Méthode 2 : Sélection manuelle
1. Clique sur les **checkboxes** des appareils que tu veux supprimer
2. Le compteur s'affiche : "3 appareils sélectionnés"
3. Clique sur **"Supprimer la sélection"**
4. Confirme avec **"Oui, supprimer"**
5. ✅ Les appareils sélectionnés sont supprimés

### Méthode 3 : Suppression individuelle (comme avant)
1. Clique sur l'**icône de corbeille** 🗑️ d'un appareil
2. Confirme avec **"Oui, supprimer"**
3. ✅ Cet appareil uniquement est supprimé

---

## 🎨 Aperçu Visuel

### Barre d'actions (en haut)
```
┌─────────────────────────────────────────────────────────────┐
│  [☐ Tout sélectionner]   3 appareils sélectionnés           │
│                               [🗑️ Supprimer la sélection]   │
└─────────────────────────────────────────────────────────────┘
```

### Appareil sélectionné (bordure bleue)
```
┌─────────────────────────────────────────────────────────────┐
│  ✅  📱  Nom Appareil       🟢 En ligne              🗑️     │
│       ⏰ Vu: 31/12 11:23  📅 Ajouté: 31/12/2024             │
└─────────────────────────────────────────────────────────────┘
```

### Appareil non sélectionné
```
┌─────────────────────────────────────────────────────────────┐
│  ☐  📱  Autre Appareil     ⚪ Hors ligne             🗑️     │
│      ⏰ Vu: 30/12 14:45  📅 Ajouté: 30/12/2024              │
└─────────────────────────────────────────────────────────────┘
```

### Mode confirmation (suppression multiple)
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Supprimer 3 appareils ?                                 │
│               [Oui, supprimer]  [Annuler]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Test de la Fonctionnalité

### Étape 1 : Exécuter le SQL (ci-dessus)
Exécute le SQL dans Supabase SQL Editor.

### Étape 2 : Attendre le déploiement Vercel
Le code a été pushé sur GitHub. Vercel va le déployer automatiquement (2-3 min).

Vérifie sur : https://vercel.com/dashboard

### Étape 3 : Tester la suppression
1. Va sur : https://sms-gateway-saas.vercel.app/dashboard/devices
2. Appuie sur **Ctrl+F5** (hard refresh)
3. **Tu devrais voir** :
   - Barre d'actions en haut
   - Checkboxes sur chaque appareil
   - Bouton "Tout sélectionner"

### Étape 4 : Tester la suppression individuelle
1. Clique sur l'**icône de corbeille** 🗑️ d'un appareil de test
2. Confirme
3. ✅ L'appareil devrait être supprimé

### Étape 5 : Tester la sélection multiple
1. Sélectionne **2-3 appareils** (clique sur les checkboxes)
2. Clique sur **"Supprimer la sélection"**
3. Confirme
4. ✅ Les appareils sélectionnés devraient être supprimés

---

## 🐛 Si ça ne marche toujours pas

### Problème 1 : Le SQL ne s'exécute pas
**Erreur possible** : "policy already exists"

**Solution** : Exécute d'abord :
```sql
DROP POLICY IF EXISTS "Users can delete their org devices" ON devices;
DROP POLICY IF EXISTS "Users can insert their org devices" ON devices;
DROP POLICY IF EXISTS "Users can update their org devices" ON devices;
```

Puis re-exécute le SQL complet ci-dessus.

### Problème 2 : La suppression échoue avec une erreur
**Ouvre la console navigateur** (F12) et regarde l'erreur.

Envoie-moi l'erreur exacte.

### Problème 3 : Les checkboxes n'apparaissent pas
**Le déploiement Vercel n'est pas terminé.**

1. Va sur : https://vercel.com/dashboard
2. Vérifie que le dernier deployment est "Ready" ✅
3. Attends qu'il se termine
4. Refresh la page (Ctrl+F5)

---

## ✅ Checklist

- [ ] SQL exécuté dans Supabase SQL Editor
- [ ] Déploiement Vercel terminé (status "Ready")
- [ ] Page refreshée (Ctrl+F5)
- [ ] Barre d'actions visible en haut
- [ ] Checkboxes visibles sur chaque appareil
- [ ] Suppression individuelle fonctionne
- [ ] Sélection multiple fonctionne
- [ ] Suppression multiple fonctionne

---

## 📝 Détails Techniques

### Fichiers Modifiés

1. **`supabase/migrations/20251231020000_add_devices_delete_policy.sql`** (nouveau)
   - Ajout policy DELETE pour devices
   - Ajout policy INSERT pour devices
   - Ajout policy UPDATE pour devices

2. **`web/src/app/dashboard/devices/devices-list.tsx`**
   - Ajout états : `selectedIds`, `deletingIds`, `confirmDeleteMultiple`
   - Ajout fonctions : `toggleSelection`, `selectAll`, `handleDeleteSingle`, `handleDeleteMultiple`
   - Ajout barre d'actions en haut
   - Ajout checkboxes sur chaque device
   - Refonte de la suppression

### RLS Policies Ajoutées

```sql
-- DELETE (permet aux users de supprimer leurs devices)
CREATE POLICY "Users can delete their org devices"
ON devices FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- INSERT (permet aux users de créer des devices via web app)
CREATE POLICY "Users can insert their org devices"
ON devices FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- UPDATE (permet aux users de modifier leurs devices)
CREATE POLICY "Users can update their org devices"
ON devices FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
```

---

**Status**: ⏳ En attente de l'exécution du SQL  
**Commit**: `3081e14`

**EXÉCUTE LE SQL MAINTENANT pour que la suppression fonctionne ! 🚀**





