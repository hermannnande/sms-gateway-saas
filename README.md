## SMS Gateway SaaS

Plateforme **Web + Mobile** pour envoyer des campagnes SMS via les SIM d’un téléphone Android connecté.

- **Web**: Next.js (dashboard, campagnes, devices, admin)
- **Mobile**: Flutter (envoi SMS natif + arrière‑plan)
- **Backend**: Supabase (PostgreSQL + RLS + Edge Functions)

### Documentation

Lis l’index: **`DOCS_INDEX_FR.md`**

### Démarrage rapide (dev)

#### Web

```bash
cd web
npm install
npm run dev
```

#### Flutter

```bash
cd flutter_app
flutter pub get
flutter run
```

### ⚠️ Sécurité

Ne mets jamais en git:
- `SUPABASE_SERVICE_ROLE_KEY`
- secrets Payfonte / webhooks
- mots de passe keystore Android
