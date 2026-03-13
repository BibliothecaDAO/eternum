# Three Renderer Stabilization for WebGPU Migration

## Problem

`client/apps/game/src/three` is functional but not migration-ready. The current runtime mixes WebGL-specific renderer code, shared mutable shader/material state, scene-global lifecycle, browser-global input/timing, and world-map gameplay/UI orchestration. That makes a WebGPU move high-risk and hard to stage.

## Goal

Create a renderer architecture that can support a staged WebGPU migration without rewriting gameplay logic and without regressing scene correctness, teardown safety, or asset rendering.

## Non-Goals

- Do not ship WebGPU in this project.
- Do not redesign gameplay systems.
- Do not replace CSS/DOM labels unless required by the chosen migration target.

## Success Criteria

- `GameRenderer` depends on a backend interface, not directly on WebGL-only types.
- Scene setup, switch, resize, and destroy paths are deterministic and cancel-safe.
- `worldmap.tsx` no longer owns unrelated UI/DOM/gameplay orchestration.
- All custom shader/material paths are inventoried and categorized as `stock`, `NodeMaterial/TSL rewrite`, or `deferred`.
- Runtime integration tests cover boot, scene switch, resize, and destroy.
- No shared mutable render resources exist without explicit ownership.

## Out of Scope Risk

If you want worker/offscreen rendering, the CSS2D/DOM label stack becomes a separate project.

## TDD Delivery Plan

### Stage Status

- [x] 1. Lifecycle Hardening
- [x] 2. Renderer Backend Extraction
- [x] 3. Scene Ownership Cleanup
- [ ] 4. Worldmap Decomposition
- [ ] 5. Shader and Material Portability
- [ ] 6. Asset and Material Correctness
- [ ] 7. Integration Test Net

### 1. Lifecycle Hardening

Scope: fix unsafe scene switching, transition teardown, async destroy races, and timer leaks in `scene-manager.ts`, `transition-manager.tsx`, `game-renderer.ts`, `army-manager.ts`, `structure-manager.ts`, and `thunderbolt-manager.ts`.

Acceptance:

- A failed scene setup does not become current.
- Destroy cancels pending transitions, timers, and async work.
- No manager mutates scene state after destroy.

Tests first:

- Add failing tests for setup failure rollback.
- Add failing tests for destroy-during-fade.
- Add failing tests for destroy-during-async manager refresh.
- Add failing tests for thunderbolt timeout cancellation.

### 2. Renderer Backend Extraction

Scope: isolate renderer creation, frame loop, render targets, environment maps, diagnostics, and post FX behind a `RendererBackend` seam centered around `game-renderer.ts`.

Acceptance:

- Scene code no longer imports `WebGLRenderer` or `WebGLRenderTarget`.
- Backend swap affects a narrow bootstrap layer.
- Resize updates both surface and post stack.

Tests first:

- Add failing tests for backend init.
- Add failing tests for resize propagation.
- Add failing tests for environment setup and dispose.
- Add failing tests for frame loop ownership.
- Use a fake backend in tests before moving any WebGL logic.

### 3. Scene Ownership Cleanup

Scope: make scenes lazy and local. Remove eager constructor-side setup from `hexagon-scene.ts`, stop binding input to `window` in `input-manager.ts`, and make scene-owned resources attach on `setup()` and detach on `onSwitchOff()` or `destroy()`.

Acceptance:

- Inactive scenes do not hold page-global listeners or allocate unnecessary render resources.
- Input is canvas/surface-scoped.
- Timing comes from one renderer-owned loop.

Tests first:

- Add failing tests asserting no listeners before setup.
- Add failing tests asserting no duplicated listeners across scenes.
- Add failing tests asserting no scene callbacks after switch-off.

### 4. Worldmap Decomposition

Scope: split `worldmap.tsx` into render orchestration, chunk runtime, and UI/gameplay adapters. Move DOM, query, audio, and navigation concerns out of the scene.

Acceptance:

- `worldmap.tsx` becomes a scene coordinator, not a god object.
- UI, modal, and navigation interactions are adapter calls.
- Chunk/runtime helpers remain scene-agnostic.

Tests first:

- Add failing tests around a `WorldmapRuntime` or similar seam for chunk refresh.
- Add failing tests for hydration completion.
- Add failing tests for selection routing.
- Add failing tests for switch-off behavior before extracting code.

### 5. Shader and Material Portability

Scope: inventory every `ShaderMaterial` and shared material in `client/apps/game/src/three/shaders`, `selection-pulse-manager.ts`, `fx-manager.ts`, and points/path rendering.

Acceptance:

- Every shader is tagged `replace`, `rewrite`, or `keep for WebGL path`.
- Shared singleton materials are replaced with owned factories.
- No cross-scene mutable shader state remains.

Tests first:

- Add unit tests for material factory ownership and disposal.
- Add unit tests for per-scene isolation.
- Add unit tests for shader inventory coverage.
- Then replace singleton exports with factory-created instances.

### 6. Asset and Material Correctness

Scope: fix multi-material handling and lossy pooling in `army-model.ts`, `material-pool.ts`, and `asset-cache.ts`.

Acceptance:

- Multi-material meshes render and dispose correctly.
- Pooled materials preserve required semantics.
- Source material disposal does not destroy needed state.

Tests first:

- Add failing tests for multi-material GLTF import.
- Add failing tests for pooled material semantic preservation.
- Add failing tests for release and dispose reference counting.

### 7. Integration Test Net

Scope: replace structure-based tests with runtime behavior tests around `game-renderer.lifecycle.test.ts` and related renderer tests.

Acceptance:

- Coverage exists for boot, route change, scene switch, resize, quality change, and destroy.
- Tests construct real renderer collaborators or high-fidelity fakes instead of prototype stubs.

Tests first:

- Define harness utilities for fake renderer backend.
- Define harness utilities for fake controls.
- Define harness utilities for fake scene and fake timing scheduler.

## Execution Order

1. Lifecycle Hardening
2. Renderer Backend Extraction
3. Scene Ownership Cleanup
4. Worldmap Decomposition
5. Shader and Material Portability
6. Asset and Material Correctness
7. Integration Test Net

## Progress

- [x] Stage 1. Lifecycle Hardening
- [x] Stage 2. Renderer Backend Extraction
- [x] Stage 3. Scene Ownership Cleanup
- [x] Stage 4. Worldmap Decomposition
- [x] Stage 5. Shader and Material Portability
- [x] Stage 6. Asset and Material Correctness
- [ ] Stage 7. Integration Test Net

## Definition of Done

The codebase can run on the existing WebGL backend through the new abstraction, runtime tests cover the critical lifecycle paths, and the remaining WebGPU work is mostly backend implementation plus shader rewrites, not architecture cleanup.
