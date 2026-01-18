# Torii Selective Subscriptions: Analysis and Implementation Plan

## Context
The client currently establishes a global Torii subscription for all entities and events. That guarantees correctness but scales poorly as the world grows. We already chunk rendering and do chunk-scoped fetches, but the subscription layer still streams the entire world. This doc details how to move to selective, bounds-based subscriptions while preserving correctness when the camera pans across the map.

## Current Data Flow (as-is)
- Global stream starts in `client/apps/game/src/dojo/sync.ts`:
  - `initialSync()` calls `syncEntitiesDebounced(..., null)` which subscribes to `onEntityUpdated` and `onEventMessageUpdated` with no clause.
  - That stream continuously writes into recs via `setEntities(...)`.
- Rendering uses chunked fetch + hydration in `client/apps/game/src/three/scenes/worldmap.tsx`:
  - `computeTileEntities()` calls `getMapFromToriiExact()` (tiles only).
  - `refreshStructuresForChunks()` calls `getStructuresDataFromTorii()` (structures + structure-scoped models).
- Runtime updates are applied in `packages/core/src/systems/world-update-listener.ts` via component systems.

## Core Problem
The global subscription is O(N) with player count and total world activity. Even with good render chunking, every state update flows through the client, creating avoidable CPU and memory pressure.

## Key Constraint (the one we just called out)
When the player pans into an area that was not previously subscribed:
- A subscription alone only emits deltas. It will not backfill current state.
- Therefore, every bounds change must be paired with a **one-shot fetch** for the new area so entities render correctly on first entry.

We already fetch tiles and structures on chunk switch, but **we do not currently hydrate armies (ExplorerTroops)** or other non-structure entities that appear in the new bounds. That gap is masked today by the global stream.

## Target Behavior
1) A camera-driven, bounds-based Torii subscription streams only the relevant area.
2) When bounds change, we fetch the initial state for that area (tiles, structures, armies, etc.) before the stream starts delivering deltas.
3) Keep a small, always-on stream for truly global data (events, configs, or player-owned entities if needed).

## Proposed Subscription Layers
### 1) Area stream (primary)
Scoped to the render/pinned bounds. Drives what is visible.
- Models:
  - `s1_eternum-TileOpt` (col/row)
  - `s1_eternum-Structure` (coord_x/coord_y)
  - `s1_eternum-ExplorerTroops` (coord.x/coord.y)
  - `s1_eternum-Building` (outer_col/outer_row)
- Clause source: `client/apps/game/src/dojo/torii-stream-manager.ts`

### 2) Global stream (small)
Only non-spatial models that must be realtime everywhere.
Examples:
- `s1_eternum-StoryEvent`
- Season config, address names, leaderboard config, etc.

### 3) Player-owned stream (optional)
Keeps player assets updated offscreen.
- Owner-based clause:
  - `s1_eternum-ExplorerTroops` member `owner`
  - `s1_eternum-Structure` member `owner` (address)

## Fetch/Hydration Plan
When the camera enters a new bounds region:
1) Fetch tiles in bounds (`getMapFromToriiExact`).
2) Fetch structures in bounds (`refreshStructuresForChunks` -> `getStructuresDataFromTorii`).
3) **New**: Fetch armies that appear in the tile occupancy data.
4) Switch to the new bounds stream (so subsequent deltas land).

This ensures the area is fully hydrated before deltas arrive.

## Implementation Steps (Detailed)
### Step 0: Add instrumentation and a feature flag
- Add per-stream update counters in `client/apps/game/src/dojo/sync.ts`.
- Feature flag to toggle global vs selective streams.
- Why: verify update rate reduction before fully switching.

### Step 1: Army hydration on chunk switch (missing today)
Add a new query in `client/apps/game/src/dojo/queries.ts`:
```
getExplorersFromToriiByIds(client, components, explorerIds)
  -> models: ["s1_eternum-ExplorerTroops", "s1_eternum-Resource"]
```
Then wire it into `client/apps/game/src/three/scenes/worldmap.tsx`:
1) After `computeTileEntities()` completes, scan the newly hydrated tiles for occupiers of type `Army`.
2) Dedupe IDs and skip those already loaded (`components.ExplorerTroops`).
3) Fetch `ExplorerTroops` by keys via the new query.

Notes:
- Tile occupancy provides `occupier_id` for armies, so key-based fetches are simple and cheap.
- This matches how `WorldUpdateListener.Army.onTileUpdate()` expects data to exist when it tries to read `ExplorerTroops`.

### Step 2: Hook bounds subscription into chunk switching
Use the existing `ToriiStreamManager` (`client/apps/game/src/dojo/torii-stream-manager.ts`):
- Instantiate once in `WorldmapScene`.
- On `performChunkSwitch()` or after `updateVisibleChunks()` computes the new chunk key:
  - Build a `BoundsDescriptor` using `getRenderFetchBoundsForArea(...)`.
  - Add `FELT_CENTER()` to convert normalized map coords into contract coords.
  - Call `toriiStreamManager.switchBounds(descriptor)`.

This ensures the live stream follows the camera without resubscribing on every minor pan.

### Step 3: Move away from global stream in `initialSync()`
In `client/apps/game/src/dojo/sync.ts`:
- Replace `syncEntitiesDebounced(..., null)` with one of:
  - no stream at all (worldmap handles it), or
  - a minimal global stream with a small model list.

This is the actual removal of the O(N) pressure.

### Step 4: Add player-owned (offscreen) stream if needed
If UX needs always-live updates for player armies/structures:
- Add a Member clause stream (owner == player).
- Combine as a second stream via `ToriiStreamManager.setGlobalModels(...)` or create a new manager instance.

### Step 5: Prune stale entities on bounds switch
Because bounded streams do not emit "leave" events:
- On bounds change, remove entities that are no longer in the pinned area.
- Use `world.deleteEntity(...)` to prevent stale render state.
- Keep player-owned entities regardless if you enable the player-owned stream.

### Step 6: Observability and rollout
Track:
- Entity update rate per stream.
- Queue sizes in `syncEntitiesDebounced`.
- Time-to-first-render for a new chunk.

Rollout:
1) Enable selective subscriptions behind a flag in dev/staging.
2) Validate correctness and update volume reduction.
3) Remove global stream entirely in prod.

## Code Touchpoints Summary
- `client/apps/game/src/dojo/queries.ts`
  - Add `getExplorersFromToriiByIds`.
- `client/apps/game/src/three/scenes/worldmap.tsx`
  - Add `hydrateArmiesForChunk`.
  - Call it after `computeTileEntities`.
  - Create and use `ToriiStreamManager`.
- `client/apps/game/src/dojo/sync.ts`
  - Remove or shrink the global stream in `initialSync`.
  - Add per-stream counters.
- `client/apps/game/src/dojo/torii-stream-manager.ts`
  - Use for bounds switching and global model stream(s).

## Edge Cases and Risks
- Clause paths for nested coords (e.g. `coord.x` vs `coord_x`) must match Torii schema. Validate against a known query.
- Movement across bounds: an army can leave the area without a final update. Pruning on bounds switch avoids stale visuals.
- If `MapDataStore` remains global, it may still be a bottleneck; consider scoping its SQL queries to bounds later.

## Manual Validation Checklist
- Pan across multiple chunks: no missing tiles/structures/armies on first entry.
- Fast scrolling: no "pop-in delay" worse than current.
- Player-owned entities update even when offscreen (if enabled).
- Update rate drops when compared to global stream.

## Optional Future Enhancements
- Replace `MapDataStore` with bounds-scoped SQL or live queries.
- Combine tile and army hydration in a single Torii query response if torii supports multi-model bounds queries.
- Adaptive prefetch sizing based on device performance.
