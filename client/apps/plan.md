# Routing & Game Selection Unification Plan

## Executive Summary

This plan addresses two key objectives:
1. **Add routing system to mobile** for improved loading/UX (lazy loading, code splitting)
2. **Share game selection code** between desktop and mobile apps

---

## Current State Analysis

### Desktop (`client/apps/game`)
| Aspect | Implementation |
|--------|---------------|
| **Router** | `react-router-dom` v7.9.3 |
| **Lazy Loading** | Extensive - Three.js, blockchain, UI libs in separate chunks |
| **Game Selection** | Full `WorldSelectPanel` with multi-chain support |
| **Onboarding** | 5-phase flow (`world-select` → `account` → `loading` → `settlement` → `ready`) |

### Mobile (`client/apps/eternum-mobile`)
| Aspect | Implementation |
|--------|---------------|
| **Router** | `@tanstack/react-router` v1.74.0 |
| **Lazy Loading** | None - all pages eagerly imported |
| **Game Selection** | None - hardcoded to single world |
| **Onboarding** | Simplified - direct wallet connect → blitz registration |

---

## Proposed Architecture

### Phase 1: Create Shared Game Selection Package

Create `@bibliothecadao/game-selection` in `packages/game-selection/`:

```
packages/game-selection/
├── src/
│   ├── index.ts
│   ├── hooks/
│   │   ├── use-factory-worlds.ts      # Move from game app
│   │   ├── use-world-availability.ts  # Move from game app
│   │   └── use-game-selection.ts      # New: shared selection state
│   ├── utils/
│   │   ├── factory-query.ts           # SQL query logic
│   │   ├── world-profile.ts           # Profile management
│   │   └── chain-utils.ts             # Chain normalization
│   └── types/
│       └── index.ts                   # FactoryWorld, WorldProfile types
├── package.json
└── tsconfig.json
```

**Key Exports:**
- `useFactoryWorlds(chains)` - Fetch available worlds from factory
- `useWorldsAvailability(worlds)` - Check Torii availability
- `useGameSelection()` - Zustand-based selection state
- `WorldProfile`, `FactoryWorld` types
- `getFactorySqlBaseUrl()`, `resolveChain()` utilities

### Phase 2: Add Lazy Loading to Mobile Router

Update `client/apps/eternum-mobile/src/app/config/router.tsx`:

```typescript
import { lazy } from "react";
import { createLazyRoute } from "@tanstack/react-router";

// Lazy load heavy pages
const HomePage = lazy(() => import("@/pages/home").then(m => ({ default: m.HomePage })));
const TradePage = lazy(() => import("@/pages/trade").then(m => ({ default: m.TradePage })));
const WorldmapPage = lazy(() => import("@/pages/worldmap").then(m => ({ default: m.WorldmapPage })));
const RealmPage = lazy(() => import("@/pages/realm").then(m => ({ default: m.RealmPage })));

// Keep login/chat light for instant load
import { LoginPage } from "@/pages/login";
import { ChatPage } from "@/pages/chat";
```

Update `vite.config.ts` manual chunks:

```typescript
manualChunks: {
  "react-vendor": ["react", "react-dom", "@tanstack/react-router"],
  "blockchain": ["starknet", "@dojoengine/core", "@dojoengine/sdk"],
  "ui-libs": ["@tanstack/react-query", "zustand"],
  "dojo": ["@bibliothecadao/eternum", "@bibliothecadao/dojo", "@bibliothecadao/torii"],
}
```

### Phase 3: Add World Selection to Mobile

Create new mobile page `client/apps/eternum-mobile/src/pages/world-select/`:

```
pages/world-select/
├── index.ts
└── ui/
    └── world-select-page.tsx
```

The mobile world select page will:
- Use `@bibliothecadao/game-selection` hooks
- Mobile-optimized UI (touch-friendly cards, swipe gestures)
- Show available worlds with status indicators
- Allow switching between mainnet/slot chains

### Phase 4: Unified Onboarding Flow

Create shared onboarding state machine in `@bibliothecadao/game-selection`:

```typescript
// packages/game-selection/src/hooks/use-onboarding-machine.ts
type OnboardingPhase =
  | "world-select"  // Pick world
  | "account"       // Connect wallet
  | "loading"       // Bootstrap
  | "settlement"    // Blitz registration (if applicable)
  | "ready";        // Enter game

interface OnboardingState {
  phase: OnboardingPhase;
  selectedWorld: FactoryWorld | null;
  isConnected: boolean;
  isBootstrapComplete: boolean;

  // Actions
  selectWorld: (world: FactoryWorld) => void;
  setConnected: (connected: boolean) => void;
  setBootstrapComplete: (complete: boolean) => void;
  computePhase: () => OnboardingPhase;
}
```

---

## Detailed Milestones

### Milestone 1: Extract Game Selection Package ✅ COMPLETE
**Scope:** Create `@bibliothecadao/game-selection` with core hooks

| Task | Files | Status |
|------|-------|--------|
| Create package structure | `packages/game-selection/*` | ✅ |
| Move `useFactoryWorlds` hook | From `client/apps/game/src/hooks/` | ✅ |
| Move `useWorldsAvailability` hook | From `client/apps/game/src/hooks/` | ✅ |
| Extract world profile utilities | From `client/apps/game/src/runtime/world/` | ✅ |
| Add chain utilities | New | ✅ |
| Add TypeScript types | New | ✅ |
| Update desktop app imports | `client/apps/game/src/**` | ✅ |
| Add package to mobile app | `client/apps/eternum-mobile/package.json` | ✅ |

**Deliverable:** Desktop app works with extracted package, mobile can import hooks.

**Created Files:**
- `packages/game-selection/package.json`
- `packages/game-selection/tsconfig.json`
- `packages/game-selection/tsup.config.ts`
- `packages/game-selection/src/index.ts`
- `packages/game-selection/src/types/index.ts`
- `packages/game-selection/src/utils/index.ts`
- `packages/game-selection/src/utils/chain-utils.ts`
- `packages/game-selection/src/utils/factory-query.ts`
- `packages/game-selection/src/hooks/index.ts`
- `packages/game-selection/src/hooks/use-factory-worlds.ts`
- `packages/game-selection/src/hooks/use-world-availability.ts`
- `packages/game-selection/src/hooks/use-game-selection.ts`

**Modified Files:**
- `client/apps/game/package.json` - Added dependency
- `client/apps/game/src/hooks/use-factory-worlds.ts` - Now re-exports from shared
- `client/apps/game/src/hooks/use-world-availability.ts` - Now re-exports from shared
- `client/apps/eternum-mobile/package.json` - Added dependency

---

### Milestone 2: Add Lazy Loading to Mobile
**Scope:** Implement code splitting in mobile app

| Task | Files | Status |
|------|-------|--------|
| Add Suspense boundaries to router | `router.tsx` | ⬜ |
| Convert pages to lazy imports | `router.tsx` | ⬜ |
| Add loading fallback component | New `loading-spinner.tsx` | ⬜ |
| Configure Vite manual chunks | `vite.config.ts` | ⬜ |
| Test bundle analysis | - | ⬜ |

**Deliverable:** Mobile app has chunked bundles, faster initial load.

---

### Milestone 3: World Selection Page for Mobile
**Scope:** Add world selection UI to mobile

| Task | Files | Status |
|------|-------|--------|
| Create world-select page structure | `pages/world-select/*` | ⬜ |
| Build mobile-optimized world list UI | `world-select-page.tsx` | ⬜ |
| Add world card component | `components/world-card.tsx` | ⬜ |
| Integrate with shared hooks | - | ⬜ |
| Add route to router | `router.tsx` | ⬜ |
| Update login flow to go through world-select | `login-page.tsx` | ⬜ |

**Deliverable:** Mobile users can select which world to join.

---

### Milestone 4: Shared Onboarding State Machine
**Scope:** Unify onboarding flow logic

| Task | Files | Status |
|------|-------|--------|
| Create `useOnboardingMachine` hook | `packages/game-selection/src/hooks/` | ⬜ |
| Refactor desktop to use shared machine | `use-unified-onboarding.ts` | ⬜ |
| Implement mobile onboarding with shared machine | `login-page.tsx`, `blitz-onboarding.tsx` | ⬜ |
| Add phase transition animations | Both apps | ⬜ |

**Deliverable:** Both apps use same onboarding state logic.

---

### Milestone 5: Mobile Route Guards & Protected Routes
**Scope:** Improve auth flow and route protection

| Task | Files | Status |
|------|-------|--------|
| Add world-selection guard | `router.tsx` | ⬜ |
| Redirect unauthenticated users | `router.tsx` | ⬜ |
| Add "no world selected" redirect | `router.tsx` | ⬜ |
| Persist selected world in localStorage | `use-game-selection.ts` | ⬜ |

**Deliverable:** Clean navigation flow with proper guards.

---

### Milestone 6: Shared UI Components (Optional)
**Scope:** Extract reusable UI for both platforms

| Task | Files | Status |
|------|-------|--------|
| Create `@bibliothecadao/ui-shared` package | `packages/ui-shared/*` | ⬜ |
| Extract `WorldCountdown` component | From desktop | ⬜ |
| Extract status indicators | From desktop | ⬜ |
| Platform-specific styling via props | - | ⬜ |

**Deliverable:** Consistent UI elements across platforms.

---

## Route Structure Comparison (After Changes)

### Desktop Routes (unchanged)
```
/                     → Landing
/play/*               → Game (lazy)
  /play               → World Select → Account → Settlement → Ready
/factory              → Admin (lazy)
```

### Mobile Routes (new)
```
/                     → Login (checks world selection)
/world-select         → World Selection (new)
/protected/*          → Protected Layout
  /home               → Home (lazy)
  /realm              → Realm (lazy)
  /trade              → Trade (lazy)
  /worldmap           → Worldmap (lazy)
  /chat               → Chat
  /lordpedia          → Lordpedia
  /settings           → Settings
```

---

## Technical Decisions

### Why Keep Separate Routers?
- Desktop uses `react-router-dom` - deeply integrated with 3D views
- Mobile uses `@tanstack/react-router` - better type safety for forms
- Migration cost outweighs benefits
- Shared hooks work with any router

### Why Zustand for Selection State?
- Already used in both apps
- Works outside React components (route guards)
- Supports middleware (`subscribeWithSelector`)
- localStorage persistence built-in

### Lazy Loading Strategy
| Platform | Strategy |
|----------|----------|
| Desktop | Aggressive chunking (7+ chunks) for heavy 3D/blockchain |
| Mobile | Moderate chunking (4 chunks) for faster cold start |

---

## File Impact Summary

| Location | New Files | Modified Files |
|----------|-----------|----------------|
| `packages/game-selection/` | ~10 | 0 |
| `client/apps/game/` | 0 | ~5 |
| `client/apps/eternum-mobile/` | ~6 | ~4 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking desktop during extraction | Extract incrementally, keep original imports working |
| Mobile bundle size increase | Monitor with `vite-bundle-visualizer` |
| Chain configuration mismatch | Centralize in shared package |
| Different React Query versions | Pin version in shared package |

---

## Success Criteria

1. **Mobile initial load time** reduced by 30%+ (lazy loading)
2. **Mobile users can select worlds** like desktop
3. **Zero code duplication** for factory world fetching
4. **Both apps share** onboarding state machine
5. **Type-safe** route definitions with validated search params
