# 🎨 Design System - SMS Gateway Flutter

## Vue d'ensemble

Cette application Flutter utilise un design **moderne, professionnel et élégant** basé sur Material Design 3 avec des améliorations personnalisées.

---

## 🎨 Palette de couleurs

### Couleurs principales
```dart
Primary:    #16A34A (Vert professionnel)
Secondary:  #22C55E (Vert clair)
Accent:     #3B82F6 (Bleu)
```

### Couleurs d'état
- ✅ **Succès**: `#16A34A` (Vert)
- ❌ **Erreur**: `#DC2626` (Rouge)
- ℹ️ **Info**: `#3B82F6` (Bleu)
- ⚠️ **Warning**: `#F59E0B` (Orange)

### Couleurs neutres
- **Texte principal**: `Colors.black87`
- **Texte secondaire**: `Colors.black54` / `Colors.grey.shade600`
- **Backgrounds**: `Colors.white`, `Colors.grey.shade50`
- **Bordures**: `Colors.grey.shade200`, `Colors.grey.shade300`

---

## 📝 Typographie

### Hiérarchie
- **Headline Large**: 32sp, Bold
- **Headline Medium**: 22sp, Bold
- **Title Large**: 18sp, Bold
- **Title Medium**: 16sp, SemiBold
- **Body Large**: 16sp, Regular
- **Body Medium**: 14sp, Regular
- **Caption**: 12sp, Regular

### Font Family
- **Primary**: SF Pro Display (system font)
- **Monospace**: Pour les tokens/codes

---

## 🎭 Composants UI

### 1. **Cards modernes** (`_ModernCard`)
- Border-radius: 24px
- Padding: 24px
- Border: 1px solid `Colors.grey.shade200`
- Shadow: Douce et élégante
- Support gradient pour cards importantes

**Variantes**:
- **Standard**: Fond blanc avec bordure
- **Gradient**: Fond dégradé (vert) avec shadow colorée

### 2. **Buttons animés** (`_AnimatedButton`)
- Border-radius: 16px
- Padding vertical: 16px
- Animation: Scale effect (0.95) au press
- Haptic feedback intégré

**Types**:
- **Primary**: Fond vert, texte blanc, elevation
- **Secondary**: Fond blanc, texte vert, bordure

### 3. **Status Cards** (`_StatusCard`)
- Auto-détection du type (succès/erreur/info)
- Icône contextuelle
- Couleurs adaptatives
- Animation d'entrée (fade + slide)

### 4. **Message Tiles** (`_MessageTile`)
- Border-radius: 16px
- Icône SMS avec background coloré
- Badge de comptage
- Animation en cascade (delay basé sur l'index)

---

## ✨ Animations & Transitions

### Animations d'entrée
- **Fade In**: Opacité 0 → 1 (300-800ms)
- **Slide Up**: Translate Y 30px → 0 (300-800ms)
- **Scale**: 0.95 → 1.0 (100-300ms)

### Transitions de page
- **Fade + Slide**: Combinaison douce
- **Duration**: 500ms
- **Curve**: `Curves.easeOutCubic`

### Micro-interactions
- **Button Press**: Scale 1.0 → 0.95 (100ms)
- **Haptic Feedback**: Light/Medium/Heavy selon l'action
- **Loading States**: CircularProgressIndicator fluide

---

## 📱 Pages

### **Page de Pairing**

#### Layout
- **Background**: Gradient léger (vert → bleu → blanc)
- **Hero Icon**: 100x100, gradient vert, shadow colorée
- **Glassmorphism Card**: BackdropFilter blur + transparent background

#### Éléments clés
1. **Hero animation** pour l'icône app
2. **TextField** multi-lignes pour le token
3. **Deux boutons** : Scanner QR + Valider
4. **Status card** animée en bas

#### Animations
- Fade + Slide au montage (800ms)
- Hero transition vers HomePage
- Haptic feedback sur toutes les actions

---

### **Scanner QR**

#### Layout
- **Fullscreen**: AppBar transparent sur scanner
- **Overlay**: Cadre carré 280x280 avec coins animés
- **Instructions**: Card flottante en bas

#### Design
- Bordure verte (3px) autour du cadre
- Coins décorés (4 triangles en L)
- Background noir semi-transparent
- Instructions dans une card arrondie

#### Fonctionnalités
- Auto-détection et fermeture
- Haptic feedback au scan
- Animation des coins (optionnel)

---

### **Page d'accueil (HomePage)**

#### AppBar
- **Gradient**: Vert professionnel
- **Title**: "SMS Gateway" centré, blanc, bold
- **Action**: Bouton logout avec dialog de confirmation

#### Sections

1. **Status Card** (Gradient)
   - Icône check_circle
   - État de connexion
   - Token display (tronqué)
   - Style glassmorphism

2. **Sync Card**
   - Titre "Synchronisation"
   - Bouton full-width avec loading state
   - Status message avec icône info

3. **Messages Card**
   - Titre + badge de comptage
   - Empty state avec icône inbox
   - Liste de `_MessageTile` avec animations en cascade

#### Interactions
- **Pull to refresh**: RefreshIndicator vert
- **Haptic feedback**: Sur toutes les actions
- **Dialog de confirmation**: Pour la déconnexion

---

## ♿ Accessibilité

### Semantic Labels
- Boutons avec `Semantics` descriptifs
- Tooltips sur les IconButtons
- Labels explicites pour les actions

### Contraste
- Ratio minimum 4.5:1 pour le texte
- Icônes visibles sur tous les backgrounds
- Focus indicators visibles

### Touch Targets
- Minimum 48x48 dp
- Padding généreux autour des boutons
- Espacement suffisant entre les éléments

---

## 🎯 Principes UX

### 1. **Feedback visuel immédiat**
- Loading states clairs
- Animations de confirmation
- Messages de status contextuels

### 2. **Navigation intuitive**
- Transitions fluides entre pages
- Breadcrumb visuel (statut toujours visible)
- Actions importantes accessibles facilement

### 3. **Performance**
- Animations optimisées (60 FPS)
- Lazy loading des listes
- Debounce sur les actions réseau

### 4. **Cohérence**
- Spacing system cohérent (multiples de 4)
- Border-radius uniformes (12, 16, 20, 24)
- Palette de couleurs limitée et cohérente

---

## 📦 Composants réutilisables

| Composant | Utilisation | Props clés |
|-----------|-------------|------------|
| `_ModernCard` | Container élégant | `child`, `gradient?` |
| `_AnimatedButton` | Bouton interactif | `icon`, `label`, `isPrimary`, `isLoading` |
| `_StatusCard` | Message de statut | `message` |
| `_MessageTile` | Item de liste SMS | `message`, `index` |

---

## 🚀 Optimisations

### Performances
- `const` constructors partout
- `SingleTickerProviderStateMixin` pour animations
- `TweenAnimationBuilder` pour animations simples
- `AnimatedSwitcher` pour transitions

### Code Quality
- Séparation composants réutilisables
- Nommage explicite et cohérent
- Documentation inline
- Pas de widgets anonymes complexes

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 600dp (default)
- **Tablet**: 600-900dp (à implémenter)
- **Desktop**: > 900dp (à implémenter)

### Adaptations
- Padding relatif à la largeur écran
- Font sizes adaptatives (optionnel)
- Layout flex/wrap pour petits écrans

---

## 🎨 Exemples de code

### Card avec gradient
```dart
_ModernCard(
  gradient: const LinearGradient(
    colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
  ),
  child: YourContent(),
)
```

### Bouton animé
```dart
_AnimatedButton(
  onPressed: () => doSomething(),
  icon: Icons.sync_rounded,
  label: 'Synchroniser',
  isPrimary: true,
  isLoading: false,
)
```

### Status message
```dart
_StatusCard(
  message: 'Token enregistré avec succès',
)
```

---

## 🔮 Améliorations futures

### Phase 2 (optionnel)
- [ ] Dark mode complet
- [ ] Thèmes personnalisables
- [ ] Animations Lottie/Rive
- [ ] Skeleton loaders
- [ ] Shimmer effects
- [ ] Parallax scrolling
- [ ] Custom page transitions (Hero, SharedAxis, etc.)
- [ ] Responsive layouts (tablet, desktop)

### Performance
- [ ] Image caching
- [ ] Network optimizations
- [ ] Background sync
- [ ] Local notifications

---

## 📚 Ressources

- [Material Design 3](https://m3.material.io/)
- [Flutter Animations](https://docs.flutter.dev/development/ui/animations)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Dernière mise à jour**: Décembre 2025  
**Version**: 1.0.0  
**Auteur**: Claude Sonnet 4.5 (Design) + GPT Codex Max (Code)

