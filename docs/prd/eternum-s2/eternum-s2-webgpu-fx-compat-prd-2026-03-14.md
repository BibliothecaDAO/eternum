# Eternum S2 WebGPU FX Compatibility PRD

Date: 2026-03-14 Status: Proposed Scope: `client/apps/game/src/three` FX pipeline, renderer capability seam, worldmap/army/structure effect call sites

## Implementation Tracking

- [x] Phase 0: Repro Inventory and Guardrails
- [x] Phase 1: Renderer Capability Seam
- [ ] Phase 2: FX Backend Abstraction
- [ ] Phase 3: WebGPU-Safe Billboard Backend
- [ ] Phase 4: Resource FX and Label FX Migration
- [ ] Phase 5: WebGPU Smoke Matrix and Cleanup

### Phase 0 Inventory

- [x] `compass`
- [x] `travel`
- [x] troop diff
- [x] resource gain/loss
- [x] world reward/reveal effects such as donkey/army found
- [x] army/structure FX routed through `FXManager`

## 1. Objective

Fix the root cause of WebGPU black-screen regressions caused by gameplay FX, while keeping the FX visible.

This PRD covers:

- world-space gameplay FX compatibility in native WebGPU,
- a renderer-capability seam so gameplay code stops branching on renderer mode,
- shared FX backend selection for `FXManager` and `ResourceFXManager`,
- TDD-first rollout with explicit red/green test slices,
- a smoke-test matrix for all known effect families.

## 2. Problem Statement

The current FX system assumes the legacy render path is the only runtime.

That assumption leaks in two ways:

1. `FXManager` and `ResourceFXManager` instantiate scene FX with `THREE.Sprite`, `THREE.SpriteMaterial`, `CSS2DObject`, and `renderOrder = Infinity`.
2. Gameplay systems call those managers directly with no renderer capability check or backend negotiation.

In native WebGPU, at least one of those scene-FX primitives is not behaving safely. The observed symptom is:

1. click a unit,
2. click `Explore`,
3. world graphics go black immediately,
4. UI remains visible,
5. graphics return when the effect is cleaned up after the explore update / tx completion.

This is consistent with the current tactical mitigation:

- `WorldmapScene.onArmyMovement()` spawns a persistent `compass` scene FX immediately,
- that FX remains alive until the explore result arrives,
- suppressing that FX in WebGPU removes the blackout.

This means the root issue is not scene routing or the loading overlay. It is the FX rendering path itself.

## 3. Confirmed Findings

### 3.1 The blackout is not the scene-transition overlay

- Explore clicks route through `WorldmapScene.onArmyMovement()`, not scene navigation.
- The transition overlay depends on `SceneManager.switchScene()` or navigation helpers, and the reported repro keeps UI visible.
- Therefore the loading/transition overlay is not the primary root cause for this bug class.

Primary references:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scene-manager.ts`
- `client/apps/game/src/three/managers/transition-manager.tsx`
- `client/apps/game/src/ui/modules/loading-oroborus.tsx`

### 3.2 The failing seam is the world-space FX pipeline

- `FXManager` uses `THREE.SpriteMaterial`, `THREE.Sprite`, `CSS2DObject`, and `renderOrder = Infinity`.
- `ResourceFXManager` uses the same family of primitives.
- Gameplay systems do not go through a renderer capability policy before spawning effects.

Primary references:

- `client/apps/game/src/three/managers/fx-manager.ts`
- `client/apps/game/src/three/managers/resource-fx-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`

### 3.3 The bug is effect-family-wide, not explore-specific

The user reported that effects like “donkey found”, “army found”, and similar reveal/reward FX show the same black-screen behavior.

That means the correct fix is not “keep adding per-effect skips”.

The correct fix is:

- centralize backend compatibility,
- replace the unsafe scene-FX primitive for WebGPU,
- keep gameplay call sites renderer-agnostic.

## 4. Goals

1. Keep gameplay FX visible in native WebGPU without blacking out the canvas.
2. Eliminate per-call-site renderer mode checks from gameplay systems.
3. Make effect rendering backend-selectable from renderer capabilities, not feature-specific hacks.
4. Reuse one capability-aware FX pipeline across `FXManager` and `ResourceFXManager`.
5. Land the change via TDD with explicit failing tests for each behavior slice.

## 5. Non-Goals

- Pixel-perfect parity between legacy sprite FX and WebGPU-safe FX in the first pass.
- Reworking post-processing, terrain rendering, or unrelated worldmap refresh logic.
- Replacing CSS2D labels globally across the whole app.
- Rewriting every visual effect system at once.

## 6. Root-Cause Hypothesis

The black-screen bug is caused by WebGPU-incompatible scene FX primitives being inserted into the main world scene.

The most likely problematic combination is:

- `THREE.SpriteMaterial`
- `THREE.Sprite`
- unbounded `renderOrder = Infinity`
- persistent world-scene lifetime while the tx is pending

The exact primitive may be one or more of the above, but the implementation response should not depend on isolating a single line-level offender first. The safer architectural fix is to stop using that primitive family in native WebGPU FX rendering.

## 7. Proposed Solution

Introduce a renderer-capability-driven FX backend abstraction.

### 7.1 New Capability Seam

Add a small runtime capability object derived from renderer diagnostics:

```ts
interface RendererFxCapabilities {
  activeMode: "legacy-webgl" | "webgl2-fallback" | "webgpu" | null;
  supportsSpriteSceneFx: boolean;
  supportsBillboardMeshFx: boolean;
  supportsDomLabelFx: boolean;
}
```

Rules:

- `legacy-webgl` and `webgl2-fallback` keep sprite-based scene FX.
- `webgpu` must not use sprite-based scene FX.
- DOM labels remain allowed unless proven otherwise.

This capability object must be the only renderer-awareness the gameplay FX layer sees.

### 7.2 New FX Backend Interface

Create a shared backend interface for world-space FX rendering:

```ts
interface WorldFxBackend {
  spawnIconFx(spec: IconFxSpec): WorldFxHandle;
  spawnTextFx(spec: TextFxSpec): WorldFxHandle;
  update(deltaTime: number): void;
  destroy(): void;
}
```

Where:

- `IconFxSpec` covers texture/icon-like world FX such as `compass`, `travel`, and reward/reveal icons.
- `TextFxSpec` covers floating text / labels / counters.
- `WorldFxHandle` exposes `end()` and `dispose()` semantics compatible with today’s call sites.

### 7.3 Two Concrete Backends

#### A. Legacy Sprite Backend

Used for:

- `legacy-webgl`
- `webgl2-fallback`

Behavior:

- keep current `SpriteMaterial`/`Sprite` implementation,
- clamp render order to a finite high value instead of `Infinity`,
- preserve current visuals.

#### B. WebGPU Billboard Backend

Used for:

- `webgpu`

Behavior:

- replace `THREE.Sprite` with camera-facing quads / planes,
- use `MeshBasicMaterial` or another WebGPU-safe material path,
- preserve effect lifetime, animation hooks, and label attachment behavior,
- keep effect transforms in world space.

This backend is the root fix.

It should be implemented once and reused by:

- `FXManager`
- `ResourceFXManager`

### 7.4 Keep Gameplay Call Sites Stable

Gameplay systems should keep doing:

- `playFxAtCoords(...)`
- `playTroopDiffFx(...)`
- resource gain/loss effect calls

But those methods must become backend-agnostic wrappers, not direct sprite constructors.

### 7.5 Tactical Mitigation Stays Until Full Root Fix Lands

The current WebGPU-only suppression for explore `compass` FX should remain in place during rollout.

It should be removed only after the WebGPU billboard backend covers that effect and its tests are green.

## 8. Scope by Phase

### Phase 0: Repro Inventory and Guardrails

Create an inventory of all FX families that can touch world graphics:

- `compass`
- `travel`
- troop diff
- resource gain/loss
- world reward/reveal effects such as donkey/army found
- any structure/army effect routed through `FXManager`

Deliverables:

- one source-of-truth inventory doc in code comments or PRD checklist,
- a backend-selection policy test file,
- a failing test for WebGPU explore FX support routing.

### Phase 1: Renderer Capability Seam

Add a small capability resolver from renderer diagnostics.

Requirements:

- no gameplay code should read `snapshotRendererDiagnostics()` directly after this phase,
- capability resolution should be pure and unit-tested,
- `null` / startup state should choose the safest default for boot, then settle after diagnostics are available.

### Phase 2: FX Backend Abstraction

Refactor `FXManager` so construction and lifecycle depend on a `WorldFxBackend`.

Requirements:

- existing public API remains stable,
- lifetime semantics remain stable,
- unit tests cover backend selection and cleanup semantics.

### Phase 3: WebGPU-Safe Billboard Backend

Implement world-space billboard mesh FX for icon effects.

Requirements:

- no `SpriteMaterial` or `Sprite` in the WebGPU backend,
- no `renderOrder = Infinity`,
- world-space anchor must remain stable during camera movement,
- effect animation hooks must remain backend-independent.

### Phase 4: Resource FX and Label FX Migration

Move `ResourceFXManager` onto the same backend abstraction.

Requirements:

- shared texture/material lifecycle where possible,
- floating amount labels preserved,
- no duplicated compatibility policy between managers.

### Phase 5: WebGPU Smoke Matrix and Cleanup

Validate all known FX families in WebGPU and then remove temporary suppressions.

Requirements:

- explicit smoke matrix in PR / QA notes,
- remove tactical per-effect skip only after coverage exists,
- keep one backend policy, not multiple effect-specific exceptions.

## 9. TDD Plan

This work must be landed red/green, one behavior slice at a time.

### Slice 1: Capability routing

RED:

- add a pure test proving native WebGPU does not choose sprite scene FX.

GREEN:

- implement `resolveRendererFxCapabilities(...)`.

### Slice 2: Explore FX backend selection

RED:

- add a pure test proving explore FX under WebGPU routes to the WebGPU-safe backend instead of the sprite backend.

GREEN:

- implement backend selection in the FX manager factory.

### Slice 3: Backend-agnostic effect lifecycle

RED:

- add tests proving `spawn -> update -> end -> cleanup` behavior matches across backends.

GREEN:

- move current lifecycle code behind the backend interface.

### Slice 4: WebGPU icon effect safety

RED:

- add tests proving the WebGPU backend does not instantiate `Sprite` / `SpriteMaterial`.

GREEN:

- implement billboard mesh effect rendering.

### Slice 5: Resource FX backend migration

RED:

- add tests proving resource FX select the same backend policy and preserve cleanup.

GREEN:

- migrate `ResourceFXManager`.

### Slice 6: Tactical suppression removal

RED:

- add an integration/policy test proving WebGPU explore FX are enabled once the safe backend is available.

GREEN:

- remove the current explore-FX suppression.

## 10. Test Matrix

### 10.1 Unit Tests

- `resolveRendererFxCapabilities()`
- `createWorldFxBackend()` selection
- backend lifecycle parity
- cleanup idempotence
- effect-handle `end()` behavior
- no `Sprite`/`SpriteMaterial` in WebGPU backend
- finite render order policy

### 10.2 Integration Tests

- `WorldmapScene.onArmyMovement()` routes explore FX through backend policy
- army/structure managers still trigger expected FX calls
- `ResourceFXManager` shares backend selection behavior

### 10.3 Static/Wiring Tests

- worldmap and managers should depend on the backend-agnostic API, not renderer-mode conditionals
- no new gameplay call site should read renderer diagnostics directly

### 10.4 Manual Smoke Matrix

Legacy WebGL:

- explore
- travel
- donkey found / army found / reveal rewards
- troop diff
- resource gain/loss

Native WebGPU:

- same matrix
- verify “graphics stay live while tx pending”
- verify UI overlays and labels remain intact

WebGL fallback from experimental build:

- same matrix
- confirm legacy sprite backend still works

## 11. Acceptance Criteria

1. No known gameplay FX blacks out the main canvas in native WebGPU.
2. The temporary tactical suppression for explore FX is removed once the new backend is in place.
3. Gameplay systems do not branch on renderer mode.
4. `FXManager` and `ResourceFXManager` share one capability-aware backend contract.
5. WebGPU-safe FX remain visible during pending transactions.
6. Unit and integration coverage explicitly protects backend selection and effect lifecycle behavior.

## 12. Risks

### Risk 1: Billboard mesh visuals drift from sprite visuals

Mitigation:

- accept first-pass visual approximation,
- validate icon readability and world anchoring instead of pixel-perfect parity.

### Risk 2: CSS2D labels are also partially implicated

Mitigation:

- keep labels behind a separate capability flag,
- if needed, add a DOM-overlay text backend without reworking icon rendering again.

### Risk 3: Tactical suppression becomes permanent

Mitigation:

- require a red test for suppression removal,
- track removal explicitly in Phase 5.

### Risk 4: Multiple managers reimplement capability logic

Mitigation:

- force backend selection through one factory module.

## 13. Rollout Strategy

1. Land capability seam and backend abstraction behind current behavior.
2. Keep tactical explore-FX suppression for WebGPU.
3. Land WebGPU billboard backend for explore/travel effects first.
4. Expand to resource/reveal/reward effects.
5. Run smoke matrix.
6. Remove temporary suppression.

## 14. Proposed File Targets

- `client/apps/game/src/three/renderer-fx-capabilities.ts`
- `client/apps/game/src/three/managers/fx-manager.ts`
- `client/apps/game/src/three/managers/resource-fx-manager.ts`
- `client/apps/game/src/three/fx/` backend folder
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`

## 15. Immediate Recommendation

Do not continue fixing this family with effect-specific skips.

Use the current explore suppression only as a temporary guardrail, and implement the root fix as:

1. renderer capability seam,
2. shared FX backend abstraction,
3. WebGPU-safe billboard mesh backend,
4. TDD slices for backend selection and lifecycle parity.
