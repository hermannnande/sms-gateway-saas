# SMS Gateway Android App

Application Android Gateway pour envoyer des SMS.

## Setup

1. Ouvrir le projet dans **Android Studio Hedgehog** ou plus récent
2. Sync Gradle
3. Connecter un appareil Android physique (API 24+)
4. Build & Run

## Permissions requises

- `SEND_SMS`: Envoyer des SMS
- `READ_PHONE_STATE`: Lire infos SIM
- `POST_NOTIFICATIONS`: Notifications (Android 13+)
- `INTERNET`: Communication avec backend
- `FOREGROUND_SERVICE`: Service en arrière-plan

## Structure

```
app/
├── data/          # Models & data layer
├── service/       # Foreground Service SMS
├── ui/            # Activities & fragments
└── utils/         # Helpers
```

## Build APK

```bash
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

## Tests

1. Scanner QR code depuis web app
2. Choisir SIM (SIM1/SIM2)
3. Démarrer service
4. Vérifier envoi SMS

## Status

- [x] ÉTAPE 1: Setup projet Android OK
- [ ] ÉTAPE 4: QR pairing
- [ ] ÉTAPE 6: SMS sender complet




