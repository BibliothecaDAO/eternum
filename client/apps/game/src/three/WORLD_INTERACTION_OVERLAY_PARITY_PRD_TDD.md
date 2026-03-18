# World Interaction Overlay Parity PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: world interaction highlight rendering, renderer frame pipeline, post-processing boundaries, scene overlay ownership, backend parity, regression harnesses

## 1. Summary

This document converts the current selected-unit highlight review into a staged delivery plan with product requirements,
technical design, file-level scope, and test-first implementation steps.

The core conclusion from the review is:

- the movement and discovery highlight colors are already defined correctly
- the bug is not primarily a palette bug or an action-path bug
- the real parity break is that interaction highlights are rendered inside the legacy WebGL post-processed main scene
- the correct fix is to render world interaction overlays in a post-process-exempt overlay pass, not to tune colors per backend

The plan below stages the work so that each phase:

- proves the problem with tests before implementation
- keeps the visual blast radius narrow
- preserves the existing HUD overlay behavior
- avoids reopening the broader renderer tone-mapping stack unless later evidence demands it

## 2. Problem Statement

The current selected-unit highlight path produces readable movement and discovery colors in the WebGPU lane but can render
movement highlights as effectively black in legacy WebGL. The issue is visible when a unit is selected and the world map
renders reachable tiles and frontier tiles with the selection highlight field.

### 2.1 The palette is not missing

- movement route color is already green
- discovery frontier color is already blue
- descriptor generation already classifies frontier endpoints separately from route tiles

That means the input data for the visual is correct before rendering starts.

### 2.2 The current rendering architecture mixes interaction overlays into the main scene

- `HexagonScene` creates `HighlightHexManager` against the main world `Scene`
- `WorldmapScene` creates `SelectionPulseManager` and `SelectedHexManager` against the same scene
- legacy WebGL runs the main scene through `EffectComposer`
- native WebGPU currently runs a more minimal path with far fewer post-processing features

This means the exact same interaction geometry is composited differently across backends.

### 2.3 The route layer is especially vulnerable

- the route layer is low opacity
- the route layer is intentionally color-dimmed for readability
- the route layer sits lower than the brighter frontier layer
- the route layer is transparent and still depth-tested

That combination makes route highlights the first visual to collapse when the compositor, tone-mapping, vignette, or
depth composition differs by backend.

### 2.4 The current overlay seam is insufficient for the proper fix

The renderer pipeline currently supports only one optional overlay scene/camera pair, and that slot is already consumed
by `HUDScene`. A proper world-space interaction overlay requires:

- a world-space overlay scene
- the main world camera, not the HUD camera
- rendering after the main scene post-processing completes
- preserving the existing HUD pass as the final overlay

So the proper fix is not just "move a mesh to another scene". It requires extending the frame pipeline to support
multiple overlay passes in a stable order.

## 3. Goals

### 3.1 Product goals

- make selected-unit movement highlights render with readable, intended color in legacy WebGL
- keep movement and discovery highlight visuals visually consistent across legacy WebGL, WebGPU native, and WebGPU
  WebGL fallback lanes
- preserve current HUD rendering order and interaction behavior
- avoid changing overall world color grading while fixing the selection overlay issue

### 3.2 Technical goals

- move world interaction highlight rendering out of the main post-processed scene
- generalize the renderer frame pipeline to support ordered overlay passes
- keep the proper fix scoped to world interaction visuals instead of broad renderer regrading
- add tests that lock in overlay render ordering and parity assumptions

## 4. Non-goals

- redesigning the highlight palette
- adding WebGL-only color branches inside highlight materials as the primary fix
- broad cleanup of tone-mapping policy across the full renderer stack
- migrating every world-space auxiliary visual into overlays in the first change
- changing gameplay rules, action-path generation, or selection behavior

## 5. Architecture Assessment

The existing renderer already has the right seam for the proper fix, but it is too narrow.

- `game-renderer.ts` already differentiates between `mainScene` and `overlayScene`
- `webgl-postprocess-runtime.ts`, `webgpu-postprocess-runtime.ts`, and `renderer-backend-compat.ts` already render an
  overlay pass after the main scene using `clearDepth()`
- `HUDScene` already proves that a post-process-exempt overlay pass works in this codebase
- `HexagonScene` already centralizes scene-owned interaction managers, so it is the right place to own a world-space
  interaction overlay scene

The gap is that the frame pipeline only models one overlay pass, so HUD and world interaction overlays cannot both be
expressed cleanly today.

## 6. Proposed Solution

Implement world interaction overlay parity with a dedicated world-space interaction overlay pass.

### 6.1 Design overview

Introduce a second scene owned by `HexagonScene`:

- `mainScene`: terrain, entities, environment, lighting, and everything that should remain inside the current renderer
  post-processing path
- `interactionOverlayScene`: unlit or post-process-sensitive interaction visuals that should render after the main scene
  and before the HUD

Move `HighlightHexManager` to `interactionOverlayScene`.

Do not move unrelated visuals in the first implementation. Keep the first proper-fix scope narrow and centered on the
known regression.

### 6.2 Pass ordering

Render in this order:

1. main world scene with the active backend's current main-scene behavior
2. world interaction overlay scene using the main world camera, after `clearDepth()`
3. HUD overlay scene using the HUD camera, after `clearDepth()`

That guarantees:

- world interaction highlights are no longer color-graded by the legacy WebGL composer
- HUD continues to sit on top of world interaction visuals
- camera-space alignment stays correct because the interaction overlay uses the same perspective camera as the world

### 6.3 Pipeline contract change

Replace the single optional overlay pair in `RendererFramePipeline` with an ordered overlay-pass list.

Proposed shape:

```ts
type RendererOverlayPass = {
  camera: Camera;
  scene: Scene;
  name?: string;
};

interface RendererFramePipeline {
  mainCamera: Camera;
  mainScene: Scene;
  overlayPasses?: RendererOverlayPass[];
  sceneName?: string;
}
```

This keeps the contract extensible without hard-coding a second overlay slot.

### 6.4 Scope decision for interaction visuals

Stage the migration as follows:

- required in first implementation: `HighlightHexManager`
- explicitly deferred unless validation shows the same defect:
  - `SelectionPulseManager`
  - `SelectedHexManager`
  - hover-only visuals

This keeps the change narrowly aligned with the user-visible regression while allowing later cleanup to reuse the same
overlay seam.

### 6.5 Why this is the proper fix

This approach fixes the actual renderer-boundary bug:

- it removes the problematic visual from the inconsistent backend-specific post-processing path
- it avoids per-backend material hacks
- it preserves current world grading and environment behavior
- it gives the renderer a better long-term abstraction for world-space overlays

## 7. Success Metrics

### 7.1 Correctness metrics

- selected-army movement route highlights are visibly green in `legacy-webgl`
- discovery frontier highlights remain blue in all renderer lanes
- HUD still renders above interaction visuals
- selection and hover raycasting behavior remains unchanged

### 7.2 Parity metrics

- screenshots from `legacy-webgl`, `experimental-webgpu-force-webgl`, and native `webgpu` show matching highlight
  hue/readability for the same selected-army state
- no backend-specific highlight-palette branches are required to achieve parity

### 7.3 Regression metrics

- no test regressions in renderer frame ordering
- no loss of existing HUD overlay rendering
- no chunk-switch or scene-switch teardown leak caused by the new overlay scene ownership

## 8. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Baseline proof and failing tests | Prove the current contract cannot express the proper fix |
| 1 | Multi-overlay frame pipeline | Support ordered overlay passes in all backends |
| 2 | Scene-owned world interaction overlay | Add an interaction overlay scene to map scenes |
| 3 | Highlight manager migration and parity validation | Move the highlight field to the new pass |
| 4 | Optional interaction-overlay follow-up | Migrate pulse/hover visuals only if needed |
| 5 | Regression hardening and rollout gates | Lock in ordering and parity behavior |

### Delivery Tracker

- [ ] Stage 0: Baseline proof and failing tests
- [ ] Stage 1: Multi-overlay frame pipeline
- [ ] Stage 2: Scene-owned world interaction overlay
- [ ] Stage 3: Highlight manager migration and parity validation
- [ ] Stage 4: Optional interaction-overlay follow-up
- [ ] Stage 5: Regression hardening and rollout gates

## 9. Detailed Stages

### 9.1 Stage 0: Baseline Proof and Failing Tests

#### Objective

Capture the current limitation in tests before changing the renderer contract.

#### Scope

- add failing tests for ordered overlay rendering expectations
- add failing tests that prove the current single-overlay pipeline is insufficient for world interaction plus HUD
- add a targeted highlight parity test seam at the scene/runtime level

#### Files to change

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- `client/apps/game/src/three/game-renderer.runtime.test.ts`
- `client/apps/game/src/three/webgpu-postprocess-runtime.test.ts`
- `client/apps/game/src/three/webgl-postprocess-runtime.test.ts`
- new: `client/apps/game/src/three/renderer-overlay-passes.test.ts`

#### TDD plan

Write tests first:

1. a frame pipeline test that expects multiple overlay passes to render in order
2. a runtime test that expects `GameRenderer` to provide both a world interaction overlay pass and the HUD pass
3. backend runtime tests that expect `clearDepth()` before each overlay render
4. a regression test that ensures the old single-overlay shape is no longer the source of truth

Implementation steps:

1. add a small overlay-pass helper or normalized pipeline shape
2. thread the new shape through the renderer compatibility layer first
3. update backend runtime tests to validate ordering before any scene migration happens

Exit criteria:

- tests fail for the missing multi-overlay support before implementation begins
- the new pipeline contract is pinned by tests in one place

### 9.2 Stage 1: Multi-overlay Frame Pipeline

#### Objective

Make the renderer capable of expressing the proper fix without yet changing where the highlight manager lives.

#### Scope

- replace `overlayScene` and `overlayCamera` with ordered `overlayPasses`
- update the compatibility renderer path
- update WebGL post-processing runtime
- update WebGPU minimal and WebGPU-postprocess runtimes

#### Files to change

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- `client/apps/game/src/three/webgl-postprocess-runtime.ts`
- `client/apps/game/src/three/webgpu-postprocess-runtime.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/renderer-backend-v2.test.ts`
- `client/apps/game/src/three/webgpu-postprocess-runtime.test.ts`
- `client/apps/game/src/three/webgl-postprocess-runtime.test.ts`
- new: `client/apps/game/src/three/renderer-overlay-passes.ts`
- new: `client/apps/game/src/three/renderer-overlay-passes.test.ts`

#### TDD plan

Write tests first:

1. normalizing helper returns a stable ordered overlay-pass list
2. compatibility renderer renders each overlay pass in order with `clearDepth()` between them
3. WebGL post-process runtime renders composer output first, then overlay passes sequentially
4. WebGPU runtimes match the same overlay ordering contract

Implementation steps:

1. define `RendererOverlayPass` and update `RendererFramePipeline`
2. add a small helper to iterate overlay passes consistently
3. update all render paths to consume the shared overlay-pass shape
4. keep behavior unchanged when there are zero overlay passes

Exit criteria:

- all renderer backends can render more than one overlay pass
- HUD-only behavior is preserved when no world interaction overlay exists

### 9.3 Stage 2: Scene-owned World Interaction Overlay

#### Objective

Introduce a dedicated world-space overlay scene owned by map scenes.

#### Scope

- add `interactionOverlayScene` ownership to `HexagonScene`
- expose read access for renderer assembly
- ensure lifecycle and disposal are handled with scene ownership

#### Files to change

- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/scenes/hexagon-scene.lifecycle.test.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/game-renderer.runtime.test.ts`

#### TDD plan

Write tests first:

1. `HexagonScene` creates and exposes an interaction overlay scene
2. `GameRenderer` includes the active scene's interaction overlay pass before HUD
3. disposing a scene cleans up managers attached to the interaction overlay scene
4. scenes without overlay content still produce a valid empty overlay contract

Implementation steps:

1. add `interactionOverlayScene` creation in `HexagonScene`
2. expose a getter or overlay-pass builder for the active scene
3. have `GameRenderer` assemble overlay passes in stable order:
   - active scene interaction overlay
   - HUD scene

Exit criteria:

- renderer frame assembly no longer assumes HUD is the only overlay
- map scenes can own world-space overlay content independent of the main scene

### 9.4 Stage 3: Highlight Manager Migration and Parity Validation

#### Objective

Move the actual selected-unit highlight field to the interaction overlay scene and lock the fix in with tests.

#### Scope

- instantiate `HighlightHexManager` on the interaction overlay scene instead of the main scene
- preserve existing API and selection behavior
- keep hover and pulse visuals unchanged in this stage

#### Files to change

- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/managers/highlight-hex-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-interaction-adapter.test.tsx`
- new: `client/apps/game/src/three/scenes/worldmap-highlight-overlay-parity.test.ts`

#### TDD plan

Write tests first:

1. selected-army highlight rendering still routes through `highlightHexManager.highlightHexes()`
2. the highlight manager mounts its meshes on the interaction overlay scene
3. highlight teardown removes overlay-scene content correctly
4. a runtime harness test proves the overlay pass ordering used for highlights is `main scene -> interaction overlay -> HUD`

Implementation steps:

1. change `HexagonScene` to construct `HighlightHexManager` with `interactionOverlayScene`
2. keep existing worldmap selection logic unchanged
3. adjust any manager disposal assumptions if they implicitly depended on the main scene

Exit criteria:

- selected-army movement/discovery highlight rendering no longer depends on the main-scene composer path
- the known parity bug is fixed without changing palette constants

### 9.5 Stage 4: Optional Interaction-overlay Follow-up

#### Objective

Only if validation shows the same parity issue on other selection affordances, reuse the new overlay seam for those
visuals.

#### Scope

- optionally migrate:
  - `SelectionPulseManager`
  - `SelectedHexManager`
  - hover-only managers if needed
- keep this stage separate from the required highlight fix

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/selection-pulse-manager.ts`
- `client/apps/game/src/three/managers/selected-hex-manager.ts`
- `client/apps/game/src/three/managers/hover-hex-manager.ts`
- related scene/runtime tests only if migration is justified

#### TDD plan

Write tests first:

1. pulse or hover visuals exhibit the same backend boundary issue
2. migrated visuals still update and dispose correctly on the interaction overlay scene

Implementation steps:

1. migrate only the specific manager(s) proven to benefit
2. avoid broad interaction-overlay migration without evidence

Exit criteria:

- no remaining backend-specific parity issue for selection affordances that share the same rendering risk

### 9.6 Stage 5: Regression Hardening and Rollout Gates

#### Objective

Protect the fix with renderer-order tests and a lightweight manual verification matrix.

#### Scope

- add rollout notes for renderer lane verification
- add regression guards for overlay ordering and scene assembly
- document the intended ownership boundary for future world-space overlays

#### Files to change

- `client/apps/game/src/three/README.md`
- `client/apps/game/src/three/game-renderer.runtime.test.ts`
- `client/apps/game/src/three/renderer-overlay-passes.test.ts`
- renderer smoke or harness scripts if needed

#### TDD plan

Write tests first:

1. overlay pass order remains stable when both world interaction and HUD overlays are present
2. HUD remains the final overlay pass
3. scenes without interaction overlays still render correctly

Implementation steps:

1. add README notes for the overlay-pass contract
2. add or extend smoke harness coverage if the repo already uses renderer scene smoke checks for parity
3. document the renderer-lane manual verification matrix

Exit criteria:

- overlay ordering is protected by tests
- future renderer work has an explicit place for world-space post-process-exempt visuals

## 10. Risks and Mitigations

### 10.1 Risk: Overlay pipeline refactor breaks HUD rendering

Mitigation:

- treat HUD ordering as a first-class invariant in tests
- keep HUD as the final pass in all runtime implementations

### 10.2 Risk: Scene ownership leaks or leaves overlay-scene objects behind

Mitigation:

- keep manager disposal scene-agnostic
- add lifecycle tests for overlay-scene teardown

### 10.3 Risk: Team reopens full renderer grading debates during the bug fix

Mitigation:

- explicitly defer broad tone-mapping cleanup from this PRD
- fix only the boundary that causes the selected-unit highlight regression

### 10.4 Risk: More visuals than expected depend on the same seam

Mitigation:

- land the interaction overlay seam first
- migrate other visuals only if validation shows they actually need it

## 11. Open Questions

1. Should `HighlightHexManager` be the only required first-stage migration target, or should the selection pulse move at
   the same time for consistency?
2. Do we want to keep overlay-pass assembly scene-driven, renderer-driven, or centralized in `GameRenderer`?
3. Should future world-space labels or navigational markers use the same overlay-pass seam, or remain HUD-owned?

## 12. Recommended Implementation Order

1. Stage 0 failing tests
2. Stage 1 overlay-pass contract refactor
3. Stage 2 interaction overlay scene ownership
4. Stage 3 highlight migration
5. Manual parity verification across:
   - `legacy-webgl`
   - `experimental-webgpu-force-webgl`
   - native `webgpu`
6. Stage 4 only if additional parity defects are observed

## 13. Acceptance Criteria

- The selected-unit route highlight is visibly green in legacy WebGL.
- The discovery frontier highlight remains blue in all renderer lanes.
- No WebGL-only palette or opacity branch is required for the fix.
- The renderer pipeline supports ordered overlay passes.
- The world interaction overlay renders after the main scene and before the HUD.
- Existing HUD behavior remains unchanged.
