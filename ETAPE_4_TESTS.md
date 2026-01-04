# ✅ ÉTAPE 4 — Pairing device (QR) + Devices page

## Status: COMPLÉTÉ

## 📦 Livrables

### 1. Edge Functions
- ✅ `device_pair`: Générer token device + hash SHA256
- ✅ `device_update_sim`: Mettre à jour SIM choisie + last_seen

### 2. Web Pages
- ✅ `/dashboard/devices`: Liste des appareils
- ✅ Modal "Ajouter appareil" avec QR code
- ✅ Vérification quota max_devices (selon plan)
- ✅ Affichage statut online/offline

### 3. Composants
- ✅ DevicesList: Affiche devices avec statut
- ✅ AddDeviceButton: Bouton conditionnel
- ✅ AddDeviceModal: Formulaire + QR code generation

### 4. Sécurité
- ✅ Token généré: 32 bytes random (64 hex)
- ✅ Stockage: hash SHA256 seulement
- ✅ Token envoyé UNE SEULE FOIS via QR

## 🧪 Tests manuels à effectuer

### Setup

```bash
# Terminal 1: Supabase + Edge Functions
cd supabase
supabase start
supabase functions serve

# Terminal 2: Web
cd web
pnpm dev
```

### Test 1: Accéder à la page Devices

1. Se connecter sur http://localhost:3000
2. Aller sur le dashboard
3. Cliquer "📱 Gérer Appareils"
4. Arriver sur `/dashboard/devices`

**Vérifier:**
- [ ] Page "Appareils Gateway" s'affiche
- [ ] Compteur "0 / X appareils connectés" (X selon plan)
- [ ] Bouton "+ Ajouter appareil" visible

### Test 2: Ajouter un appareil (générer QR)

1. Cliquer "+ Ajouter appareil"
2. Modal s'ouvre
3. Entrer nom: "Test Device 1"
4. Cliquer "Continuer"

**Vérifier:**
- [ ] Appel à `/functions/v1/device_pair` réussit
- [ ] QR code s'affiche
- [ ] Dans Supabase Studio > `devices`:
  - [ ] 1 ligne créée
  - [ ] `name` = "Test Device 1"
  - [ ] `token_hash` est présent (64 caractères hex)
  - [ ] `status` = 'offline'

### Test 3: Inspecter QR code

1. Clic droit sur QR code > "Ouvrir image dans nouvel onglet"
2. Utiliser un décodeur QR en ligne (ex: zxing.org/w/decode)
3. Décoder le QR

**Vérifier:**
- [ ] Contenu JSON visible:
  ```json
  {
    "device_id": "uuid...",
    "device_token": "64 hex chars...",
    "api_url": "http://localhost:54321"
  }
  ```
- [ ] `device_token` est présent (unique, 64 chars hex)

### Test 4: Vérifier limite max_devices

1. Vérifier votre plan actuel dans DB:
   ```sql
   SELECT * FROM subscriptions 
   JOIN plans ON subscriptions.plan_id = plans.id 
   WHERE org_id = 'votre_org_id';
   ```
   Noter `max_devices` (ex: Basic = 1)

2. Si déjà 1 device et max=1, essayer d'ajouter un 2ème

**Vérifier:**
- [ ] Bouton "+ Ajouter appareil" devient grisé (disabled)
- [ ] Tooltip "Limite d'appareils atteinte"
- [ ] Impossible d'ouvrir le modal

### Test 5: Simuler device online (SQL)

Puisque l'app Android n'est pas encore prête, simuler:

```sql
-- Mettre device online
UPDATE devices 
SET status = 'online', 
    last_seen_at = NOW(),
    selected_subscription_id = '1'
WHERE id = 'votre_device_id';
```

**Vérifier:**
- [ ] Rafraîchir `/dashboard/devices`
- [ ] Badge passe de "⚫ Hors ligne" à "🟢 En ligne"
- [ ] Affiche "📱 SIM: 1"
- [ ] Affiche "Dernière activité: ..."

### Test 6: Tester Edge Function device_update_sim (manuel)

Utiliser Postman ou curl:

```bash
# Récupérer device_token depuis QR code (étape 3)
# Remplacer YOUR_TOKEN par le token du QR

curl -X POST http://localhost:54321/functions/v1/device_update_sim \
  -H "Content-Type: application/json" \
  -d '{
    "device_token": "YOUR_TOKEN_HERE",
    "sim_subscription_id": "2"
  }'
```

**Vérifier:**
- [ ] Réponse: `{"success": true, "device_id": "..."}`
- [ ] Dans DB, `devices.selected_subscription_id` = "2"
- [ ] `devices.status` = "online"
- [ ] `devices.last_seen_at` = NOW

### Test 7: Offline après 5 minutes

Le device est considéré offline si `last_seen_at` > 5 min

Simuler:

```sql
-- Simuler ancien last_seen
UPDATE devices 
SET last_seen_at = NOW() - INTERVAL '10 minutes'
WHERE id = 'votre_device_id';
```

**Vérifier:**
- [ ] Rafraîchir `/dashboard/devices`
- [ ] Badge repasse à "⚫ Hors ligne"

### Test 8: Plusieurs devices

1. Upgrade plan à "Pro" (max 3 devices) via SQL:

```sql
-- Simuler upgrade plan
UPDATE subscriptions 
SET plan_id = 'pro'
WHERE org_id = 'votre_org_id';
```

2. Ajouter 2 autres devices via l'UI
3. Observer la liste

**Vérifier:**
- [ ] Compteur "3 / 3 appareils connectés"
- [ ] 3 devices affichés dans la liste
- [ ] Bouton "Ajouter" désactivé (limite atteinte)

## 📋 Checklist finale

- [x] Edge Function `device_pair` OK
- [x] Edge Function `device_update_sim` OK
- [x] Page `/dashboard/devices` OK
- [x] Modal + QR code generation OK
- [x] Token sécurisé (32 bytes random + SHA256)
- [x] Vérification quota max_devices OK
- [x] Statut online/offline basé sur last_seen_at
- [x] Affichage SIM choisie

## 🎯 Prochaine étape

**ÉTAPE 5 — Moteur d'envoi (claim + status)**
- Edge Function `claim_messages` (locking atomique)
- Edge Function `update_message_status` (sent/failed + retry)
- Vérification subscription active + quota
- Rate limiting

## 📝 Notes

- Token device: généré UNE FOIS, jamais réaffiché
- Hash SHA256 stocké en DB pour auth device
- Online si last_seen < 5 minutes
- Android app (ÉTAPE 6) utilisera ce token pour claim messages
- max_devices respecté selon plan

---

**Date:** 2025-01-30
**Temps estimé:** Étape complète
**Prêt pour ÉTAPE 5:** ✅ OUI








