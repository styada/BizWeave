# Bizweave Design System

> **Bizweave** — Your business, woven online while you sleep.  
> AI agents that build, run, and market your web presence for existing businesses (retail, SaaS, services).

---

## Brand

| Token | Value |
|-------|-------|
| **Name** | Bizweave |
| **Tagline** | Your business, woven online while you sleep |
| **Voice** | Confident, warm, operator-first — not hype-y startup speak |
| **Audience** | Existing business owners (liquor stores, boutiques, local SaaS) who want a full web business without hiring |

### Positioning vs Polsia

- **Polsia**: AI employee for founders building new companies  
- **Bizweave**: AI team for **existing** businesses — ingest inventory, location, brand; agents weave site + marketing + ops with BYOK LLMs and safeguard review

---

## Color Palette

Dark-first premium aesthetic — deep ink backgrounds, woven gold accent, cool teal for trust/safeguards.

```css
/* Core */
--bg-base:        #0a0b0f;      /* Page background */
--bg-elevated:    #12141c;      /* Cards, panels */
--bg-surface:     #1a1d28;      /* Inputs, secondary cards */
--bg-muted:       #252836;      /* Borders, dividers */

/* Brand */
--accent-primary: #e8b84a;      /* Woven gold — CTAs, highlights */
--accent-glow:    #f5d078;      /* Hover, gradients */
--accent-secondary: #5eead4;    /* Teal — success, safeguard, trust */

/* Text */
--text-primary:   #f4f4f5;
--text-secondary: #a1a1aa;
--text-muted:     #71717a;

/* Semantic */
--success:        #34d399;
--warning:        #fbbf24;
--error:          #f87171;
--safeguard:      #818cf8;      /* Safeguard agent badge */
```

### Gradients

- **Hero mesh**: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232,184,74,0.15), transparent)`  
- **Card shine**: `linear-gradient(135deg, rgba(232,184,74,0.08) 0%, transparent 50%)`  
- **Agent pulse**: gold → teal at 45°

---

## Typography

| Role | Font | Weight | Size (desktop) |
|------|------|--------|----------------|
| Display | **Instrument Serif** | 400 | 3.5–4.5rem |
| Headline | **DM Sans** | 600–700 | 1.5–2rem |
| Body | **DM Sans** | 400–500 | 1rem |
| Mono / code | **JetBrains Mono** | 400 | 0.875rem |
| Label | **DM Sans** | 500 | 0.75rem, uppercase tracking |

Line height: 1.5 body, 1.1 display. Letter-spacing: -0.02em on display.

---

## Spacing & Layout

- Base unit: **4px**
- Container max: `1280px` (marketing), `1440px` (dashboard)
- Section padding: `py-24` marketing, `py-8` app
- Card padding: `p-6` default, `p-8` feature cards
- Grid: 12-column; dashboard sidebar `280px` fixed

---

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `sm` | 6px | Badges, chips |
| `md` | 10px | Buttons, inputs |
| `lg` | 16px | Cards |
| `xl` | 24px | Modals, hero panels |
| `full` | 9999px | Pills, avatars |

---

## Shadows & Depth

```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.4);
--shadow-md:  0 4px 24px rgba(0,0,0,0.35);
--shadow-lg:  0 12px 48px rgba(0,0,0,0.45);
--shadow-glow: 0 0 40px rgba(232,184,74,0.12);
```

Glass panels: `backdrop-blur-xl bg-white/[0.03] border border-white/[0.06]`

---

## Motion

| Pattern | Duration | Easing |
|---------|----------|--------|
| Page enter | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Hover lift | 200ms | ease-out |
| Skeleton pulse | 1.5s | infinite |
| Agent step | 600ms stagger | spring-ish |
| Progress bar | 300ms | ease |

**Loading states**

1. **Page loader**: Full-viewport weave pattern animation + "Weaving your workspace…"  
2. **Skeleton**: Rounded rects on `bg-muted`, shimmer gradient L→R  
3. **Agent pipeline**: Vertical stepper with pulsing dot on active step, checkmark on complete  
4. **Button**: Spinner inline + disabled; label changes to "Running agents…"  
5. **Streaming**: Typewriter cursor on agent output panels

Respect `prefers-reduced-motion`: disable parallax and reduce transitions to opacity only.

---

## Components

### Buttons

- **Primary**: Gold bg, dark text, shadow-glow on hover  
- **Secondary**: `bg-surface` border `border-muted`  
- **Ghost**: Transparent, text secondary → primary on hover  
- **Danger**: Error red, outline only  

Min height `44px`, padding `px-6`.

### Cards

- Elevated surface + 1px border `white/6%`  
- Optional top gradient border (gold 2px) for featured  
- Agent cards: icon left, status pill right, activity log below fold

### Forms

- Labels above, `text-sm text-secondary`  
- Inputs: `bg-surface border-muted focus:ring-2 focus:ring-accent-primary/40`  
- BYOK fields: monospace, mask toggle, "Test connection" secondary button

### Navigation

- Marketing: sticky top, blur, logo + 4 links + CTA  
- Dashboard: left sidebar, collapsible on mobile drawer

### Agent status badges

| Status | Color | Icon |
|--------|-------|------|
| idle | muted | circle |
| running | gold pulse | loader |
| complete | success | check |
| blocked | safeguard purple | shield |
| failed | error | x |

---

## Page Templates

### Landing (`/`)

1. Hero — display headline, subcopy on existing businesses, dual CTA (Start / See agents)  
2. Social proof strip — "Built for stores, SaaS, and services"  
3. How it works — 4 steps: Connect → Weave → Run → Market  
4. Agent roster — Planner, Builder, Marketing, Support, **Safeguard** (bastion)  
5. BYOK section — your keys, your models, encrypted  
6. Use cases — liquor store, SaaS, restaurant tabs  
7. CTA footer  

### Onboarding (`/onboarding`)

Multi-step wizard with progress bar: Business type → Details → Data sources → BYOK → Launch

### Dashboard (`/dashboard`)

- Overview: active business, agent timeline, site preview thumbnail  
- Projects list  
- Settings: BYOK, profile  

### Site preview (`/dashboard/[id]/preview`)

Iframe or split view of generated site JSON → rendered HTML

---

## Iconography

- Lucide React, 20px default, 24px nav  
- Agent icons: `Brain`, `Hammer`, `Megaphone`, `MessageCircle`, `ShieldCheck`

---

## Accessibility

- WCAG AA contrast on text (4.5:1 minimum)  
- Focus rings visible on all interactive elements  
- Skip link to main content  
- `aria-live="polite"` on agent log streams

---

## Copy Guidelines

- Say **"your store"** / **"your business"**, not "users"  
- Safeguard agent: **"Last-bastion review before anything goes live"**  
- BYOK: **"Your API keys never leave encrypted storage"**  
- Avoid "revolutionary", "game-changing" — prefer concrete outcomes

---

## File / Code Conventions

- Tailwind utility-first; CSS variables in `globals.css`  
- Components in `src/components/ui` (primitives) and `src/components/{feature}`  
- Server actions for mutations; API routes for agent SSE streams
