# Eternum S2 WebGPU Client Implementation PRD

Date: 2026-03-13
Status: Draft
Scope: `client/apps/game/src/three`, `client/apps/game/vite.config.ts`, renderer flags, selected tests, and adjacent render diagnostics

## Implementation Tracking

- [x] Phase 0: Contract and Build-Mode Design
- [x] Phase 1: Experimental `three/webgpu` Build and Backend Boot
- [x] Phase 2: Backend Contract V2 and Frame Pipeline
- [x] Phase 3: Effect and Material Porting Foundation
  - [x] Replace points-label shader path with stock `PointsMaterial` + vertex-color hover state
  - [x] Replace path rendering shader path with owned stock line materials
  - [x] Port remaining FX/resource FX surfaces off unsupported custom shaders
  - [x] Finalize backend-neutral post-process parity tuning for the first canary scenes
- [x] Phase 4: Scene Rollout and Parity
  - [x] HUD parity sign-off
  - [x] FastTravel parity sign-off
  - [x] Hexception parity sign-off
  - [x] Worldmap parity sign-off
- [ ] Phase 5: Compatibility, Telemetry, and Ship Gates
- [ ] Phase 6: Legacy Backend Retirement Decision

## 1. Objective

Implement WebGPU across the Eternum Three.js client in a way that:

- preserves the existing shipping WebGL path until parity is proven,
- uses the current renderer stabilization work as the foundation,
- introduces a robust experimental WebGPU build path,
- supports fallback and diagnostics from day one,
- and leaves the client with a cleaner, future-proof rendering architecture after migration.

This PRD assumes the renderer-stabilization PRD is already in progress and uses that work as a prerequisite rather than
repeating it.

## 2. Confirmed Inputs

### 2.1 Current repo baseline

- The client is on `three@0.182.0`, `postprocessing@6.x`, and `three-stdlib@2.x`.
- A renderer backend seam already exists in `client/apps/game/src/three/renderer-backend.ts`.
- `GameRenderer` already delegates core surface actions to that backend seam.
- The current backend interface is still WebGL-shaped because it exposes `createRenderPass()`, `addPass()`,
  `removePass()`, and `updateRenderPassScene()`.
- `client/apps/game/vite.config.ts` does not currently alias `three` to `three/webgpu` or expose a renderer build mode.
- The client still contains multiple custom `ShaderMaterial` paths and several shader-driven managers:
  - `points-label-material.ts`
  - `path-line-material.ts`
  - `hover-hex-material.ts`
  - `highlight-hex-material.ts`
  - `selection-pulse-material.ts`
  - shader-driven FX in `fx-manager.ts`

### 2.2 Official WebGPU constraints from current Three.js docs

- `WebGPURenderer` is intended to be used via the `three/webgpu` build, not the default `three` build. [S1]
- `WebGPURenderer` requires `await renderer.init()` and prefers `renderer.setAnimationLoop()` ownership. [S1]
- `WebGPURenderer` automatically falls back to a WebGL 2 backend when WebGPU is unavailable, and can be forced into that
  mode with `forceWebGL`. [S1][S2]
- `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile()` material patching are not supported in
  `WebGPURenderer`. [S1]
- `EffectComposer` is not supported in `WebGPURenderer`; Three now provides a different post-processing stack based on
  `PostProcessing`, nodes, and TSL. [S1][S5]
- TSL is the portable custom-shader path for the new renderer because it can target WGSL or GLSL depending on backend.
  [S1][S4]

## 3. Problem Statement

The client is now structurally closer to supporting multiple render backends, but it is not ready for a direct
`WebGLRenderer` -> `WebGPURenderer` swap.

The specific blockers are:

1. the app still ships on the default `three` build rather than `three/webgpu`,
2. the backend seam is still based on WebGL-era pass/composer assumptions,
3. the custom material/effect surface is still centered on `ShaderMaterial`,
4. several scene features depend on visual effects that must be re-expressed in TSL or redesigned,
5. and the project needs a safe rollout plan that avoids breaking unsupported browsers, dev machines, or parity
   testing.

The migration therefore needs to be staged as a controlled implementation program, not treated as a renderer constructor
replacement.

## 4. Goals

1. Add an experimental WebGPU-capable build path without destabilizing the current shipping WebGL renderer.
2. Allow the same gameplay scene code to run through a WebGPU-oriented renderer contract once unsupported effect paths
   are ported.
3. Preserve functional parity across world map, hexception, fast travel, and HUD.
4. Preserve a safe fallback path on unsupported browsers and devices during rollout.
5. Replace WebGL-only custom effect paths with TSL, official WebGPU postprocessing, or simpler stock-material designs
   where that is the better long-term tradeoff.
6. Improve diagnostics, failure handling, and long-term renderer maintainability.

## 5. Non-Goals

- Shipping WebGPU to all users immediately.
- Replacing the DOM/CSS2D label stack in this PRD.
- Rewriting gameplay logic, chunking strategy, or Torii data flow beyond what is required for renderer correctness.
- Introducing compute-driven gameplay or worker-driven rendering in this phase.
- Solving WebXR or offscreen-canvas rendering in this phase.

## 6. Product Requirements

### R1. The project must support an experimental WebGPU build mode before it changes the shipping build

The client must introduce a renderer build mode system with at least:

- `legacy-webgl`: current `three` + `WebGLRenderer` shipping path,
- `experimental-webgpu-auto`: `three/webgpu` + `WebGPURenderer` with automatic WebGPU/WebGL2 backend selection,
- `experimental-webgpu-force-webgl`: `three/webgpu` + `WebGPURenderer({ forceWebGL: true })` for development and CI on
  machines without WebGPU.

This is required because the official Three.js migration path depends on the `three/webgpu` build, but the current
client still has unsupported material/effect paths. The project therefore needs a separate experimental lane before it
can converge to one runtime.

Acceptance:

- Developer can select build mode via env and query-param tooling.
- Unsupported devices fall back safely without app crash.
- QA can exercise the WebGPU-oriented code path even on non-WebGPU devices through forced WebGL2 fallback.

### R2. The renderer backend contract must be evolved from pass-based to pipeline-based

The current backend seam is a good starting point but still leaks WebGL/`EffectComposer` assumptions:

- `createRenderPass()`
- `addPass()`
- `removePass()`
- `updateRenderPassScene()`

That contract is not the right long-term abstraction for a WebGPU stack built around `PostProcessing` and output nodes.

The backend contract must be upgraded so `GameRenderer` drives a higher-level frame pipeline instead of a pass list.

Minimum contract responsibilities:

- async backend initialization,
- frame scheduler ownership,
- surface resize,
- main-scene render,
- overlay/HUD render,
- environment application,
- backend capabilities and fallback reason reporting,
- post-process plan application from a backend-neutral policy object.

Acceptance:

- `GameRenderer` no longer needs to know whether the backend uses `EffectComposer` or `PostProcessing`.
- The legacy WebGL backend can be adapted to the new contract without changing scene logic.
- The future WebGPU backend can implement the same contract without pass-list shims.

### R3. The first WebGPU implementation must be behind a dedicated `WebGPURendererBackend`

The new backend must live alongside the existing WebGL backend, not replace it up front.

Responsibilities:

- create `WebGPURenderer`,
- call `await init()`,
- configure output quality (`outputBufferType`, antialias strategy, shadow settings),
- report active backend mode (`webgpu` or internal `webgl2-fallback`),
- expose one place for error handling and kill-switch fallback.

Acceptance:

- A minimal game scene can boot through the WebGPU backend under an experimental flag.
- Backend selection and backend type are visible in diagnostics.
- Init failures fail closed to the legacy path instead of crashing the app.

### R4. Postprocessing must move to a backend-neutral effect plan

The project must stop treating pmndrs `postprocessing` classes as the source of truth for visual policy.

Instead:

- `game-renderer-policy.ts` should express desired effects in backend-neutral terms,
- the WebGL backend should map that plan to the current `EffectComposer`,
- the WebGPU backend should map that same plan to Three's `PostProcessing` node stack.

Required initial parity targets:

- tone mapping / output transform,
- bloom,
- chromatic aberration,
- anti-aliasing selection,
- vignette / color-grade layer where visual value justifies the complexity.

Acceptance:

- Effect enablement, quality gating, and tuning are defined once.
- WebGL and WebGPU backends translate the same effect policy.
- WebGPU work does not require `GameRenderer` to branch on effect implementation classes.

### R5. Unsupported custom-material surfaces must be categorized before implementation starts

Each current custom render effect must be assigned one of three strategies:

- `Replace`: drop custom shader logic and use stock materials or simpler geometry.
- `Rewrite`: port to TSL / node-based materials.
- `Redesign`: keep the feature but express it with a different primitive or renderer path.

Required first-pass categorization:

| Surface | Current implementation | WebGPU strategy |
| --- | --- | --- |
| Hover hex | shared `ShaderMaterial` mesh overlay | Rewrite or replace with a TSL overlay material |
| Highlight hex | `ShaderMaterial` / instanced color shader | Rewrite in TSL |
| Selection pulse | shared global shader material | Rewrite in TSL and make scene-owned |
| Path renderer | instanced ribbon shader | Keep geometry, rewrite material in TSL |
| Point labels | `THREE.Points` shader with WebGL-era semantics | Redesign as instanced billboards or sprite-like quads |
| FX manager / resource FX | sprite-like shader materials | Rewrite in TSL or replace with stock billboard materials |
| Label stack | CSS2D + DOM | Keep for MVP; isolate behind overlay seam |

Acceptance:

- Every unsupported effect has a declared implementation path before coding starts.
- No experimental WebGPU scene enters parity testing while still depending on uncategorized `ShaderMaterial` code.

### R6. The scene rollout must be staged by complexity, not by importance

The recommended order is:

1. backend smoke harness,
2. HUD,
3. FastTravel,
4. Hexception,
5. Worldmap.

Rationale:

- HUD is small and proves overlay composition.
- FastTravel is materially simpler than Worldmap and exercises shared navigation/runtime concepts.
- Hexception covers richer local scene interactions.
- Worldmap is the largest and most effect-heavy scene and should remain last.

Acceptance:

- A scene is only considered "ported" when its required interactions, effects, and teardown behavior pass parity gates.
- Worldmap remains gated behind earlier scene success.

### R7. The implementation must preserve a safe and observable fallback story

Fallback is not optional. The client must:

- detect availability with `three/addons/capabilities/WebGPU.js`,
- record whether the active renderer is legacy WebGL, WebGPU, or WebGPURenderer-on-WebGL2 fallback,
- expose a query-param or dev-menu override,
- automatically revert to legacy WebGL if experimental init repeatedly fails in a session.

Acceptance:

- Unsupported browsers get a deterministic path.
- Experimental backend failures are visible in telemetry and local debug UI.
- A kill switch exists for rollout.

### R8. Diagnostics must become backend-agnostic

The existing diagnostic surface is still tied to raw `renderer.info`.

The PRD requires a backend-neutral diagnostics interface covering:

- active backend mode,
- init time,
- frame time,
- draw-call and geometry counts where available,
- fallback reason,
- effect plan currently applied,
- scene name,
- error/fallback counters.

Acceptance:

- Memory and performance tooling does not assume `WebGLRenderer`.
- Missing per-backend metrics degrade gracefully instead of failing.

### R9. The implementation must preserve visual parity by policy, not by exact implementation

Visual parity does not mean identical shader code. It means:

- the same gameplay affordances remain readable,
- the same quality tiers remain meaningful,
- the same scene transitions remain understandable,
- and any intentionally dropped effect is approved and documented.

Acceptance:

- The PRD defines required parity surfaces per scene.
- Low-value effects may be simplified if readability and gameplay clarity improve.

### R10. The implementation must leave a future path for deeper WebGPU optimization

The MVP should not prematurely commit to complex GPU-driven systems, but the architecture must preserve headroom for:

- official WebGPU postprocessing growth,
- render-bundle use on static scene subsets,
- storage-backed instancing,
- eventual compute-driven effects or culling,
- eventual overlay replacement if the client later wants off-main-thread rendering.

Acceptance:

- New seams introduced during migration are renderer-neutral where feasible.
- The final architecture does not require another large cleanup to pursue WebGPU-native optimizations later.

## 7. Parity Matrix

### 7.1 Global parity surfaces

- scene boot
- resize and DPR changes
- route-based scene switching
- environment map application
- tone mapping and color grade
- weather propagation
- HUD overlay composition
- destroy and re-init

### 7.2 Scene-specific parity surfaces

HUD:

- weather, rain, ambient particles, navigator, label cadence

FastTravel:

- path preview, selection pulse, camera chunk refresh, entity anchors, movement preview

Hexception:

- structure/building visuals, interaction surface, building preview, paused state overlays

Worldmap:

- chunk switching, terrain rebuilds, army/structure visibility, paths, point icons, hover/selection, effects, labels,
  weather, shadow policy, diagnostics

## 8. Implementation Plan

## Phase 0: Contract and Build-Mode Design

Deliverables:

- finalize WebGPU migration inventory,
- define `RendererBackendV2`,
- define renderer build modes and config surface,
- document the bundler strategy for `three` vs `three/webgpu`,
- document effect-plan schema.

Design note:

Do not globally alias `three` to `three/webgpu` in the main app build yet. That should happen only in the experimental
build lane until scene parity is proven.

Acceptance:

- There is one approved backend contract for both WebGL and WebGPU paths.
- There is one approved build-mode plan for dev, CI, and rollout.

TDD first:

- add tests for renderer mode resolution,
- add tests for fallback mode selection,
- add tests for backend contract initialization flow.

## Phase 1: Experimental `three/webgpu` Build and Backend Boot

Deliverables:

- Vite build-mode support for experimental `three/webgpu`,
- `WebGPURendererBackend`,
- capability detection using `WebGPU.isAvailable()`,
- explicit backend-type reporting,
- init failure fallback path,
- minimal boot harness scene.

Acceptance:

- Experimental build boots a trivial scene through `WebGPURenderer`,
- forced WebGL mode works for non-WebGPU development,
- backend reports whether it is using true WebGPU or WebGL2 fallback.

TDD first:

- failing tests for backend init success/failure,
- failing tests for fallback-from-init-error,
- failing tests for mode overrides.

## Phase 2: Backend Contract V2 and Frame Pipeline

Deliverables:

- replace pass-list interface with pipeline interface,
- move frame-loop ownership toward backend scheduler compatibility,
- implement legacy WebGL adapter on the new contract,
- implement WebGPU adapter stub on the same contract,
- make post-process plan backend-neutral.

Acceptance:

- `GameRenderer` no longer calls `createRenderPass()`, `addPass()`, or `removePass()` directly.
- The same `GameRenderer` logic can drive both backends.

TDD first:

- failing tests for backend-neutral frame render flow,
- failing tests for overlay render ordering,
- failing tests for resize behavior through the new contract.

## Phase 3: Effect and Material Porting Foundation

Deliverables:

- remove remaining scene-global shared shader materials,
- implement scene-owned material factories,
- port or replace first-wave effects,
- define the official WebGPU-compatible postprocessing stack for the client.

Recommended sequence:

1. selection pulse / hover / highlight overlays,
2. path rendering,
3. point icon rendering,
4. FX manager/resource FX,
5. post-process parity tuning.

Acceptance:

- No canary scene depends on unsupported `ShaderMaterial` code.
- The WebGPU backend can render its first target scenes without WebGL-only materials.

TDD first:

- failing tests for per-scene material ownership,
- failing tests for disposal isolation,
- failing tests for effect-plan translation.

## Phase 4: Scene Rollout and Parity

Deliverables:

- HUD parity,
- FastTravel parity,
- Hexception parity,
- Worldmap parity.

Each scene requires:

- functional parity sign-off,
- teardown sign-off,
- resize/DPR sign-off,
- fallback sign-off,
- image-comparison or structured visual checklist sign-off.

Acceptance:

- Earlier scenes remain green while later scenes are ported.
- Worldmap is not attempted until the simpler scenes are stable.

TDD first:

- add scene smoke harnesses,
- add route-switch lifecycle tests,
- add destroy/re-init tests per scene,
- add visual-regression harnesses where feasible.

## Phase 5: Compatibility, Telemetry, and Ship Gates

Deliverables:

- backend telemetry,
- kill switch,
- rollout checklist,
- browser/device QA matrix,
- quality-tier tuning,
- fallback and failure dashboards.

Quality-tier evaluation requirements:

- benchmark `outputBufferType` choices for desktop/mobile tiers,
- benchmark anti-aliasing strategies by tier,
- verify shadow and post FX defaults per quality level.

Acceptance:

- Experimental rollout can be enabled for internal users without silent failures.
- Every failure path has a fallback or a clear diagnostic outcome.

TDD first:

- tests for telemetry field population,
- tests for kill-switch application,
- tests for fallback-on-error behavior.

## Phase 6: Legacy Backend Retirement Decision

Deliverables:

- decision memo on whether to:
  - keep both backends longer,
  - ship only the WebGPU-oriented build and rely on `WebGPURenderer` fallback,
  - or defer retirement due to unresolved parity/perf issues.

Retirement gate:

- all target scenes green,
- parity checklist approved,
- rollout telemetry acceptable,
- no unresolved blocker class tied to legacy backend availability.

## 9. Edge Cases and Failure Modes

### 9.1 Build and boot edge cases

- Experimental build accidentally mixed with legacy `three` imports.
- `renderer.init()` rejection or long init latency.
- Backend init succeeds but required scene features are still missing.

### 9.2 Runtime edge cases

- background/foreground tab transitions,
- resize during init,
- device pixel ratio change,
- worldmap scene switch during backend fallback,
- effect plan changes during scene transition,
- destroy and re-init while an experimental backend is active.

### 9.3 Visual edge cases

- tone mapping mismatch between legacy and WebGPU stacks,
- bloom or chromatic aberration tuning drift,
- path thickness/readability drift,
- point-label readability drift if redesigned away from the current points shader,
- shadow precision differences from buffer/output changes.

### 9.4 Rollout edge cases

- user forces experimental mode on unsupported device,
- forced WebGL2-through-WebGPURenderer path behaves differently from legacy WebGL,
- telemetry is incomplete on one backend,
- repeated failures cause recovery loops.

## 10. Testing Strategy

### 10.1 Unit and contract tests

- backend mode resolution,
- capability detection and fallback reason mapping,
- backend contract V2 behavior,
- effect-plan translation,
- scene-owned material factories,
- diagnostics interface behavior.

### 10.2 Scene smoke tests

- boot each scene,
- switch scenes,
- resize,
- destroy and re-init,
- verify no post-destroy callbacks mutate scene state.

### 10.3 Visual parity tests

- screenshot or pixel-threshold checks for key scene states,
- quality-tier snapshots,
- post-effect snapshots where practical,
- selection/hover/path visibility checks.

### 10.4 Performance and stability checks

- worldmap steady-state frame cost,
- worldmap chunk-switch cost,
- Hexception interaction frame cost,
- init time,
- fallback rate,
- error rate.

## 11. Future-Proofing Opportunities

These are not MVP requirements but the implementation should leave room for them:

- use official WebGPU-native postprocessing growth instead of adding more pmndrs-specific lock-in,
- investigate render-bundle optimization for static chunk terrain and other stable scene subsets,
- investigate storage-backed instancing for very high entity counts after parity,
- keep labels behind an explicit overlay seam so the client can later revisit DOM vs GPU labels without touching scene
  logic again,
- converge on one `three/webgpu` build once parity is proven so future TSL and WebGPU upgrades are incremental rather
  than architectural.

## 12. Recommended Decisions Up Front

1. Keep the current shipping `WebGLRenderer` backend until scene parity is proven.
2. Build the WebGPU effort around a separate experimental `three/webgpu` lane, not a one-shot import rewrite.
3. Upgrade the backend contract before implementing the full WebGPU backend.
4. Replace shared shader singletons with scene-owned material factories before porting effects.
5. Treat point icons and paths as design opportunities, not only shader-porting tasks.
6. Plan to converge to one `WebGPURenderer` path with internal WebGL2 fallback only after parity and rollout gates pass.

## 13. Source References

- [S1] Three.js manual: WebGPURenderer
  https://threejs.org/manual/en/webgpurenderer
- [S2] Three.js docs: WebGPURenderer
  https://threejs.org/docs/pages/WebGPURenderer.html
- [S3] Three.js docs: WebGPU capability helper
  https://threejs.org/docs/pages/WebGPU.html
- [S4] Three.js manual: TSL
  https://threejs.org/manual/en/tsl.html
- [S5] Three.js docs: PostProcessing
  https://threejs.org/docs/pages/PostProcessing.html
- [S6] Three.js example: WebGPU postprocessing bloom
  https://threejs.org/examples/webgpu_postprocessing_bloom.html
- [S7] Three.js example: WebGPU postprocessing FXAA
  https://threejs.org/examples/webgpu_postprocessing_fxaa.html
- [S8] Three.js example: WebGPU postprocessing transition
  https://threejs.org/examples/webgpu_postprocessing_transition.html
