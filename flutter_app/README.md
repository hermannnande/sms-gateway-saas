# 📱 SMS Gateway - Application Flutter

Application mobile Android moderne pour l'envoi de SMS via une passerelle connectée au dashboard web SMS Gateway.

---

## 🎯 Fonctionnalités

### ✅ Actuellement implémenté
- ✨ **Design professionnel** : Interface moderne avec Material Design 3
- 📱 **Pairing QR Code** : Jumelage rapide via scan QR depuis le dashboard web
- 🔐 **Gestion sécurisée** : Stockage local du token d'authentification
- 📤 **Envoi SMS** : Utilisation des SIM du téléphone pour envoyer des SMS
- 🔄 **Synchronisation** : Récupération automatique des messages en attente
- 📊 **Suivi en temps réel** : Historique des derniers messages envoyés
- 🎨 **Animations fluides** : Transitions et micro-interactions élégantes
- ♿ **Accessibilité** : Support complet des guidelines d'accessibilité

### 🚀 Architecture
- **State Management** : Riverpod (providers + notifiers)
- **Backend** : Supabase (Edge Functions + PostgreSQL)
- **SMS natif** : MethodChannel Kotlin
- **Animations** : AnimationController + TweenAnimationBuilder
- **Design** : Material 3 + Composants personnalisés

---

## 📋 Prérequis

### Environnement de développement
- **Flutter SDK** : 3.5.4+
- **Dart** : 3.5.4+
- **JDK** : 17 (Oracle JDK ou OpenJDK)
- **Android Studio** : Latest version
- **Gradle** : 8.7

### Configuration système
```bash
# Vérifier Flutter
flutter doctor

# Vérifier JDK
java -version  # Devrait afficher 17.x

# Vérifier Gradle
gradle -v      # Devrait afficher 8.7
```

---

## 🛠️ Installation

### 1. Cloner et installer les dépendances
```bash
cd flutter_app
flutter pub get
```

### 2. Configuration Supabase
Modifier `lib/config.dart` avec vos clés Supabase :
```dart
class AppConfig {
  static const supabaseUrl = 'https://VOTRE_PROJET.supabase.co';
  static const supabaseAnonKey = 'VOTRE_ANON_KEY';
  static const claimBatchSize = 10;
}
```

### 3. Permissions Android
Les permissions suivantes sont déjà configurées dans `AndroidManifest.xml` :
- `SEND_SMS` : Envoi de SMS
- `RECEIVE_SMS` : Réception de SMS
- `READ_SMS` : Lecture des SMS
- `READ_PHONE_STATE` : État du téléphone
- `CAMERA` : Scanner QR code
- `INTERNET` : Connexion API

---

## 🏗️ Build

### APK Debug (pour test)
```bash
# Définir JAVA_HOME (Windows PowerShell)
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"
$env:PATH="$env:JAVA_HOME\bin;" + $env:PATH

# Build APK
flutter build apk --debug
```

### APK Release (production)
```bash
# Build APK signé
flutter build apk --release

# L'APK sera dans :
# build/app/outputs/flutter-apk/app-release.apk
```

### App Bundle (Google Play)
```bash
flutter build appbundle --release

# L'AAB sera dans :
# build/app/outputs/bundle/release/app-release.aab
```

---

## 📱 Installation sur appareil

### Via USB
```bash
# Activer le débogage USB sur l'appareil
# Puis :
flutter install

# Ou manuellement :
adb install build/app/outputs/flutter-apk/app-debug.apk
```

### Via fichier APK
1. Copier `app-debug.apk` sur le téléphone
2. Ouvrir avec l'explorateur de fichiers
3. Autoriser l'installation de sources inconnues
4. Installer l'application

---

## 🎨 Design System

L'application utilise un design system moderne et cohérent :

### Couleurs principales
- **Primary** : `#16A34A` (Vert professionnel)
- **Secondary** : `#22C55E` (Vert clair)
- **Accent** : `#3B82F6` (Bleu)

### Composants personnalisés
- `_ModernCard` : Cards avec gradient et glassmorphism
- `_AnimatedButton` : Boutons avec animations scale
- `_StatusCard` : Messages de statut avec auto-détection
- `_MessageTile` : Tuiles de messages avec animation cascade

### Animations
- **Fade In** : 300-800ms
- **Slide Up** : 30px → 0
- **Scale Press** : 1.0 → 0.95
- **Haptic Feedback** : Sur toutes les interactions

📖 **Documentation complète** : Voir [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

---

## 🚀 Utilisation

### 1. Premier lancement
1. Ouvrir l'application
2. Vous arrivez sur l'écran de **Pairing**

### 2. Jumeler l'appareil
**Option A - Scanner QR Code** :
1. Cliquer sur "Scanner QR"
2. Autoriser l'accès à la caméra
3. Scanner le QR code depuis le dashboard web

**Option B - Coller le token** :
1. Copier le token depuis le dashboard web
2. Coller dans le champ "Token de l'appareil"
3. Cliquer sur "Valider"

### 3. Permissions
Au premier envoi, autoriser les permissions :
- ✅ Envoyer et consulter des SMS
- ✅ Passer des appels téléphoniques

### 4. Synchroniser et envoyer
1. Sur l'écran d'accueil, cliquer sur **"Synchroniser et envoyer"**
2. L'app récupère les messages en attente depuis Supabase
3. Les SMS sont envoyés automatiquement
4. Les statuts sont mis à jour en temps réel

### 5. Pull to refresh
- Glisser vers le bas pour forcer une synchronisation

---

## 📂 Structure du projet

```
flutter_app/
├── lib/
│   ├── main.dart              # Point d'entrée + UI complète
│   ├── config.dart            # Configuration Supabase
│   ├── models/
│   │   └── message.dart       # Modèle Message
│   └── services/
│       ├── device_service.dart    # API Supabase
│       ├── sms_sender.dart        # Envoi SMS natif
│       └── token_storage.dart     # Stockage local
├── android/
│   ├── app/
│   │   ├── src/main/kotlin/
│   │   │   └── .../MainActivity.kt  # MethodChannel SMS
│   │   ├── build.gradle       # Config Gradle
│   │   └── AndroidManifest.xml
│   └── gradle.properties      # JDK config
├── pubspec.yaml               # Dépendances Flutter
├── README.md                  # Ce fichier
└── DESIGN_SYSTEM.md          # Documentation design
```

---

## 🔧 Dépendances principales

| Package | Version | Usage |
|---------|---------|-------|
| `flutter_riverpod` | ^2.6.1 | State management |
| `supabase` | ^2.0.0 | Backend API |
| `mobile_scanner` | ^5.1.1 | Scanner QR code |
| `permission_handler` | ^11.3.0 | Gestion permissions |
| `shared_preferences` | ^2.3.2 | Stockage local |
| `logger` | ^2.4.0 | Logging |

---

## 🐛 Dépannage

### Erreur de build Gradle
```bash
# Nettoyer le cache
cd android
./gradlew clean
cd ..
flutter clean
flutter pub get
flutter build apk --debug
```

### Erreur JDK
```bash
# Vérifier JDK 17 installé
java -version

# Si nécessaire, installer JDK 17
# Windows : https://www.oracle.com/java/technologies/downloads/#jdk17-windows
# Ou utiliser winget :
winget search jdk
```

### Permissions refusées
1. Ouvrir les **Paramètres** du téléphone
2. Aller dans **Applications** → **SMS Gateway**
3. Activer toutes les permissions (SMS, Téléphone, Caméra)

### Token invalide
1. Sur l'écran d'accueil, cliquer sur l'icône **logout**
2. Confirmer la déconnexion
3. Générer un nouveau token depuis le dashboard web
4. Jumeler à nouveau l'appareil

---

## 🎯 Workflow de développement

### Hot Reload
```bash
# Lancer en mode développement
flutter run

# Modifications → Sauvegarder
# Hot reload automatique (< 1s)
```

### Déboguer
```bash
# Logs Flutter
flutter logs

# Logs Android (natif)
adb logcat | grep SMS_GATEWAY
```

### Tests
```bash
# Tests unitaires
flutter test

# Tests d'intégration
flutter drive --target=test_driver/app.dart
```

---

## 📊 Performances

### Optimisations appliquées
- ✅ `const` constructors partout
- ✅ `SingleTickerProviderStateMixin` pour animations
- ✅ Lazy loading des listes
- ✅ Debounce sur les actions réseau
- ✅ Cache des ressources
- ✅ Animations 60 FPS

### Métriques cibles
- **Cold start** : < 2s
- **Hot reload** : < 500ms
- **Build APK** : < 2min
- **FPS animations** : 60 constant

---

## 🔐 Sécurité

### Bonnes pratiques
- ✅ Token stocké localement (SharedPreferences)
- ✅ Communication HTTPS uniquement
- ✅ Validation côté serveur (Edge Functions)
- ✅ RLS Supabase activée
- ⚠️ Ne JAMAIS commiter les clés API

### Checklist pré-production
- [ ] Obfuscation du code (`--obfuscate`)
- [ ] Signing APK avec keystore
- [ ] ProGuard rules configurées
- [ ] SSL pinning (optionnel)
- [ ] Rotation des clés API

---

## 📝 TODO / Roadmap

### Phase actuelle (✅ Terminé)
- [x] UI complète et professionnelle
- [x] Pairing QR code
- [x] Envoi SMS natif
- [x] Synchronisation Supabase
- [x] Animations et transitions
- [x] Gestion d'état Riverpod

### Phase 2 (Optionnel)
- [ ] Dark mode
- [ ] Multi-SIM support UI
- [ ] Notifications push
- [ ] Background sync automatique
- [ ] Statistiques détaillées
- [ ] Logs d'erreurs détaillés
- [ ] Crashlytics / Sentry

### Phase 3 (Avancé)
- [ ] Support iOS
- [ ] Internationalisation (i18n)
- [ ] Tests automatisés
- [ ] CI/CD (GitHub Actions)
- [ ] Distribution Play Store

---

## 🤝 Contribution

Ce projet fait partie de la plateforme **SMS Gateway SaaS** :
- **Web Dashboard** : Next.js 15 + Supabase
- **Android App** : Flutter (ce repo)
- **Backend** : Supabase (Edge Functions + PostgreSQL)

---

## 📄 Licence

Propriétaire - Tous droits réservés

---

## 🆘 Support

### Documentation
- [Flutter Docs](https://docs.flutter.dev/)
- [Riverpod Docs](https://riverpod.dev/)
- [Supabase Docs](https://supabase.com/docs)

### Contact
Pour toute question ou problème, contacter l'équipe de développement.

---

**Version** : 1.0.0  
**Dernière mise à jour** : Décembre 2025  
**Développement** :
- **Code** : GPT 5.1 Codex Max
- **Design** : Claude Sonnet 4.5
