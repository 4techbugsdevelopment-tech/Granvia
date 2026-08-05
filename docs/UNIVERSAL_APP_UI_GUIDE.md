# Universal App UI Guide — `/app`

> **Purpose.** This is the single source of truth for building the `/app` (universal mobile app)
> screens for **every role except `super_admin`** — employer, sales executive, sub admin — so they
> look and feel identical to the existing **Guard / Associate Partner** app.
>
> The guard app (`src/mobile-guard/`) is the reference implementation. Every element, icon, colour,
> radius and motion below was extracted from that code. When you recreate a role's *web* page as an
> *app* screen, **match these patterns exactly** — do not invent new styles.
>
> Live reference: `https://granvia.llc/universal-app/login` → log in as a guard
> (`guard@granvia.test` / `password`) to see all of this rendered.

---

## 1. Routing & entry architecture

| Path | Meaning |
|------|---------|
| `/app` | **Legacy alias** — normalises to `/universal-app` (`UNIVERSAL_APP_LEGACY_PATH` in `roleRouting.ts`). Safe to use / link. |
| `/universal-app` | Root → splash → login |
| `/universal-app/login` | Single shared login (auto-detects role) |
| `/universal-app/associate` | Guard portal (reference app) |
| `/universal-app/employer` | Employer portal |
| `/universal-app/sales` | Sales executive portal |
| `/universal-app/sub-admin` | Sub admin portal |
| `/universal-app/unauthorized` | Shown to `super_admin` / unsupported roles |

**Key files**

| File | Role |
|------|------|
| `src/universal-mobile/UniversalMobileApp.tsx` | Shell: splash → login → role app, route resolution, access control |
| `src/universal-mobile/UniversalLogin.tsx` | Shared login |
| `src/universal-mobile/roleRouting.ts` | Path ↔ role mapping, access guards |
| `src/universal-mobile/MobileChrome.tsx` | **Shared chrome** (top drawer + bottom nav) used by non-guard roles |
| `src/mobile-guard/MobileApp.tsx` | Guard shell (fixed 6-slot bottom nav, no drawer) — **the reference** |

**Reuse rule (do NOT duplicate pages):** each role's existing `App` component takes an optional
`layout?: 'desktop' | 'mobile'` prop. In the `mobile` branch it keeps 100 % of its state and
`renderPage()`, but swaps its desktop sidebar for `<MobileChrome>`. The guard app is the only one
that renders directly (it was mobile-native from day one).

---

## 2. Two shell options

### 2a. Guard shell — `MobileApp.tsx` (reference)
- **Fixed bottom nav**, 5 primary items + a trailing **Logout** button.
- No hamburger drawer; every screen is one tap away.
- Nav items: `Home`, `Jobs`, `Attend.`, `Profile`, `Applied`.

```
NAV_ITEMS = [
  { id: 'dashboard',    icon: <LayoutDashboard size={20}/>, label: 'Home' },
  { id: 'jobs',         icon: <Search size={20}/>,          label: 'Jobs' },
  { id: 'attendance',   icon: <Clock size={20}/>,           label: 'Attend.' },
  { id: 'profile',      icon: <User size={20}/>,            label: 'Profile' },
  { id: 'applications', icon: <MoreHorizontal size={20}/>,  label: 'Applied' },
]
// + trailing <LogOut size={20}/> "Logout"
```

### 2b. Shared chrome — `MobileChrome.tsx` (employer / sales / sub-admin)
Use this for every other role. It gives you:
- **Top bar**: hamburger (`<Menu>`) → drawer, page `title`, `subtitle`, optional `headerRight` slot.
- **Bottom nav**: horizontally scrollable; items with `master:false`.
- **Drawer**: items with `master:true` under a **"Master Entry"** heading, all bottom items repeated
  under **"Quick Access"**, and **Logout** pinned at the bottom.

**Nav-item flag rule:** `master: true` → drawer; otherwise → bottom nav.

```tsx
<MobileChrome
  brandLabel="Employer"          // role label in top bar + drawer header
  title={activePageTitle}
  subtitle={activeCompanyName}   // optional
  navItems={navItems}            // MobileNavItem[] with master flags
  activeId={page}
  onNavigate={setPage}
  onLogout={handleLogout}
  accent="#8b1a1a"               // keep the role's accent; default is brand crimson
  headerRight={<CompanySwitcher/>} // optional
>
  {renderPage()}
</MobileChrome>
```

Master-flag assignments already agreed per role:
- **sub_admin**: `company`, `staff`, `verification` → master.
- **sales**: `post-job`, `discounts` → master.
- **employer**: all setup/secondary items → master; bottom = `dashboard`, `profile`, `jobs`, `applicants`, `payments`. Respect `visibleNavItems` (Aadhaar gating).
- **guard**: no master items (uses `MobileApp` directly).

---

## 3. Design tokens

### Colours
| Token | Hex | Usage |
|-------|-----|-------|
| Navy (primary) | `#0f1e3c` | headers, primary text, active nav, primary buttons |
| Navy-2 | `#1a2d50` | gradient partner for navy |
| Crimson (accent) | `#8b1a1a` | brand accent, active dot, secondary CTA, logo mark |
| Crimson-2 | `#a52a2a` / `#c0392b` | crimson gradient partner |
| Page background | `#f1f5f9` | app body |
| Card white | `#ffffff` | all cards / sheets |
| Muted text | `#94a3b8` / `#64748b` | labels, inactive nav, secondary |
| Border | `#e2e8f0` / `#eef2f7` | inputs, dividers |
| Input fill | `#f8fafc` | sheet inputs |

**Status colour system** (reuse verbatim — used in badges everywhere):
| State | Text | Background |
|-------|------|-----------|
| Success / Verified / Selected | `#166534` | `#dcfce7` |
| Pending / Warning / Open | `#854d0e` | `#fef9c3` |
| Error / Rejected / Blocked | `#7c2d12` | `#fee2e2` |
| Info / Viewed | `#075985` | `#e0f2fe` |
| Shortlisted / Jobs | `#1d4ed8` | `#dbeafe` |
| Neutral / fallback | `#64748b` | `#f1f5f9` |

**Domain accent colours** (dashboards, marker legend):
Jobs `#1d4ed8` · Guards `#166534` · Sites `#7c2d12` · Employers `#5b21b6` · Wallet `#854d0e`

### Gradients
| Name | Value | Usage |
|------|-------|-------|
| Header | `linear-gradient(135deg, #0f1e3c, #1a2d50)` | every screen header |
| Primary button | `linear-gradient(135deg, #0f1e3c, #1a2d50)` | main CTAs |
| Brand button | `linear-gradient(135deg, #0f1e3c, #8b1a1a)` | login / hero CTA |
| Danger button | `linear-gradient(135deg, #8b1a1a, #c0392b)` | destructive (Check Out) |
| Card back (flip) | `linear-gradient(135deg, #0f1e3c, #1a2d50)` | flip-card reverse |
| Wallet balance | `linear-gradient(135deg, #0f1e3c, #8b1a1a)` | balance hero card |
| Splash | `linear-gradient(160deg, #060d1a, #0f1e3c 50%, #1a0505)` | splash background |
| Drawer | `linear-gradient(180deg, #0a1628, #0f1e3c 60%, #120a0a)` | side drawer |

### Typography
- Font: **Inter** (body). **Georgia serif** only for the "GRANVIA" wordmark on splash/login.
- Screen title `<h1>`: `text-xl font-bold` white on header.
- Section heading `<h3>`: `text-sm font-bold text-gray-700`, or `text-xs font-semibold text-gray-400 uppercase tracking-wide` for sub-labels.
- Card title: `text-sm font-bold text-gray-900`.
- Meta / caption: `text-xs text-gray-400`.
- Nav label: `fontSize: 10, font-semibold`.

### Radius, shadow, spacing
- Radii: cards/sheets `rounded-2xl` (16px) or `rounded-3xl` (24px for hero/mark cards); pills `rounded-full`; small chips `rounded-lg`/`rounded-xl`.
- Card shadow: `0 2px 12px rgba(0,0,0,0.07)` (standard) · `0 8px 24px/32px rgba(0,0,0,0.1)` (elevated hero).
- Bottom-nav shadow: `0 -2px 16px rgba(0,0,0,0.08)`.
- Screen padding: `px-4` content, `px-5` on headers/sheets. Section gap: `mt-5`. Card gap: `space-y-2.5`.
- **Always** add `paddingTop: 'max(20px, env(safe-area-inset-top, 20px))'` on headers and honour bottom safe-area on nav/sheets.

---

## 4. Icon inventory

**Library:** `lucide-react`, imported per component. Standard sizes: **20** (bottom nav), **16** (buttons/rows), **14** (inline meta), **10–12** (tiny inline).

**Emoji** are used only in the guard dashboard "Quick Access" tiles and job filter chips.

### Icons by function (reuse the same icon for the same meaning across all roles)
| Meaning | Icon | Notes |
|---------|------|-------|
| Home / dashboard | `LayoutDashboard` | bottom nav |
| Search / find jobs | `Search` | |
| Attendance / time | `Clock` | |
| Location | `MapPin` | |
| Profile / user | `User` | |
| More / applications | `MoreHorizontal` | |
| Logout | `LogOut` | |
| Menu (drawer) | `Menu` | MobileChrome only |
| Close sheet | `X` | |
| Forward / drill-in | `ChevronRight` | |
| Expand / collapse | `ChevronDown` | FAQ accordion |
| Notifications | `Bell` | |
| Trending / hours | `TrendingUp` | |
| Documents | `FileText` | |
| Verification / shield | `Shield`, `ShieldCheck` | |
| Success / done | `CheckCircle` | green `#22c55e` when celebratory |
| Fail / declined | `XCircle` | |
| In progress | `Loader` | |
| Alert / error | `AlertCircle` | red inline |
| Check in / out | `LogIn` / `LogOut` | attendance actions |
| Calendar | `Calendar`, `CalendarClock` | |
| Wallet / coins | `Wallet` | |
| Money in / out | `ArrowDownLeft` / `ArrowUpRight` | credit / debit |
| Bank | `Building2` | |
| Edit | `Pencil` | |
| Upload | `Upload` | |
| Delete | `Trash2` | |
| Add | `Plus` | |
| Job / briefcase | `Briefcase` | empty states |
| Bank card | `CreditCard` | |
| Phone / email | `Phone` / `Mail` | contact rows |
| Password show/hide | `Eye` / `EyeOff` | |
| Lock | `Lock` | password field |
| Map / list toggle | `Map` (as `MapIcon`) / `List` | |
| Mark all read | `CheckCheck` | |
| Support | `LifeBuoy`, `MessageSquare`, `Headphones` (🎧 emoji on dashboard) | |
| Back | `ArrowLeft` | |

### Guard dashboard Quick-Access emoji + colour (pattern for any role's quick grid)
```
🔍 Find Jobs #0f1e3c   📍 Attendance #8b1a1a   📋 Applications #166534
🗓️ Availability #5b21b6  💰 Wallet #854d0e      👤 My Profile #7c2d12
🔔 Notifications #1d4ed8 🎧 Support #1e3a5f
```

---

## 5. Component patterns (copy these)

### 5.1 Screen header (gradient) — every screen starts with this
```tsx
<div className="px-4 pt-5 pb-6"
  style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)',
           paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}>
  <h1 className="text-white font-bold text-xl mb-1">Screen Title</h1>
  <p className="text-blue-200 text-xs">Subtitle / count line</p>
</div>
```
Rich header (dashboard/profile) adds: an animated decorative circle (`opacity-10` crimson blob,
`scale [1,1.1,1]` loop), avatar (`rounded-full`, initial letter on `rgba(139,26,26,0.5)`), and a
Bell button on `rgba(255,255,255,0.1)`.

### 5.2 Stat strip (FlipCards) — pulls up over the header with `-mt-4`
```tsx
<div className="grid grid-cols-3 gap-2.5 px-4 -mt-4 relative z-10">
  <FlipCard icon={<Clock size={14}/>} label="Days Present" value={<AnimatedNum val={n}/>} color="#0f1e3c" />
  …
</div>
```
`FlipCard` (`src/components/FlipCard.tsx`) flips to the Granvia logo on hover (desktop) / tap (mobile).
`AnimatedNum` counts up from 0.

### 5.3 Quick-access grid (flip tiles)
`grid grid-cols-3 gap-2.5`; each tile is a `DashboardFlipCard` `h-24`, front = white card with big emoji
+ label, back = navy gradient with "Open ›". Staggered entrance (`delay: 0.05 * i`).

### 5.4 List card (jobs, applications, attendance, tickets, transactions)
```tsx
<motion.div className="rounded-2xl p-4"
  style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
  <div className="flex items-start justify-between mb-3">
    <div className="flex-1 min-w-0 mr-2">
      <p className="font-bold text-gray-900 truncate">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
    </div>
    {/* status badge — see 5.5 */}
  </div>
  <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
    <span className="flex items-center gap-1"><MapPin size={10}/>{city}</span>
    <span className="flex items-center gap-1"><Clock size={10}/>{meta}</span>
  </div>
</motion.div>
```
Row with icon tile (attendance/wallet/notifications): a `w-9 h-9`/`w-10 h-10 rounded-xl` coloured
square holding a size-16 icon, tinted with the status colour system.

### 5.5 Status badge
```tsx
<span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
  style={{ background: cfg.bg, color: cfg.color }}>
  {cfg.icon}{cfg.label}
</span>
```
Use the **status colour system** table (§3). For application statuses copy the `STATUS_CONFIG`
map from `ApplicationsScreen.tsx` (applied/viewed/shortlisted/selected/…/rejected) verbatim.

### 5.6 Bottom sheet (the universal modal) — used for detail, edit, compose, confirm
```tsx
<AnimatePresence>{open && (
  <motion.div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
    <motion.div className="w-full rounded-t-3xl bg-white"
      style={{ maxHeight: '85vh', overflow: 'auto', paddingBottom: 'max(env(safe-area-inset-bottom,0px),16px)' }}
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }} onClick={e => e.stopPropagation()}>
      <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200"/></div>
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Sheet Title</h2>
          <button onClick={close} className="text-gray-400"><X size={18}/></button>
        </div>
        {/* body */}
      </div>
    </motion.div>
  </motion.div>
)}</AnimatePresence>
```
Grab handle, spring-up, tap-scrim-to-close, safe-area bottom padding — all mandatory.

### 5.7 Form controls (inside sheets)
- **Text input** (`SheetInput`): `w-full px-3.5 py-2.5 rounded-xl text-sm outline-none`,
  `border: 1.5px solid #e2e8f0; background: #f8fafc; color: #0f1e3c`; label `text-xs font-semibold text-gray-500 mb-1`.
- **Select**: same box style.
- **Chip multi-select** (`ChipSelect`): `rounded-full border` pills; selected = navy fill white text,
  unselected = white fill, `#64748b` text, `#e2e8f0` border.
- **Segmented buttons** (duration/frequency): equal-width `rounded-xl`, selected navy / unselected `#f1f5f9`.

### 5.8 Buttons
| Kind | Style |
|------|-------|
| Primary CTA | `w-full py-4 rounded-2xl font-bold text-white`, primary gradient, `whileTap={{ scale: 0.97 }}` |
| Secondary (on header) | `rgba(255,255,255,0.12)` bg, `1px solid rgba(255,255,255,0.2)` border, white text |
| Disabled | add `disabled:opacity-50` |
| Loading | swap label for a spinning `w-5 h-5 rounded-full border-2 border-white border-t-transparent` (`rotate 360`, 0.8s linear loop) |

### 5.9 Filter tabs / segmented toggle
Pills in a horizontal scroll row: active = navy fill + `0 4px 12px rgba(15,30,60,0.2)` shadow;
inactive = white + faint shadow. (See `JobSearch` filter tabs and list/map toggle.)

### 5.10 Empty state
Centred, `py-16`, a size-40/48 lucide icon in `text-gray-200/300`, a `text-gray-400` line, optional
`text-gray-300 text-sm` hint. e.g. `<Briefcase size={48} className="mx-auto mb-3 text-gray-200"/>`.

### 5.11 Loading state
Centred spinner `w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600` + `text-gray-400 text-sm mt-3` caption.

### 5.12 Inline error / toast
- Inline: `mx-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs` with `<AlertCircle size={13}/>`.
- Toast: `fixed bottom-24 left-4 right-4 z-50 … rounded-2xl bg-red-600 text-white`, slides up (`y: 20 → 0`), dismiss `X`.

---

## 6. Motion conventions (Framer Motion)
| Element | Animation |
|---------|-----------|
| Screen transition | `initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}}` `0.18s` (handled by shell) |
| List items | fade + `y:16→0` or `x:-10→0`, staggered `delay: i * 0.05–0.06` |
| Cards on mount | `opacity:0,y:10/16 → 1,0` |
| Buttons | `whileTap={{ scale: 0.97 }}` (0.88 for nav icons) |
| Sheets | spring `stiffness:300, damping:30`, `y:'100%'→0` |
| Flip cards | `rotateY 0/180`, `0.5s easeInOut` |
| Live dot | `scale:[1,1.4,1]` infinite 2s |
| Decorative blob | `scale:[1,1.1,1]` infinite 4–5s |
| GPS pulse (attendance) | expanding rings `scale:[1,1.5] opacity:[0.5,0]` staggered |

---

## 7. CSS utility classes (in `src/index.css`) — always apply
| Class | Purpose |
|-------|---------|
| `granvia-mobile` | wraps the app; applies all four `env(safe-area-inset-*)` paddings |
| `mobile-scroll` | momentum scroll + `overscroll-behavior-y: contain` for Android WebView |
| `mobile-touch-interactive` | disables hover transforms on touch; adds `scale(0.97)` active state |
| `mobile-bottom-nav` | bottom safe-area padding |
| `no-scrollbar` | hides scrollbar (horizontal bottom nav) |

APK mode (`.apk-mode`, set when `window.__GRANVIA_APK__` is true via the Expo WebView) removes the
desktop phone frame and notch. Don't hardcode heights — use `h-full` / `flex-1` inside the shell.

---

## 8. Recreating a role's web page as an app screen — checklist

1. **Locate the web page** (e.g. `src/employer/pages/…` or the `renderPage()` branch in the role's App).
2. **Do not fork the page** — add/extend the `layout="mobile"` branch so the same JSX renders inside `<MobileChrome>`.
3. **Wrap content**, not chrome: the page returns only the scrollable body; `MobileChrome` supplies header + nav.
4. Replace any **desktop table** with the **list-card** pattern (§5.4). Tables must never cause body
   horizontal scroll — if a table is unavoidable, wrap it in `overflow-x-auto`.
5. Convert **desktop dialogs** to **bottom sheets** (§5.6).
6. Convert **toolbars/filters** to **pill tabs** (§5.9).
7. Map the page's actions to the **button styles** (§5.8) and **status badges** (§5.5).
8. Add the **gradient header** (§5.1) with the page title; pass `title`/`subtitle` into `MobileChrome`.
9. Assign nav items and their `master` flags (§2b).
10. Apply the **CSS utility classes** (§7) and **safe-area** padding.
11. Verify at mobile width (375×812): no horizontal body overflow, no console errors, bottom nav
    reachable, sheets respect safe area.

---

## 9. Per-role screen map (what to build)

The bottom-nav labels below mirror the guard app's five-slot pattern. Secondary items go to the drawer.

| Role | Bottom nav (primary) | Drawer (master / quick) |
|------|----------------------|--------------------------|
| **Guard** *(done — reference)* | Home · Jobs · Attend. · Profile · Applied | — (Wallet, Availability, Notifications, Support reached via dashboard quick-access) |
| **Employer** | Dashboard · Jobs · Applicants · Payments · Profile | Companies, Sites, Wallet, Aadhaar/KYC, Agreements, Support (master); respects Aadhaar gating |
| **Sales** | Dashboard · Leads · Jobs · Profile | Post Job, Discounts (master) |
| **Sub Admin** | Dashboard · Guards · Reports · Profile | Company, Staff, Verification (master) |

> `super_admin` is intentionally excluded — it routes to `/universal-app/unauthorized` and stays on the
> secure web admin portal.

---

## 10. Golden rules
- **Reuse, don't duplicate.** One page, two layouts (`desktop` | `mobile`).
- **Match the tokens** in §3 exactly; never introduce new colours/radii.
- **Same icon = same meaning** across every role (§4).
- Every screen: gradient header → scrollable body → shared nav. Modals are bottom sheets.
- Everything is **touch-first**: `whileTap`, `mobile-touch-interactive`, safe-area padding, 48px+ targets.
