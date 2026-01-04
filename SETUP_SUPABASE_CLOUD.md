# 🚀 Configuration Supabase Cloud

## ✅ Étape 1: Variables d'environnement

Créez le fichier `web/.env.local` avec ce contenu :

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://gamumybcooxanhjskpde.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hZwqTJIzRf69_sNQGUAdDb_6RXbGzj5

# Service Role Key - À récupérer après provisioning
SUPABASE_SERVICE_ROLE_KEY=VOTRE_SERVICE_ROLE_KEY_ICI

# Payfonte (optionnel - à configurer plus tard)
PAYFONTE_CLIENT_ID=sandbox_client_id
PAYFONTE_CLIENT_SECRET=sandbox_secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📋 Étape 2: Récupérer la Service Role Key

**Une fois le provisioning terminé (statut "Active")** :

1. Allez dans **Settings** (⚙️ dans la barre latérale gauche)
2. Cliquez sur **API**
3. Copiez la **service_role** key (section "Project API keys")
4. Remplacez `VOTRE_SERVICE_ROLE_KEY_ICI` dans `.env.local`

## 🗄️ Étape 3: Créer les tables (SQL)

1. Dans Supabase Dashboard, allez dans **SQL Editor** (icône 📝)
2. Cliquez **New query**
3. Copiez-collez tout le contenu de `supabase/migrations/20240101000000_initial_schema.sql`
4. Cliquez **Run** ▶️
5. Répétez pour :
   - `20240101000001_enable_rls.sql`
   - `20240101000002_claim_function.sql`
   - `seed.sql`

## 🚀 Étape 4: Lancer l'app web

```powershell
cd "C:\Users\nande\Desktop\SMS ENVOIE\web"
npm install
npm run dev
```

L'app sera accessible sur http://localhost:3000

## 📱 Prochaines étapes

1. ✅ Créer un compte sur l'app web
2. ✅ Configurer Payfonte (optionnel pour tests)
3. ✅ Build Android APK
4. ✅ Scanner QR code et tester !







