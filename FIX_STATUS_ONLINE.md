# 🟢 Fix Statut "En Ligne" - Système Heartbeat

**Date**: 31 Décembre 2024  
**Problème**: Les appareils connectés s'affichent "Hors ligne" au lieu de "En ligne"  
**Solution**: Système de heartbeat (ping automatique toutes les 2 minutes)

---

## 🎯 Comment ça fonctionne maintenant

### ✅ Nouveau Système

**L'app mobile envoie automatiquement un "heartbeat" toutes les 2 minutes** :
- 📡 Appel à l'Edge Function `heartbeat`
- ✅ Met à jour `last_seen_at` et `status = 'online'`
- 🟢 L'appareil s'affiche **"En ligne"** sur la web app

**Critères pour être "En ligne"** :
- `status = 'online'` ET
- `last_seen_at` < 5 minutes

---

## ⚠️ URGENT : Déployer l'Edge Function Heartbeat

### Étape 1 : Déployer sur Supabase

Ouvre un terminal (PowerShell) et exécute :

```powershell
cd "C:\Users\nande\Desktop\SMS ENVOIE"
supabase functions deploy heartbeat --no-verify-jwt
```

**Tu devrais voir** :
```
Deploying...
Deployed function heartbeat to https://gamumybcoxxanhjakpde.supabase.co/functions/v1/heartbeat
```

---

## 📱 Rebuild l'App Mobile

### Étape 2 : Rebuild l'APK Flutter

Le code Flutter a été modifié pour envoyer des heartbeats. Tu dois rebuild l'APK.

```powershell
cd "C:\Users\nande\Desktop\SMS ENVOIE\flutter_app"

# Définir JAVA_HOME (si nécessaire)
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"
$env:PATH="$env:JAVA_HOME\bin;" + $env:PATH

# Build APK
flutter build apk --release
```

**L'APK sera dans** : `flutter_app/build/app/outputs/flutter-apk/app-release.apk`

### Étape 3 : Installer le nouvel APK

1. **Copie** `app-release.apk` sur ton téléphone
2. **Désinstalle** l'ancienne version de l'app
3. **Installe** le nouvel APK
4. **Ouvre** l'app et connecte-toi (email/password ou scan QR session)
5. **Scanne** le QR code de pairing (si device pas encore jumelé)

---

## 🧪 Test du Statut "En Ligne"

### Test 1 : Vérifier que le heartbeat fonctionne

1. **Ouvre** l'app mobile (HomePage)
2. **Attends 10 secondes** (le premier heartbeat est envoyé immédiatement)
3. **Va sur** la web app: https://sms-gateway-saas.vercel.app/dashboard/devices
4. **Refresh** (Ctrl+F5)
5. **Tu devrais voir** ton appareil avec le badge **🟢 En ligne** ✅

### Test 2 : Vérifier que le heartbeat se maintient

1. **Laisse** l'app mobile ouverte
2. **Attends 2-3 minutes**
3. **Refresh** la web app
4. **Le statut devrait rester** 🟢 En ligne ✅

### Test 3 : Vérifier le passage à "Hors ligne"

1. **Ferme** l'app mobile (swipe up / kill app)
2. **Attends 6 minutes** (au-delà de la limite de 5 min)
3. **Refresh** la web app
4. **Le statut devrait passer à** ⚪ Hors ligne ✅

---

## 📊 Détails Techniques

### Nouveaux Fichiers

#### 1. `supabase/functions/heartbeat/index.ts`
Edge Function qui reçoit le heartbeat et met à jour le device :
```typescript
// Update device last_seen + status
await supabaseClient
  .from('devices')
  .update({
    last_seen_at: new Date().toISOString(),
    status: 'online',
  })
  .eq('id', device.id)
```

#### 2. `flutter_app/lib/services/device_service.dart`
Ajout de la méthode `sendHeartbeat()` :
```dart
Future<void> sendHeartbeat({required String deviceToken}) async {
  final response = await client.functions.invoke(
    'heartbeat',
    body: {'device_token': deviceToken},
  );
}
```

#### 3. `flutter_app/lib/main.dart` (HomePage)
Timer qui appelle le heartbeat toutes les 2 minutes :
```dart
void _startHeartbeat() {
  _sendHeartbeat(); // Immédiat
  
  _heartbeatTimer = Timer.periodic(const Duration(minutes: 2), (timer) {
    _sendHeartbeat();
  });
}
```

### Cycle de Vie du Statut

```
App Mobile          Web App (Statut)
─────────────       ────────────────
Démarre            → (Hors ligne)
├─ Login OK        → (Hors ligne)
├─ Pairing QR OK   → (Hors ligne)
├─ HomePage        → 🟢 En ligne (heartbeat envoyé)
│  ├─ +2 min       → 🟢 En ligne (heartbeat auto)
│  ├─ +4 min       → 🟢 En ligne (heartbeat auto)
│  └─ +6 min       → 🟢 En ligne (heartbeat auto)
├─ App fermée      → 🟢 En ligne (pendant <5 min)
└─ Après 6 min     → ⚪ Hors ligne (last_seen > 5 min)
```

---

## 🔍 Troubleshooting

### Problème 1 : Le heartbeat ne se déploie pas

**Erreur** : `supabase: command not found`

**Solution** : Installe Supabase CLI :
```powershell
npm install -g supabase
```

**OU** déploie manuellement :
1. Va sur : https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/functions
2. Clique "New Edge Function"
3. Nom : `heartbeat`
4. Copie le contenu de `supabase/functions/heartbeat/index.ts`
5. Déploie

### Problème 2 : L'appareil reste "Hors ligne" après rebuild

**Vérifications** :
1. ✅ L'Edge Function `heartbeat` est bien déployée ?
   - Check : https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/functions
2. ✅ L'app mobile est bien la nouvelle version ?
   - Désinstalle complètement l'ancienne
   - Réinstalle le nouvel APK
3. ✅ L'app est bien sur HomePage (pas sur AuthPage) ?
   - Le heartbeat ne se lance que sur HomePage
4. ✅ Le device a bien un token valide ?
   - Va dans l'app → Menu → "Appareil actuel"

### Problème 3 : Erreur dans les logs Supabase

**Check les logs** :
1. Va sur : https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/logs
2. Filtre : "Edge Functions"
3. Cherche "heartbeat"
4. Vérifie s'il y a des erreurs

**Erreur possible** : "Device non trouvé"
- Le token est invalide ou a été supprimé
- Solution : Re-scan le QR code de pairing

---

## 🎉 Avantages du Système Heartbeat

### ✅ Avant (sans heartbeat)
- ❌ Appareil "Hors ligne" même quand connecté
- ❌ Passe "En ligne" uniquement lors d'envoi de SMS
- ❌ Impossible de savoir si l'app est active

### ✅ Après (avec heartbeat)
- ✅ Appareil "En ligne" dès que l'app est ouverte
- ✅ Statut reste "En ligne" toutes les 2 min
- ✅ Monitoring temps réel de l'activité des appareils
- ✅ Détection automatique si l'app est fermée (>5 min)

---

## 📝 Futures Améliorations (Optionnelles)

### 1. Heartbeat plus fréquent
Changer `Duration(minutes: 2)` → `Duration(minutes: 1)` pour un statut encore plus réactif.

### 2. Notification si appareil offline
Ajouter une alerte sur la web app si un appareil passe offline alors qu'il devrait être actif.

### 3. Statistiques de disponibilité
Calculer le % de temps "online" de chaque appareil sur la journée/semaine.

### 4. Heartbeat intelligent
N'envoyer le heartbeat que si l'app est au premier plan (utiliser `WidgetsBindingObserver`).

---

## ✅ Checklist

- [ ] Edge Function `heartbeat` déployée sur Supabase
- [ ] APK Flutter rebuild avec le nouveau code
- [ ] Ancien APK désinstallé du téléphone
- [ ] Nouveau APK installé
- [ ] App mobile ouverte sur HomePage
- [ ] Statut "En ligne" visible sur web app
- [ ] Heartbeat maintenu après 2-3 minutes

---

**Status**: ⏳ En attente du déploiement Edge Function + rebuild APK  
**Commit**: `a89878f`

**DÉPLOIE LA EDGE FUNCTION ET REBUILD L'APK MAINTENANT ! 🚀**

