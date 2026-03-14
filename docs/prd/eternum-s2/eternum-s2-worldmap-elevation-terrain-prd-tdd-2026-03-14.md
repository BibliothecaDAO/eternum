# Eternum S2 Worldmap Elevation Terrain PRD

Date: 2026-03-14
Status: Proposed
Scope: `packages/core/src/utils/biome`, `client/apps/game/src/three` worldmap terrain rendering, world-position anchoring, army traversal visuals, structure grounding, interaction overlays, selected tests

## Implementation Tracking

- [ ] Phase 0: Baseline Invariants and Harness Lock
- [ ] Phase 1: Deterministic Elevation API
- [ ] Phase 2: Shared Terrain Resolver and Anchor Model
- [ ] Phase 3: Elevated Terrain Foundation Layer
- [ ] Phase 4: Worldmap Grid Unification and Cache Safety
- [ ] Phase 5: Discovery Reveal Animation
- [ ] Phase 6: Army, Structure, and Overlay Grounding
- [ ] Phase 7: Movement Traversal, Bounds, and Polish

## 1. Objective

Lift the worldmap from a flat hex plane into a deterministic height field driven by the existing biome noise pipeline, while
keeping current gameplay rules intact.

Each explored hex should have:

- a deterministic surface height derived from the same noise input used for biome generation,
- a full visual body so raised tiles do not appear to float,
- units, structures, hover states, and selection FX anchored to the terrain surface,
- army movement paths that visibly climb and descend with terrain,
- a discovery reveal that grows newly explored terrain up from the undiscovered base layer.

## 2. Problem Statement

The current worldmap is visually flat even though the biome pipeline already computes elevation internally.

Today:

1. `Biome` calculates elevation and moisture to choose biome type.
2. The worldmap stores only `BiomeType`.
3. Terrain placement hardcodes near-zero `y`.
4. Bulk chunk terrain rebuilds and incremental explored-tile insertion use different transform paths.
5. Armies and structures are positioned with flat world-position helpers.
6. Hover, selection, highlight, and path visuals assume a flat plane.
7. Newly explored tiles appear immediately instead of revealing through a terrain-growth transition.

The result is a mismatch between the available terrain signal and the rendered world. Adding height by patching one call
site will not be sufficient because terrain, entities, and interaction layers already have separate placement code.

## 3. Confirmed Current-State Findings

### 3.1 Elevation already exists in core logic but is discarded by the renderer

`packages/core/src/utils/biome/biome.ts` calculates elevation via the simplex-noise pipeline before resolving
`BiomeType`, but only biome type is publicly consumed today.

Implication:

- the correct source of terrain height is not a new random function,
- the correct source is the existing elevation sample already used to classify the biome.

### 3.2 The worldmap owns terrain state and currently stores biome only

`WorldmapScene` keeps explored terrain in `exploredTiles: Map<number, Map<number, BiomeType>>` and rebuilds the visible
terrain in `updateHexagonGrid()`.

Implication:

- the feature should stay scene-owned at the runtime/orchestration level,
- but the actual height transform logic should move into a shared resolver so bulk and incremental paths cannot drift.

### 3.3 Terrain rendering is split across two code paths

Terrain transforms currently come from:

- bulk chunk rebuild in `client/apps/game/src/three/scenes/worldmap.tsx` via `updateHexagonGrid()`,
- incremental insertion in the same file via `updateExploredHex()`.

Implication:

- one shared terrain-instance policy is required,
- otherwise newly explored tiles and chunk-rebuilt tiles will land at different heights.

### 3.4 Units already support 3D interpolation once path endpoints have `y`

`ArmyManager` converts hex paths into world `Vector3[]`, and `ArmyModel` lerps between those vectors during movement.
That means the movement stack already supports up/down traversal visually.

Implication:

- the main movement change is to make world-path positions terrain-aware,
- not to rewrite the army animation engine.

### 3.5 Terrain hiding under structures is incompatible with raised tiles

The worldmap currently hides biome tiles under structures. That works for a flat board, but it creates a failure mode for
raised terrain: a structure would lose its ground body unless terrain is split into a persistent foundation layer and an
optional decorative top layer.

Implication:

- the feature must separate "terrain body" from "biome decoration",
- hiding the decorative cap under structures is fine,
- removing the actual terrain foundation is not.

### 3.6 Many world-space consumers currently assume `y ~= 0`

Flat assumptions exist in:

- army anchoring,
- structure anchoring,
- interactive/hover/select/highlight overlays,
- some label and point-icon placements,
- chunk bounds and cache heuristics,
- some world-space FX.

Implication:

- height must be introduced through one shared terrain anchor API,
- not copied as manual `position.y += ...` offsets in each manager.

## 4. Goals

1. Use the existing biome noise pipeline mirrored in `@bibliothecadao/eternum` as the single renderer-side source for per-hex elevation.
2. Render explored worldmap hexes at deterministic heights with visible terrain sides so they read as solid terrain.
3. Keep army movement rules, pathfinding, stamina cost, and occupancy rules unchanged.
4. Make armies, structures, hover, selection, and movement-path visuals follow terrain height.
5. Preserve worldmap chunking, cache reuse, and renderer portability.
6. Keep a flat fallback path for explicit compatibility mode.

## 5. Non-Goals

- Changing gameplay movement cost based on elevation.
- Changing worker pathfinding or exploration strategy semantics.
- Changing Cairo tile storage in the first visual rollout.
- Reworking fast-travel terrain in this PRD.
- Reworking `HexceptionScene` beyond keeping its existing terrain behavior intact.
- Updating the mobile client in the same delivery.
- Introducing custom shader dependencies as the primary solution.
- Replacing biome GLB assets in this phase unless an art pass is later requested.

## 6. Design Principles

### 6.1 One terrain signal

Biome classification and render elevation must come from the same deterministic sample.

### 6.2 One placement contract

Terrain, units, structures, hover, selection, and paths must ask one shared resolver where the terrain surface is.

### 6.3 Terrain body and terrain decoration are separate concerns

The world needs a structural terrain body even when the biome top is hidden or simplified.

### 6.4 Renderer-first, gameplay-safe

The first delivery is visual grounding and traversal. Gameplay rules stay exactly as they are.

### 6.5 Test the pure seams, not only the giant scene

Extract pure policy functions for elevation mapping, terrain transforms, and anchor offsets so the critical logic can be
locked with fast unit tests before touching `worldmap.tsx`.

## 7. Proposed Design

### 7.1 Expose normalized elevation from `Biome`

Add a public core API that returns normalized elevation from the same sample already used by `getBiome()`.

Recommended public contract:

```ts
Biome.getElevation(col: number, row: number): number
```

Properties:

- deterministic for any `(col,row)`,
- returns normalized scalar in a stable range, preferably `0..1`,
- does not expose fixed-point internals to the renderer,
- keeps biome classification thresholds unchanged.

This keeps biome rules in core and lets the renderer own visual exaggeration.

### 7.1.1 Authority decision

- use the existing TypeScript biome mirror,
- expose normalized elevation from `@bibliothecadao/eternum`,
- derive renderer height deterministically from `(col,row)` on the client,
- do not widen `Tile`, `TileOpt`, Torii payloads, or Cairo storage.

This PRD is intentionally TS-only.

Why:

- the user request is primarily visual worldmap elevation and terrain-following traversal,
- it avoids a contract/model/indexer migration before the rendering contract is proven,
- it keeps current gameplay rules unchanged,
- it is enough for all renderer, overlay, and army movement work in this PRD.

### 7.2 Add a renderer-owned terrain resolver

Add a shared terrain resolver in the game client that maps:

- hex coordinates,
- normalized elevation,
- biome,
- renderer mode / flat fallback,

into:

- `surfaceY`,
- `foundationHeight`,
- anchor offsets for terrain cap, hover, selection, path, label, and structure placement.

Recommended responsibilities:

- memoize terrain samples by hex key,
- clamp/configure sea level and maximum terrain exaggeration,
- return terrain-aware world positions without mutating chunk/grid math,
- preserve existing flat behavior when `IS_FLAT_MODE` or a new explicit terrain-height flag disables elevation.

Height profile decisions:

- terrain exaggeration should stay subtle,
- ocean and deep-ocean tiles should clamp to the lowest level,
- land height mapping should start conservative and prioritize readability over spectacle.

Important design choice:

- keep `exploredTiles` as biome-only data for gameplay/worker code,
- store terrain height in a renderer-only cache or compute it through the resolver,
- do not widen worker-facing map snapshots unless later gameplay work needs that.

### 7.3 Split terrain into two layers

#### Layer A: Terrain foundation

A new instanced mesh renders the solid body of each explored hex.

Recommended implementation:

- procedural hex skirt / column geometry,
- open top face or slightly recessed top to avoid z-fighting with biome caps,
- stock `MeshStandardMaterial`,
- per-instance color derived from the biome base color but slightly darker,
- one mesh or one small set of meshes, not a mesh per tile.

This layer remains present even if a structure occupies the tile.

#### Layer B: Decorative biome cap

The existing `InstancedBiome` GLB layer remains the visual top surface/details for the tile.

Rules:

- keep current biome variant selection,
- place the cap at `surfaceY + capOffset`,
- allow decorative hiding under structures if needed,
- do not let decorative hiding remove the terrain body.

#### Layer C: Undiscovered outline plane

Undiscovered hexes should stay visually flat and should not reveal real terrain height.

Rules:

- keep the existing `Outline`/undiscovered representation on a shared discovery plane near the map base,
- use a tiny constant height like `0.02` only to avoid z-fighting,
- do not sample noise-derived height for undiscovered tiles,
- indicate undiscovered state through material treatment, opacity, fog, and frontier emphasis rather than true height,
- add a soft wall treatment where raised discovered terrain meets the undiscovered plane.

Why:

- undiscovered tiles should communicate lack of knowledge, not hidden topography,
- true-height undiscovered tiles would leak terrain information before exploration,
- the flat outline layer gives the discovered frontier a clear visual contrast.

### 7.4 Create one shared terrain-instance policy

Extract a pure policy that takes:

- `col`, `row`,
- `biome`,
- `hasStructure`,
- terrain sample,
- flat-mode flag,

and returns:

- foundation transform,
- whether decorative cap should render,
- decorative transform,
- expected cache participation.

Both:

- `updateHexagonGrid()`,
- `updateExploredHex()`,

must use this exact policy.

That closes the current drift between bulk and incremental terrain insertion.

### 7.4.1 Add a discovery reveal animation contract

A newly discovered tile should not pop directly to its final height.

Recommended reveal:

1. undiscovered outline remains on the flat discovery plane,
2. when a newly discovered tile first becomes visible, the terrain foundation spawns from that same plane,
3. the foundation grows upward to the resolved target height,
4. the decorative biome cap fades/lifts in near the end of the animation after the foundation is mostly established,
5. once complete, the outline is fully retired for that tile.

Recommended constraints:

- the reveal is tied to true new discoveries, but it may be deferred until the tile first becomes visible,
- bulk chunk rebuilds must not replay the reveal once a tile has already been shown,
- if a discovered tile is hidden by a structure, the foundation still animates but the decorative cap may stay hidden,
- animation duration should stay short, roughly `150-250ms`, so exploration feels responsive.

### 7.5 Make world anchors terrain-aware

All world-space consumers that should sit on terrain need one shared terrain anchor model.

Required consumers in this PRD:

- armies,
- structures,
- interactive hex surface,
- hover hex,
- highlight hex,
- selection pulse,
- selected-hex particle marker,
- camera target when jumping to a tile on the worldmap.

Recommended anchor types:

- `surface`
- `path`
- `structure`
- `hover`
- `highlight`
- `selection`
- `label`

Each anchor type should be a small offset from the same `surfaceY`.

### 7.6 Make armies traverse terrain by changing path endpoints, not animation math

`ArmyModel` already interpolates between world positions. Once `ArmyManager` produces terrain-aware world points:

- the army model will visually climb and descend,
- path lines can use the same elevated points,
- contact shadows and hover icons will follow the animated position.

Required policy:

- path points should use a small path lift above terrain to avoid z-fighting,
- moving units should pitch to the slope while traversing terrain instead of staying perfectly upright,
- floating/bob motion remains additive on top of terrain height.

### 7.7 Update chunk bounds and cache logic for vertical space

Worldmap chunk bounds are currently fixed to a shallow `y` range. Elevated terrain introduces a larger vertical envelope.

Required changes:

- chunk bounds must include `maxTerrainHeight + overlay/headroom`,
- cache snapshots must include the foundation layer,
- cache-safety expectations must account for "terrain foundation always present even under structures",
- chunk restore must restore both foundation and decorative terrain state.

### 7.8 Preserve a flat fallback

Keep a compatibility path so the map can still render flat when explicitly requested.

Recommended behavior:

- default non-flat worldmap in normal mode after this work lands,
- `FLAT_MODE=true` keeps `surfaceY=0` and disables foundation height,
- tests lock both modes to prevent regressions.

## 8. Acceptance Criteria

1. Explored worldmap tiles render at deterministic heights derived from the biome noise pipeline.
2. Raised tiles do not appear to float; they have visible terrain sides/foundations.
3. Undiscovered hexes remain on a flat discovery plane and do not leak true terrain height.
4. The discovered/undiscovered frontier uses a soft wall treatment instead of a hard visual cutoff.
5. Newly explored tiles grow from the undiscovered base plane into their resolved terrain height.
6. When discovery happens offscreen, the reveal animation still plays the first time the tile becomes visible.
7. The reveal follows style `C`: foundation grows first, cap fades/lifts in near the end.
8. Ocean and deep-ocean tiles stay at the lowest level.
9. Terrain height remains subtle rather than exaggerated.
10. Structures remain grounded on their tiles after the terrain cap is hidden or changed.
11. Armies visibly climb, descend, and pitch to slope while moving across differently elevated hexes.
12. Hover, highlight, and selection visuals remain attached to the terrain surface at all heights.
13. Bulk chunk rebuild and incremental `updateExploredHex()` generate identical terrain transforms for the same tile.
14. Chunk cache restore restores both terrain layers without holes or zero-height regressions.
15. Flat fallback mode still works.
16. The feature lands without changing pathfinding semantics or stamina rules.
17. The implementation remains stock-material and WebGPU-safe at the material level.

## 9. TDD Rules

TDD first for every slice:

1. Write the failing test for the next behavior slice.
2. Run it and verify it fails for the expected reason.
3. Write the minimum production code to pass.
4. Re-run the targeted tests.
5. Refactor only after green.

No implementation should begin in `worldmap.tsx` until the pure terrain policy and elevation resolver tests are red.

## 10. TDD Delivery Plan

### Phase 0: Baseline Invariants and Harness Lock

Scope:

- lock current assumptions before changing placement semantics.

Tests first:

- add failing core tests for public elevation access,
- add failing renderer tests for terrain resolver output,
- add failing worldmap policy tests asserting parity between bulk and incremental terrain placement,
- add failing anchor tests for army and structure placement on non-zero surface heights.

Files:

- add `packages/core/src/utils/biome/biome.elevation.test.ts`
- add `client/apps/game/src/three/utils/world-terrain.test.ts`
- add `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.test.ts`
- add `client/apps/game/src/three/managers/worldmap-terrain-foundation.test.ts`

Acceptance:

- there is a red test seam for every later implementation phase.

### Phase 1: Deterministic Elevation API

Scope:

- expose normalized elevation from `Biome` without changing biome thresholds or behavior.

Tests first:

- `Biome.getElevation()` returns deterministic output for repeated calls,
- neighboring coordinates produce stable but non-uniform values,
- the returned elevation remains consistent with current biome classification thresholds.

Implementation:

- add public `getElevation()` in `packages/core/src/utils/biome/biome.ts`,
- optionally add an internal shared terrain-sample helper used by both `getBiome()` and `getElevation()`.

Files:

- modify `packages/core/src/utils/biome/biome.ts`
- add `packages/core/src/utils/biome/biome.elevation.test.ts`

Acceptance:

- the renderer can request normalized elevation without duplicating the biome algorithm.

### Phase 2: Shared Terrain Resolver and Anchor Model

Scope:

- create one renderer-owned terrain resolver that turns `(col,row,biome)` into `surfaceY` and named anchor positions.

Tests first:

- flat mode returns zero terrain height,
- non-flat mode maps elevation to deterministic `surfaceY`,
- water/low-elevation tiles clamp to the lowest level,
- terrain mapping stays within a subtle height range,
- named anchors all derive from the same base `surfaceY`,
- repeated lookups reuse cached results.

Implementation:

- add terrain config constants,
- add a terrain resolver/cache,
- add terrain-aware world-position helpers or helper functions that new call sites can opt into.

Files:

- add `client/apps/game/src/three/utils/world-terrain.ts`
- add `client/apps/game/src/three/utils/world-terrain.test.ts`
- modify `client/apps/game/src/three/utils/utils.ts`
- update or extend `client/apps/game/src/three/utils/utils.world-hex-conversion.test.ts`

Acceptance:

- one API exists for "where is the terrain surface for this hex?".

### Phase 3: Elevated Terrain Foundation Layer

Scope:

- render a solid terrain body under explored tiles.

Tests first:

- foundation geometry produces a full hex body with side walls,
- per-instance transforms scale to the expected foundation height,
- foundation color derivation is deterministic from biome color,
- terrain foundation remains renderable for a tile with a structure on it.

Implementation:

- add skirt/column geometry,
- add a foundation manager or equivalent scene-owned helper for instanced terrain bodies,
- keep decorative biome caps separate from foundations.

Files:

- add `client/apps/game/src/three/geometry/hex-skirt-geometry.ts`
- add `client/apps/game/src/three/geometry/hex-skirt-geometry.test.ts`
- add `client/apps/game/src/three/managers/worldmap-terrain-foundation.ts`
- add `client/apps/game/src/three/managers/worldmap-terrain-foundation.test.ts`
- optionally modify `client/apps/game/src/three/managers/instanced-biome.tsx` only if minor support hooks are required

Acceptance:

- raised tiles no longer look like floating tops.

### Phase 4: Worldmap Grid Unification and Cache Safety

Scope:

- make the worldmap use the new terrain resolver and foundation layer in both bulk and incremental paths.

Tests first:

- bulk terrain generation and incremental explored-tile insertion produce identical transforms,
- structure occupancy hides only decorative terrain, not foundation terrain,
- undiscovered tiles resolve to the flat discovery plane instead of sampled terrain height,
- discovered-to-undiscovered boundaries receive the soft wall treatment,
- cache snapshot/restore includes both terrain layers,
- duplicate-tile reconcile still invalidates and refreshes correctly with elevation present.

Implementation:

- extract a pure terrain-instance policy,
- update `updateHexagonGrid()` to build foundations and decorative caps from one policy,
- update `updateExploredHex()` to use the same policy,
- update terrain cache metadata and expected-instance calculations.

Files:

- add `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.ts`
- add `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.test.ts`
- modify `client/apps/game/src/three/scenes/worldmap.tsx`
- modify `client/apps/game/src/three/scenes/worldmap-explored-hex-transform-policy.ts`
- modify `client/apps/game/src/three/scenes/worldmap-explored-hex-transform-policy.test.ts`
- modify `client/apps/game/src/three/scenes/worldmap-cache-safety.ts`
- modify `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
- modify `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

Acceptance:

- the scene has one terrain placement contract and one cache contract.

### Phase 5: Discovery Reveal Animation

Scope:

- animate newly discovered terrain up from the undiscovered base plane.

Tests first:

- a true first-discovery event starts the tile on the discovery plane,
- the reveal target height matches the terrain resolver output,
- a newly discovered offscreen tile still reveals the first time it becomes visible,
- the reveal completes deterministically and leaves the tile in steady-state terrain form,
- chunk rebuilds do not replay the reveal for tiles that were already revealed onscreen,
- the foundation grows first and the biome cap appears near the end of the reveal,
- structure-covered tiles still animate their foundation even if the cap remains hidden.

Implementation:

- add a small reveal-state policy or runtime queue for newly discovered tiles,
- drive animation from `updateExploredHex()` only for first discovery,
- ensure the bulk chunk rebuild path skips reveal and renders final state directly.

Files:

- add `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.ts`
- add `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.test.ts`
- modify `client/apps/game/src/three/scenes/worldmap.tsx`
- modify `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

Acceptance:

- discovery feels intentional and new terrain rises out of the unexplored layer instead of popping in.

### Phase 6: Army, Structure, and Overlay Grounding

Scope:

- terrain-aware anchoring for all must-have worldmap actors and interaction overlays.

Tests first:

- army world positions resolve to terrain surface,
- structure world positions resolve to terrain surface,
- hover/highlight/selection positions use named anchor offsets from the same terrain sample,
- camera jump-to-tile targets terrain surface rather than `y=0`,
- structure bases remain flush with the tile surface without cap protrusion around the footprint.

Implementation:

- update army anchoring in `ArmyManager`,
- update structure anchoring in `StructureManager`,
- update hover/highlight/selection managers to accept terrain-aware positions,
- update worldmap camera target helpers where needed.

Files:

- modify `client/apps/game/src/three/managers/army-manager.ts`
- modify `client/apps/game/src/three/managers/structure-manager.ts`
- modify `client/apps/game/src/three/managers/interactive-hex-manager.ts`
- modify `client/apps/game/src/three/managers/hover-hex-manager.ts`
- modify `client/apps/game/src/three/managers/highlight-hex-manager.ts`
- modify `client/apps/game/src/three/managers/selection-pulse-manager.ts`
- modify `client/apps/game/src/three/managers/selected-hex-manager.ts`
- modify `client/apps/game/src/three/scenes/hexagon-scene.ts`
- update `client/apps/game/src/three/managers/interactive-hex-manager.resolve.test.ts`
- update `client/apps/game/src/three/managers/structure-manager.lifecycle.test.ts`
- add `client/apps/game/src/three/managers/world-terrain-anchor-policy.test.ts` if a pure anchor policy is extracted

Acceptance:

- map-space interaction visuals remain grounded at any terrain height.

### Phase 7: Movement Traversal, Bounds, and Polish

Scope:

- finish terrain-aware traversal visuals and supporting runtime safety.

Tests first:

- moving armies receive elevated world paths,
- moving armies pitch to the slope while traversing those paths,
- path renderer bounds remain valid for sloped paths,
- chunk bounds include new terrain vertical range,
- flat fallback still produces flat paths and flat anchors.

Implementation:

- make `ArmyManager.moveArmy()` build terrain-aware `worldPath`,
- update `ArmyModel` orientation so moving units pitch to the terrain slope while traversing,
- keep path lines slightly above the surface,
- verify `ArmyModel` movement uses those vectors without extra changes,
- update chunk bounds and any vertical culling assumptions.

Files:

- modify `client/apps/game/src/three/managers/army-manager.ts`
- modify `client/apps/game/src/three/managers/army-model.ts`
- modify `client/apps/game/src/three/managers/path-renderer.ts` only if path lift or bounds policy is centralized there
- modify `client/apps/game/src/three/scenes/worldmap.tsx`
- modify `client/apps/game/src/three/scenes/worldmap-chunk-bounds.test.ts`
- add `client/apps/game/src/three/managers/army-manager.terrain-path-wiring.test.ts`
- add `client/apps/game/src/three/managers/army-model.slope-orientation.test.ts`
- add `client/apps/game/src/three/managers/path-renderer.terrain-bounds.test.ts` if needed

Acceptance:

- armies visibly traverse elevation changes and the runtime still culls/caches correctly.

## 11. Detailed Task List

### ELEV-001 Core elevation exposure

- Add public normalized elevation API to `Biome`.
- Keep biome thresholds and classification output unchanged.
- Do not leak fixed-point internals to the client.

Files:

- `packages/core/src/utils/biome/biome.ts`
- `packages/core/src/utils/biome/biome.elevation.test.ts`

### ELEV-002 Terrain resolver and config

- Add renderer-level height/exaggeration config.
- Add cached terrain sample lookup by hex key.
- Add named anchor offsets for surface consumers.
- Keep the initial height profile subtle.
- Clamp ocean and deep-ocean to the lowest level.

Files:

- `client/apps/game/src/three/utils/world-terrain.ts`
- `client/apps/game/src/three/utils/world-terrain.test.ts`
- `client/apps/game/src/three/utils/utils.ts`
- `client/apps/game/src/three/utils/utils.world-hex-conversion.test.ts`

### ELEV-003 Foundation geometry

- Add procedural hex skirt/column geometry.
- Use stock materials and instance colors only.
- Keep top recessed or open to avoid z-fighting with biome caps.

Files:

- `client/apps/game/src/three/geometry/hex-skirt-geometry.ts`
- `client/apps/game/src/three/geometry/hex-skirt-geometry.test.ts`

### ELEV-004 Foundation rendering manager

- Add one instanced manager for terrain foundations.
- Support snapshot/restore or scene-owned rebuild for chunk cache parity.
- Keep foundations present even when structures occupy the hex.

Files:

- `client/apps/game/src/three/managers/worldmap-terrain-foundation.ts`
- `client/apps/game/src/three/managers/worldmap-terrain-foundation.test.ts`

### ELEV-005 Unified terrain instance policy

- Extract pure transform policy for terrain body + decorative cap.
- Consume it from both worldmap bulk and incremental paths.

Files:

- `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.ts`
- `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.test.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`

### ELEV-006 Decorative terrain and cache migration

- Update `updateHexagonGrid()` and `updateExploredHex()` to use the new terrain policy.
- Extend cache metadata to include foundation participation.
- Update cache-safety rules for new expected-instance counts.
- Keep undiscovered `Outline` tiles on the flat discovery plane.
- Add a soft wall treatment on the discovered/undiscovered frontier.

Files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-cache-safety.ts`
- `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
- `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

### ELEV-007 Discovery reveal animation

- Animate newly discovered tiles from the flat discovery plane to their resolved terrain height.
- If discovery happened offscreen, play the reveal the first time the tile becomes visible.
- Never replay this animation once the tile has already been shown.
- Use reveal style `C`: foundation first, cap fade/lift near the end.

Files:

- `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.ts`
- `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.test.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

### ELEV-008 Army grounding and traversal

- Resolve army world positions through the terrain resolver.
- Use terrain-aware world paths for movement.
- Pitch moving units to the slope while they traverse terrain.
- Keep bob/floating animation additive over terrain.

Files:

- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/army-model.ts`
- `client/apps/game/src/three/managers/army-manager.terrain-path-wiring.test.ts`
- `client/apps/game/src/three/managers/army-model.slope-orientation.test.ts`

### ELEV-009 Structure grounding

- Resolve structure world positions and labels through terrain surface anchors.
- Ensure structures on elevated tiles do not appear to float.
- Keep the visible structure base flush with the tile surface.

Files:

- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.lifecycle.test.ts`

### ELEV-010 Interaction and overlay grounding

- Move interactive hover/select/highlight systems onto named terrain anchors.
- Keep raycast selection stable by resolving hex from x/z while rendering overlays at terrain `y`.

Files:

- `client/apps/game/src/three/managers/interactive-hex-manager.ts`
- `client/apps/game/src/three/managers/hover-hex-manager.ts`
- `client/apps/game/src/three/managers/highlight-hex-manager.ts`
- `client/apps/game/src/three/managers/selection-pulse-manager.ts`
- `client/apps/game/src/three/managers/selected-hex-manager.ts`
- `client/apps/game/src/three/managers/interactive-hex-manager.resolve.test.ts`

### ELEV-011 Bounds and camera alignment

- Raise chunk bounds to include elevated terrain and grounded actors.
- Move camera target helpers onto terrain surface for tile jumps.

Files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-bounds.test.ts`

### ELEV-012 Secondary world-space FX audit

- Audit remaining world-space systems that still use flat hex positions.
- Promote only the required consumers into this PRD or explicitly defer them.

Likely follow-up candidates:

- `client/apps/game/src/three/managers/chest-manager.ts`
- `client/apps/game/src/three/managers/resource-fx-manager.ts`
- `client/apps/game/src/three/managers/thunderbolt-manager.ts`
- `client/apps/game/src/three/managers/navigator.ts`

## 12. File Change Summary

### Core / Shared

- Modify `packages/core/src/utils/biome/biome.ts`
- Add `packages/core/src/utils/biome/biome.elevation.test.ts`

### New Client Terrain Files

- Add `client/apps/game/src/three/utils/world-terrain.ts`
- Add `client/apps/game/src/three/utils/world-terrain.test.ts`
- Add `client/apps/game/src/three/geometry/hex-skirt-geometry.ts`
- Add `client/apps/game/src/three/geometry/hex-skirt-geometry.test.ts`
- Add `client/apps/game/src/three/managers/worldmap-terrain-foundation.ts`
- Add `client/apps/game/src/three/managers/worldmap-terrain-foundation.test.ts`
- Add `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.ts`
- Add `client/apps/game/src/three/scenes/worldmap-terrain-instance-policy.test.ts`
- Add `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.ts`
- Add `client/apps/game/src/three/scenes/worldmap-discovery-reveal-policy.test.ts`
- Add `client/apps/game/src/three/managers/army-manager.terrain-path-wiring.test.ts`
- Add `client/apps/game/src/three/managers/army-model.slope-orientation.test.ts`

### Existing Client Files To Modify

- Modify `client/apps/game/src/three/utils/utils.ts`
- Modify `client/apps/game/src/three/utils/utils.world-hex-conversion.test.ts`
- Modify `client/apps/game/src/three/scenes/worldmap.tsx`
- Modify `client/apps/game/src/three/scenes/worldmap-explored-hex-transform-policy.ts`
- Modify `client/apps/game/src/three/scenes/worldmap-explored-hex-transform-policy.test.ts`
- Modify `client/apps/game/src/three/scenes/worldmap-cache-safety.ts`
- Modify `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
- Modify `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
- Modify `client/apps/game/src/three/scenes/worldmap-chunk-bounds.test.ts`
- Modify `client/apps/game/src/three/scenes/hexagon-scene.ts`
- Modify `client/apps/game/src/three/managers/army-manager.ts`
- Modify `client/apps/game/src/three/managers/army-model.ts`
- Modify `client/apps/game/src/three/managers/structure-manager.ts`
- Modify `client/apps/game/src/three/managers/interactive-hex-manager.ts`
- Modify `client/apps/game/src/three/managers/interactive-hex-manager.resolve.test.ts`
- Modify `client/apps/game/src/three/managers/hover-hex-manager.ts`
- Modify `client/apps/game/src/three/managers/highlight-hex-manager.ts`
- Modify `client/apps/game/src/three/managers/selection-pulse-manager.ts`
- Modify `client/apps/game/src/three/managers/selected-hex-manager.ts`

## 13. QA and Verification Matrix

### Functional QA

1. Explore a new tile in the active chunk and verify the newly inserted tile height matches a full chunk rebuild.
2. Explore a tile on a chunk edge, force a chunk switch, and verify terrain restores at the same height.
3. Move an army across alternating high and low tiles and verify visible climb/descent.
4. Verify that moving armies pitch to the slope instead of staying fully upright.
5. Select a high-elevation tile and verify hover, highlight, selection pulse, and the frontier soft wall sit correctly.
6. Verify a structure on a high tile remains grounded, flush with the tile surface, and does not lose its terrain body.
7. Discover a tile offscreen, then pan until it becomes visible and verify the reveal still plays once.
8. Enable flat mode and verify the worldmap returns to current flat behavior.

### Performance / Safety QA

1. Verify no matrix-cache restore path produces missing terrain foundations.
2. Verify chunk frustum bounds do not cull elevated terrain too early.
3. Verify no uncontrolled instance-count growth after repeated chunk switches.
4. Verify low and high graphics modes still render the worldmap correctly.

## 14. Risks and Mitigations

### Risk: Bulk and incremental terrain drift

Mitigation:

- one shared terrain-instance policy,
- parity test before touching `worldmap.tsx`.

### Risk: Structures float because terrain is hidden underneath

Mitigation:

- foundation layer remains present even when decorative cap is hidden.

### Risk: Entity and overlay grounding splinters across managers

Mitigation:

- use one terrain anchor resolver,
- do not allow manager-local `y` constants to remain for grounded worldmap visuals.

### Risk: Cache restore brings back only decorative caps or only foundations

Mitigation:

- extend cache contract explicitly and lock it with restore tests.

### Risk: Height exaggeration looks noisy or unreadable

Mitigation:

- keep renderer-owned exaggeration config,
- clamp sea level and max elevation,
- verify readability at default worldmap camera distances before polishing.

## 15. Open Questions

1. Should the default rollout enable elevation globally, or only behind a temporary feature flag until art/perf signoff?
2. Should secondary world-space FX consumers be part of this PRD or land as a short follow-up once the main terrain and
   unit grounding work is stable?

## 16. Recommended Execution Order

1. Phase 0: lock pure test seams
2. Phase 1: expose core elevation
3. Phase 2: build terrain resolver and anchor API
4. Phase 3: add terrain foundation geometry/manager
5. Phase 4: switch worldmap bulk/incremental terrain to the shared policy
6. Phase 5: add the discovery reveal animation
7. Phase 6: ground armies, structures, and interaction overlays
8. Phase 7: finish traversal polish, bounds, and fallback verification

This order keeps the risky work in pure, testable seams first and delays `worldmap.tsx` orchestration edits until the
terrain contract is already defined and locked.
