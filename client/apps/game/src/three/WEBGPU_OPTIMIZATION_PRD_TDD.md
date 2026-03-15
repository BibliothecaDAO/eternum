# WebGPU Optimization and Renderer Hardening PRD + TDD

Status: Draft
Date: 2026-03-15
Scope: `client/apps/game/src/three`
Primary surfaces: renderer backend selection, WebGPU initialization, scene update loop, chunked worldmap rendering, instancing, visibility, world FX, path rendering, post-processing portability, diagnostics

## 1. Summary

This document converts the current WebGPU review into a staged delivery plan with product requirements, technical design, file-level change lists, and test-first implementation steps.

The core conclusion from the review is:

- the current codebase already has the right high-level seams for optimization
- the next wins are mostly in correctness, visibility convergence, and upload reduction
- simply "using WebGPU more" will not unlock the expected gains until CPU-side churn and buffer upload churn are reduced

The plan below stages the work so that every phase:

- ships measurable improvements
- keeps rollback paths simple
- adds test coverage before changing behavior
- reduces risk before larger architectural moves

## 2. Problem Statement

The current renderer stack has five classes of issues that block reliable WebGPU-scale gains.

### 2.1 Backend correctness and portability gaps

- failed experimental renderer initialization can leak a partially created renderer
- WebGPU capability reporting is not fully truthful relative to actual implementation
- world FX teardown can strand promises
- the WebGPU compat shim depends on private Three internals
- the portability inventory is stale relative to retired files

### 2.2 CPU work still dominates too many frames

- the game loop still spends significant time in controls, HUD, weather propagation, scene updates, CSS2D labels, and diagnostics
- visibility policy is fragmented across multiple systems
- path rendering remains object-per-path rather than batched

### 2.3 Animation work is under-gated

- `ArmyModel` ignores the visibility context in its hottest animation path
- draw counts are based on sparse slot maxima instead of dense active counts
- hidden or sparse instances still drive morph and draw work

### 2.4 Upload churn remains high

- worldmap chunk cache replay still re-copies matrices and colors into GPU-backed attributes
- structure refresh does extra instance churn by zeroing models before repopulating them
- some instanced model paths recompute bounds only to immediately overwrite them with chunk bounds

### 2.5 Observability is not yet GPU-aware

- diagnostics are mostly CPU timers and counters
- there is no first-class accounting for per-frame upload volume
- there is no backend-specific telemetry for init, device loss, or GPU pass timing

## 3. Goals

### 3.1 Product goals

- make the experimental WebGPU lane safe to run for longer sessions
- improve worldmap traversal smoothness under camera movement and chunk switching
- reduce rendering stalls during chunk replay and heavy army/structure scenes
- keep renderer behavior consistent across legacy WebGL and WebGPU where parity is promised

### 3.2 Technical goals

- eliminate known correctness leaks in initialization and FX lifecycles
- unify visibility and animation gating around the centralized visibility manager
- reduce redundant instance uploads and bound recomputation
- create enough telemetry to measure whether WebGPU-specific work is actually paying off
- stage feature parity work so post-processing and environment features can migrate without destabilizing the main loop

## 4. Non-goals

- a full renderer rewrite outside `client/apps/game/src/three`
- immediate migration to custom WGSL or raw WebGPU for all rendering
- replacing Three.js as the rendering abstraction in this project
- shipping advanced WebGPU-only compute work before correctness and telemetry are in place
- redesigning gameplay-facing visuals beyond what is needed for backend parity

## 5. Architecture Assessment

The current architecture has strong foundations that should be preserved.

- `renderer-backend.ts`, `renderer-backend-v2.ts`, and `renderer-backend-loader.ts` provide a usable backend seam.
- `WarpTravel` and its helper modules split chunk decisions, hydration, and commit phases cleanly.
- `CentralizedVisibilityManager` is the right abstraction for shared frustum and distance policy.
- the worldmap already has debounced refresh scheduling, latest-wins semantics, and directional prefetch.
- `PointsLabelRenderer` and `InteractiveHexManager` are already relatively backend-portable.

The plan should build on those seams instead of bypassing them.

## 6. Success Metrics

### 6.1 Correctness metrics

- no leaked renderer instance on failed experimental initialization
- no unresolved world-FX promises after scene teardown or effect disposal
- no stale capability reporting for tone mapping or DOM/billboard FX support
- WebGPU backend tests execute successfully in CI

### 6.2 Performance metrics

- lower worldmap chunk replay time in cached-chunk paths
- lower bytes uploaded per chunk replay and per frame
- lower animation work for offscreen armies and sparse slot maps
- lower path-render draw calls at equivalent gameplay state
- bounded instance-bound recomputation in chunk-refresh hot paths

### 6.3 Diagnostics metrics

- renderer init timings visible in diagnostics
- backend mode, fallback reason, and device-loss status visible in diagnostics
- upload volume visible per frame and per chunk switch
- GPU timing available when backend/browser features permit it

## 7. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Observability and test harness hardening | Make the work measurable and executable |
| 1 | Backend correctness hardening | Fix known leaks, hangs, and parity mismatches |
| 2 | Visibility and animation convergence | Stop offscreen work earlier |
| 3 | Upload and instance churn reduction | Reduce the main WebGPU bottleneck |
| 4 | Secondary renderer batching | Lower draw/object overhead outside terrain |
| 5 | Feature parity and post stack migration | Make WebGPU more truthful and useful |
| 6 | Advanced WebGPU experiments | Optional higher-risk work behind flags |

### Delivery Tracker

- [x] Stage 0: Observability and test harness hardening
- [x] Stage 1: Backend correctness hardening
- [x] Stage 2: Visibility and animation convergence
- [x] Stage 3: Upload and instance churn reduction
- [x] Stage 4: Secondary renderer batching
- [ ] Stage 5: Feature parity and post stack migration
- [ ] Stage 6: Advanced WebGPU experiments

## 8. Detailed Stages

### 8.1 Stage 0: Observability and Test Harness Hardening

#### Objective

Make renderer work measurable and make the WebGPU test lane executable before behavior changes land.

#### Scope

- add explicit renderer telemetry for init, upload volume, and optional GPU timing
- make backend diagnostics easier to consume from tests and dev tooling
- fix the current WebGPU test execution failure so the planned work can be protected with tests

#### Files to change

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.ts`
- `client/apps/game/src/three/utils/performance-monitor.ts`
- `client/apps/game/vitest.config.ts`
- `client/apps/game/src/setupTests.ts`
- new: `client/apps/game/src/three/perf/renderer-gpu-telemetry.ts`
- new: `client/apps/game/src/three/perf/renderer-gpu-telemetry.test.ts`

#### TDD plan

Write tests first:

1. add tests for new telemetry snapshot shape and reset behavior
2. add tests for backend diagnostics carrying init timing and backend mode metadata
3. add a regression test that proves the WebGPU backend test file can execute under the configured Vitest environment
4. add tests for upload-counter increments on simulated matrix/color writes

Implementation steps:

1. introduce a small telemetry module for renderer init timing, upload bytes, optional GPU timing, and device status
2. thread telemetry writes through the backend seam and chunk replay hot paths
3. fix the Vitest/jsdom setup so `webgpu-renderer-backend.test.ts` runs instead of failing before collection
4. expose debug globals only through existing diagnostics hooks, not ad hoc globals

Exit criteria:

- `webgpu-renderer-backend.test.ts` executes in `pnpm --dir client/apps/game test`
- telemetry snapshots can be inspected from tests
- at least one cached worldmap replay path reports upload volume

### 8.2 Stage 1: Backend Correctness Hardening

#### Objective

Fix the concrete correctness bugs and contract mismatches in the backend and FX plumbing.

#### Scope

- dispose partially created renderers on init failure
- add device-loss and uncaptured-error handling hooks
- make capability reporting match actual WebGPU behavior
- resolve world-FX promises on all teardown paths
- remove stale portability metadata and reduce brittle compat behavior

#### Files to change

- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/renderer-backend-loader.ts`
- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-fx-capabilities.ts`
- `client/apps/game/src/three/fx/world-fx-backends.ts`
- `client/apps/game/src/three/renderer-vite-config.ts`
- `client/apps/game/src/three/three-webgpu-compat.ts`
- `client/apps/game/src/three/shaders/shader-portability-inventory.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.test.ts`
- `client/apps/game/src/three/renderer-backend-loader.test.ts`
- `client/apps/game/src/three/renderer-fx-capabilities.test.ts`
- `client/apps/game/src/three/fx/world-fx-backends.test.ts`
- `client/apps/game/src/three/shaders/shader-portability-inventory.test.ts`

#### TDD plan

Write tests first:

1. backend init failure disposes any created renderer before legacy fallback
2. device-loss state updates diagnostics and does not leave stale active mode claims
3. world-FX `dispose()` resolves `handle.promise`
4. backend-wide `destroy()` resolves all outstanding FX promises
5. tone-mapping capability reporting matches actual supported fields and modes
6. portability inventory only lists live files

Implementation steps:

1. assign the created experimental renderer early enough to dispose it on failure, or keep a local finally-path disposer
2. wire `GPUDevice.lost` and uncaptured-error hooks into diagnostics
3. make the world-FX lifecycle single-resolution and teardown-safe
4. either downgrade `supportsToneMappingControl` or implement honest partial capability semantics
5. trim or isolate private `three/src/Three.js` compat usage behind the smallest possible shim
6. make the inventory and tests agree on retired shader helpers

Exit criteria:

- no known backend leak on init failure
- no hanging FX promises on destroy paths
- capability diagnostics are truthful enough to drive feature gating

### 8.3 Stage 2: Visibility and Animation Convergence

#### Objective

Make visibility the single source of truth for animation and culling decisions across the renderer stack.

#### Scope

- gate `ArmyModel` animation work by centralized visibility
- converge path, point, and structure visibility around shared frame state
- reduce split usage of `FrustumManager` and singleton reach-ins where centralized visibility should own the policy

#### Files to change

- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
- `client/apps/game/src/three/managers/army-model.ts`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/points-label-renderer.ts`
- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/three/utils/frustum-manager.ts`
- `client/apps/game/src/three/managers/army-model.visibility.test.ts`
- new: `client/apps/game/src/three/managers/army-model.animation-visibility.test.ts`
- new: `client/apps/game/src/three/managers/path-renderer.visibility.test.ts`
- new: `client/apps/game/src/three/managers/structure-manager.visibility-wiring.test.ts`

#### TDD plan

Write tests first:

1. offscreen `ArmyModel` instances skip animation updates
2. visible `ArmyModel` instances still animate as before
3. path visibility is derived from centralized visibility without direct singleton dependency
4. structure point icon visibility follows shared visibility state without duplicate frustum ownership
5. visibility frame recomputation happens once per scene frame unless dirtied

Implementation steps:

1. give `ArmyModel.updateAnimations()` a real visibility gate
2. pass explicit visibility context from scene/manager owners instead of relying on global access
3. add any small adapter methods needed so `PointsLabelRenderer` can consume chunk/sphere visibility from the centralized manager
4. deprecate or narrow `FrustumManager` usage where centralized visibility already covers the same policy

Exit criteria:

- no offscreen army morph work in normal frames
- visibility ownership is coherent enough that backend changes do not need per-manager special cases

### 8.4 Stage 3: Upload and Instance Churn Reduction

#### Objective

Reduce the buffer upload and instance-management work that currently dominates chunk replay and dense entity updates.

#### Scope

- compact sparse army slots into dense visible ranges
- stop full chunk cache replays from acting like full GPU uploads when only reuse is needed
- remove redundant bound recomputation in instanced model hot paths
- stop structure refresh from zeroing all models before repopulating them

#### Files to change

- `client/apps/game/src/three/managers/army-model.ts`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/instanced-model.tsx`
- `client/apps/game/src/three/managers/instanced-biome.tsx`
- `client/apps/game/src/three/utils/instanced-matrix-attribute-pool.ts`
- new: `client/apps/game/src/three/scenes/worldmap-upload-budget-policy.ts`
- new: `client/apps/game/src/three/scenes/worldmap-upload-budget-policy.test.ts`
- new: `client/apps/game/src/three/managers/army-model.slot-compaction.test.ts`
- new: `client/apps/game/src/three/scenes/worldmap-cache-replay-upload.test.ts`

#### TDD plan

Write tests first:

1. sparse visible slots compact to dense draw ranges without changing logical entity ownership
2. army render and animation counts track dense visible count, not max slot index
3. cached chunk replay reports lower upload volume than a cold chunk rebuild
4. structure refresh no longer performs a global `setCount(0)` reset pass
5. instanced model and biome updates skip bounding recomputation when chunk bounds are authoritative

Implementation steps:

1. introduce a dense slot remap policy for visible armies
2. change draw-count ownership from "highest used slot" to "dense active count"
3. split chunk cache replay into cold rebuild vs cached apply paths with explicit upload accounting
4. preserve per-model instance counts across structure updates without full reset passes
5. short-circuit `computeBoundingSphere()` and similar work when `setWorldBounds()` already owns the bounds

Exit criteria:

- measurable drop in upload bytes for cached worldmap refreshes
- measurable drop in army animation work for sparse visibility sets
- no functional regressions in selection, hover, raycast, or entity-to-slot mapping

### 8.5 Stage 4: Secondary Renderer Batching

#### Objective

Reduce draw-call and object-management overhead in non-terrain secondary renderers.

#### Scope

- batch path rendering
- make world FX lifecycle and backend selection more scalable
- move fast-travel visuals closer to the instanced worldmap model where feasible

#### Files to change

- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/three/managers/path-renderer.test.ts`
- `client/apps/game/src/three/managers/path-renderer.scene-ownership.test.ts`
- `client/apps/game/src/three/fx/world-fx-backends.ts`
- `client/apps/game/src/three/fx/world-fx-backends.test.ts`
- `client/apps/game/src/three/scenes/fast-travel.ts`
- `client/apps/game/src/three/scenes/fast-travel-render-assets.ts`
- `client/apps/game/src/three/scenes/fast-travel-render-assets.test.ts`
- new: `client/apps/game/src/three/managers/path-batching-policy.ts`
- new: `client/apps/game/src/three/managers/path-batching-policy.test.ts`

#### TDD plan

Write tests first:

1. multiple active paths render through a bounded number of path batches
2. path visibility updates do not require one object per path
3. world FX billboard backend respects capability flags for both billboard meshes and DOM labels
4. fast-travel chunk refresh reuses render assets instead of fully recreating them when scene ownership is unchanged

Implementation steps:

1. introduce a batched path buffer layout and keep the current API as the facade
2. move path culling to chunk/group visibility rather than per-object scene graph visibility
3. share billboard geometry where possible and keep teardown-safe promise behavior from Stage 1
4. isolate fast-travel render assets from fast-travel data refresh so chunk changes do not imply full recreation

Exit criteria:

- path draw calls scale sublinearly with path count
- fast-travel chunk switches allocate materially less per switch

### 8.6 Stage 5: Feature Parity and Post Stack Migration

#### Objective

Make the WebGPU lane more honest and more useful by reducing parity mismatches and planning the post stack migration explicitly.

#### Scope

- make tone-mapping parity explicit
- define how environment IBL, color grade, vignette, and bloom migrate or stay unsupported
- prewarm pipeline/material variants during scene transitions and chunk switches

#### Files to change

- `client/apps/game/src/three/game-renderer-policy.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/renderer-backend.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/renderer-parity-gates.ts`
- `client/apps/game/src/three/fx/world-fx-backends.ts`
- `client/apps/game/src/three/game-renderer-policy.test.ts`
- `client/apps/game/src/three/renderer-diagnostics.test.ts`
- `client/apps/game/src/three/renderer-parity-gates.test.ts`
- new: `client/apps/game/src/three/webgpu-postprocess-policy.ts`
- new: `client/apps/game/src/three/webgpu-postprocess-policy.test.ts`

#### TDD plan

Write tests first:

1. parity gates reflect actual supported WebGPU features
2. unsupported features degrade explicitly instead of appearing configurable but inert
3. post-process policy chooses the correct plan for WebGL, native WebGPU, and forced-WebGL fallback
4. scene prewarm hooks request async compilation before the first hot frame

Implementation steps:

1. define a policy module that maps requested effects to backend-supported effects
2. decide which features will remain unsupported in the first WebGPU production lane
3. add a renderer prewarm hook that can call `compileAsync()` for scene/material variants when supported
4. keep legacy WebGL behavior unchanged unless explicitly gated

Exit criteria:

- diagnostics and UI agree about what the WebGPU lane can and cannot do
- transition into heavy scenes no longer pays first-use compilation cost on the hottest frame when prewarm is available

### 8.7 Stage 6: Advanced WebGPU Experiments

#### Objective

Evaluate higher-risk WebGPU work only after the previous stages prove where the remaining bottlenecks are.

#### Scope

- optional OffscreenCanvas worker rendering experiment
- optional GPU-driven visibility or draw-indirect experiment behind flags
- optional subgroup-enabled or multi-draw-indirect experiments in supported Chrome builds

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- new: `client/apps/game/src/three/experiments/webgpu-worker-renderer.ts`
- new: `client/apps/game/src/three/experiments/webgpu-worker-renderer.test.ts`
- new: `client/apps/game/src/three/experiments/worldmap-gpu-culling.ts`
- new: `client/apps/game/src/three/experiments/worldmap-gpu-culling.test.ts`

#### TDD plan

Write tests first:

1. worker/offscreen mode is fully behind an explicit feature flag
2. the renderer falls back safely if worker/offscreen setup fails
3. GPU culling experiment preserves visible-entity correctness against CPU reference results

Implementation steps:

1. build experiments as opt-in modules outside the main production path
2. keep CPU reference implementations alongside experiments for correctness checks
3. only promote experiments after telemetry proves that Stages 0 through 5 no longer dominate frame cost

Exit criteria:

- experiments are safe to enable locally without threatening the default renderer path
- any production promotion is justified by telemetry, not speculation

## 9. Recommended Delivery Order

The recommended order is strict.

1. Stage 0
2. Stage 1
3. Stage 2
4. Stage 3
5. Stage 4
6. Stage 5
7. Stage 6 only if still necessary

The most important sequencing rule is:

- do not start shader or compute-heavy WebGPU work before visibility and upload churn are under control

## 10. Testing Strategy Summary

Every stage should follow the same delivery pattern.

1. add or repair the smallest failing tests that define the target behavior
2. implement the behavior behind the existing seam whenever possible
3. add diagnostics assertions where the new behavior is performance-related
4. run targeted tests for touched files plus the nearest renderer integration tests
5. update documentation and parity gates only after tests pass

Required recurring test commands:

- `pnpm --dir client/apps/game test -- src/three/webgpu-renderer-backend.test.ts`
- `pnpm --dir client/apps/game test -- src/three/renderer-backend-loader.test.ts`
- `pnpm --dir client/apps/game test -- src/three/managers/army-model.visibility.test.ts`
- `pnpm --dir client/apps/game test -- src/three/scenes/worldmap-cache-safety.test.ts`
- `pnpm --dir client/apps/game test -- src/three/scenes/worldmap-switch-off-memory.test.ts`

Add stage-specific targeted commands as each phase lands.

## 11. Risks and Mitigations

- Risk: visibility changes can cause subtle selection or hover regressions.
  Mitigation: preserve existing manager APIs and add explicit visibility wiring tests before refactors.

- Risk: slot compaction can break entity-to-instance lookup assumptions.
  Mitigation: add bijection tests for slot ownership, raycast results, and selected-entity stability.

- Risk: post-process parity work can accidentally change WebGL visuals.
  Mitigation: keep parity gates explicit and route changes through policy modules with backend-specific tests.

- Risk: worker/offscreen experiments can conflict with CSS2D labels and DOM-owned HUD systems.
  Mitigation: keep worker mode experimental and only attempt it after measuring the remaining main-thread cost.

## 12. External Guidance Used

The stage ordering in this document is aligned with current official guidance:

- Three.js `WebGPURenderer` and async compilation: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js WebGPU/TSL post-processing path: https://threejs.org/docs/pages/PostProcessing.html
- Three.js TSL and render-pipeline direction: https://threejs.org/docs/TSL.html
- MDN `GPUDevice.createRenderPipelineAsync`: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync
- MDN `GPUQueue.writeBuffer`: https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeBuffer
- MDN `GPUDevice.lost`: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost
- MDN `OffscreenCanvas`: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- Chrome WebGPU 131 update for future experiments: https://developer.chrome.com/blog/new-in-webgpu-131
