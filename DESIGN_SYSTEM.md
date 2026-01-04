# 🎨 Design System - SMS Gateway SaaS

## Vue d'ensemble

Système de design moderne combinant **néo-brutalisme**, **glassmorphism**, et **minimalisme 2.0** pour une expérience utilisateur immersive et performante.

---

## 🎨 Palette de Couleurs

### Primary (Vert Électrique - SMS Vibe)
```css
--primary: hsl(142 86% 45%)
--primary-foreground: hsl(0 0% 100%)
```
**Usage**: CTA principaux, succès, éléments actifs

### Accent (Bleu Cyber)
```css
--accent: hsl(217 91% 60%)
--accent-foreground: hsl(0 0% 100%)
```
**Usage**: Elements secondaires, templates, badges

### Secondary (Orange Énergique)
```css
--secondary: hsl(25 95% 53%)
--secondary-foreground: hsl(0 0% 100%)
```
**Usage**: Actions importantes, contacts, alertes

### Neutrals
```css
--background: hsl(0 0% 98%)       /* Light mode */
--foreground: hsl(240 10% 3.9%)
--muted: hsl(240 4.8% 95.9%)
--border: hsl(240 5.9% 90%)
```

### Dark Mode
```css
--background: hsl(240 10% 3.9%)
--foreground: hsl(0 0% 98%)
--card: hsl(240 10% 6%)
--border: hsl(240 3.7% 15.9%)
```

---

## 📐 Typographie

### Polices
- **Sans-serif**: Inter (corps de texte, UI)
- **Monospace**: JetBrains Mono (code, IDs, données techniques)

### Scale
```css
h1: text-4xl md:text-6xl font-black (36-60px)
h2: text-3xl md:text-4xl font-black (30-36px)
h3: text-2xl font-black (24px)
h4: text-xl font-bold (20px)
body: text-base (16px)
small: text-sm (14px)
```

### Poids
- **Black (900)**: Titres principaux
- **Bold (700)**: Sous-titres, labels, CTA
- **Semibold (600)**: Liens, navigation
- **Regular (400)**: Corps de texte

---

## 🔲 Composants

### Buttons

#### Primary Button (Néo-brutalisme)
```tsx
<button className="px-8 py-4 bg-gradient-primary text-white rounded-xl font-bold text-lg shadow-brutal-primary border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200">
  Texte
</button>
```

#### Accent Button
```tsx
<button className="px-6 py-3 bg-gradient-accent text-white rounded-xl font-bold shadow-brutal-accent border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200">
  Texte
</button>
```

#### Outline Button
```tsx
<button className="px-6 py-3 border-3 border-border rounded-xl font-semibold hover:bg-muted transition">
  Texte
</button>
```

### Cards

#### Glass Card
```tsx
<div className="glass-card rounded-2xl p-6 border-4 border-black/10 dark:border-white/10 hover-lift">
  {/* Content */}
</div>
```

#### Gradient Card
```tsx
<div className="glass-card rounded-3xl p-8 border-4 border-primary/20 bg-gradient-hero">
  {/* Content */}
</div>
```

### Badges

#### Status Badge
```tsx
<span className="px-3 py-1.5 rounded-xl text-sm font-bold border-2 bg-green-500/10 text-green-700 border-green-500/30">
  ✅ Actif
</span>
```

---

## ✨ Animations

### Keyframes
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 20px hsl(142 86% 45% / 0.3); }
  50% { box-shadow: 0 0 40px hsl(142 86% 45% / 0.6); }
}
```

### Classes utilitaires
```css
.animate-slide-up
.animate-fade-in
.animate-scale-in
.animate-float
.animate-pulse-glow
.hover-lift
```

---

## 🎭 Effets Spéciaux

### Glassmorphism
```css
.glass-card {
  backdrop-blur: 24px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}
```

### Néo-brutalisme (Ombres)
```css
.shadow-brutal: 8px 8px 0px 0px rgba(0,0,0,1)
.shadow-brutal-sm: 4px 4px 0px 0px rgba(0,0,0,1)
.shadow-brutal-primary: 8px 8px 0px 0px hsl(142 86% 45%)
.shadow-brutal-accent: 8px 8px 0px 0px hsl(217 91% 60%)
```

### Hover Lift
```css
.hover-lift {
  transition: all 0.3s ease;
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}
```

---

## 📱 Responsive Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

---

## 🎯 Icônes (Emoji)

Convention d'usage des emoji comme iconographie :

| Catégorie | Emoji | Usage |
|-----------|-------|-------|
| Messages | 📨 📩 📬 | SMS, Inbox |
| Appareils | 📱 📲 | Téléphones, devices |
| Actions | 🚀 ⚡ ✨ | Lancer, rapide, nouveau |
| Statut | ✅ ❌ ⏳ ⏸️ | Success, error, loading, pause |
| Navigation | 📊 👥 📝 💳 | Dashboard, contacts, templates, billing |
| Info | 💡 ℹ️ ⚠️ | Tips, info, warning |

---

## 🌈 Gradients

### Primary Gradient
```css
background: linear-gradient(135deg, hsl(142 86% 45%) 0%, hsl(158 64% 52%) 100%);
```

### Accent Gradient
```css
background: linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(242 87% 63%) 100%);
```

### Hero Background
```css
background: linear-gradient(135deg, hsl(142 86% 45% / 0.1) 0%, hsl(217 91% 60% / 0.1) 100%);
```

---

## ♿ Accessibilité

### Contrastes
- Ratio minimum : **4.5:1** pour le texte normal
- Ratio minimum : **3:1** pour le texte large (18px+)

### Focus States
Tous les éléments interactifs doivent avoir un état focus visible :
```css
focus:outline-none focus:ring-4 focus:ring-primary/20
```

### Dark Mode
Tous les composants supportent automatiquement le dark mode via les variables CSS.

---

## 📦 Composants Réutilisables

### Button Component
```tsx
import { Button } from '@/components/ui/button'

<Button variant="primary" size="lg">
  Texte
</Button>
```

### Card Component
```tsx
import { Card } from '@/components/ui/card'

<Card variant="glass">
  {children}
</Card>
```

---

## 🎨 Guidelines UX

### Micro-interactions
- Tous les boutons ont un effet hover/active
- Les cards ont un effet lift au hover
- Les badges ont des animations subtiles

### Feedback Visuel
- Loading states : spinner + texte
- Success : checkmark + message vert
- Error : X + message rouge
- Info : icône info + message bleu

### Spacing
- Utiliser la scale 4px : 4, 8, 12, 16, 24, 32, 48, 64
- Padding cards : 24-32px (p-6 à p-8)
- Gap grid : 16-24px (gap-4 à gap-6)

---

## 🚀 Performance

### Optimisations
- Utilisation de `backdrop-blur` avec parcimonie
- Animations CSS plutôt que JS
- Images lazy loading
- Polices avec `display: swap`

### Best Practices
- Minimiser les re-renders
- Utiliser `will-change` pour les animations fréquentes
- Éviter les ombres complexes sur de grandes surfaces

---

## 📝 Checklist Création Composant

- [ ] Responsive (mobile-first)
- [ ] Dark mode support
- [ ] Animations fluides
- [ ] États hover/focus/active
- [ ] Accessible (ARIA, keyboard)
- [ ] Micro-interactions
- [ ] Consistent avec le design system

---

**Version**: 1.0  
**Dernière mise à jour**: Décembre 2025  
**Maintenu par**: SMS Gateway Team







