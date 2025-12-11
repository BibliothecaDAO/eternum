# Three.js client

This directory hosts the browser Three.js renderer for the Eternum game client (world map, hex view, HUD).

## Quick start

- Install deps once at repo root: `pnpm install`
- Run the Blitz client: `pnpm --dir client/apps/game dev`
- `GameRenderer` is instantiated by the app shell with the Dojo `SetupResult` and mounts into `#main-canvas`.

## Key entry points

- `game-renderer.ts`: renderer bootstrap, controls, post-processing, and the main animation loop.
- `scene-manager.ts`: switches between scenes with fade transitions.
- `scenes/hexagon-scene.ts`: base class that wires shared lighting, fog, ground plane, input, and visibility managers.
- `scenes/worldmap.tsx` and `scenes/hexception.tsx`: concrete scenes for the map and settlement view.
- `scenes/hud-scene.ts`: overlay scene for HUD elements, navigator, and ambience controls.

## Conventions

- Three.js config lives in `constants/rendering.ts` (camera, controls, post-processing, fog).
- Domain constants live in `constants/scene-constants.ts` and `constants/army-constants.ts`.
- Managers are under `managers/`, utilities under `utils/`, effects under `effects/`.
- Toggle graphics via `GraphicsSettings` in `ui/config.tsx`; low skips post-processing.

## Architecture overview

**Core wiring**

- `GameRenderer` (`game-renderer.ts`): top-level bootstrap. Creates the Three renderer, shared camera/controls,
  post-processing composer, CSS2D label renderer, instantiates scenes, and runs the main `animate()` loop. Any
  camera/control change schedules a chunk refresh for the world map.
- `SceneManager` (`scene-manager.ts`): registers scenes and switches between them with fade transitions via
  `TransitionManager`.
- `HexagonScene` (`scenes/hexagon-scene.ts`): abstract base class for map scenes. Owns the Three `Scene`, uses the
  shared `PerspectiveCamera` from controls, sets up lighting/fog/ground, input routing, frustum tracking, and the
  singleton `CentralizedVisibilityManager`.

**Scenes**

- `WorldmapScene` (`scenes/worldmap.tsx`): large-scale world view and the chunking + hydration system.
- `HexceptionScene` (`scenes/hexception.tsx`): local/settlement view around a structure; radius-based, no world
  chunking.
- `HUDScene` (`scenes/hud-scene.ts`): orthographic overlay (navigator, weather, ambience) rendered after the main scene.

**Managers & utilities**

- Entity/FX managers live in `managers/*` (`ArmyManager`, `StructureManager`, `QuestManager`, `ChestManager`,
  `FXManager`, etc.). They translate ECS state into instanced meshes and labels per chunk.
- Shared helpers live in `utils/*`, especially:
  - `chunk-geometry.ts`: single source of truth for chunk centers and render bounds.
  - `centralized-visibility-manager.ts`: per-frame frustum cache shared across all managers.
  - matrix/material pools to reduce allocations.

**Data flow**

Torii/Dojo ECS → `WorldUpdateListener` → `WorldmapScene` caches (`exploredTiles`, `structuresPositions`, …) → managers
`updateChunk()` → instanced meshes/labels → rendered each frame.

## Worldmap chunking (deep dive)

**Geometry & keys**

- **Stride chunk size:** `chunkSize = 24` hexes. Chunk keys are `"startRow,startCol"` in **normalized** hex coords,
  snapped to multiples of `chunkSize`.
- **Render window:** `renderChunkSize = 64×64` hexes centered on the stride chunk. All fetch/visibility logic uses
  `utils/chunk-geometry.ts` to avoid edge drift.

**Pinned neighborhood & prefetch**

- **Pinned neighborhood is 5×5**, not 3×3: the scene keeps a 5×5 grid of stride chunks active around the current chunk
  (`chunkRowsAhead/Behind = 2`, `chunkColsEachSide = 2`). These pinned chunks drive background prefetching and cache
  retention.
- **Directional prefetch:** a 2×3 band of chunks ahead of camera movement is prefetched to reduce pop‑in.

**Loading / unloading**

- Camera movement triggers `WorldmapScene.requestChunkRefresh()` (50ms debounce).
- `updateVisibleChunks()` computes a ground focus point, derives the next chunk key, and uses a small padding
  (`chunkSwitchPadding`) to delay switching right at boundaries.
- On chunk change `performChunkSwitch()`:
  1. Sets `currentChunk`, updates bounds, and registers/unregisters chunk bounds with the
     `CentralizedVisibilityManager`.
  2. Starts deterministic Torii fetches for tiles (`computeTileEntities`) and structures (`refreshStructuresForChunks`)
     for the new render window.
  3. Pins the 5×5 neighborhood and kicks background prefetch for those chunks.
  4. Immediately rebuilds the visible hex grid (instanced biome tiles).
  5. Once tile+structure hydration completes, calls all entity managers’ `updateChunk()` concurrently.

**Fetch caching**

- Tile fetches are deduped by `fetchedChunks` (completed) and `pendingChunks` (in‑flight), keyed by Torii super‑areas
  (`getRenderAreaKeyForChunk`), so multiple stride chunks share one fetch.
- A completed fetch is only cached if its render area is still pinned when it finishes, preventing stale caching.

## Rendering pipeline

- `WebGLRenderer` with an `EffectComposer`:
  - `RenderPass` draws the active game scene (worldmap or hexception).
  - Optional FXAA/bloom/vignette/tone-mapping passes based on `GraphicsSettings`.
- `animate()` loop:
  1. Updates controls and clears the main renderer.
  2. Updates the active scene and renders it through the composer.
  3. Updates and renders the HUD scene on top (depth cleared only).
  4. Renders CSS2D labels for both the active scene and HUD.

## Typical frame when panning

1. User pans/zooms → `MapControls` fires `"change"` events.
2. Renderer debounces and calls `updateVisibleChunks()`.
3. If chunk changes: grid rebuild starts immediately; managers update once Torii hydration resolves.
4. The next `animate()` frame renders updated instanced meshes and labels.

## Risks & suggestions

- Tile hiding is coupled to structure/quest presence during grid builds. If structures/quests change without a tile
  update, a targeted grid refresh could be required to avoid tiles showing under them.
- The 5×5 pinned set can exceed `maxMatrixCacheSize = 16`; consider increasing the cache or tying it to pinned count to
  avoid retention warnings.
- Torii tile fetches are coalesced by super‑areas (`toriiFetch.superAreaStrides`) so overlapping 64×64 render windows
  don’t repeat queries. Tune `superAreaStrides` if Torii payload size or pop‑in behavior changes.
- Keep `chunkSize`/`renderChunkSize` consistent across managers; `utils/chunk-geometry.ts` is the shared source of
  truth.

1. Add a dev chunk debug overlay (or consolidate the existing DEV logs). You’ll want live visibility into currentChunk,
   pinned size, pending/fetched counts, and per‑manager visible counts before tuning anything.
2. Do the two low‑risk hygiene fixes:
   - Unregister all pinned chunk bounds on WorldmapScene.onSwitchOff() to avoid stale visibility state.
   - Remove/guard the redundant computeTileEntities(this.currentChunk) inside updateHexagonGrid so rendering isn’t
     launching fetches.
3. Fix correctness: trigger tile/biome refresh when structures/quests enter/ leave/move inside the current render bounds
   (not only on tile updates). This removes “tiles showing under late‑hydrated entities.”
4. Centralize chunk geometry/policy constants (stride=24, render=64×64, pin radius=2 → 5×5, padding, prefetch band) into
   a shared config used by scene + managers. This stabilizes invariants before tuning.
5. Resize/auto‑scale the biome matrix cache to cover the pinned set (≥25, preferably pinned+slack). Now you can tie it
   directly to the shared config.
6. Add prefetch priority/cancellation (current > pinned ring > forward band, cap concurrency, drop queued work on pin
   changes). This reduces wasted work during fast pans.
7. (Done) Coalesce Torii tile fetches across overlapping render windows using “super‑area” keys. Remaining tuning is
   choosing the right `superAreaStrides` for payload vs. reuse.
8. Strengthen hysteresis around chunk boundaries, using the debug overlay to tune enter/exit bands and verify thrash
   reduction.
9. Extract chunking/grid/fetch/caching into a dedicated chunk subsystem. Do this last so you’re refactoring a stable,
   well‑understood behavior/perf profile.

Current Performance Risks (ordered)

- PointsLabelRenderer.setPoint recomputes bounding spheres + flips multiple attributes on every call, then re‑checks
  frustum; chunk refreshes and moving armies can trigger hundreds of calls → CPU spikes + stutter
  (managers/points-label-renderer.ts).
- Multiple independent requestAnimationFrame loops for effects (hover, selection pulses, resource FX) run alongside the
  main loop → extra callbacks, unsynced timing, frame variance (managers/hover-hex-manager.ts,
  managers/selection-pulse-manager.ts, managers/resource- fx-manager.ts).
- Heavy, repeated allocations in hot chunk/visibility paths: getWorldPositionForHex returns new Vector3, plus many
  .clone() calls inside loops → GC thrash on chunk switches and large entity counts (utils/utils.ts,
  scenes/worldmap.tsx, managers/\*-manager.ts).
- InteractiveHexManager keeps allHexes/hexBuckets forever using string keys; updateVisibleHexes parses/splits strings
  each switch → memory grows with explored map, visibility updates get slower (managers/interactive-hex- manager.ts,
  scenes/worldmap.tsx#processCell).
- CentralizedVisibilityManager builds string keys with toFixed() per query → lots of transient strings when many
  entities are checked (utils/centralized-visibility- manager.ts).
- ArmyModel.updateInstance updates every base/cosmetic instanced mesh per moving entity (zero‑scale hides) → O(models ×
  movingArmies) per frame under load (managers/ army-model.ts).
- Ownership pulses create per‑hex Mesh + cloned shader material (no instancing) → draw‑call/material explosion if
  positions grow (managers/selection-pulse-manager.ts).
- CSS2D label rendering every frame for world + HUD can become DOM‑bound with many labels despite pooling (game-
  renderer.ts#animate, utils/labels/\*).
- updateHexagonGrid finalization applies matrices with per‑instance setMatrixAt loops; end‑of‑task “apply” can still
  hitch (scenes/worldmap.tsx#finalizeSuccess).

Concrete Optimisation Recommendations

- Batch/defang PointsLabelRenderer updates
  - Change: add beginBatch()/endBatch() or setPoints([...]) in managers/points-label- renderer.ts; during batch, only
    write to arrays, then once: attributes.position.needsUpdate = true, setDrawRange, recompute bounds once or disable
    bounds/frustum for points (points.frustumCulled = false). Add setPointPosition(entityId,x,y,z) so moving updates
    don’t touch size/color.
  - Why: removes O(N) computeBoundingSphere per point and redundant attribute flips.
  - Impact: high CPU + stutter reduction.
- Collapse per‑manager rAF loops into main update
  - Change: refactor HoverHexManager, SelectionPulseManager, ResourceFXManager to expose update(deltaTime); register
    them in WorldmapScene.update / HexagonScene.update or a shared FXSystem. Remove their internal
    requestAnimationFrame.
  - Why: one timing source, fewer callbacks, lower frame variance.
  - Impact: high/medium CPU + stutter.
- Introduce non‑alloc hex→world helpers and remove clones
  - Change: in utils/utils.ts, add getWorldPositionForHexInto(hex, out, flat?) (or (col,row,out)); update hot loops to
    reuse scratch vectors:
    - scenes/worldmap.tsx#processCell, InteractiveHexManager.renderHexes/ renderAllHexes, ArmyManager.isArmyVisible,
      StructureManager.isStructureVisible, QuestManager.isQuestVisible, ChestManager.isChestVisible.
    - Avoid position.clone() inside loops; pass numbers or copy into scratch.
  - Why: cuts thousands of Vector3 allocations per chunk rebuild and per visibility pass.
  - Impact: high GC/memory + stutter.
- Cache render bounds once per chunk update
  - Change: compute bounds once in getVisible*ForChunk and pass to is*Visible helpers (armies/structures/
    quests/chests). Remove per‑entity getRenderBounds calls.
  - Why: avoids repeated object creation and math.
  - Impact: medium-high on chunk switch smoothness.
- Fix CentralizedVisibilityManager keying
  - Change: replace boxToKey/sphereToKey/pointToKey with identity‑based caches: WeakMap<Box3, boolean>, WeakMap<Sphere,
    boolean>, and WeakMap<Vector3, boolean> (or allow caller‑supplied stable keys).
  - Why: eliminates per‑query string/toFixed allocations.
  - Impact: medium-high CPU/GC when many entities visible.
- Rework InteractiveHexManager storage
  - Change: store hexes per‑chunk (e.g., Map<chunkKey, Uint32Array> or Set<number> encoded coords) and evict when chunks
    unpinned. Avoid global allHexes growth and string splitting. Optionally, skip addHex per cell and derive visible
    coords directly from render bounds.
  - Why: prevents unbounded memory and keeps visibility O(window) not O(explored).
  - Impact: high memory + scalability.
- Bulk‑apply biome matrices at grid finalize
  - Change: in scenes/worldmap.tsx#finalizeSuccess, build InstancedBufferAttribute per biome via
    InstancedMatrixAttributePool and call InstancedBiome.setMatricesAndCount once, or spread final apply across a few
    frames.
  - Why: reduces end‑of‑chunk one‑frame “apply” spike.
  - Impact: medium-high frame variance.
- Reduce per‑frame ArmyModel work
  - Change: in managers/army-model.ts#updateInstance, update only active base model + active cosmetic (and previous
    active on transitions). Keep per‑entity active model IDs to skip zero‑scale writes to inactive meshes each frame.
  - Why: fewer instanced‑mesh writes with many moving armies.
  - Impact: medium-high CPU.
- Instance ownership pulses
  - Change: replace per‑mesh clones in managers/ selection-pulse-manager.ts#showOwnershipPulses with a single
    InstancedMesh and per‑instance color/ pulseColor attributes. Add a cap or reuse pool.
  - Why: collapses draw calls/materials.
  - Impact: medium-high GPU.
- Throttle CSS2D label rendering
  - Change: in game-renderer.ts#animate, render CSS2D only when camera changed or label state dirty, or at capped FPS
    (e.g., 30). Use QualityController.labelRenderDistance for distance cull.
  - Why: DOM layout is often the real CPU bottleneck at scale.
  - Impact: medium CPU.
- Actually use QualityController
  - Change: call qualityController.recordFrame(deltaMs) in main loop; subscribe to quality events to adjust pixel ratio,
    shadows, post‑FX, label distance, animation FPS, chunk load radius.
  - Why: keeps frame time stable across hardware/player density.
  - Impact: medium stability/scalability.
- Minor cleanups
  - Remove unused per‑cell rotation math in scenes/ worldmap.tsx#processCell if rotation stays disabled.
  - Precompute particle circle cos/sin once in managers/ particles.ts.
  - Guard stray logs with import.meta.env.DEV (managers/ instanced-model.tsx, managers/army-manager.ts).
  - Impact: low but easy wins.

Chunking / Rendering‑Specific Improvements

- Visibility logic
  - Already movement‑debounced + hysteresis‑based (good). Next: avoid focusPoint clones, and make managers share
    precomputed bounds/center from utils/ chunk-geometry.ts.
  - Replace per‑entity frustum point creation with scratch vectors + centralized visibility cache.
- Load/unload performance
  - Keep matrix cache (33 chunks) but ensure InteractiveHexManager and label/icon caches evict with pinned‑set changes.
  - Reuse shared materials via MaterialPool for structures/biomes if you see duplication in MaterialPool.getStats();
    avoid creating per‑object materials in future additions.

1. Quick wins (low risk): Batch PointsLabelRenderer, disable per‑set bounding sphere, guard logs, remove unused math.
2. GC & visibility refactor: Add getWorldPositionForHexInto, eliminate clones, cache render bounds per update, switch
   visibility caches
3. Adaptive quality/LOD: Wire QualityController and add simple distance‑based shadow/label/animation LOD.

Open Questions / Assumptions

- Is InteractiveHexManager meant to support interaction on far‑away explored hexes, or can it be limited to pinned/
  render windows? This drives eviction strategy.
- How many icons/labels are expected at peak (armies, (100s+ hexes)? If yes, instancing is urgent.
- Can icon frustum culling be relaxed (single draw‑call points) to simplify PointsLabelRenderer?
- Any constraints on using Web Workers/OffscreenCanvas for grid or hydration prep?

If you want, I can turn the top 2–3 items into concrete patches next (starting with PointsLabelRenderer batching and
non‑alloc getWorldPositionForHexInto).
