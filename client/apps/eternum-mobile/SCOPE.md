# Scope: Text-First React Native Mobile Client for Eternum

## Context

Eternum is an on-chain strategy game with a desktop Vite+React+Three.js client and an existing browser-based mobile app (`client/apps/eternum-mobile`). Rather than porting the 3D rendering to mobile (complex, risky), we're building a **text/UI-first React Native app** with rethought mobile UX. The existing mobile app is already 87.5% text-based - only the worldmap uses 3D. All game logic lives in shared packages that are 95-100% portable to React Native.

**Goal:** A fully playable native mobile client that's better than a 3D port because it's designed for how people actually use phones - quick check-ins, thumb-driven navigation, notification-driven engagement.

---

## Decisions Made

1. **Bare React Native** - Full native module control, no Expo Go
2. **Cartridge Controller** - Embedded wallet, no deep-link complexity
3. **Replaces `eternum-mobile`** - Keep as reference during development
4. **MVP first** - Ship core gameplay, iterate to full parity
5. **Text/UI first** - No 3D rendering. Rethink UX for mobile.

---

## What We're Working With

### Shared Packages (all reusable, zero changes)

| Package | What it gives us |
|---------|-----------------|
| `@bibliothecadao/eternum` | 24 game managers (army, resource, structure, market, stamina, config, etc.) |
| `@bibliothecadao/react` | 24 React hooks (useArmies, useResources, useStructures, useTrade, etc.) |
| `@bibliothecadao/torii` | State sync via HTTP + WebSocket, SQL queries for all entities |
| `@bibliothecadao/provider` | TX batching, 213+ transaction types |
| `@bibliothecadao/dojo` | World setup, network config |
| `@bibliothecadao/types` | All type defs, constants, enums |

### Existing Mobile App (reference, `client/apps/eternum-mobile`)

- 8 routes: Login, Home, Realm (4 tabs), Worldmap, Trade, Chat, Lordpedia, Settings
- 39 widgets covering all game actions
- Feature-Sliced Design architecture
- Key reference files:
  - `src/pages/` - all route components
  - `src/features/` - domain logic (armies, resources, production, upgrades, chat)
  - `src/widgets/` - reusable game-specific UI
  - `src/shared/` - UI primitives and hooks
  - `src/app/dojo/` - Dojo/Starknet integration for mobile context

### Game Complexity

- 213+ game actions, 5 structure types, 39 building types, 24 resource types
- 3 troop types (Knight/Paladin/Crossbowman) x 3 tiers each
- 3 tick systems: default (1s), armies (~1hr), delivery (configurable)
- 5 core loops: production, military, trading, settlement, exploration

---

## Rethought Mobile UX

### Design Principles

1. **Notification-driven** - Mobile users play in bursts. Surface what needs attention NOW.
2. **2-tap actions** - Most common actions (claim resources, move army, accept trade) are 1-2 taps from any screen.
3. **Progressive disclosure** - Summary -> Detail -> Action. Never overwhelm.
4. **Thumb zone** - All primary actions reachable by thumb. Bottom navigation. Bottom sheet drawers for actions.
5. **Spatial without 3D** - Represent the hex world through smart 2D: region cards, coordinate tags, distance indicators, neighbor lists.

### Navigation Structure

```
Bottom Tab Bar (always visible)
├── Command    (home dashboard - what needs attention)
├── Realms     (your structures + buildings + production)
├── Armies     (all military units + exploration)
├── Trade      (market + active orders + caravans)
└── More       (chat, guild, leaderboard, lordpedia, settings)
```

**Why 4+1 tabs instead of the current 8 routes:**

- Reduces cognitive load
- Groups by player intent ("manage my stuff" vs "fight" vs "trade")
- "Command" replaces Home with an actionable feed
- "More" hides low-frequency screens

### Screen Breakdown

#### Tab 1: Command (Dashboard)

The "what do I need to do" screen. Not a static summary - a prioritized action feed.

**Sections (scrollable, collapsible):**

- **Urgent Actions** (red badges)
  - Resources at capacity (claim or they stop producing)
  - Armies under attack
  - Trades expiring soon
  - Stamina full (wasted regen)
- **Ready to Claim** (tap-to-claim inline)
  - Arrived caravans
  - Quest rewards
  - Production overflow
- **Activity Feed**
  - Recent battles (won/lost)
  - Trade completions
  - Exploration discoveries
  - Guild events
- **Quick Stats Bar** (horizontal scroll)
  - Total LORDS balance
  - Army count
  - Realm count
  - Active trades

**Key interaction:** Tapping any feed item navigates to the relevant detail screen with the action pre-loaded.

#### Tab 2: Realms

All your structures, organized as a swipeable card deck.

**Realm Card (summary):**

- Realm name, level, coordinates
- Resource bar (top 5 resources, capacity %)
- Building count / slots used
- Guard status (defended / vulnerable)
- Production status indicator (all running / paused / at capacity)

**Tap -> Realm Detail (tabbed):**

- **Resources** - Full inventory list, grouped by type. Inline claim buttons.
- **Buildings** - Card list per building with production rate, pause/resume toggle, upgrade button
- **Military** - Guard slots (fill/swap), nearby enemies list with distance
- **Actions** - Level up, transfer ownership, rename

**Interaction patterns:**

- Swipe left/right between realms
- Pull-down to refresh resource counts
- Long-press building card for quick actions menu

#### Tab 3: Armies

All military units and exploration in one place.

**Army List (default view):**

- Card per army: name, troop type/tier/count, stamina bar, position coordinates
- Status badge: idle / moving / exploring / in combat / garrisoned
- Swipe-right on card -> quick move action
- Swipe-left on card -> quick attack/explore action

**Tap -> Army Detail:**

- Full stats (damage, food consumption, boosts, cooldowns)
- Position + nearby hexes (list of adjacent tiles with biome, occupier, exploration status)
- Action buttons: Move, Explore, Attack, Garrison, Transfer Troops, Disband
- **Move action** -> hex coordinate picker (type coords or pick from "known locations" list)
- **Explore action** -> shows stamina cost, food cost, tap to confirm
- **Attack action** -> target picker (nearby armies list with damage preview)

**Map alternative - "Neighborhood View":**

Instead of a full hex map, show the selected army's local area as a simple grid:

- 7-hex ring around current position
- Each hex shows: biome icon, occupier name/flag, explored status
- Tap hex -> see details, tap again -> move/explore/attack
- This gives spatial awareness without a full 3D map

#### Tab 4: Trade

Marketplace and resource logistics.

**Sub-tabs (top):**

- **Market** - AMM swap interface (already built well in existing mobile app)
- **Orders** - P2P trade orders (yours + available)
- **Caravans** - In-transit resources with ETA countdown

**Market screen:** Direct port of existing swap widget (it's already good)

**Orders screen:**

- Create order: resource picker -> amount -> price ratio -> confirm
- Available orders: filterable list, tap to preview, tap to accept
- Your orders: list with cancel option

**Caravans screen:**

- Card per caravan: origin -> destination, resource list, ETA countdown
- Tap -> full details + option to track on neighborhood view

#### Tab 5: More

Lower-frequency features behind a menu grid.

- **Chat** (global, rooms, DMs - port existing socket.io implementation)
- **Guild** (members, management, transfers)
- **Leaderboard** (rankings by category)
- **Hyperstructures** (contribution tracker, shared progress)
- **Quests** (active quests with progress bars)
- **Lordpedia** (encyclopedia - port existing 11 sections)
- **Settings** (notifications, account, theme)

### Interaction Patterns

**Bottom Sheet Drawers (not full-screen modals):**

All actions use bottom sheets that slide up from bottom:

- Army creation -> bottom sheet with troop selector + confirm
- Building construction -> bottom sheet with building picker + slot selector
- Trade creation -> bottom sheet with resource/amount inputs
- Attack confirmation -> bottom sheet with damage preview + confirm/cancel

**Swipe Actions on List Items:**

- Swipe right on army -> Move
- Swipe right on resource arrival -> Claim
- Swipe left on trade order -> Cancel
- Swipe left on army -> Attack nearest

**Pull-to-Refresh:**

- Any list screen pulls fresh data from Torii

**Haptic Feedback:**

- Battle resolution, successful trade, level up, resource claim

### What Replaces the 3D Map

The 3D worldmap is the one desktop feature that doesn't translate to text. Three alternatives, progressively:

**MVP: Coordinate + List Based**

- Every location shows as `(col, row)` with biome tag
- "Nearby" sections on army/realm detail show adjacent hexes as a list
- Search by coordinates to find any location
- Distance shown as hop count between points

**V2: 2D Mini-Map Canvas**

- Simple 2D hex grid rendered on a `<Canvas>` (react-native-skia or basic RN canvas)
- Color-coded hexes: your territory, explored, fog, enemy
- Tap hex for info, double-tap for action
- Much simpler than Three.js - just colored hexagons, no models/shaders/lighting

**V3: Interactive 2D Map (if needed)**

- Pan/zoom 2D map with react-native-gesture-handler
- Icons for structures/armies
- Path visualization for movement
- Still no 3D - just a clean tactical map

---

## Technical Architecture

### Project Location

`client/apps/game-native/` - new directory in the monorepo

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Bare React Native 0.81+ |
| Navigation | React Navigation 7 (tabs + stack + bottom sheet) |
| State | Zustand 5.x (same stores as desktop) |
| Server State | @tanstack/react-query |
| Blockchain | Shared packages (`@bibliothecadao/*`) |
| Wallet | Cartridge Controller (embedded) |
| UI Components | Build custom (inspired by existing shadcn widgets) |
| Animations | react-native-reanimated |
| Gestures | react-native-gesture-handler |
| Lists | FlashList (performant scrolling) |
| Icons | lucide-react-native |
| Storage | @react-native-async-storage/async-storage |
| Charts | victory-native (for trade price charts) |
| Audio | react-native-sound or expo-av |
| Error Tracking | @sentry/react-native |
| Analytics | posthog-react-native |

### Dependency Simplification (vs WebGPU plan)

**Eliminated entirely:**

- `three`, `three-stdlib`, `postprocessing` (no 3D)
- `react-native-webgpu` (no WebGPU)
- GLSL -> WGSL shader conversion (no shaders)
- Draco WASM decoder (no GLTF models)
- CSS2DRenderer replacement (no 3D labels)
- Web Worker replacement for rendering (no render loop)

**Still needed:**

- WASM verification for `@dojoengine/torii-wasm` in Hermes (same risk, but only risk)
- Cartridge Controller RN SDK verification
- `starknet` SDK crypto polyfills for RN

### Platform Gap Solutions

| Web API | RN Replacement |
|---------|---------------|
| `localStorage` | `AsyncStorage` |
| `sessionStorage` | In-memory Map |
| `fetch()` | Native (built-in) |
| WebSocket | Native (built-in) |
| Web Workers (entity sync) | Main thread with batched processing or `react-native-worklets` |
| `requestIdleCallback` | `InteractionManager.runAfterInteractions()` |
| `html-to-image` | `react-native-view-shot` |
| `socket.io-client` | Same (RN compatible) |

---

## Risk Assessment (Dramatically Reduced)

### High Risk

1. **WASM in Hermes** - `@dojoengine/torii-wasm` still needs verification. Fallback: HTTP-only Torii queries via `@bibliothecadao/torii` SQL module.

### Medium Risk

2. **Cartridge Controller on RN** - Need to verify embedded SDK works outside browser.
3. **`starknet` SDK polyfills** - Crypto operations may need `react-native-get-random-values` + `buffer` polyfills.
4. **Entity sync threading** - Web Worker for entity sync needs replacement. Can start on main thread with batching.

### Low Risk (previously high, now eliminated)

- ~~WebGPU maturity~~ - No WebGPU needed
- ~~Post-processing pipeline~~ - No shaders
- ~~GLTF Draco decoding~~ - No 3D models
- ~~CSS2DRenderer replacement~~ - No 3D labels
- ~~Shader GLSL->WGSL~~ - No shaders

---

## Build Phases

### Phase 0: Spike & Validation (1 week)

- Init bare React Native 0.81+ project
- Wire `@bibliothecadao/torii` - verify Torii HTTP queries work
- Test `@dojoengine/torii-wasm` in Hermes (or confirm HTTP-only fallback)
- Test `starknet` SDK crypto operations with RN polyfills
- Test Cartridge Controller SDK in RN
- **Gate:** If Torii + Starknet work, we're green. If WASM fails, switch to HTTP-only queries.

### Phase 1: Foundation (2 weeks)

- Project scaffold at `client/apps/game-native/`
- React Navigation with 5-tab structure
- Dojo/Starknet context providers adapted for RN
- Cartridge Controller embedded wallet flow
- Zustand stores wired to Torii data
- Basic theme/design system (colors, typography, spacing from existing app)

### Phase 2: Command + Realms (2-3 weeks)

- Command dashboard with action feed
- Urgent actions / ready-to-claim sections
- Realm list with swipeable cards
- Realm detail (4 tabs: resources, buildings, military, actions)
- Resource inventory with inline claim
- Building list with production controls
- Bottom sheet drawers for: build, upgrade, claim

### Phase 3: Armies + Exploration (2-3 weeks)

- Army list with status badges
- Army detail with full stats
- Neighborhood view (7-hex ring around army)
- Move/explore/attack flows via bottom sheets
- Coordinate-based location system
- Swipe actions on army cards
- Guard slot management on realm military tab

### Phase 4: Trading (1-2 weeks)

- AMM swap interface (port existing widget patterns)
- P2P order creation + browsing
- Caravan tracking with ETA
- Resource transfer flows
- Price display

### Phase 5: Social + Polish (2 weeks)

- Chat (port socket.io integration)
- Guild management
- Leaderboard
- Quest tracker
- Lordpedia (port existing 11 sections)
- Haptic feedback on key actions
- Pull-to-refresh everywhere
- Error states and loading skeletons

### Phase 6: 2D Map (optional, post-MVP)

- Simple 2D hex canvas via react-native-skia
- Color-coded territory view
- Tap-to-interact hexes
- Army position markers
- Movement path visualization

**MVP (Phases 0-4): ~8-11 weeks**
**Full parity (Phases 5-6): +4 weeks**
**Total: ~12-15 weeks** (down from 18-26 with WebGPU)

---

## Key Files to Reference

### Reuse directly (shared packages)

- `packages/core/src/managers/` - All 24 game managers
- `packages/react/src/hooks/` - All 24 React hooks
- `packages/torii/src/` - State sync + SQL queries
- `packages/provider/src/` - TX types + batching
- `packages/types/src/` - All type definitions

### Port UI patterns from (existing mobile app)

- `client/apps/eternum-mobile/src/widgets/swap-input/` - Trade swap interface
- `client/apps/eternum-mobile/src/widgets/resources-card/` - Resource display
- `client/apps/eternum-mobile/src/widgets/attack-drawer/` - Combat interface
- `client/apps/eternum-mobile/src/widgets/transfer-drawer/` - Resource transfer
- `client/apps/eternum-mobile/src/widgets/production-widget/` - Building production
- `client/apps/eternum-mobile/src/widgets/claim/` - Resource claiming
- `client/apps/eternum-mobile/src/widgets/nearby-enemies/` - Threat display
- `client/apps/eternum-mobile/src/features/chat/` - Socket.io chat integration
- `client/apps/eternum-mobile/src/app/dojo/` - Dojo setup for mobile

### Desktop features for parity reference

- `client/apps/game/src/ui/features/` - All 15+ feature modules
- `client/apps/game/src/hooks/store/` - Zustand store patterns

---

## Verification Plan

1. **Spike gate** - Torii queries return data, Starknet TX signing works, Cartridge Controller authenticates
2. **Per-phase** - Each phase should produce a screen-recorded demo of the new screens
3. **Integration test** - Connect to testnet, create army, move it, explore a hex, claim resources - all from the RN app
4. **Performance** - Profile on a mid-range Android device (Pixel 6a or similar), target <100MB heap, <2s screen transitions
5. **Parity checklist** - Track feature-by-feature against desktop client's `src/ui/features/` directory
