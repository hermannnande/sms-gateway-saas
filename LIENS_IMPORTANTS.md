# 🔗 Liens Importants - SMS Gateway SaaS

## 📦 Repository GitHub
**URL**: https://github.com/hermannnande/sms-gateway-saas  
**Branch principale**: `main`  
**Dernier commit**: `de75075` (31 Décembre 2024)

---

## 🌐 Web App (Vercel)
**URL Production**: https://sms-gateway-saas.vercel.app  
**Dashboard Vercel**: https://vercel.com/dashboard  
**Auto-deploy**: Activé (push sur `main` → deploy automatique)

### Pages principales:
- Homepage: https://sms-gateway-saas.vercel.app
- Login: https://sms-gateway-saas.vercel.app/auth/login
- Register: https://sms-gateway-saas.vercel.app/auth/register
- Dashboard: https://sms-gateway-saas.vercel.app/dashboard
- Campaigns: https://sms-gateway-saas.vercel.app/dashboard/campaigns
- Devices: https://sms-gateway-saas.vercel.app/dashboard/devices
- Profile: https://sms-gateway-saas.vercel.app/dashboard/profile
- Billing: https://sms-gateway-saas.vercel.app/billing/plans

### Endpoints de debug:
- `/api/debug/env`: Check environment variables
- `/api/debug/devices`: Check devices listing (orgCount, deviceCount)

---

## 🗄️ Backend (Supabase Cloud)
**Project URL**: https://gamumybcoxxanhjakpde.supabase.co  
**Dashboard**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde  
**Project ID**: `gamumybcoxxanhjakpde`

### Accès Dashboard:
- **SQL Editor**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/sql
- **Database**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/database/tables
- **Authentication**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/auth/users
- **Edge Functions**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/functions
- **Storage**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/storage/buckets
- **Logs**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/logs

### Edge Functions déployées:
- `device_pair`: Create device + QR token
- `claim_messages`: Claim SMS batch (Android)
- `update_message_status`: Update SMS status
- `campaign_control`: Pause/Resume/Cancel campaigns

### Tables principales:
- `users` (Auth)
- `organizations`
- `org_members`
- `devices`
- `campaigns`
- `messages`
- `contacts`
- `templates`
- `opt_outs`
- `subscriptions`
- `plans`
- `payments`

---

## 📱 Mobile App (Flutter)
**Platform**: Android (APK)  
**Package**: `com.smsgateway.gateway`  
**Distribution**: GitHub Releases (semi-automatic updates)

### Build:
```bash
cd flutter_app
flutter build apk --release
```
**Output**: `flutter_app/build/app/outputs/flutter-apk/app-release.apk`

### Installation:
- Manual: Download APK → Install (bypass Play Protect)
- Guide client: `GUIDE_INSTALLATION_CLIENT.md`

### Signing:
- **Keystore**: `flutter_app/android/sms-gateway-release.jks` (gitignored)
- **Alias**: `sms_gateway_key`
- **Passwords**: `smsgateway2025`

---

## 🔑 Credentials & Secrets

### Supabase
**URL**: `https://gamumybcoxxanhjakpde.supabase.co`

**Anon Key** (public):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbXVteWJjb3h4YW5oamFrcGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDA1MzAsImV4cCI6MjA4MjY3NjUzMH0.0SLKPBAO5AaYguxnqUjb2nDVIGvZiK8N-3FQCREKk6w
```

**Service Role Key** (secret - NEVER expose client-side):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbXVteWJjb3h4YW5oamFrcGRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEwMDUzMCwiZXhwIjoyMDgyNjc2NTMwfQ.sIFvQRRj_eXBVHsuZmv2R_GJ890ajn-IFdeDYTJ6iKE
```

### Keystore Android
- **Store Password**: `smsgateway2025`
- **Key Password**: `smsgateway2025`
- **Key Alias**: `sms_gateway_key`

### Payfonte (à configurer)
- **API Key**: (à ajouter dans Vercel Environment Variables)
- **Webhook Secret**: (à ajouter)

---

## 📂 Fichiers de Configuration

### Web App (`web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://gamumybcoxxanhjakpde.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PAYFONTE_SECRET_KEY=<secret>
```

### Flutter App (`flutter_app/lib/main.dart`)
```dart
const SUPABASE_URL = 'https://gamumybcoxxanhjakpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Keystore (`flutter_app/android/key.properties`)
```properties
storeFile=sms-gateway-release.jks
storePassword=smsgateway2025
keyAlias=sms_gateway_key
keyPassword=smsgateway2025
```

---

## 🛠️ Commandes Rapides

### Développement Local
```bash
# Web App
cd web
npm install
npm run dev

# Flutter App
cd flutter_app
flutter pub get
flutter run
```

### Build Production
```bash
# Web App (auto via Vercel)
cd web
npm run build

# Flutter App
cd flutter_app
flutter build apk --release
```

### Déploiement
```bash
# Git push (auto-deploy Vercel)
git add .
git commit -m "message"
git push origin main

# Edge Functions
supabase functions deploy device_pair --no-verify-jwt
supabase functions deploy claim_messages --no-verify-jwt
supabase functions deploy update_message_status --no-verify-jwt
supabase functions deploy campaign_control --no-verify-jwt
```

### Database Migrations
```bash
# Exécuter migration (via SQL Editor Supabase Dashboard)
# OU via CLI:
supabase db push
```

---

## 🐛 Troubleshooting

### Web App
1. **TypeError: Failed to fetch** → Vérifier `NEXT_PUBLIC_SUPABASE_URL` et `ANON_KEY` dans Vercel
2. **Page vide** → Check browser console + Vercel logs
3. **Build failed** → Check ESLint/TypeScript errors (ou désactiver temporairement dans `next.config.ts`)

### Mobile App
1. **Application non installée** → Désinstaller ancienne version + vérifier package name
2. **Play Protect warning** → Normal (APK hors Play Store), cliquer "Installer quand même"
3. **QR code ne marche pas** → Vérifier format QR (refresh_token présent)
4. **SMS non envoyés** → Vérifier permissions SMS + SIM card insérée

### Backend
1. **RLS recursion** → Exécuter `20251231010000_fix_org_members_rls_recursion.sql`
2. **CORS error** → Vérifier CORS headers dans Edge Functions
3. **BOOT_ERROR** → Vérifier imports (utiliser `npm:` au lieu de `deno.land/std`)

---

## 📞 Support

- **Documentation**: `PROJECT_SUMMARY.md`, `README.md`, `flutter_app/README.md`
- **Issues GitHub**: https://github.com/hermannnande/sms-gateway-saas/issues
- **Logs Vercel**: https://vercel.com/dashboard
- **Logs Supabase**: https://supabase.com/dashboard/project/gamumybcoxxanhjakpde/logs

---

## ✅ Checklist Déploiement Production

- [x] Web App déployée (Vercel)
- [x] Backend configuré (Supabase Cloud)
- [x] Environment variables (Vercel + Supabase)
- [x] Edge Functions déployées
- [x] RLS policies fixes (recursion)
- [x] Mobile App buildée (APK signé)
- [x] Keystore sécurisé (gitignored)
- [x] Homepage design finalisé
- [x] Authentication (web + mobile)
- [x] Campaign system complet
- [x] Update system (GitHub Releases)
- [ ] Tests E2E complets
- [ ] Documentation client finale
- [ ] Privacy Policy + Terms of Service
- [ ] Monitoring configuré
- [ ] Backup strategy

---

**📅 Dernière mise à jour**: 31 Décembre 2024  
**🔖 Commit**: `de75075`  
**✅ Status**: Production Ready





