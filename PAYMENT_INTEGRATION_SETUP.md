# Configuration du système de paiement - Pages de remerciement + Activation manuelle/Code promo

## ✅ CE QUI EST PRÊT

### 1. Pages de remerciement (Thank You Pages)
- ✅ `/billing/thank-you/plan-1` - Plan 1 appareil (9,900 F CFA)
- ✅ `/billing/thank-you/plan-3` - Plan 3 appareils (15,900 F CFA)
- ✅ `/billing/thank-you/plan-5` - Plan 5 appareils (22,900 F CFA)

Chaque page inclut :
- Animation de succès
- Détails du plan acheté
- Instructions étape par étape
- **Bouton WhatsApp pré-rempli** avec message personnalisé pour le client
- Lien retour au dashboard

### 2. Interface Admin - Activation manuelle
- ✅ `/admin/activate` - Activer manuellement un abonnement
  - Recherche client par email
  - Sélection du plan
  - Durée personnalisable (30, 60, 90 jours ou autre)
  - Activation en 1 clic

### 3. Interface Admin - Codes promo
- ✅ `/admin/promo-codes` - Générer et gérer des codes promo
  - Génération de codes (format: SMS1-ABC123, SMS3-XYZ789, etc.)
  - Configuration : plan, durée, nombre d'utilisations max, expiration
  - Liste des codes générés avec statut
  - Activation/désactivation des codes

### 4. Interface Client - Activer un code promo
- ✅ `/dashboard/promo` - Page pour entrer un code promo
  - Formulaire simple
  - Validation en temps réel
  - Activation instantanée de l'abonnement
  - Bouton accessible depuis le dashboard (bouton "🎟️ Code promo")

### 5. Base de données
- ✅ Tables `promo_codes` et `promo_code_redemptions` créées
- ✅ Politiques RLS configurées
- ✅ Migration SQL prête : `supabase/migrations/20250105_create_promo_codes.sql`

---

## ⚙️ CONFIGURATION REQUISE

### Étape 1 : Exécuter la migration SQL

```bash
# Depuis le dossier du projet
cd supabase
supabase db push
```

Ou manuellement depuis le dashboard Supabase :
1. Aller dans SQL Editor
2. Copier le contenu de `supabase/migrations/20250105_create_promo_codes.sql`
3. Exécuter

### Étape 2 : Configurer votre plateforme de paiement

**IMPORTANT** : Vous devez configurer vos liens de paiement pour rediriger vers les pages de remerciement après un paiement réussi :

| Plan | Montant | URL de redirection (Success URL) |
|------|---------|----------------------------------|
| 1 appareil | 9,900 F CFA | `https://smsenvoie.com/billing/thank-you/plan-1` |
| 3 appareils | 15,900 F CFA | `https://smsenvoie.com/billing/thank-you/plan-3` |
| 5 appareils | 22,900 F CFA | `https://smsenvoie.com/billing/thank-you/plan-5` |

**Comment faire :**
1. Créez 3 liens de paiement sur votre plateforme (Moneroo, PayTech, Wave, etc.)
2. Pour chaque lien, configurez l'URL de redirection après succès
3. Copiez les 3 liens de paiement générés
4. **Mettre à jour le fichier `web/src/app/billing/plans/plans-card.tsx`** :

```typescript
// Remplacer les lignes 18-22 par vos nouveaux liens
const PAYMENT_LINKS: Record<string, string> = {
  'monthly_1': 'VOTRE_LIEN_1_APPAREIL',     // 9,900 XOF
  'monthly_3': 'VOTRE_LIEN_3_APPAREILS',    // 15,900 XOF
  'monthly_5': 'VOTRE_LIEN_5_APPAREILS',    // 22,900 XOF
}
```

### Étape 3 : Créer un compte admin

Si vous n'avez pas encore de compte admin :

```sql
-- Depuis le SQL Editor de Supabase
-- Remplacez 'votre-email@example.com' par votre email

UPDATE app_users
SET role = 'super_admin'
WHERE email = 'votre-email@example.com';
```

---

## 📋 WORKFLOW COMPLET

### Workflow A : Activation manuelle par Admin

```
1. Client paie via le lien de paiement
   ↓
2. Redirection vers /billing/thank-you/plan-X
   ↓
3. Client voit les instructions + bouton WhatsApp
   ↓
4. Client clique sur WhatsApp (message pré-rempli)
   ↓
5. Vous recevez le message avec son email
   ↓
6. Vous allez sur https://smsenvoie.com/admin/activate
   ↓
7. Vous cherchez son email
   ↓
8. Vous sélectionnez le plan + durée
   ↓
9. Vous cliquez sur "Activer l'abonnement"
   ↓
10. Le client reçoit son quota immédiatement ✅
   ↓
11. Vous confirmez au client sur WhatsApp
```

**Délai estimé** : 5-30 minutes (selon votre disponibilité)

### Workflow B : Code promo (activation instantanée)

```
1. Client vous contacte sur WhatsApp
   ↓
2. Vous allez sur https://smsenvoie.com/admin/promo-codes
   ↓
3. Vous générez un code (ex: SMS1-ABC123)
   ↓
4. Vous envoyez le code au client sur WhatsApp
   ↓
5. Client va sur https://smsenvoie.com/dashboard/promo
   ↓
6. Client entre le code
   ↓
7. Abonnement activé instantanément ✅
```

**Délai estimé** : Instantané (0 minute)

---

## 🎯 AVANTAGES DES 2 WORKFLOWS

### Activation manuelle (Workflow A)
- ✅ Contrôle total sur chaque activation
- ✅ Vérification du paiement avant activation
- ✅ Contact direct avec le client (WhatsApp)
- ❌ Requiert intervention humaine (5-30 min)

### Code promo (Workflow B)
- ✅ Activation instantanée 24/7
- ✅ Pas d'intervention requise après génération du code
- ✅ Peut être utilisé pour des offres spéciales
- ✅ Le client peut activer quand il veut
- ❌ Moins de contrôle anti-fraude

---

## 📱 NUMÉRO WHATSAPP

Le numéro WhatsApp actuellement configuré est : **+225 07 78 03 00 75**

Pour le changer, modifier dans :
- `web/src/app/billing/thank-you/plan-1/page.tsx` (ligne 80)
- `web/src/app/billing/thank-you/plan-3/page.tsx` (ligne 80)
- `web/src/app/billing/thank-you/plan-5/page.tsx` (ligne 80)
- `web/src/app/billing/plans/page.tsx` (ligne 196)
- `web/src/app/dashboard/promo/redeem-promo-form.tsx` (ligne 116)

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Pages de remerciement
1. Accéder à : https://smsenvoie.com/billing/thank-you/plan-1
2. Vérifier l'affichage correct
3. Tester le bouton WhatsApp (message pré-rempli)

### Test 2 : Activation manuelle Admin
1. Se connecter avec un compte admin
2. Aller sur : https://smsenvoie.com/admin/activate
3. Chercher un email de test
4. Activer un abonnement de test (7 jours)
5. Vérifier dans le dashboard du client que l'abonnement est actif

### Test 3 : Code promo
1. Aller sur : https://smsenvoie.com/admin/promo-codes
2. Générer un code de test (Plan 1 appareil, 7 jours)
3. Se déconnecter
4. Se reconnecter avec un compte client
5. Aller sur : https://smsenvoie.com/dashboard/promo
6. Entrer le code généré
7. Vérifier l'activation de l'abonnement

### Test 4 : Workflow complet
1. Créer un compte de test
2. "Payer" (simuler le paiement en accédant directement à la page de remerciement)
3. Suivre le workflow A ou B
4. Vérifier que le quota est bien attribué

---

## 🔐 SÉCURITÉ

- ✅ Tous les endpoints sont protégés par authentification
- ✅ Les codes promo ont une limite d'utilisation
- ✅ Les codes promo peuvent expirer
- ✅ Les codes promo peuvent être désactivés à tout moment
- ✅ RLS (Row Level Security) activée sur toutes les tables
- ✅ Seuls les admins peuvent générer des codes et activer manuellement

---

## ❓ FAQ

**Q : Puis-je offrir des essais gratuits avec les codes promo ?**
R : Oui ! Générez un code avec 7 jours de durée et envoyez-le au client.

**Q : Un code peut-il être utilisé plusieurs fois ?**
R : Oui, vous pouvez configurer `max_uses` lors de la génération (1 par défaut).

**Q : Comment voir qui a utilisé un code promo ?**
R : Dans Supabase, consultez la table `promo_code_redemptions`.

**Q : Puis-je révoquer un abonnement activé par erreur ?**
R : Oui, dans Supabase SQL Editor :
```sql
UPDATE subscriptions
SET status = 'canceled'
WHERE org_id = 'ORG_ID_ICI';
```

**Q : Comment changer la durée d'un abonnement déjà actif ?**
R : Via `/admin/activate`, recherchez le client et "réactivez" avec la nouvelle durée.

---

## 📞 CONTACT SUPPORT

Si vous avez besoin d'aide pour la configuration, contactez-moi avec :
- Les 3 nouveaux liens de paiement
- Le numéro WhatsApp à utiliser (si différent de celui configuré)
- Tout problème rencontré lors des tests

