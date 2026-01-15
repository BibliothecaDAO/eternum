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

See `ARCHITECTURE.md` for a deeper map of scenes, managers, and data flow.

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

---

1. Current Visual Limitations

- Potential double tone-mapping / inconsistent grade: renderer uses ACESFilmicToneMapping while postprocessing also
  applies ToneMappingEffect (game-renderer.ts:250, game-renderer.ts:891), which can wash contrast and make bloom
  behavior unpredictable across quality tiers.
- Fog depth cues effectively disabled: fog is gated behind a user toggle + quality checks (scenes/hexagon-
  scene.ts:1069), so the world can read “flat” at zoom-out.
- Fog zoom instability risk: day/night cycle hard-sets fog near/far every update (effects/day-night- cycle.ts:314),
  fighting the camera-distance fog logic (scenes/hexagon-scene.ts:1069) if you enable it.
- Fill lighting likely too strong/constant: storm update overrides hemisphere intensity to ~1.2 continuously
  (scenes/hexagon-scene.ts:757), reducing directional contrast even though base lighting aims for subtle fill
  (scenes/hexagon-scene.ts:215).
- Worldmap shadow noise + cost: worldmap forces castShadow = shadowsEnabledByQuality and uses a very wide shadow frustum
  (scenes/worldmap.tsx:924), overriding the “no shadows in Far view” intent in the base camera logic
  (scenes/hexagon-scene.ts:1007).
- Emissive/glow risk: HDR-ish emissive values (e.g. MinesMaterialsParams) can blow out once you fix tone- mapping/bloom
  ordering (constants/scene-constants.ts:257, constants/rendering.ts:50).

2. High-Impact Visual Improvements (Low GPU Cost)

- Pick one tone-mapping path: either (A) keep postprocessing tone mapping and set renderer toneMapping to NoToneMapping
  for MID/HIGH, or (B) remove the ToneMappingEffect and rely on renderer tone mapping (game- renderer.ts:250,
  game-renderer.ts:891). This alone usually improves clarity and “intentional” color.
- Enable subtle fog by default for Medium/Far: make fog opt-out (not opt-in) and keep it very gentle; it’s night manager
  and use updateFogForDistance as the single source of truth for near/far (effects/day-night- cycle.ts:314,
  scenes/hexagon-scene.ts:1069).
- Restore Far-view shadow disable in worldmap: align scenes/worldmap.tsx:924 with scenes/hexagon- scene.ts:1026 to avoid
  noisy distant shadows and a big shadow pass.
- Add cheap “contact shadows” for units/structures: blob/shadow decals (instanced quads with a soft alpha texture) keep
  units grounded when Far-view shadows are off, with tiny cost.

3. Lighting & Material Recommendations

- Lighting ratios (readability-first): keep a strong sun + restrained fill.
  - Target ranges: sun intensity ~1.5–2.5, hemisphere ~0.25–0.6, ambient ~0.05–0.15 (then stylize via color/grade).
  - Today: hemisphere is initialized at 0.8 (scenes/hexagon-scene.ts:215) but then effectively forced near 1.2
    (scenes/hexagon-scene.ts:757).
- Storm vs “always on” atmosphere: apply the flicker only when weather says storm; otherwise keep steady lighting so
  silhouettes and material response are stable (scenes/hexagon-scene.ts:757).
- Shadow tuning: keep shadows crisp and purposeful.
  - Use Far-view “no shadows” consistently (scenes/hexagon-scene.ts:1026, scenes/worldmap.tsx:924).
  - Consider normalBias + smaller bias for cleaner results at low map sizes (your current bias = -0.015 is aggressive)
    (scenes/hexagon-scene.ts:229).
- Material strategy: standardize “matte terrain, mid-gloss buildings, highest-contrast units.”
  - You already reuse/pool some materials (utils/material-pool.ts:1) and already do terrain vertex colors
    (managers/instanced-biome.tsx:76); extend this by clamping extreme roughness/metalness/emissive on import.
- Player/faction identity: you have a strong palette system for units (systems/player-colors.ts:1); reuse it for
  structure selection/pulses (currently hue is derived from structure id) (scenes/worldmap.tsx:1633).

4. Terrain & Chunk Visual Enhancements

- Keep the current per-hex color jitter (it’s a great low-cost win): you already do ±3% sat/light variance per tile
  (scenes/worldmap.tsx:2990, managers/instanced-biome.tsx:76).
- Consider re-enabling selective 60° rotation for symmetric biomes: you already compute a rotation seed but don’t apply
  it (scenes/worldmap.tsx:3088). Only enable for biomes whose meshes won’t create directional seams.
- Shadow policy on terrain details: terrain base not casting is good; consider also disabling castShadow on small biome
  detail meshes to reduce noise in Medium view (managers/instanced-biome.tsx:83).
- Texture clarity at tilt: add moderate anisotropy (e.g., 4–8) to the big ground/terrain textures for sharper far
  readability (ground texture setup is here: scenes/hexagon-scene.ts:647).

5. Polish & Presentation Ideas

- Selection/importance readability: expand your existing ring/pulse/hover language (you already have rim/ hover +
  pulses) to units/structures consistently (managers/hover-hex-manager.ts:1, managers/selection- pulse-manager.ts:1).
- Distance-aware emphasis: increase outline/ring contrast slightly in Far view and reduce in Close (you already scale
  outline opacity with distance) (scenes/hexagon-scene.ts:700).
- “Alive” without cost: tiny idle motion is already supported via throttled morph animation updates; focus it on
  gameplay-important actors, not the whole terrain (managers/instanced-biome.tsx:115, utils/quality- controller.ts:46).
- Post stack restraint: keep FXAA + mild vignette/grade; be careful with bloom on large maps (it tends to blur UI and
  reduce tactical readability) (constants/rendering.ts:50, game-renderer.ts:891).

6. Performance-Aware Trade-offs

- Safest at scale: fog (linear), anisotropy (capped), material presets/pooling, Far-view shadow disable.
- Primary cost centers: shadows (shadow pass triangle count + map size) and bloom at high pixel ratios
  (utils/quality-controller.ts:46).
- Optional/experimental: screen-space outlines for everything, cascaded shadows (CSM), SSAO—only if you can gate by
  view/quality and measure.

Suggested “Visual Ruleset” (team-facing)

- Terrain muted + low contrast; gameplay objects get the saturation/contrast budget.
- One sun does the shaping; fill lights never exceed ~30–40% of sun.
- Shadows: units/structures only; Far view uses blobs, not shadow maps.
- Fog always on (Medium/Far), tuned for readability (not “mood haze”).
