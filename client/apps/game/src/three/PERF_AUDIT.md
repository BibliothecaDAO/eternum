# Three.js Performance Audit (Findings + Tasks)

Scope: `client/apps/game/src/three`

## Executive Summary

Top suspected bottlenecks (CPU vs GPU):

- CPU: Army icon updates trigger repeated frustum-bound recompute per point update.
- CPU/GC: Army morph animation path allocates per bucket and updates per instance.
- CPU/GPU: Structure + biome animation updates scale with visible instance counts.
- CPU/DOM: CSS2DRenderer renders twice per frame (world + HUD) and scales with label count.
- GPU: Shadow pass cost with 2048 maps and many instanced casters.

Most likely O(n) / O(n^2) offenders:

- O(n^2): `PointsLabelRenderer.refreshFrustumVisibility()` called per `setPoint()` in a loop.
- O(n): Morph animation updates in `ArmyModel`, `InstancedModel`, `InstancedBiome`.
- O(n): CSS2D label render and DOM mutation cost.

Expected impact at scale:

- 1k-2k moving armies: icon updates can add multi-ms spikes (O(n^2)).
- 3k-5k animated instances: morph texture uploads can dominate frame time.
- Mid-tier GPUs: shadows and postprocessing can push GPU frame time over budget.

## Hot Paths Observed

Per-frame loops:

- `three/game-renderer.ts:847` - `GameRenderer.animate()` (render + HUD + CSS2D).
- `three/scenes/worldmap.tsx:3672` - `WorldmapScene.update()`.
- `three/scenes/hexagon-scene.ts:903` - `HexagonScene.update()`.
- `three/managers/army-manager.ts:1741` - `ArmyManager.update()`.
- `three/managers/instanced-model.tsx:398` - `InstancedModel.updateAnimations()`.
- `three/managers/instanced-biome.tsx:386` - `InstancedBiome.updateAnimations()`.

Frequent events:

- `three/scenes/hexagon-scene.ts:272` - mousemove handler (throttled) -> hover/pick.
- `three/game-renderer.ts:206` - controls "change" triggers chunk refresh debounce.

## Findings (Detailed)

1. O(n^2) icon updates from repeated frustum recompute

- Location: `three/managers/army-manager.ts:1741`, `three/managers/points-label-renderer.ts:104`,
  `three/managers/points-label-renderer.ts:143`
- Category: Complexity / CPU / GC
- Complexity: O(k\*n) per frame, where k = moving armies calling `setPoint()`, n = total points.
- Why it hurts: `setPoint()` sets `boundsDirty` and calls `refreshFrustumVisibility()` which recomputes bounding sphere
  each call. With many moving armies, this becomes effectively O(n^2).
- Fix: wrap per-frame icon updates in `beginBatch()/endBatch()` and call `refreshFrustumVisibility()` once; or add an
  update queue to run a single visibility refresh after the loop.
- Risk: missed `endBatch()` can leave icons stale or invisible.

2. Army morph animation path allocates per update and calls `setMorphAt` per instance

- Location: `three/managers/army-model.ts:821`
- Category: CPU / GC / GPU
- Complexity: O(n\*m) per update where n = visible army instances, m = animated meshes.
- Why it hurts: allocates `idleWeights`/`movingWeights` arrays per update and uses `setMorphAt()` per instance, which is
  expensive and causes morph texture uploads (`needsUpdate`) on every update.
- Fix: migrate to typed-array bucket updates like `InstancedModel.updateAnimations()` and write morph texture data
  directly; preallocate buffers; update only a subset of buckets per frame; skip idle animations for distant armies.
- Risk: animation timing changes or subtle visual differences if bucket updates are too sparse.

3. Structure + biome animation updates scale linearly with instance counts

- Location: `three/scenes/hexagon-scene.ts:903`, `three/managers/structure-manager.ts:1584`,
  `three/managers/instanced-model.tsx:398`, `three/managers/instanced-biome.tsx:386`
- Category: CPU / GPU
- Complexity: O(n) per update for n = total animated instances.
- Why it hurts: morph texture updates plus per-instance loops are a steady cost that grows with visible chunk density.
- Fix: maintain an "active animated models" list (only meshes with count > 0 and visible); apply stronger animation LOD
  with distance/visibility gating; increase bucket stride for high instance counts.
- Risk: LOD changes can cause animation popping.

4. CSS2DRenderer runs twice per frame and scales with label count

- Location: `three/game-renderer.ts:885`, `three/game-renderer.ts:903`
- Category: CPU / DOM
- Complexity: O(l) per frame, l = number of labels; plus DOM layout work.
- Why it hurts: CSS2DRenderer triggers DOM updates; rendering both world and HUD labels each frame can saturate the main
  thread when many labels exist.
- Fix: render CSS2D only when the camera moved or label data changed; decimate updates when zoomed out; cap label count
  or switch to sprite-based labels for dense scenes.
- Risk: label lag or occasional stale positions if update gating is too aggressive.

5. Multiple requestAnimationFrame loops for FX/hover/selection

- Location: `three/managers/resource-fx-manager.ts:117`, `three/managers/selection-pulse-manager.ts:47`,
  `three/managers/hover-hex-manager.ts:66`
- Category: Architecture / CPU
- Complexity: O(k) independent rAF loops, k = active FX instances.
- Why it hurts: competing rAF loops cause uneven frame pacing and scale poorly during combat spikes.
- Fix: consolidate into the main update loop (e.g., `GameRenderer.animate()`), update active FX with deltaTime, and keep
  rAF in one place.
- Risk: requires careful lifecycle cleanup to avoid orphaned updates.

6. Interactive hex rendering does string parsing and allocates vectors on refresh

- Location: `three/managers/interactive-hex-manager.ts:367`
- Category: CPU / GC
- Complexity: O(v) per chunk refresh, v = visible hexes.
- Why it hurts: `split(",")` + `Number()` per hex and `getWorldPositionForHex()` allocations create chunk-switch spikes.
- Fix: keep visible hex coords in typed arrays and use `getWorldPositionForHexCoordsInto()`; avoid `position.clone()` on
  hover by returning a shared vector or copying into a caller-supplied target.
- Risk: shared vector use requires discipline to avoid mutation bugs.

7. Shadow pass cost scales with casters and high shadow map size

- Location: `three/scenes/hexagon-scene.ts:233`, `three/managers/instanced-model.tsx:140`
- Category: GPU
- Complexity: O(c \* shadowMapArea), c = shadow casting instances.
- Why it hurts: 2048 shadow maps with many instanced casters can dominate GPU time, especially on mobile.
- Fix: distance-based shadow culling; reduce shadow map size dynamically; disable castShadow on small details; bake
  lighting for static assets.
- Risk: reduced shadow fidelity and possible quality tier mismatch.

## Tasks

Quick Wins (1-2 hours)

- Batch army point icon updates: wrap `setPoint()` calls with `beginBatch()/endBatch()` for each renderer, or add a
  single `refreshFrustumVisibility()` at the end of the update loop.
- Swap hover return to a shared vector to avoid per-mousemove `clone()` allocations; update call sites accordingly.
- Use `getWorldPositionForHexCoordsInto()` in `InteractiveHexManager.renderHexes()` and cache numeric coords to remove
  string parsing.

Medium (1-2 days)

- Convert `ArmyModel.updateAnimations()` to typed-array bucket writes similar to `InstancedModel.updateAnimations()` and
  reuse buffers.
- Add distance-based animation LOD for armies, structures, and biomes; increase update interval and bucket stride at
  high counts.
- Gate CSS2DRenderer updates on camera/label dirty flags; decimate label update rate when zoomed out.

Larger Refactors (multi-day)

- Move all FX/hover/selection animations into the main render loop with centralized scheduling.
- Shadow LOD/baking pipeline: static shadows for terrain/structures, dynamic shadows only for nearby units.
- GPU-driven animation path (shader time + atlas) for armies/structures to avoid per-instance CPU updates.

## Profiling Plan

Chrome DevTools Performance

- Record 10-15s during: camera pan, zoom in/out, and large battle.
- Inspect time in: `PointsLabelRenderer.refreshFrustumVisibility`, `ArmyModel.updateModelAnimations`,
  `InstancedModel.updateAnimations`, `CSS2DRenderer.render`, and GC.
- Success: scripting time stable, no long GC events during pan.

Three.js renderer.info

- Log `renderer.info.render.calls/triangles/textures` once per second.
- Correlate spikes with chunk changes and combat events.
- Success: draw calls stable; no large spikes during idle.

GPU timing

- Use `EXT_disjoint_timer_query_webgl2` or existing perf helpers to measure:
  - `composer.render()` time
  - shadow pass time
  - HUD render time
- Success: GPU time stays within budget at target quality tier.

Spector.js

- Capture a frame during a heavy scene; check:
  - shadow map cost
  - morph texture uploads
  - material/program switches
- Success: reduced shadow map cost and fewer large uniform/texture uploads.

## Assumptions

- "n" is the number of visible instances (armies + structures + biomes).
- Label counts can be in the hundreds or higher during peak activity.
- Mobile hardware targets are mid-tier GPUs where shadows and CSS2D are especially costly.
