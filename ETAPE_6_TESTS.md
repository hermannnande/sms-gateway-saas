# ✅ ÉTAPE 6 — Android SMS send via SIM choisie

## Status: COMPLÉTÉ

## 📦 Livrables

### 1. Data Layer
- ✅ `DevicePrefs`: Encrypted SharedPreferences (device_token)
- ✅ `ApiModels`: Data classes pour API
- ✅ `ApiClient`: OkHttp client (claim/update/sim)

### 2. SMS Layer
- ✅ `SmsManagerHelper`: Gestion SMS multi-SIM
- ✅ `SmsBroadcastReceiver`: Écoute sent/delivered + update status API

### 3. Service
- ✅ `SmsGatewayService`: Foreground Service
- ✅ Polling loop (10s interval)
- ✅ Claim → Send → Delay (3s)

### 4. UI
- ✅ `MainActivity`: QR scanner + SIM picker + Service control
- ✅ Permissions handler
- ✅ Status display

### 5. Sécurité
- ✅ Token chiffré via EncryptedSharedPreferences
- ✅ MasterKey AES256

## 🧪 Tests manuels à effectuer

### Prérequis

- Téléphone Android physique (API 24+)
- 2 cartes SIM insérées (optionnel mais recommandé)
- Android Studio installé

### Test 1: Build & Install APK

```bash
cd android
# Ouvrir dans Android Studio
# Build > Build Bundle(s) / APK(s) > Build APK(s)
# Installer sur téléphone via USB
```

**Vérifier:**
- [ ] APK compile sans erreur
- [ ] App s'installe sur téléphone
- [ ] App s'ouvre sans crash

### Test 2: Permissions

1. Ouvrir l'app
2. Accepter toutes les permissions demandées:
   - SEND_SMS
   - READ_PHONE_STATE
   - CAMERA
   - POST_NOTIFICATIONS (Android 13+)

**Vérifier:**
- [ ] Toutes permissions accordées
- [ ] Status affiche "⚠️ Non configuré"

### Test 3: Scanner QR Code

1. Sur web (localhost ou ngrok pour test):
   - Aller sur `/dashboard/devices`
   - Ajouter device → générer QR
2. Sur Android:
   - Cliquer "📷 Scanner QR Code"
   - Scanner le QR affiché sur web

**Vérifier:**
- [ ] Scanner s'ouvre
- [ ] QR scanné avec succès
- [ ] Toast "Appareil configuré avec succès!"
- [ ] Status affiche "✅ Configuré"
- [ ] Device ID visible (8 premiers chars)
- [ ] Bouton "Sélectionner SIM" activé

### Test 4: Sélectionner SIM

1. Cliquer "📱 Sélectionner SIM"
2. Choisir une SIM dans la liste

**Vérifier:**
- [ ] Liste des SIM s'affiche (ex: "SIM 1 (Orange CI)")
- [ ] SIM sélectionnée affichée dans status
- [ ] Toast "SIM mise à jour sur le serveur"
- [ ] Dans web `/dashboard/devices`:
  - [ ] Device passe "🟢 En ligne"
  - [ ] SIM affichée (ex: "📱 SIM: 0")
- [ ] Bouton "▶️ Démarrer" activé

### Test 5: Créer messages test (Backend)

Via Supabase SQL Editor:

```sql
-- Créer campagne + messages
INSERT INTO campaigns (org_id, name, status) 
VALUES ('YOUR_ORG_ID', 'Test Android', 'running') 
RETURNING id;

INSERT INTO messages (org_id, campaign_id, to_phone_e164, body_final, status)
VALUES 
  ('YOUR_ORG_ID', 'CAMPAIGN_ID', '+2250708090001', 'Test SMS 1', 'queued'),
  ('YOUR_ORG_ID', 'CAMPAIGN_ID', '+2250708090002', 'Test SMS 2', 'queued'),
  ('YOUR_ORG_ID', 'CAMPAIGN_ID', '+2250708090003', 'Test SMS 3', 'queued');
```

**Vérifier:**
- [ ] 3 messages status='queued' en DB

### Test 6: Démarrer Service

1. Sur Android, cliquer "▶️ Démarrer"
2. Observer notification "SMS Gateway"

**Vérifier:**
- [ ] Service démarre
- [ ] Notification persistante visible
- [ ] Toast "Service démarré"
- [ ] Status affiche "🟢 Service actif"

### Test 7: Envoi SMS (RÉEL!)

⚠️ **ATTENTION:** Ceci enverra de vrais SMS. Utilisez des numéros test!

1. Observer les logs Android (Logcat):
   ```
   tag:SmsGatewayService
   tag:SmsBroadcastReceiver
   ```
2. Attendre ~10 secondes (intervalle polling)

**Vérifier dans logs:**
- [ ] "Claimed 3 messages for device..."
- [ ] "SMS sent to +225... via SIM 0"
- [ ] "SMS sent successfully: message_id"
- [ ] "Status updated successfully: message_id -> sent"

**Vérifier dans DB:**
- [ ] Messages passent status='sending' → 'sent'
- [ ] `sent_at` rempli
- [ ] `device_id` et `sim_subscription_id` remplis

**Vérifier téléphones destinataires:**
- [ ] SMS reçus (si numéros valides)

### Test 8: Delay entre SMS

Observer les logs timestamp:

```
10:30:01 - SMS sent to +2250...001
10:30:04 - SMS sent to +2250...002  // +3 secondes
10:30:07 - SMS sent to +2250...003  // +3 secondes
```

**Vérifier:**
- [ ] Délai ~3 secondes entre chaque SMS
- [ ] Respecte rate limit

### Test 9: Test échec SMS (mode avion)

1. Créer 1 message test en DB
2. Activer **mode avion** sur Android
3. Laisser service tourner
4. Attendre claim

**Vérifier dans logs:**
- [ ] "SMS failed (no service): message_id"
- [ ] "Status updated: message_id -> queued_retry"

**Vérifier dans DB:**
- [ ] Message status='queued' (retry)
- [ ] try_count=1
- [ ] last_error='No service'
- [ ] device_id=NULL (libéré)

5. Désactiver mode avion
6. Attendre 10s

**Vérifier:**
- [ ] Message réclamé à nouveau
- [ ] Envoyé avec succès (try_count=1)

### Test 10: Arrêter Service

1. Cliquer "⏹️ Arrêter"

**Vérifier:**
- [ ] Service s'arrête
- [ ] Notification disparaît
- [ ] Toast "Service arrêté"

### Test 11: Persistence (Redémarrage app)

1. Fermer l'app (swipe away)
2. Rouvrir l'app

**Vérifier:**
- [ ] Status affiche "✅ Configuré"
- [ ] SIM toujours sélectionnée
- [ ] Device token persisté (chiffré)

### Test 12: Multi-SIM (si disponible)

Si 2 SIM:

1. Sélectionner SIM 2
2. Démarrer service
3. Envoyer message

**Vérifier:**
- [ ] SMS envoyé via SIM 2 (vérifier indicateur réseau)
- [ ] `sim_subscription_id` = "1" en DB

### Test 13: Battery Optimization

Sur Android 12+, vérifier que l'app peut tourner en arrière-plan:

Paramètres > Apps > SMS Gateway > Batterie > Non optimisé

**Si optimisé:**
- [ ] Service peut être tué par système
- [ ] Ajouter instructions user dans app (TODO pour prod)

## 📋 Checklist finale

- [x] DevicePrefs (encrypted) OK
- [x] API Client (claim/update/sim) OK
- [x] SmsManager multi-SIM OK
- [x] BroadcastReceiver (sent/delivered) OK
- [x] Foreground Service OK
- [x] Polling loop (10s) OK
- [x] SMS delay (3s) OK
- [x] QR Scanner OK
- [x] SIM Picker OK
- [x] Permissions runtime OK
- [x] Update status API après envoi OK
- [x] Retry après échec (via backend) OK

## 🎯 Prochaine étape

**ÉTAPE 7 — Web Campaigns UX + progression temps réel**
- Create campaign UI
- Import contacts CSV
- Render template variables
- Generate messages
- Start/pause/resume campaign
- Progress tracking (sent/failed/queued)
- Real-time updates (polling ou Realtime)
- Export logs CSV

## 📝 Notes

- Token device chiffré via EncryptedSharedPreferences (AES256)
- SmsManager.getSmsManagerForSubscriptionId() pour multi-SIM
- BroadcastReceiver écoute sent/delivered et update backend
- Foreground Service obligatoire Android 8+
- Delay 3s entre SMS (configurable selon plan)
- Retry géré backend (max 3)
- WorkManager non implémenté (optionnel pour robustesse)

**⚠️ Production:**
- Ajouter instructions battery optimization
- Gérer reconnexion réseau (actuellement simple polling)
- WorkManager pour relance si service tué
- Logs persistants locaux (actuellement seulement Logcat)
- UI stats (messages envoyés/jour)

---

**Date:** 2025-01-30
**Temps estimé:** Étape complète
**Prêt pour ÉTAPE 7:** ✅ OUI








