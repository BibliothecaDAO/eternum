# Chunking System Implementation Plan

Scope: fix ghost/disappearing armies, stale tiles, and non-deterministic chunk loads by aligning chunk geometry,
cleaning lifecycle, and introducing the chunk-system pipeline incrementally.

## Phase 0 – High-Severity Hotfixes

- Army instancing removal fix: patch `ArmyManager.removeVisibleArmy` and the caller in `removeArmy` to clear the correct
  slot, refresh the swapped entity’s matrices, and avoid wiping the swapped slot. Add a regression unit test around
  swap/pop.
- Matrix cache invalidation: correct row/col loops in `removeCachedMatricesAroundColRow` and `getChunksAround` to use
  width for cols and height for rows; ensure chunk keys aren’t swapped.
- Visibility registration leak: unregister chunks when they leave the pinned/current set in `WorldmapScene` and add a
  bounded cap in `CentralizedVisibilityManager`.
- Listener cleanup: capture `WorldUpdateListener` unsubscribe handles and dispose them in `onSwitchOff/destroy` to
  prevent double updates.

## Phase 1 – Geometry & Boundary Alignment

- Define a single chunk geometry config `{chunkSize, renderSize, overlap}` shared by map, army, structure, minimap, and
  Torii fetches.
- Make fetch bounds == render bounds (+optional overlap), and keep army/structure `chunkStride` equal to `chunkSize`.
- Add helpers `chunkKeyFromHex`, `chunkBoundsFromKey`, `hexInChunkBounds` to centralize rounding; replace ad-hoc
  `getChunkCenter`/`worldToChunkCoordinates`.
- Add assertions/DEV logging when entities fall outside the active chunk during render to catch edge cases.

## Phase 2 – Deterministic Lifecycle (Chunk System)

- Wire `ChunkLifecycleController` into `WorldmapScene`:
  - Use `onCameraMove` to request chunks; debounce via controller.
  - Register managers through adapters; set `DataFetchCoordinator` fetch to Torii batch queries.
  - Move prefetch (3×3) into controller priority queue.
- Hydration gating: use `EntityHydrationRegistry` to await `WorldUpdateListener` receipts before
  `ManagerOrchestrator.render` runs. Remove ad-hoc `scheduleHydratedChunkRefresh`.
- Cancel/ignore late fetches for unpinned chunks; surface state via debug HUD (chunk phase, pending fetches).

## Phase 3 – Stable Instancing & Ownership

- Introduce a per-model free list in `ArmyModel` with stable instance IDs; avoid swap/pop without buffer rewrites.
  Provide `alloc(entityId)`, `free(entityId)`, `rebind(entityId, index)`.
- Decouple visibility diffing: compute desired visible set → diff against `visibleArmyIndices` → apply alloc/free
  updates in deterministic order; support `force` refresh for hydration.
- Do the same audit for `StructureManager` buckets and instancing slots (ensure deletions update buffers).
- Status: implemented stable slot allocator + deterministic visibility diff; structure removals trigger immediate
  instanced-buffer refresh.

## Phase 4 – Visibility & Culling

- Centralize visibility queries through `CentralizedVisibilityManager` for armies/structures; remove per-manager frustum
  state or keep it in sync via a shared frame token.
- Register/unregister chunk bounds on lifecycle enter/exit; bound cache size; add DEV metrics for visible chunk count
  and frustum tests per frame.
- Optional: add per-instance frustum flags (CPU) or per-chunk bounding spheres (GPU draw call culling) once stable.
- Status: Army/Structure managers now subscribe to the centralized visibility manager for label/icon culling and point
  checks; chunk bounds are registered with a capped visibility registry and stats expose capacity.

## Phase 5 – Testing & Instrumentation

- Add unit tests for chunk math (`chunkKeyFromHex`, bounds overlap), hydration gating, and instancing diff (swap
  removal, double add/remove).
- Add integration test harness: simulate camera scroll across chunk edges with scripted `WorldUpdateListener` events;
  assert no ghost/double armies and no empty tiles after hydration.
- Add DEV overlay/logging: chunk phase, fetch timers, hydration progress per chunk, instanced counts, and visibility
  cache size.

## Phase 6 – Rollout

- Guard new controller behind a feature flag; ship Phase 0 hotfixes immediately.
- Enable controller in canary builds; capture telemetry (missing renders, late hydrations, memory deltas).
- Remove legacy `updateVisibleChunks` path after validation; keep debug hooks for forced refresh and cache clear.
