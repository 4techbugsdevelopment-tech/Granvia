# Granvia — 3D & Motion Effects Plan

A catalog of 3D/immersive effects, where each applies, and which are recommended.
Portal-aware by design: the landing page can be rich, the **guard app is mobile-first
so it stays light (no WebGL)**, and everything respects `prefers-reduced-motion`.

**Already available:** `framer-motion@12` (used in 44 files), `recharts`, `leaflet`,
a `FlipCard` component. Most effects below need **no new library**.

---

## 1. Effect catalog (by technique)

| # | Effect | Technique / Library | Cost | Best fit |
|---|--------|--------------------|------|----------|
| E1 | **Card 3D tilt** (rotateX/Y toward cursor + glare) | Framer Motion `useMotionValue`/`useTransform` (no lib) | Low | Portal cards, KPI/stat tiles, job/applicant cards |
| E2 | **Card flip** (front ↔ back) | existing `FlipCard` / CSS `rotateY` | Low | Guard digital ID, job details, company cards |
| E3 | **Spotlight/glow follow** (radial gradient tracks mouse) | CSS var + pointer move | Low | Cards, CTAs, login panel |
| E4 | **Magnetic buttons** (element eases toward cursor) | Framer Motion springs | Low | Primary CTAs (Post Job, Secure Login) |
| E5 | **Depth press** (translateZ + dynamic shadow on tap) | Framer Motion `whileTap` | Low | All buttons |
| E6 | **Parallax layers** (mouse/scroll move layers at diff depth) | Framer Motion `useScroll`/pointer | Low–Med | Landing hero, login art, splash |
| E7 | **Scroll-linked reveals** (rise + rotateX as they enter) | Framer Motion `useInView`/`useScroll` | Low | Landing sections, dashboards |
| E8 | **Shared-element "magic move"** (card expands into detail) | Framer Motion `layoutId` | Med | List → detail (guards, jobs, applicants) |
| E9 | **Spring page/route/tab transitions** (slide/fade/rotateY) | Framer Motion `AnimatePresence` | Low | Portal switch, admin pages, mobile screens, tabs |
| E10 | **Count-up stats** (spring number roll) | Framer Motion `animate`/`useSpring` | Low | All dashboard KPIs |
| E11 | **Swipeable 3D card stack** (Tinder-style, rotate on drag) | Framer Motion `drag` | Med | Guard **JobSearch** (swipe to apply/skip) |
| E12 | **Animated mesh-gradient / aurora background** | CSS or tiny shader | Low | Landing, login, splash backgrounds |
| E13 | **Particle / starfield field** | `@tsparticles/react` or custom canvas | Med | Dark login screens, hero |
| E14 | **3D globe with city arcs** ("186+ cities") | **`cobe`** (~5 kB) or R3F | Med | Landing hero, admin overview |
| E15 | **Full WebGL 3D hero object** (rotating shield/badge) | `@react-three/fiber` + `drei` + `three` | High | Landing hero (desktop only, lazy) |
| E16 | **3D / extruded charts** | R3F or CSS-3D wrapper on recharts | High | Admin Reports (optional) |
| E17 | **Success burst / confetti** (particles on milestone) | canvas-confetti (~2 kB) | Low | Aadhaar verified, check-in, hire |
| E18 | **Splash 3D logo assembly** (depth + rotate build-in) | Framer Motion 3D transforms | Low | All portal splash screens |
| E19 | **Skeleton shimmer / 3D flip loaders** | CSS | Low | All data-loading states |
| E20 | **Smooth momentum scroll** | `lenis` (~2 kB) | Low | Landing (desktop) |

---

## 2. Portal-aware strategy

| Portal | Device | Aggressiveness | WebGL? |
|--------|--------|----------------|--------|
| **Landing** (`App.tsx`) | both | **Rich** — first impression | Yes (desktop, lazy) |
| **Login / Splash** (all) | both | **Showcase** moments | Light shader/particles |
| **Admin** (`web-admin/`) | desktop | Moderate — professional, data-first | Optional |
| **Employer** (`employer/`) | desktop | Moderate | Optional |
| **Sales / Sub-admin** | desktop | Moderate (share admin patterns) | Optional |
| **Guard app** (`mobile-guard/`) | mobile | **Light** — 60 fps, battery-safe | **No** |

---

## 3. Where each effect goes (page/component map)

### Landing (`App.tsx` → LandingPage) — richest
- **Hero:** 3D globe with city arcs (E14 `cobe`) *or* rotating shield (E15). Mesh-gradient bg (E12) + particles (E13).
- **5 portal cards:** 3D tilt + spotlight + lift (E1+E3+E5). ⭐ highest impact / lowest cost.
- **Stat band** (12,400+ / 3,800+ / 186+): count-up (E10) + parallax (E6).
- **Section reveals:** scroll-linked rise/rotate (E7). Smooth scroll (E20).

### Login & Splash (all portals)
- **Splash:** 3D logo assembly (E18), depth parallax (E6).
- **Login marketing panel** ("India's Premier…"): parallax floating security icons (E6), aurora bg (E12), starfield (E13).
- **Login card:** subtle tilt (E1) + glow border (E3). Magnetic "Secure Login" (E4).

### Admin (`web-admin/`)
- **Dashboard KPI cards:** tilt + count-up + spotlight (E1+E10+E3).
- **Sidebar:** active-item morph via `layoutId` (E8/E9).
- **Page transitions:** spring slide/fade (E9).
- **Tables** (GuardList, EmployerManagement): stagger reveal + row hover-lift (E7).
- **Row → detail:** shared-element expand (E8).
- **Reports (recharts):** entrance animations; optional 3D bars (E16).
- **Overview map:** keep Leaflet; optional 3D-globe alternate view (E14).

### Employer (`employer/`)
- **Dashboard KPIs:** tilt + count-up (E1+E10).
- **Aadhaar gate success:** 3D flip + confetti burst (E2+E17). ⭐ satisfying milestone.
- **Job / applicant / company cards:** tilt + spotlight; flip for details (E1+E2+E3).
- **Post-job:** multi-step with spring transitions (E9).

### Guard app (`mobile-guard/`) — light only
- **Profile digital ID:** `FlipCard` front photo / back details (E2). ⭐ perfect existing fit.
- **JobSearch:** swipeable 3D card stack — swipe right = apply (E11). ⭐ signature interaction.
- **Bottom nav:** spring active indicator + icon micro-bounce (E9).
- **Attendance check-in:** success flip + burst (E2+E17).
- **Screen transitions:** spring slide (E9). Skeleton shimmer (E19).
- **Cards:** subtle tilt/press only (E1 light + E5); optional device-orientation tilt.

### Sales / Sub-admin
- **KPI tiles:** tilt + count-up (E1+E10).
- **Manpower map:** optional 3D globe/heatmap (E14).

---

## 4. Recommended tiers (what SHALL be there)

**Tier 1 — do first (high impact · low cost · all portals · no new deps):**
- E1 portal-card & KPI tilt + E3 spotlight
- E10 count-up stats
- E9 spring page/tab/screen transitions
- E2 guard ID FlipCard
- `prefers-reduced-motion` support (required)

**Tier 2 — showcase moments (add `cobe`, `canvas-confetti`):**
- E14 landing hero globe with city arcs
- E12 mesh-gradient + E13 particles on login/splash
- E18 splash 3D logo
- E17 Aadhaar / check-in success burst
- E11 guard job swipe-stack

**Tier 3 — heavier / optional (add R3F + three, lenis):**
- E15 full WebGL hero object
- E16 3D charts
- E8 shared-element magic-move across all lists
- E4 magnetic buttons, E20 smooth scroll

---

## 5. Libraries to add (by tier)

| Tier | Add | Size | Why |
|------|-----|------|-----|
| 1 | — | — | Framer Motion already covers it |
| 2 | `cobe` | ~5 kB | Lightweight 3D globe (vs full three.js) |
| 2 | `canvas-confetti` | ~2 kB | Success bursts |
| 2 | `@tsparticles/react` *(optional)* | ~30 kB | Particle backgrounds (or hand-roll canvas) |
| 3 | `@react-three/fiber` + `@react-three/drei` + `three` | ~150 kB+ | Real WebGL scenes — **lazy-load, desktop-only** |
| 3 | `lenis` | ~2 kB | Smooth momentum scroll (landing) |

---

## 6. Cross-cutting rules (non-negotiable)
- **`prefers-reduced-motion`:** every effect degrades to a fade/none. Wrap in a `useReducedMotion()` guard.
- **GPU-only animation:** animate `transform`/`opacity` only; never animate layout-triggering props.
- **Mobile budget:** no WebGL in the guard app; cap particle counts; target 60 fps.
- **Lazy-load 3D:** `React.lazy` + `Suspense` for R3F/cobe so initial bundle stays small; static fallback on mobile.
- **Theme-aware:** effects read the light/dark theme.
- **A shared `<Tilt>`, `<SpotlightCard>`, `<CountUp>`, `<PageTransition>` primitive set** so effects are consistent and applied once, reused everywhere.
