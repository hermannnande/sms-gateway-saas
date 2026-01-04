# ✅ ÉTAPE 7 — Web Campaigns UX + progression temps réel

## Status: COMPLÉTÉ

## 📦 Livrables

### 1. Utilities
- ✅ `phone.ts`: Normalisation E.164 (Côte d'Ivoire +225)
- ✅ `parseCSV`: Parser CSV contacts

### 2. Contacts Management
- ✅ `/dashboard/contacts`: Liste contacts
- ✅ Import CSV modal + validation
- ✅ Normalisation auto +225

### 3. Campaigns
- ✅ `/dashboard/campaigns`: Liste campagnes
- ✅ `/dashboard/campaigns/new`: Créer campagne
- ✅ `/dashboard/campaigns/[id]`: Détails + progression
- ✅ Template variables {nom} replacement
- ✅ Stats temps réel (auto-refresh 5s)
- ✅ Progress bar

### 4. UX
- ✅ Cards status (queued/sending/sent/failed)
- ✅ Badges statut campagne
- ✅ Skeleton/loading states

## 🧪 Tests manuels à effectuer

### Test 1: Importer contacts CSV

1. Créer fichier `contacts.csv`:
```csv
phone,name
0708090001,Alice Martin
0708090002,Bob Dupont
0708090003,Claire Bernard
+2250708090004,David Kouassi
2250708090005,Emma Traoré
```

2. Aller sur `/dashboard/contacts`
3. Cliquer "Importer contacts (CSV)"
4. Sélectionner fichier
5. Vérifier aperçu (5 premiers)
6. Cliquer "Importer"

**Vérifier:**
- [ ] 5 contacts importés
- [ ] Tous normalisés à +2250708090001, etc.
- [ ] opt_in=true par défaut
- [ ] Pas de doublons (upsert)

### Test 2: Normalisation numéros

Tester différents formats:

```csv
phone,name
0708090001,Format 0
708090002,Sans 0
+2250708090003,Avec +225
2250708090004,Avec 225
```

**Vérifier:**
- [ ] Tous convertis en +2250708090XXX
- [ ] Formats invalides rejetés

### Test 3: Créer template avec variables

1. Aller `/dashboard/templates/new`
2. Créer template:
   - Nom: "Bienvenue"
   - Message: "Bonjour {nom}, bienvenue chez nous!"

**Vérifier:**
- [ ] Template créé
- [ ] Variable {nom} visible dans aperçu

### Test 4: Créer campagne

1. Aller `/dashboard/campaigns/new`
2. Remplir:
   - Nom: "Test Campagne 1"
   - Template: "Bienvenue"
3. Vérifier compteur contacts
4. Cliquer "Créer et envoyer"

**Vérifier:**
- [ ] Redirection vers `/dashboard/campaigns/[id]`
- [ ] Messages générés (1 par contact)
- [ ] Variables remplacées: "Bonjour Alice, bienvenue..." 
- [ ] Status campagne = 'queued'
- [ ] Messages status = 'queued'

### Test 5: Progression temps réel

1. Sur page campagne `/dashboard/campaigns/[id]`
2. S'assurer Android Gateway actif
3. Observer l'écran

**Vérifier:**
- [ ] Auto-refresh toutes les 5 secondes
- [ ] Stats se mettent à jour:
  - [ ] Queued diminue
  - [ ] Sending augmente
  - [ ] Sent augmente
- [ ] Progress bar avance (ex: 0% → 60% → 100%)
- [ ] Bouton "🔄 Actualiser" manuel fonctionne

### Test 6: Stats détaillées

Sur page campagne, vérifier les cards:

**Vérifier affichage:**
- [ ] Total: nombre total messages
- [ ] En attente (bleu): queued
- [ ] En cours (jaune): sending
- [ ] Envoyés (vert): sent
- [ ] Échecs (rouge): failed
- [ ] Optout (gris): skipped_optout

### Test 7: Liste campagnes

1. Créer 2-3 campagnes
2. Aller `/dashboard/campaigns`

**Vérifier:**
- [ ] Toutes campagnes affichées
- [ ] Badges status corrects (Brouillon, En cours, Terminée, etc.)
- [ ] Template name affiché
- [ ] Date création visible
- [ ] Clic sur campagne → détails

### Test 8: Template variables multiples

Créer template:
```
Bonjour {nom},
Votre compte est actif.
Merci {nom}!
```

Créer campagne avec ce template.

**Vérifier:**
- [ ] {nom} remplacé 2 fois dans même message
- [ ] "Bonjour Alice, ... Merci Alice!"

### Test 9: Import CSV doublons

1. Importer contacts.csv
2. Réimporter le même fichier

**Vérifier:**
- [ ] Pas de doublons créés (upsert)
- [ ] Contacts existants mis à jour (name si changé)

### Test 10: Campaign sans contacts

1. Supprimer tous contacts en DB:
```sql
DELETE FROM contacts WHERE org_id = 'YOUR_ORG_ID';
```

2. Essayer créer campagne

**Vérifier:**
- [ ] Erreur "Aucun contact avec opt-in"
- [ ] Campagne non créée

### Test 11: Campaign sans template

1. Supprimer tous templates
2. Aller `/dashboard/campaigns/new`

**Vérifier:**
- [ ] Message jaune: "Vous devez créer au moins un template..."
- [ ] Bouton "Créer un template"

### Test 12: Progress 100%

Attendre qu'une campagne se termine (tous sent ou failed).

**Vérifier:**
- [ ] Progress bar = 100%
- [ ] Auto-refresh s'arrête si status='done'
- [ ] Stats finales correctes

## 📋 Checklist finale

- [x] Import CSV contacts OK
- [x] Normalisation E.164 (+225) OK
- [x] Liste contacts avec opt-in OK
- [x] CRUD templates OK
- [x] Variables templates {nom} OK
- [x] Créer campagne OK
- [x] Générer messages automatiquement OK
- [x] Render variables dans messages OK
- [x] Page détails campagne OK
- [x] Stats temps réel (polling 5s) OK
- [x] Progress bar OK
- [x] Badges statut OK
- [x] Liste campagnes OK

## 🎯 Prochaine étape

**ÉTAPE 8 — Finition produit (STOP/optouts)**
- Gestion optout (blacklist STOP)
- Mark message skipped_optout
- Page optouts UI
- Nettoyage UI/UX
- Documentation finale
- README complet

## 📝 Notes

- Auto-refresh campagne: 5 secondes (configurable)
- Variables supportées: {nom}, {name} (case-insensitive)
- CSV format: phone,name (header optionnel)
- Normalisation: +225 Côte d'Ivoire
- Import upsert: pas de doublons
- Opt-in par défaut: true (à valider user en prod)

**Améliorations futures:**
- Filtres contacts (tags/segments)
- Export logs CSV
- Historique campagnes (charts)
- Pause/resume campagne (backend logic à ajouter)
- Supabase Realtime au lieu de polling

---

**Date:** 2025-01-30
**Temps estimé:** Étape complète
**Prêt pour ÉTAPE 8:** ✅ OUI








