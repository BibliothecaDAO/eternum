# Performance Hot-Path Bugfix PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: hover-hex material CPU texture, path renderer batch lifecycle, army manager allocations, hover-hex geometry lifecycle, thunderbolt opacity, FX texture color space, day-night sky color mutation

## 1. Summary

This document covers a set of concrete performance bugs and visual correctness issues in hot rendering paths. Each bug has been verified against the current source. The fixes are grouped into four independent stages ordered by impact.

The core findings are:

- the hover-hex material redraws a 128x128 CPU texture every time `setTime` is called, but `redrawHoverTexture` never reads the `time` uniform — every pixel computation is wasted
- path renderer rebuilds all batch geometry and materials on every display-state change with no dirty-flag or frame-deferred coalescing
- `getArmyWorldPosition` allocates a new `Vector3` on every call despite the class already owning reusable temp vectors
- `EdgesGeometry` wraps an inline `ShapeGeometry` that is never stored or disposed, leaking GPU memory
- thunderbolt layer opacity reads its own current value as input to the next-frame calculation, creating a compounding feedback loop
- FX texture properties (`colorSpace`, filters) are set in an async callback, so the first rendered frames use wrong defaults
- `applyWeatherModulation` mutates the scene background color in-place with `multiplyScalar`, causing exponential darkening if call order is violated

## 2. Problem Statement

### 2.1 CPU waste in hover-hex material texture redraw

`redrawHoverTexture` (hover-hex-material.ts:85-120) iterates all 16,384 pixels of a 128x128 `DataTexture`, computing SDF hexagon distances, smoothstep blends, and color lerps for every pixel. The `setTime` method (line 167-169) calls this function after updating the `time` uniform, but `redrawHoverTexture` never reads `uniforms.time.value`. The texture output is identical regardless of the time value passed. At 60fps this wastes approximately 1M pixel computations per second with zero visual effect.

Note: in the current codebase, `setTime` is defined on the `HoverHexMaterialController` interface (line 33) and implemented (line 167), but no production code currently calls it — only tests do. The bug is that the method exists as a public API contract, and if any caller were to use it (as the interface implies they should), it would trigger a full CPU texture redraw per frame for no visual change. The method should either be removed or made a no-op, and the `time` uniform should be removed if unused.

### 2.2 Path renderer full rebuild on every state change

`PathRenderer.setPathDisplayState` (path-renderer.ts:162-169) calls `rebuildPathBatches()` synchronously. `rebuildPathBatches` (line 322) calls `disposeBatchObjects()` which removes all batch `LineSegments` from the scene graph, disposes all geometries and materials, then recreates everything from scratch. Multiple state changes in a single frame (e.g., deselecting one path and selecting another via `setSelectedPath` at lines 142-156) trigger multiple full rebuilds. There is no dirty flag, no frame batching, and no coalescing.

### 2.3 Allocation in army position lookup

`getArmyWorldPosition` (army-manager.ts:2276-2278) allocates `new Vector3()` on every call. This method is called from at least 7 call sites including `createPath` (line 1806 maps over an entire path array), `showLabel` (line 1920), `refreshArmyInstance` (line 1191), and `addArmy` (line 703). The class already owns `tempCosmeticPosition` and `tempIconPosition` (lines 192-193) as reusable scratch vectors, and a companion method `getArmyWorldPositionInto` (line 2271) exists that writes into a caller-provided vector.

### 2.4 Leaked source geometry in hover-hex outline

`HoverHexManager.createHoverHex` (hover-hex-manager.ts:89) creates an `EdgesGeometry` wrapping an inline `new ShapeGeometry(createHexagonShape(HEX_SIZE * 1.02))`. The intermediate `ShapeGeometry` is passed directly to the `EdgesGeometry` constructor and is never stored in a variable or disposed. Three.js `EdgesGeometry` copies the edge data but does not take ownership of the source geometry. The source geometry's GPU buffers are leaked.

### 2.5 Thunderbolt opacity feedback loop

In thunderbolt-manager.ts line 524:
```typescript
layer.material.opacity = opacity * (layer.material.opacity > 0.5 ? 1.0 : 0.8);
```
This reads `layer.material.opacity` (the current frame's value) to compute the next frame's opacity. The multiplier oscillates between 1.0 and 0.8 based on the output of the previous frame, creating a compounding feedback loop. Once opacity drops below 0.5, the 0.8 multiplier drives it further down; if it recovers above 0.5, the multiplier switches back to 1.0. This produces erratic flickering that worsens over time.

### 2.6 FX texture color space set in async callback

In fx-manager.ts lines 184-192:
```typescript
const texture = new THREE.TextureLoader().load(config.textureUrl, (loadedTexture) => {
  loadedTexture.colorSpace = THREE.SRGBColorSpace;
  loadedTexture.minFilter = THREE.LinearFilter;
  loadedTexture.magFilter = THREE.LinearFilter;
});
this.textures.set(config.textureUrl, texture);
```
`TextureLoader.load` returns the texture object synchronously, but `colorSpace`, `minFilter`, and `magFilter` are set inside the async load callback. The texture is stored in the map immediately (line 191) and can be used for rendering before the callback fires. Before load completes, the texture has `NoColorSpace` (the Three.js default) and default filters, causing FX sprites to render too dark on their first visible frames.

### 2.7 Weather modulation mutates sky color in-place

In day-night-cycle.ts lines 401-404:
```typescript
const currentSky = this.scene.background as Color;
const darkenFactor = 1 - skyDarkness * 0.5;
currentSky.multiplyScalar(darkenFactor);
```
`multiplyScalar` is destructive — it permanently modifies the color stored in `this.scene.background`. If `applyWeatherModulation` is called multiple times per frame, or if the call order relative to `update()` is ever violated, the sky color darkens exponentially toward black with no recovery path. The `update()` method sets the background color, but if weather modulation runs after, the darkened value persists until the next `update()` cycle.

## 3. Goals

### 3.1 Product goals

- eliminate wasted CPU work in hover material paths
- reduce GC pressure and allocation churn during path state transitions and army position lookups
- fix visual artifacts in thunderbolt flickering, FX color space, and weather sky darkening
- prevent GPU memory leaks from undisposed intermediate geometries

### 3.2 Technical goals

- remove or no-op the `setTime` → `redrawHoverTexture` call chain
- introduce dirty-flag deferred rebuilds in path renderer
- replace `new Vector3()` allocation in `getArmyWorldPosition` with shared temp vector reuse
- store and dispose the intermediate `ShapeGeometry` in hover-hex outline creation
- derive thunderbolt layer brightness from `layerIndex` directly instead of reading current opacity
- set FX texture properties synchronously before storing the texture
- apply weather darkening to a copy or blend target instead of mutating the scene background

## 4. Non-goals

- redesigning the hover-hex visual system or moving it to GPU shaders (future work)
- rewriting the path renderer batching architecture (covered in WEBGPU_OPTIMIZATION_PRD_TDD.md Stage 4)
- changing army position calculation logic beyond allocation reduction
- overhauling the thunderbolt visual design
- replacing the FX manager texture loading strategy
- redesigning the day-night cycle system

## 5. Success Metrics

### 5.1 Performance metrics

- `setTime` calls on hover-hex material produce zero CPU texture redraws
- multiple `setPathDisplayState` calls within a single frame produce at most one `rebuildPathBatches` call
- `getArmyWorldPosition` produces zero `Vector3` heap allocations
- no leaked `ShapeGeometry` GPU buffers from hover-hex outline creation

### 5.2 Visual correctness metrics

- thunderbolt layer opacity is deterministic given the same elapsed time and layer index
- FX textures render with correct `SRGBColorSpace` from their first visible frame
- sky color is stable under repeated `applyWeatherModulation` calls within the same frame

## 6. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Eliminate CPU texture redraw in hover hex material | ~1M pixel ops/sec recovered |
| 1 | Path renderer batch rebuild throttling | Reduce GC and rebuild churn during state changes |
| 2 | Allocation reduction in hot paths | Lower GC pressure, fix geometry memory leak |
| 3 | Visual correctness in effects | Fix flickering, color space, and sky darkening bugs |

### Delivery Tracker

- [ ] Stage 0: Eliminate CPU texture redraw in hover hex material
- [ ] Stage 1: Path renderer batch rebuild throttling
- [ ] Stage 2: Allocation reduction in hot paths
- [ ] Stage 3: Visual correctness in effects

### Dependencies between stages

All stages are independent — they touch different files and systems. They can be implemented and landed in any order or in parallel.

- Stage 0 is highest priority (biggest CPU savings, ~1M ops/sec recovered)
- Stage 1 is medium priority (reduces GC pressure during path state changes)
- Stage 2 is medium priority (allocation and memory leak reduction)
- Stage 3 is lower priority (visual polish fixes)

## 7. Detailed Stages

### 7.1 Stage 0: Eliminate CPU Texture Redraw in Hover Hex Material

#### Objective

Remove the wasted per-frame CPU texture redraw triggered by `setTime`, which iterates 16,384 pixels with zero visual effect because `redrawHoverTexture` never reads the `time` uniform.

#### Scope

- remove the `setTime` → `redrawHoverTexture` call (since the `time` uniform is unused by the texture computation)
- either make `setTime` a no-op that only updates the uniform value, or remove it entirely if no production caller exists
- clean up the `time` uniform from `HoverHexMaterialUniforms` if it serves no purpose

#### Files to change

- `client/apps/game/src/three/shaders/hover-hex-material.ts`
- `client/apps/game/src/three/shaders/hover-hex-material.test.ts`

#### TDD plan

Write tests first:

1. add a test that verifies `setTime` does NOT trigger `redrawHoverTexture` — the texture data should remain unchanged after a `setTime` call (compare texture bytes before and after)
2. add a test that verifies `setTime` still updates the `time` uniform value (if retained as a no-op uniform setter)
3. add a test that verifies `setPalette` and `setParameters` still trigger texture redraws (regression guard — these methods legitimately change visual output)
4. add a test that verifies the `redrawHoverTexture` function does not reference or depend on the `time` uniform value

Implementation steps:

1. modify `setTime` (line 167-169) to only update `uniforms.time.value` without calling `redrawHoverTexture`
2. if the `time` uniform is not consumed by any shader or downstream code, remove it from `HoverHexMaterialUniforms`, `HoverHexMaterialParameters`, and the `DEFAULT_HOVER_HEX_MATERIAL_PARAMETERS` object
3. update existing tests that assert texture changes after `setTime` — they should now assert no texture change
4. verify that `setPalette` and `setParameters` continue to redraw correctly

Exit criteria:

- `setTime` produces zero pixel iterations
- existing visual behavior of `setPalette` and `setParameters` is preserved
- `pnpm --dir client/apps/game test -- src/three/shaders/hover-hex-material.test.ts` passes
- no production code depends on `setTime` triggering a redraw

### 7.2 Stage 1: Path Renderer Batch Rebuild Throttling

#### Objective

Prevent multiple full geometry + material rebuilds within a single frame by introducing a dirty flag and deferring the actual rebuild to the next animation frame.

#### Scope

- add a dirty flag to `PathRenderer` that gates `rebuildPathBatches`
- coalesce multiple `setPathDisplayState`, `createPath`, and `removePath` calls within a frame into a single rebuild
- defer the rebuild to the next `update()` call or `requestAnimationFrame`

#### Files to change

- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/three/managers/path-renderer.test.ts`

#### TDD plan

Write tests first:

1. add a test that calls `setPathDisplayState` twice in succession and verifies `rebuildPathBatches` executes only once (after the deferred flush)
2. add a test that calls `createPath` followed by `setPathDisplayState` in the same synchronous block and verifies a single rebuild
3. add a test that verifies the rebuild still happens — calling `update()` after marking dirty triggers the rebuild and produces correct batch objects
4. add a test that verifies `removePath` followed by `createPath` for the same entity coalesces correctly
5. add a regression test that verifies `dispose()` flushes or cancels any pending rebuild without errors

Implementation steps:

1. add a `private _batchesDirty = false` flag to `PathRenderer`
2. replace direct `rebuildPathBatches()` calls in `setPathDisplayState` (line 168), `createPath` (line 121), and `removePath` (line 185) with `this._batchesDirty = true`
3. at the start of `update()` (line 207), check `_batchesDirty` and call `rebuildPathBatches()` if true, then reset the flag
4. ensure `dispose()` resets `_batchesDirty` and does not attempt a rebuild after disposal
5. keep `rebuildPathBatches` as a private method with the same implementation — only the call timing changes

Exit criteria:

- multiple state changes within a single frame produce at most one geometry rebuild
- `getStats()` returns correct values after the deferred rebuild
- `pnpm --dir client/apps/game test -- src/three/managers/path-renderer.test.ts` passes
- no functional regressions in path visibility, selection, or frustum culling

### 7.3 Stage 2: Allocation Reduction in Hot Paths

#### Objective

Eliminate unnecessary heap allocations and fix a GPU memory leak in frequently called rendering code.

#### Scope

Two independent fixes:

1. **Army manager Vector3 allocation**: replace `new Vector3()` in `getArmyWorldPosition` with a reusable temp vector
2. **Hover-hex geometry leak**: store and dispose the intermediate `ShapeGeometry` used by `EdgesGeometry`

#### Files to change

- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/hover-hex-manager.ts`
- `client/apps/game/src/three/managers/hover-hex-manager.test.ts`

#### TDD plan — Army manager Vector3 allocation

Write tests first:

1. add a test that verifies `getArmyWorldPosition` returns correct world coordinates (regression guard)
2. add a test that verifies calling `getArmyWorldPosition` multiple times returns independent position data — since a shared temp vector is reused, callers that store the result must receive the correct value at the time of access (or the API must be changed to make temp-vector semantics explicit)
3. add a test that verifies `getArmyWorldPositionInto` and `getArmyWorldPosition` produce the same output for the same input

Implementation steps:

1. add a `private readonly tempWorldPosition = new Vector3()` to the class (or reuse an existing temp vector like `tempCosmeticPosition` if call-site analysis confirms no overlap)
2. change `getArmyWorldPosition` (line 2276-2278) to call `this.getArmyWorldPositionInto(this.tempWorldPosition, hexCoords)` instead of `this.getArmyWorldPositionInto(new Vector3(), hexCoords)`
3. audit all 7+ call sites to ensure none store the returned vector across frames or async boundaries — if any do, those call sites must clone the result or use `getArmyWorldPositionInto` with their own vector
4. specifically audit `createPath` (line 1806) where `path.map(pos => this.getArmyWorldPosition(...))` would produce an array of references to the same temp vector — this call site must clone or use `getArmyWorldPositionInto` with fresh vectors per element

#### TDD plan — Hover-hex geometry leak

Write tests first:

1. add a test that verifies `HoverHexManager` construction does not leave undisposed geometries — mock `ShapeGeometry.dispose` and verify it is called for the intermediate geometry
2. add a test that verifies the `EdgesGeometry` (outline) still has correct edge data after the source geometry is disposed (Three.js copies the data, so this should pass)
3. add a test that verifies `dispose()` cleans up all geometries including the outline

Implementation steps:

1. in `createHoverHex` (hover-hex-manager.ts:89), store the intermediate `ShapeGeometry` in a local variable
2. after constructing the `EdgesGeometry`, call `.dispose()` on the intermediate `ShapeGeometry`
3. verify the outline renders correctly (edge data is copied during `EdgesGeometry` construction)

Exit criteria:

- `getArmyWorldPosition` produces zero `new Vector3()` heap allocations
- no call site receives stale data from the shared temp vector
- intermediate `ShapeGeometry` is disposed after `EdgesGeometry` construction
- `pnpm --dir client/apps/game test -- src/three/managers/army-manager` passes
- `pnpm --dir client/apps/game test -- src/three/managers/hover-hex-manager.test.ts` passes

### 7.4 Stage 3: Visual Correctness in Effects

#### Objective

Fix three independent visual correctness bugs in the effects layer: thunderbolt opacity feedback, FX texture color space timing, and destructive weather sky modulation.

#### Scope

Three independent fixes:

1. **Thunderbolt opacity feedback loop**: replace self-referential opacity calculation with a deterministic one based on `layerIndex`
2. **FX texture color space**: set texture properties synchronously before storing the texture
3. **Weather sky darkening**: apply darkening to a copy instead of mutating the scene background in-place

#### Files to change

- `client/apps/game/src/three/managers/thunderbolt-manager.ts`
- `client/apps/game/src/three/managers/thunderbolt-manager.test.ts`
- `client/apps/game/src/three/managers/fx-manager.ts`
- `client/apps/game/src/three/managers/fx-manager.test.ts`
- `client/apps/game/src/three/effects/day-night-cycle.ts`
- `client/apps/game/src/three/effects/day-night-cycle.test.ts`

#### TDD plan — Thunderbolt opacity feedback loop

Write tests first:

1. add a test that calls the thunderbolt update loop for 60 frames with the same elapsed-time delta and verifies that layer opacity is deterministic — running the same sequence twice from the same initial state produces identical opacity values
2. add a test that verifies core layers (index 0) are brighter than outer layers (index > 0) at the same elapsed time
3. add a test that verifies opacity stays within the clamped range [0.02, 1.0] after 120 frames of updates

Implementation steps:

1. replace line 524:
   ```typescript
   layer.material.opacity = opacity * (layer.material.opacity > 0.5 ? 1.0 : 0.8);
   ```
   with a deterministic calculation that uses `layerIndex` as the brightness factor source:
   ```typescript
   const layerBrightness = layerIndex === 0 ? 1.0 : 0.8;
   layer.material.opacity = THREE.MathUtils.clamp(opacity * layerBrightness, 0.02, 1);
   ```
2. verify that the visual flicker effect from `baseFade` and `flicker` (lines 512-516) is preserved — only the self-referential feedback is removed

#### TDD plan — FX texture color space

Write tests first:

1. add a test that verifies a texture stored in the `textures` map has `colorSpace === THREE.SRGBColorSpace` immediately after `registerFX` completes (before the async load callback fires)
2. add a test that verifies `minFilter` and `magFilter` are set to `THREE.LinearFilter` on the texture object before it is stored

Implementation steps:

1. in `registerFX` (fx-manager.ts:184-192), set `colorSpace`, `minFilter`, and `magFilter` on the texture object returned by `TextureLoader.load` before storing it in the map:
   ```typescript
   const texture = new THREE.TextureLoader().load(config.textureUrl, (loadedTexture) => {
     // callback can remain for any post-load work
   });
   texture.colorSpace = THREE.SRGBColorSpace;
   texture.minFilter = THREE.LinearFilter;
   texture.magFilter = THREE.LinearFilter;
   this.textures.set(config.textureUrl, texture);
   ```
2. the async callback can be kept for any future post-load work, or removed if it becomes empty

#### TDD plan — Weather sky darkening

Write tests first:

1. add a test that calls `applyWeatherModulation` with `skyDarkness = 0.5` twice in the same frame and verifies the sky color is the same after both calls (no compounding)
2. add a test that calls `update()` followed by `applyWeatherModulation` followed by `update()` and verifies the sky color recovers to the correct value (not permanently darkened)
3. add a test that verifies `applyWeatherModulation` with `skyDarkness = 0` does not modify the sky color at all

Implementation steps:

1. in `applyWeatherModulation` (day-night-cycle.ts:401-405), replace the in-place `multiplyScalar` with a copy-based approach:
   ```typescript
   if (skyDarkness > 0) {
     const currentSky = this.scene.background as Color;
     const darkenFactor = 1 - skyDarkness * 0.5;
     // Apply darkening to a copy so repeated calls don't compound
     const darkened = currentSky.clone().multiplyScalar(darkenFactor);
     (this.scene.background as Color).copy(darkened);
   }
   ```
   Or better, store the pre-weather sky color and apply darkening relative to that baseline:
   ```typescript
   if (skyDarkness > 0) {
     const currentSky = this.scene.background as Color;
     const darkenFactor = 1 - skyDarkness * 0.5;
     // Use the color set by update() as baseline, not the already-darkened value
     currentSky.copy(this.lastUpdateSkyColor).multiplyScalar(darkenFactor);
   }
   ```
2. add a `private lastUpdateSkyColor = new Color()` field that is set in `update()` after the sky color is computed, before weather modulation
3. similarly protect `this.directionalLight.intensity` and `this.hemisphereLight.intensity` in the sun occlusion block (lines 408-412) from compounding — store baseline values from `update()`

Exit criteria:

- thunderbolt opacity is deterministic and does not compound across frames
- FX textures render with correct color space from the first frame
- sky color is stable under repeated `applyWeatherModulation` calls
- `pnpm --dir client/apps/game test -- src/three/managers/thunderbolt-manager.test.ts` passes
- `pnpm --dir client/apps/game test -- src/three/managers/fx-manager.test.ts` passes
- `pnpm --dir client/apps/game test -- src/three/effects/day-night-cycle.test.ts` passes

## 8. Testing Strategy Summary

Every stage should follow the same delivery pattern:

1. add or repair the smallest failing tests that define the target behavior
2. implement the fix behind the existing API surface whenever possible
3. add performance assertions where the fix is performance-related
4. run targeted tests for touched files
5. verify no regressions in related manager tests

Required test commands per stage:

- Stage 0: `pnpm --dir client/apps/game test -- src/three/shaders/hover-hex-material.test.ts`
- Stage 1: `pnpm --dir client/apps/game test -- src/three/managers/path-renderer.test.ts`
- Stage 2: `pnpm --dir client/apps/game test -- src/three/managers/army-manager` and `pnpm --dir client/apps/game test -- src/three/managers/hover-hex-manager.test.ts`
- Stage 3: `pnpm --dir client/apps/game test -- src/three/managers/thunderbolt-manager.test.ts` and `pnpm --dir client/apps/game test -- src/three/managers/fx-manager.test.ts` and `pnpm --dir client/apps/game test -- src/three/effects/day-night-cycle.test.ts`

## 9. Risks and Mitigations

- Risk: changing `getArmyWorldPosition` to use a shared temp vector can cause stale data if callers store the reference across frames.
  Mitigation: audit all call sites before changing. The `createPath` call site (line 1806) maps over a path array and must clone each result. Add tests for multi-call correctness.

- Risk: deferring path batch rebuilds to `update()` could cause a single frame where paths render with stale geometry.
  Mitigation: the rebuild happens at the start of the next `update()` call, which runs every frame. One frame of staleness is acceptable and matches how frustum culling already works (checked every N frames).

- Risk: removing `setTime` from the hover-hex material interface could break downstream consumers.
  Mitigation: no production code currently calls `setTime`. Keep the method as a no-op that updates only the uniform value, preserving API compatibility.

- Risk: setting FX texture properties before load completes could conflict with Three.js internal texture state.
  Mitigation: Three.js `TextureLoader.load` returns a valid `Texture` object synchronously. Setting `colorSpace` and filter properties on it before the image data arrives is safe — Three.js reads these properties at upload time, which happens after load completes.

- Risk: storing baseline sky/light values for weather modulation adds state that must stay synchronized with `update()`.
  Mitigation: set the baseline at the end of `update()`, which is the only place that computes the canonical sky color. Document that `applyWeatherModulation` must be called after `update()`.
