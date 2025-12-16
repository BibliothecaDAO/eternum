# Eternum Game App - Performance Audit Report

**Date:** 2024-12-17
**Scope:** React/TypeScript performance analysis - N+1 problems, render hotspots, caching, bundle optimization
**Codebase:** `/client/apps/game/src`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [N+1 Findings (Network + Compute)](#2-n1-findings-network--compute)
3. [Rendering Hotspots](#3-rendering-hotspots)
4. [Caching & Invalidation Issues](#4-caching--invalidation-issues)
5. [Bundle Size & Runtime Cost](#5-bundle-size--runtime-cost)
6. [Top 15 Prioritized Optimizations](#6-top-15-prioritized-optimizations)
7. [Execution Plan](#7-execution-plan)
8. [Profiling Guide](#8-profiling-guide)
9. [File Reference Index](#9-file-reference-index)

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Routing** | React Router DOM v7.9.3 | `/`, `/play/*`, `/factory` |
| **State Management** | Zustand v5.0.5 | Composite store pattern |
| **Data Fetching** | TanStack React Query v5.76.0 | Via StarknetConfig internally |
| **API Layer** | SqlApi (Torii `/sql`), GraphQL, WebSockets | |
| **3D Rendering** | Three.js | Separate chunk |
| **Blockchain** | Dojo/Starknet ecosystem | ECS via recs |

### Application Flow

```
src/main.tsx
└── App (src/app.tsx)
    └── StarknetProvider (src/hooks/context/starknet-provider.tsx:121)
        │   └── [Includes QueryClientProvider internally - default settings]
        └── BrowserRouter + MusicRouterProvider
            └── Routes
                ├── "/" → LandingLayout → landing sections
                │
                ├── "/play/*" → GameRoute → useUnifiedOnboarding
                │     │   (src/hooks/context/use-unified-onboarding.ts)
                │     │
                │     └── bootstrapGame (src/init/bootstrap.tsx)
                │         ├── Dojo setup()
                │         ├── initialSync (src/dojo/sync.ts) + Torii streams
                │         ├── Set Torii + SQL base (src/services/api.ts)
                │         └── initializeGameRenderer (Three.js)
                │
                └── "/factory" → lazy(FactoryPage)
```

### State & Data Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **Zustand Stores** | `src/hooks/store/use-ui-store.ts` | App-wide UI + world state |
| | `src/hooks/store/use-account-store.ts` | Authentication (persisted) |
| | `src/hooks/store/use-player-store.ts` | Player data |
| | `src/hooks/store/use-sync-store.ts` | Blockchain subscription state |
| | `src/hooks/store/use-automation-store.ts` | Realm automation (persisted) |
| **Dojo ECS** | `useDojo()`, `useEntityQuery`, `getComponentValue` | Blockchain entity state |
| **SQL API** | `src/services/api.ts` | Torii `/sql` queries |
| **React Query** | Via StarknetConfig | Selective use (story events, entity details, modals) |
| **Store Managers** | `src/ui/store-managers.tsx` | Sync ECS → Zustand |

### Provider Hierarchy (Game Ready State)

```
StarknetProvider (QueryClientProvider inside)
└── BrowserRouter
    └── MusicRouterProvider
        └── DojoProvider ⚠️ VALUE NOT MEMOIZED
            └── MetagameProvider
                └── ErrorBoundary
                    └── StoryEventToastProvider
                        └── World
```

---

## 2. N+1 Findings (Network + Compute)

### 2.1 Network N+1 — Confirmed Critical

#### A. World Selection Request Storm
**Files:**
- `src/ui/layouts/unified-onboarding/world-select-panel.tsx:128`
- `src/ui/layouts/unified-onboarding/world-select-panel.tsx:214`
- `src/ui/features/world-selector/world-selector-modal.tsx:191`

**Pattern:**
```typescript
// Per saved world: HEAD request + SQL query
saved.map(async (n) => isToriiAvailable(...))  // HEAD /torii/sql per world
// Plus per world in factory list:
fetchWorldConfigMeta()  // SQL query per world
```

**Impact:** If factory returns 100+ worlds → 100+ HEAD requests + 100+ SQL queries on modal open.

**Call Chain:**
```
/play → onboarding → world picker UI
  └── per-world: isToriiAvailable() + fetchWorldConfigMeta()
```

---

#### B. Guards Query Cache Fragmentation
**Files:**
- `src/ui/features/military/components/army-list.tsx:25`
- `src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx:184`
- `src/ui/features/military/components/army-management-card.tsx:203`

**Pattern:**
```typescript
// army-list.tsx:25 - uses different key variant
queryKey: ["guards", "with-empty", String(structureId)]

// unified-army-creation-modal.tsx:184 - different key
queryKey: ["guards", String(activeStructureId)]

// army-management-card.tsx:203 - invalidates only one variant
queryClient.invalidateQueries({ queryKey: ["guards", String(owner_entity)] })
```

**Impact:** Same endpoint, different cache keys → duplicate fetches + invalidation misses.

---

#### C. Structure Selection List Per-Item Fetches
**File:** `src/ui/features/military/components/unified-army-creation-modal/structure-selection-list.tsx:33-42`

**Pattern:**
```typescript
// Each StructureSelectionItem in the list calls:
const { data: guardsData } = useQuery({
  queryKey: ["guards", String(realm.entityId)],
  queryFn: () => sqlApi.fetchGuardsByStructure(realm.entityId),
});
// PLUS
const explorers = useExplorersByStructure({ structureEntityId: realm.entityId });
```

**Impact:** N structures → N SQL calls + N ECS queries.

**Call Chain:**
```
StructureSelectionList.map()
  └── StructureSelectionItem (N instances)
      ├── useQuery(["guards", entityId]) × N
      └── useExplorersByStructure() × N
```

---

#### D. Players Panel Entity Queries
**File:** `src/ui/features/social/player/players-panel.tsx:99-127`

**Pattern:**
```typescript
// Inside useMemo, per player:
const playersWithStructures = sortedPlayers.map((player) => {
  // O(P) ECS queries
  const structuresEntityIds = runQuery([HasValue(Structure, { owner: player.address })]);

  // O(P×S) lookups
  const structures = Array.from(structuresEntityIds).map((entityId) => {
    const structure = getComponentValue(Structure, entityId);
    return getStructureName(structure).name;
  });

  // O(P) guild lookups
  const guild = getGuildFromPlayerAddress(player.address, components);

  // O(P) whitelist checks
  const isInvited = getComponentValue(GuildWhitelist, ...);
});
```

**Impact:** 100 players = 300+ synchronous operations per render.

---

### 2.2 Network N+1 — Multiplicative Patterns

#### E. Transfer Container Double Fetches
**File:** `src/ui/features/military/components/transfer-troops-container.tsx:79, :97`

**Pattern:**
```typescript
// Each query does BOTH structure + explorer fetch
queryFn: async () => {
  const structure = await getStructureFromToriiClient(...);
  const explorer = await getExplorerFromToriiClient(...);
  return { structure, explorer };
}
// Called for BOTH selected + target entities
```

**Impact:** ~4 Torii calls per transfer modal open.

---

#### F. Attack Target Fetch Chain
**File:** `src/ui/features/military/battle/hooks/use-attack-target.ts:156, :170`

**Pattern:** Torii fetch + extra SQL lookup (`fetchExplorerAddressOwner`) per target selection.

---

### 2.3 Query Key Instability

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `use-structure-entity-detail.ts` | 56 | `String(userAddress)` → `"undefined"` | HIGH |
| `use-army-entity-detail.ts` | 76 | `["structure", undefined]` cache key flip | HIGH |
| `relics-module.tsx` | 33 | Floating-point coordinates in key | MEDIUM |
| `use-story-events-store.ts` | 31,73,114 | Same key, 3 hooks → cache collision | MEDIUM |
| `transfer-resources-container.tsx` | 86 | `actorTypes?.selected` derived state race | MEDIUM |

---

### 2.4 Derived-Compute N+1 — Confirmed

#### G. Player Structures Global Recompute
**Files:**
- `packages/react/src/hooks/helpers/use-structures.ts:8`
- `src/ui/store-managers.tsx:301`

**Pattern:**
```typescript
// usePlayerStructures() - runs on every owned entity change
const structures = ownedEntities.map((entity) => getStructure(entity)).sort(...);

// PlayerStructuresStoreManager stores result into Zustand
setPlayerStructures(structures);
```

**Impact:** O(N structures) compute + broad UI rerenders (playerStructures used in 20+ components).

---

#### H. Resource Table Global Entity Scan
**File:** `src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx:200`

**Pattern:**
```typescript
// Scans ALL Resource entities
const resourceEntities = useEntityQuery([Has(Resource)]);

// Then filters for player structures, runs ResourceManager.* per structure×resource
// Recomputes every useBlockTimestamp tick (10s) and on ECS updates
```

**Impact:** CPU spike every 10s + on any ECS change.

---

#### I. Selectable Armies Format Loop
**File:** `src/ui/store-managers.tsx:444`

**Pattern:**
```typescript
// SelectableArmiesStoreManager
// Formats ALL explorers via formatArmies() whenever ExplorerTroops query changes
const explorers = useEntityQuery([Has(ExplorerTroops)]);
const formatted = formatArmies(explorers); // Expensive transform
setSelectableArmies(formatted);
```

**Impact:** Runs frequently during live map gameplay.

---

#### J. Story Events Heavy Transform
**Files:**
- `src/hooks/store/use-story-events-store.ts:30`
- `src/ui/features/story-events/story-event-stream.tsx:186`

**Pattern:**
```typescript
// Every 6s poll: fetch + transform ALL events
const events = await sqlApi.fetchStoryEvents(limit);
const processed = events.map((e) => buildStoryEventPresentation(e));

// story-event-stream.tsx adds per-second filtering/sorting over 350 events
```

---

## 3. Rendering Hotspots

### 3.1 Context Value Churn

#### DojoProvider Value Not Memoized (CRITICAL)
**File:** `src/hooks/context/dojo-context.tsx:50-62`

```typescript
// NEW object created every render - not memoized
<DojoContext.Provider
  value={{
    ...value,              // Spread creates new object
    masterAccount,
    account: {             // Nested new object
      account,
      accountDisplay: displayAddress(accountAddress ?? ""),
    },
  }}
>
```

**Impact:** All `useDojo()` consumers re-render when ReadyApp renders.

---

### 3.2 useEffect Re-Render Storms

#### Circular Dependency (CRITICAL)
**File:** `src/ui/features/economy/resources/travel-info.tsx:37-57`

```typescript
useEffect(() => {
  setResourceWeightKg(totalWeight);      // Sets state...
  setDonkeyBalance(calculatedBalance);   // Sets state...
}, [resources, entityId, resourceWeightKg, donkeyBalance, setCanCarry]);
//                       ↑ These are SET in this effect but also dependencies!
```

**Impact:** Infinite re-render loop risk.

---

#### Sequential setState Waterfall
**File:** `src/ui/features/economy/transfers/transfer-automation-panel.tsx:374-387`

Multiple `setResourceConfigs` calls in sequence → waterfall updates.

---

#### Object Dependencies Not Memoized
**File:** `src/ui/features/economy/transfers/transfer-automation-panel.tsx:494-533`

```typescript
useEffect(() => {
  // ...
}, [
  selectedResources,
  sourceBalances,        // Map object - new reference each render!
  aggregatedDonkeyNeed,  // Computed inline - new value each render
]);
```

---

### 3.3 Missing useMemo in Hot Paths

| File | Line | Issue |
|------|------|-------|
| `entities-army-table.tsx` | 147-156 | `.reduce()` not in useMemo |
| `realm-automation-summary.tsx` | 368-379 | `.map()` + `.sort()` in render body |

---

### 3.4 Per-Second Rerenders

#### World Selector Countdown
**Files:**
- `src/ui/layouts/unified-onboarding/world-select-panel.tsx:114`
- `src/ui/features/world-selector/world-selector-modal.tsx:169`

**Pattern:** Parent `nowSec` state ticks every second → full list rerenders even for unchanged worlds.

---

#### Story Event Stream
**File:** `src/ui/features/story-events/story-event-stream.tsx:186`

1-second interval causing rerenders even when data unchanged.

---

### 3.5 Zustand Selector Anti-Patterns

#### Method Calls in Selectors (7+ files)
```typescript
// Creates new selector function each render
const isOpen = useUIStore((state) => state.isPopupOpen(resource.toString()));
```

**Affected Files:**
- `realm-transfer-manager.tsx`
- `transfer-automation-popup.tsx`
- `settings.tsx`
- `combat-simulation.tsx`
- `latest-features.tsx`
- `shortcuts.tsx`
- `left-command-sidebar.tsx`
- `realm-info-panel.tsx`

---

### 3.6 Components Needing Virtualization

| Component | File | Est. Items | Priority |
|-----------|------|-----------|----------|
| EntityResourceTableNew | `entity-resource-table-new.tsx` | 250+ cells | CRITICAL |
| ChatModule | `chat.tsx` | 100-1000 messages | CRITICAL |
| PlayerList | `player-list.tsx` | 100+ rows | HIGH |
| GuildList | `guild-list.tsx` | 1000+ guilds | HIGH |
| WorldChatPanel | `world-chat-panel.tsx` | 100+ messages | HIGH |
| HexMinimap | `hex-minimap.tsx:198` | All tiles | HIGH |

---

### 3.7 Minimap Tile Loading (UI Freeze Risk)
**Files:**
- `src/ui/features/world/components/bottom-right-panel/bottom-right-panel.tsx:716`
- `src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx:198`

**Pattern:** Loads ALL tiles into React state, then builds full SVG geometry index.

**Impact:** UI freeze on large maps; memory pressure.

---

### 3.8 Console.log in Hot Render Paths
**File:** `src/ui/features/world/containers/top-header/top-header.tsx:69`

Debug logging in frequently-rendered component.

---

### 3.9 Top 10 Render Hotspot Candidates

| Rank | Component | File | Why | Confirm With |
|------|-----------|------|-----|--------------|
| 1 | EntityResourceTableNew | `entity-resource-table-new.tsx:119` | Global ECS scan + per-resource math | Profiler "Ranked" view |
| 2 | SelectableArmiesStoreManager | `store-managers.tsx:444` | formatArmies on every ECS change | CPU profile |
| 3 | PlayerStructuresStoreManager | `store-managers.tsx:301` | Map+sort + global fanout | Profiler render counts |
| 4 | LeftCommandSidebar | `left-command-sidebar.tsx:991` | Large tree, many selectors | "Why did this render" |
| 5 | StoryEventStream | `story-event-stream.tsx:186` | 1s interval + sort/filter | Profiler 30s session |
| 6 | HexMinimap | `hex-minimap.tsx:198` | All tiles in React state | Performance + memory |
| 7 | TopHeader | `top-header.tsx:28` | console.log + getEntityInfo | Console spam check |
| 8 | WorldSelectPanel | `world-select-panel.tsx` | Per-second countdown + async results | Profiler on modal |
| 9 | TransferModals | `transfer-*-container.tsx` | Multiple queries + derived compute | Profiler on type |
| 10 | Three.js runtime | (non-React) | Minimap + instanced animations | Chrome Performance |

---

## 4. Caching & Invalidation Issues

### 4.1 QueryClient Using Defaults

**File:** `src/hooks/context/starknet-provider.tsx:121`

No custom `QueryClient` passed to `StarknetConfig` → uses default settings:
- `refetchOnWindowFocus: true` (surprise refetches on alt-tab)
- `refetchOnReconnect: true`
- Default staleTime/gcTime

**Impact:** Alt-tabbing triggers refetch spikes in a real-time game.

---

### 4.2 Missing Cache Invalidation

| Operation | File | Lines | Missing Invalidation |
|-----------|------|-------|---------------------|
| Resource transfer | `transfer-resources-container.tsx` | 308-352 | Source & target `availableResources` |
| Troop transfer | `transfer-troops-container.tsx` | 700-772 | `selectedEntity`, `targetEntity` |
| Explorer creation | `unified-army-creation-modal.tsx` | 461 | Explorer lists |
| Guard deletion | Various | - | Guards queries |

---

### 4.3 Fetches Bypassing React Query

These use manual `useEffect + fetch/sqlApi` with no dedupe or cache sharing:

| Feature | File | Line |
|---------|------|------|
| Quest fetches | `quest-info.tsx` | 22 |
| Quest entity | `quest-entity-detail.tsx` | 33 |
| Player structures | `use-sync-player-structures.ts` | 16 |
| Relics | `store-managers.tsx` | 239 |

---

### 4.4 Cache Bleed Risk

**File:** `src/ui/features/landing/cosmetics/lib/use-torii-cosmetics.ts:1`

`COSMETICS_SQL_ENDPOINT` computed at module load. If Torii base changes in-session (world switch without reload), cache keys don't reflect the actual endpoint hit.

---

### 4.5 staleTime Configuration

| File | Query | Current | Recommended |
|------|-------|---------|-------------|
| `use-resource-balance.tsx:20` | Balance | `refetchInterval: 1000` | 5000ms+ |
| `transfer-resources-container.tsx:106` | Available resources | 3s | 10s |
| `use-army-entity-detail.ts` | Explorer | 5s | 10s |
| `use-structure-entity-detail.ts` | Structure | 5s | 10s |

---

## 5. Bundle Size & Runtime Cost

### 5.1 Current Bundle Output

| Asset | Size | Notes |
|-------|------|-------|
| `main-*.js` | ~17 MB | Main application |
| `blockchain-*.js` | ~12 MB | Dojo/Starknet ecosystem |
| `dojo_c_bg-*.wasm` | ~2.1 MB | WASM binary |
| `three-*.js` | ~733 KB | 3D graphics |
| `react-vendor-*.js` | ~310 KB | React core |
| `ui-libs-*.js` | ~208 KB | gsap, zustand, react-query |
| `external-*.js` | ~203 KB | Analytics, socket.io |
| `telemetry-*.js` | ~116 KB | OpenTelemetry |
| **dist/ total** | ~728 MB | Including assets |

---

### 5.2 Landing Page Loads Full Game

**File:** `dist/index.html:179`

All major chunks (blockchain, ui-libs, external, three, main) load on initial page load. Landing page pays full game download/parse cost before `/play`.

**Root Cause:** `manualChunks` in `vite.config.ts:97` defines chunk grouping but doesn't enable route-based code splitting. Heavy imports are statically imported from entry graph.

---

### 5.3 Lazy Loading Opportunities

| Library | Size | Files Using | Current | Action |
|---------|------|-------------|---------|--------|
| OpenTelemetry | ~116 KB | 1 (`tracer.ts`) | Eager | Conditional import |
| PostHog | ~50 KB | 1 (`posthog.ts`) | Eager | Defer 2s |
| Vercel Analytics | ~20 KB | 1 (`bootstrap.tsx`) | Eager | Defer 2s |
| socket.io-client | ~100 KB | 1 (`chat/client.ts`) | Eager | Route-based |
| html-to-image | ~100 KB | 2 files | Eager | On-demand |
| gsap | ~150 KB | 3 files | ui-libs chunk | Animation chunk |
| graphql-request | ~30 KB | 1 file | Eager | Route-based |
| lodash | ~70 KB | 5 files (throttle only) | utils chunk | `just-throttle` (~1 KB) |
| lil-gui | ~50 KB | Dev only | ui-libs chunk | Dev-only import |

**Potential Initial Load Savings:** ~500 KB+

---

### 5.4 Import Pattern Issues

```typescript
// tracer.ts - Always loaded even when disabled
import { ZoneContextManager } from "@opentelemetry/context-zone";
// ... 10 more imports
if (!config.enabled) return;  // Bundle already loaded!

// bootstrap.tsx - Analytics at startup
import { inject } from "@vercel/analytics";
inject();  // Blocks game load

// lodash - Only throttle used
import throttle from "lodash/throttle";  // Pulls 70KB for 1 function
```

---

## 6. Top 15 Prioritized Optimizations

### Quick Wins (1-2 days)

| # | Optimization | File(s) | Complexity | Impact | Risk |
|---|--------------|---------|------------|--------|------|
| 1 | **Lazy-load `/play` game shell** | `src/app.tsx` | M | HIGH | MED |
| 2 | **Memoize DojoProvider value** | `src/hooks/context/dojo-context.tsx:50-62` | S | HIGH | LOW |
| 3 | **Fix travel-info circular deps** | `src/ui/features/economy/resources/travel-info.tsx:37-57` | S | HIGH | LOW |
| 4 | **Unify guards query keys** | `army-list.tsx:25`, `unified-army-creation-modal.tsx:184` | S | MED | LOW |
| 5 | **Fix undefined in query keys** | `use-structure-entity-detail.ts:56`, `use-army-entity-detail.ts:76` | S | HIGH | LOW |
| 6 | **Remove console.log in hot paths** | `top-header.tsx:69` | S | LOW | LOW |
| 7 | **Pass custom QueryClient** | `src/hooks/context/starknet-provider.tsx:121` | S | MED | MED |

### Medium Refactors (1-2 weeks)

| # | Optimization | File(s) | Complexity | Impact | Risk |
|---|--------------|---------|------------|--------|------|
| 8 | **Collapse world selection requests** | `world-select-panel.tsx:128`, `world-selector-modal.tsx:191` | M | HIGH | MED |
| 9 | **Stop world selector per-second rerenders** | `world-select-panel.tsx:114` | S-M | MED | LOW |
| 10 | **Reduce PlayerStructures fanout** | `packages/react/.../use-structures.ts:8`, `store-managers.tsx:301` | M | HIGH | MED |
| 11 | **Throttle SelectableArmies updates** | `src/ui/store-managers.tsx:444` | M | HIGH | MED |
| 12 | **Add transfer invalidation** | `transfer-resources-container.tsx`, `transfer-troops-container.tsx` | M | HIGH | LOW |
| 13 | **Lazy load analytics/telemetry** | `tracer.ts`, `bootstrap.tsx`, `posthog.ts` | M | MED | LOW |
| 14 | **Virtualize EntityResourceTable** | `entity-resource-table-new.tsx` | M | HIGH | MED |

### Larger Improvements

| # | Optimization | File(s) | Complexity | Impact | Risk |
|---|--------------|---------|------------|--------|------|
| 15 | **Minimap offscreen/canvas render** | `hex-minimap.tsx:198`, `bottom-right-panel.tsx:716` | L | HIGH | MED-HIGH |
| 16 | **Virtualize chat + player lists** | `chat.tsx`, `player-list.tsx` | L | HIGH | MED |
| 17 | **Server-side aggregation endpoints** | Backend | L | HIGH | MED |
| 18 | **Split composite UIStore** | `use-ui-store.ts` | L | MED | HIGH |

---

## 7. Execution Plan

### Phase 1: Quick Wins (1-2 days)

```
□ Lazy-load /play route (dynamic import World + heavy deps)
□ Wrap DojoProvider value in useMemo
□ Remove resourceWeightKg/donkeyBalance from travel-info useEffect deps
□ Unify guards query keys: ["guards", structureId] everywhere
□ Fix query keys: fallback to empty string instead of undefined
□ Remove console.log from top-header.tsx render
□ Create custom QueryClient with refetchOnWindowFocus: false
□ Reduce use-resource-balance refetchInterval: 1000 → 5000
```

**Verification:**
- Landing route network: should NOT load blockchain/three chunks
- React DevTools: DojoProvider consumers should not re-render on parent update
- Network tab: single guards request per structure

---

### Phase 2: N+1 Resolution (3-5 days)

```
□ World selection: batch availability checks, cache results
□ World selector: move countdown to individual row components
□ Create useGuardsBatch(structureIds[]) hook for structure list
□ Add queryClient.invalidateQueries() after transfer operations
□ Consolidate story events into single query + selectors
□ Create useIsPopupOpen(name) helper hook with stable selector
```

**Verification:**
- World modal open: N requests → 1 batch request
- Structure selection modal: N guard requests → 1 request
- Transfer complete: related queries refresh

---

### Phase 3: Render Optimization (1-2 weeks)

```
□ PlayerStructuresStoreManager: throttle updates, shallow compare before set
□ SelectableArmiesStoreManager: throttle formatArmies, batch updates
□ EntityResourceTableNew: implement react-window grid virtualization
□ ChatModule: implement react-window FixedSizeList
□ Add useMemo to entities-army-table reduce
□ Lazy load: OpenTelemetry (conditional), PostHog (defer 2s), socket.io (route)
□ Replace lodash/throttle with just-throttle
```

**Verification:**
- CPU profile: formatArmies time reduced
- Resource table: smooth scroll with 200+ rows
- Bundle analyzer: initial load reduced by ~500KB

---

### Phase 4: Large Improvements (Optional)

```
□ Minimap: Canvas-based render instead of React SVG
□ Virtualize PlayerList, GuildList, WorldChatPanel
□ Server-side aggregation: guards counts, explorer owners, map windows
□ Address Three.js hotspots per existing PERFORMANCE_REVIEW.md
□ Memory profiling: identify leaks in chat history, ECS state
```

---

## 8. Profiling Guide

### 8.1 React DevTools Profiler Sessions

#### Session 1: Baseline
1. Open React DevTools → Profiler tab
2. Enable "Record why each component rendered"
3. Navigate to landing page
4. Record 10s of idle
5. **Expected:** Minimal commits, no unexpected rerenders

#### Session 2: Game Entry
1. Start recording
2. Click "Play" → Select world → Complete onboarding
3. Stop recording
4. **Check:** DojoProvider consumers, store managers commit frequency

#### Session 3: Resource Table
1. Enter game, open resource table
2. Record 30s with table open
3. **Check:** EntityResourceTableNew render time, ResourceManager.* in flamegraph

#### Session 4: Left Sidebar + Story Events
1. Open left sidebar tabs, enable story events
2. Record 30s
3. **Check:** LeftCommandSidebar commits, per-second story event rerenders

#### Session 5: Minimap
1. Open minimap tab
2. Record while loading
3. **Check:** HexMinimap initial render time, memory snapshot

---

### 8.2 Network Analysis

#### World Selection
1. Open Network tab, filter `sql?query=`
2. Open world selector modal
3. **Count:** HEAD requests + SQL queries
4. **Target:** N worlds → 1 batch

#### Guards Fetching
1. Filter `fetchGuardsByStructure` or `sql`
2. Open structure selection modal
3. **Count:** Requests per structure
4. **Target:** N structures → 1 batch

#### Transfer Operations
1. Execute a resource transfer
2. **Check:** Related queries refetch after completion

---

### 8.3 Chrome Performance Panel

#### Capture UI Freeze
1. Performance tab → Record
2. Open minimap on large map
3. Stop recording
4. **Identify:** Long tasks, top JS functions (expect `buildCenteredIndex`)

#### Capture Gameplay
1. Record 30s of typical play + camera movement
2. **Identify:** `formatArmies`, `getStructure`, `ResourceManager.*`

---

### 8.4 Memory Profiling

1. DevTools → Memory tab
2. Take heap snapshot before chat
3. Open chat, send 100 messages
4. Take heap snapshot after
5. **Compare:** Retained objects, potential leaks

---

### 8.5 Success Metrics

| Metric | Current (Est.) | Target |
|--------|---------------|--------|
| Landing TTI | ~5s+ | <2s |
| Initial JS | ~17 MB | <10 MB |
| World modal requests | N×2 | 1 batch |
| Guards requests (5 structures) | 5+ | 1 |
| Resource table render | ~500ms | <100ms |
| Transfer modal commits | ~20 | <5 |
| Story events commits/sec | ~1 | 0 (unless new data) |

---

## 9. File Reference Index

### Critical (Immediate Action)

| File | Issue |
|------|-------|
| `src/app.tsx` | Route-level lazy loading |
| `src/hooks/context/dojo-context.tsx:50-62` | Memoize provider value |
| `src/hooks/context/starknet-provider.tsx:121` | Custom QueryClient |
| `src/ui/features/economy/resources/travel-info.tsx:37-57` | Circular useEffect deps |
| `src/ui/features/world/components/entities/hooks/use-structure-entity-detail.ts:56` | Query key undefined |
| `src/ui/features/world/components/entities/hooks/use-army-entity-detail.ts:76` | Query key undefined |

### High Priority

| File | Issue |
|------|-------|
| `src/ui/layouts/unified-onboarding/world-select-panel.tsx:128` | World N+1 |
| `src/ui/features/world-selector/world-selector-modal.tsx:191` | World N+1 |
| `src/ui/features/military/components/army-list.tsx:25` | Guards key fragmentation |
| `src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx:184` | Guards key fragmentation |
| `src/ui/features/military/components/unified-army-creation-modal/structure-selection-list.tsx:33-42` | Per-item fetches |
| `src/ui/store-managers.tsx:301` | PlayerStructures compute |
| `src/ui/store-managers.tsx:444` | SelectableArmies compute |
| `src/ui/features/military/components/transfer-resources-container.tsx:308-352` | Missing invalidation |
| `src/ui/features/military/components/transfer-troops-container.tsx:700-772` | Missing invalidation |

### Bundle Optimization

| File | Issue |
|------|-------|
| `src/tracing/tracer.ts` | Conditional telemetry import |
| `src/init/bootstrap.tsx` | Defer analytics |
| `src/posthog.ts` | Lazy init |
| `src/ui/features/social/chat/client/client.ts` | Route-based socket.io |
| `vite.config.ts:97` | Route splitting config |

### Virtualization Candidates

| File | Component |
|------|-----------|
| `src/ui/features/economy/resources/entity-resource-table/entity-resource-table-new.tsx` | Resource table |
| `src/ui/features/social/chat/chat.tsx` | Chat messages |
| `src/ui/features/social/player/player-list.tsx` | Player list |
| `src/ui/features/social/guilds/guild-list.tsx` | Guild list |
| `src/ui/features/world/components/bottom-right-panel/hex-minimap.tsx:198` | Minimap tiles |

### useEffect Issues

| File | Line | Issue |
|------|------|-------|
| `travel-info.tsx` | 37-57 | Circular deps |
| `transfer-automation-panel.tsx` | 374-387 | Sequential setState |
| `transfer-automation-panel.tsx` | 494-533 | Object deps |
| `use-torii-sync.ts` | 82-86 | Spread deps |

---

## Appendix: Related Documentation

- `PERFORMANCE_REVIEW.md` - Three.js specific optimizations
- `optimisations.md` - Previous optimization notes
- `.claude/frontend-rules.md` - Frontend development guidelines

---

*Report generated from combined analysis. All line numbers reference current codebase state and may shift with future changes.*
