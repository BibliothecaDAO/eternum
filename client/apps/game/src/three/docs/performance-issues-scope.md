# Three.js Performance Audit: Scope and Fix Plan

## Scope

- Targets: per-frame loops, input handlers, scene updates, and GPU workloads in `client/apps/game/src/three`.
- Hot paths examined:
  - Render loop: `game-renderer.ts` (`animate`, composer passes, label rendering).
  - Scene updates: `scenes/hexagon-scene.ts`, `scenes/worldmap.tsx`, `scenes/hud-scene.ts`.
  - Input/mouse: `managers/input-manager.ts`, `managers/interactive-hex-manager.ts`.
  - Animation systems: `managers/instanced-biome.tsx`, `managers/army-model.ts`, `managers/path-renderer.ts`.
  - Effects/particles: `effects/day-night-cycle.ts`, `effects/rain-effect.ts`, `systems/ambient-particle-system.ts`.
  - Labels/UI: `managers/army-manager.ts`, `managers/structure-manager.ts`, `utils/labels/label-pool.ts`.
- Out of scope:
  - Non-Three.js UI and React view-layer performance.
  - Network or SQL query performance.
  - Server-side simulation costs.

## Issues and Fix Plan

### 1) Day/night cycle per-frame allocations

- Location: `effects/day-night-cycle.ts` (color interpolation and sun position updates).
- Problem: `lerpColor` creates new `Color` objects each call; `updateSunPosition` and `applyWeatherModulation` allocate
  `Vector3`/`Color` every frame.
- Complexity: O(1) per frame, but continuous GC churn.
- Impact: steady GC pressure and intermittent minor stutter during camera movement or storms.
- Fix:
  - Add cached `Color` and `Vector3` scratch members to reuse across frames.
  - Replace `lerpColor` with `Color.lerpColors` into a preallocated `Color` and return hex without allocations.
  - Store `targetSunPosition`/`targetSunTarget` as reusable vectors; mutate them in place.
  - Store a persistent `stormTint` color to avoid allocation inside `applyWeatherModulation`.
- Validation:
  - Chrome Performance panel: reduced GC events during steady camera motion.
  - `performance.memory` should show flatter heap during storms.

### 2) Ambient particle system inner-loop allocations and random usage

- Location: `systems/ambient-particle-system.ts` (`updateFireflies`).
- Problem: `new Color(...)` is allocated every update; `Math.random()` in the inner loop adds CPU overhead and prevents
  deterministic stepping.
- Complexity: O(n) per frame where n = `fireflyCount`.
- Impact: CPU overhead on low-end devices; visible in long tasks during heavy scenes.
- Fix:
  - Cache `baseColor` as a member and update only when params change.
  - Pre-seed per-particle random phases or drift noise arrays; update random changes at a lower frequency outside the
    per-particle loop.
- Validation:
  - Performance panel: lower scripting time in `updateFireflies`.
  - Visually confirm particle motion remains acceptable.

### 3) HUD particle spawnCenter allocation

- Location: `scenes/hud-scene.ts` (`update`).
- Problem: `new Vector3(...)` created every frame for `spawnCenter`.
- Complexity: O(1) per frame.
- Impact: avoidable GC churn in the render loop.
- Fix:
  - Add a reusable `spawnCenter` member and update via `.set(...)`.
  - Alternatively, pass camera position directly and let `AmbientParticleSystem` maintain its own center.
- Validation:
  - GC events drop during idle camera frames.

### 4) CSS2D label visibility and DOM thrash

- Location: `managers/army-manager.ts`, `managers/structure-manager.ts` (label visibility sweeps).
- Problem: Per-sweep DOM reparenting and style updates for many labels cause layout/paint spikes.
- Complexity: O(n) per visibility sweep, where n = label count.
- Impact: spikes when label counts are high (hundreds+), especially during camera movement or visibility changes.
- Fix:
  - Diff label visibility sets and update only changed labels.
  - Avoid reparenting whenever possible; toggle visibility instead of removing/adding.
  - LOD far labels into `PointsLabelRenderer` and keep CSS2D only for nearby/selected entities.
- Validation:
  - Performance panel: fewer long tasks during camera pans.
  - Reduced DOM node churn in the Elements timeline.

### 4a) Label LOD tied to quality settings (scoped)

- Goal: Use `labelRenderDistance` and `maxVisibleLabels` from `utils/quality-controller.ts` to cull or downgrade labels
  when zoomed out.
- Current state:
  - `labelRenderDistance` and `maxVisibleLabels` exist in quality presets but are unused.
  - Label visibility is based on frustum only; no distance cap or count limit.
- Proposed implementation:
  - Add label LOD parameters to `HexagonScene.applyQualityFeatures` and store them for managers.
  - Expose setters on `ArmyManager` and `StructureManager` (e.g., `setLabelLOD({ maxDistance, maxCount })`).
  - During `applyFrustumVisibilityToLabels`, add a distance check against the camera and early-cull if beyond
    `labelRenderDistance`.
  - If label count exceeds `maxVisibleLabels`, keep the nearest N labels (distance-sorted or bucketed by chunk) and hide
    the rest.
  - Downgrade far labels to `PointsLabelRenderer` icons instead of CSS2D (optional staged rollout).
- Complexity impact:
  - Adds O(n) distance checks in label sweeps, but reduces DOM updates and CSS2D work at scale.
  - Optional nearest-N selection adds O(n log n) if sorting; can be optimized with bucketed thresholds.
- Risks:
  - UI expectations for always-visible labels (e.g., selected entities) need exceptions.
  - Sorting can add CPU overhead if not throttled.
- Validation:
  - Verify label counts respect `maxVisibleLabels` on low/mid quality.
  - Confirm no missing labels for selected/hovered entities.

### 5) Interactive hex visibility scan uses string parsing

- Location: `managers/interactive-hex-manager.ts` (`updateVisibleHexes`).
- Problem: `hexString.split(",").map(Number)` inside nested loops allocates and parses per-hex.
- Complexity: O(n) per chunk update where n = hexes in candidate buckets.
- Impact: chunk refresh cost spikes during fast panning or large render windows.
- Fix:
  - Store bucket entries as numeric pairs or packed ints (e.g., `(col << 16) | row`) to avoid string parsing.
  - Optionally maintain typed arrays per bucket to speed scanning.
- Validation:
  - Measure `updateVisibleHexes` time via `PerformanceMonitor` and confirm lower variance.

### 6) Army world-position allocations in per-frame updates

- Location: `managers/army-manager.ts` (batched update path when `instanceData.position` is missing).
- Problem: `getWorldPositionForHex` allocates a new `Vector3` inside a per-frame loop.
- Complexity: O(n) per frame where n = visible armies without cached positions.
- Impact: GC and CPU overhead during large army counts.
- Fix:
  - Cache world positions on army data and update only when hex coords change.
  - Use `getWorldPositionForHexCoordsInto` with a shared scratch vector when needed.
- Validation:
  - GC spikes reduced when many armies are visible.

### 7) Instanced biome morph texture updates are expensive

- Location: `managers/instanced-biome.tsx` (`updateAnimations`).
- Problem: Per-frame morph texture updates scale with instance count and morph targets; uploads are costly on GPU.
- Complexity: O(n \* m) per animation tick (n instances, m morph targets).
- Impact: GPU stalls and CPU overhead in dense biomes (1k-2k+ instances).
- Fix:
  - Tighten animation gating (distance + frustum checks).
  - Dynamically reduce animation FPS at high instance counts or when GPU time exceeds budget.
  - Longer-term: move wind/idle animation to shader time with per-instance phase to avoid morph texture updates.
- Validation:
  - `renderer.info` shows stable frame time with large biome counts.
  - GPU timer queries show reduced time for animation-heavy frames.

### 8) Weather + rain + post-processing on low-end devices

- Location: `effects/rain-effect.ts`, `systems/ambient-particle-system.ts`, `game-renderer.ts`.
- Problem: Rain (800 line segments) plus ambient particles and post-processing can exceed mobile budgets.
- Complexity: O(n) per frame for particles, plus multiple full-screen passes.
- Impact: low FPS on low-end devices and battery drain.
- Fix:
  - Tie rain and ambient particle counts to `QualityController` (e.g., halve counts on MID/LOW).
  - Disable or reduce post-processing (FXAA, bloom) on low settings or when GPU time is high.
  - Add adaptive scaling based on measured GPU time.
- Validation:
  - Mobile device testing: FPS stays near target in storms.

## Additional LOD Opportunities (Scoped)

### A) Entity count caps from quality settings

- Use `maxVisibleArmies` / `maxVisibleStructures` to hard-cap rendered instances when zoomed out.
- Candidate hooks:
  - `WorldmapScene.updateVisibleChunks` to limit which entities enter manager visibility.
  - `ArmyManager.syncVisibleSlots` / `StructureManager` visibility assembly.
- Strategy:
  - Prioritize by distance to camera or by interaction priority (selected, hovered, moving).

### B) Animation LOD beyond current FPS throttling

- Use `animationCullDistance` from quality settings to gate:
  - biome morph animations (`managers/instanced-biome.tsx`)
  - army/structure idle animations
- Add view-based tiers: far view uses “static pose” or extremely low animation FPS.

### C) Path/FX LOD

- Path rendering:
  - Hide non-selected paths beyond a distance threshold.
  - Reduce segment density based on camera distance (e.g., decimate far paths).
- FX:
  - Reduce thunderbolt count/radius on low quality.
  - Reduce or disable non-critical FX labels when zoomed out.

### D) Particle LOD

- Scale `rainCount`, ambient dust/firefly counts by quality or GPU time.
- Reduce update frequency for particles when not in camera focus or in far view.

### E) Shadow and lighting LOD

- Already toggles by camera view, but can add:
  - shadow map size scaling by view/quality
  - disable per-instance contact shadows on far views

### F) Texture/anisotropy LOD (optional)

- Lower anisotropy for terrain and reduce mip bias on low quality.
- Consider lower-resolution textures for distant tiles or mini-map-only surfaces.

## Fix Order and Deliverables

1. Low-risk GC fixes (issues 1-3, 6).
2. Label visibility batching and LOD (issue 4).
3. Bucket storage refactor (issue 5).
4. Animation throttling and shader-based motion plan (issue 7).
5. Adaptive weather/post-processing scaling (issue 8).

Deliverables:

- Code changes with minimal behavioral risk and clear performance wins.
- Optional instrumentation hooks for before/after measurement.
- Updated docs noting any behavior or visual changes.
