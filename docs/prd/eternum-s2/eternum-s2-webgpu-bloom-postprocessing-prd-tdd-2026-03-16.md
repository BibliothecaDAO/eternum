# Eternum S2 WebGPU Bloom / Postprocessing PRD / TDD

Date: 2026-03-16
Status: Proposed
Scope: `client/apps/game/src/three` WebGPU postprocessing architecture, bloom parity, output transform ordering,
diagnostics, selected scene/asset tagging, and targeted renderer tests

## Implementation Tracking

- [ ] Phase 0: Baseline Lock and Glow Repro Harness
- [x] Phase 1: Shared Postprocess Contract and Test Seam
- [x] Phase 2: Native WebGPU PostProcessing Graph Boot
- [x] Phase 3: Bloom Parity and Selective Glow Routing
- [x] Phase 4: Optional Grade / Vignette / Aberration Closure
- [ ] Phase 5: Diagnostics, Smoke Matrix, and Rollout Gate Update

## 1. Objective

Restore intentional glow and postprocessing parity in the experimental WebGPU lane without regressing the current
shipping WebGL path or reintroducing hidden renderer behavior.

This PRD covers:

- the missing WebGPU bloom path behind the current "Essence Rift lost its glow" regression,
- migration from the current WebGL-only composer stack to an official Three.js WebGPU postprocessing path,
- preserving one backend-neutral effect policy owned by `game-renderer-policy.ts`,
- explicit capability and degradation reporting during the migration,
- and a TDD-first rollout that keeps the legacy WebGL backend as the reference path.

This PRD does not cover:

- environment / PMREM parity beyond preserving compatibility with the existing environment policy seam,
- broad material rewrites unrelated to glow/postprocessing,
- CSS2D label replacement,
- or retirement of the legacy WebGL backend.

## 2. Problem Statement

The current renderer split is architecturally honest but visually incomplete.

Today:

1. the WebGL backend owns `EffectComposer`, `BloomEffect`, color grade, vignette, and chromatic aberration,
2. the WebGPU backend reports those features as unsupported and only applies tone mapping / exposure directly on the renderer,
3. emissive assets such as the Blitz `Essence Rift` still render, but they no longer get the halo/spread that made them read as glowing,
4. and diagnostics correctly describe the WebGPU lane as `native-webgpu-minimal`.

That means the current WebGPU lane is no longer lying, but it is also no longer capable of the look the game was tuned
against. The Essence Rift symptom is the clearest example:

- the asset still has emissive intent,
- the instancing path still preserves/highlights emissive materials,
- but the bloom/postprocess stack that turned emissive brightness into visible glow does not exist in native WebGPU.

If left unresolved, the project remains in a half-complete state where:

- WebGPU is usable only with explicit visual regression,
- visual tuning continues to live in the WebGL backend,
- and every glow-heavy asset will keep looking flatter than the shipping lane.

## 3. Confirmed Findings

### 3.1 The current WebGL backend still owns the real postprocess stack

The shipping backend currently builds postprocessing through:

- `EffectComposer`,
- `ToneMappingEffect`,
- `HueSaturationEffect`,
- `BrightnessContrastEffect`,
- `BloomEffect`,
- `VignetteEffect`,
- and `ChromaticAberrationEffect`.

This is the only renderer path in the repo that currently turns the backend-neutral effect policy into a real bloom
pipeline.

### 3.2 The current WebGPU backend is intentionally minimal

The experimental backend currently:

- reports `supportsBloom = false`,
- reports color-grade/vignette/chromatic-aberration support as false,
- applies only tone mapping / exposure,
- and renders the frame directly with no node/composer postprocess graph.

That matches the current diagnostics and test expectations, but it also directly explains the missing glow.

### 3.3 The policy and diagnostics seams are already good enough to extend

The repo already has the right control plane for this work:

- `RendererBackendV2` exposes capability data,
- `game-renderer-policy.ts` already builds one backend-neutral effect plan,
- `renderer-diagnostics.ts` already snapshots capabilities, degradations, and postprocess policy,
- and targeted tests already protect unsupported-backend reporting.

This means the PRD should not invent a second policy layer. It should extend the existing one until WebGPU can honor it.

### 3.4 Official Three.js now has a real WebGPU postprocessing path

Current official Three.js sources indicate:

- `PostProcessing` is the WebGPU-oriented postprocessing entry point, [S1]
- `BloomNode` is the supported bloom primitive, [S2]
- `RenderOutputNode` is responsible for the final output transform and is explicitly required in scenarios such as FXAA,
  [S3]
- and the official `webgpu_postprocessing_bloom` example shows selective bloom implemented through the supported
  WebGPU-era stack, including MRT-based routing. [S4][S5]

Implication:

- the right fix is not "make pmndrs `postprocessing` work inside the WebGPU backend",
- the right fix is "map the repo's effect plan onto official Three.js WebGPU postprocessing primitives".

## 4. Goals

1. Restore a real bloom-capable postprocess path in native WebGPU.
2. Keep one backend-neutral effect policy owned by the current renderer policy layer.
3. Preserve the current WebGL backend behavior while giving WebGPU its own supported implementation.
4. Fix output-transform ordering so bloom/AA/tone-mapping interactions are intentional rather than accidental.
5. Support selective glow routing for emissive structures and world FX where full-scene bloom would be too noisy.
6. Extend diagnostics and tests so unsupported, disabled, and degraded behavior remain explicit.

## 5. Non-Goals

- Recreating the WebGL `EffectComposer` stack 1:1 inside WebGPU.
- Shipping WebGPU as the default renderer in this PRD.
- Solving PMREM / environment parity here.
- Rewriting all emissive assets or material authoring.
- Making every optional effect a release blocker for the first pass.

## 6. Recommended Decisions Up Front

1. Keep `legacy-webgl` as the shipping lane until this PRD is complete and smoke-validated.
2. Treat output transform ordering, tone mapping / exposure parity, and a real bloom path as required deliverables for
   this PRD.
3. Treat vignette and chromatic aberration as optional follow-on parity once bloom is stable.
4. Prefer selective bloom routing over full-scene threshold bloom whenever practical, because worldmap readability is
   more important than maximum glow.
5. Keep capability truth strict: a feature stays unsupported until the backend really implements it.
6. Prefer official Three.js WebGPU primitives over extending the old WebGL composer abstraction.

## 7. Product Requirements

### R1. The effect policy must remain backend-neutral

The existing effect-plan seam must stay the single source of truth.

Acceptance:

- `game-renderer-policy.ts` continues to produce one effect plan,
- `GameRenderer` does not branch on concrete bloom/node/composer classes,
- and both backends translate the same policy object into runtime behavior.

### R2. The WebGPU backend must own a real postprocessing graph

The WebGPU backend must no longer be "tone mapping only".

Acceptance:

- native WebGPU can initialize and own a supported postprocessing graph,
- frame rendering routes through that graph when enabled,
- and capability reporting flips only for the features actually implemented.

### R3. Output transform ordering must be explicit and correct

The repo must stop relying on accidental ordering differences between renderer tone mapping and post effects.

Acceptance:

- the design defines where output transform and tone mapping live for the WebGPU graph,
- FXAA and bloom are composed around that decision intentionally,
- and tests lock the ordering contract.

### R4. Bloom must restore glow without washing the whole map

The primary user-facing goal is to restore the visual read of emissive structures and FX.

Acceptance:

- Essence Rift and similar emissive assets regain visible glow in native WebGPU,
- bloom intensity remains quality-gated,
- and tactical readability does not materially regress at medium/far zoom.

### R5. Selective glow routing must be supported or explicitly deferred

If whole-scene bloom proves too broad, the system must support selective bloom routing.

Acceptance:

- the PRD names the routing mechanism,
- target surfaces for glow participation are enumerated,
- and diagnostics/tests can tell whether selective bloom is active or still deferred.

### R6. Dynamic runtime controls and diagnostics must remain intact

Existing runtime policy updates for quality and postprocess tuning must not become write-only no-ops.

Acceptance:

- `applyPostProcessPlan()` still returns a usable controller for supported features,
- diagnostics snapshot the active effect plan and postprocess policy,
- and unsupported vs disabled-by-quality vs disabled-by-user remain distinguishable.

### R7. The rollout must be test-led

The delivery must land through narrow red/green slices, not one large backend rewrite.

Acceptance:

- every phase names failing tests first,
- scene smoke expectations are defined before the implementation claims parity,
- and rollout gates are updated with concrete evidence requirements.

## 8. Proposed Design

### 8.1 Add a shared postprocess runtime seam

Introduce one backend-owned runtime abstraction for executing the effect plan.

Recommended shape:

```ts
interface RendererPostProcessRuntime {
  dispose(): void;
  renderFrame(pipeline: RendererFramePipeline): void;
  setPlan(plan: RendererPostProcessPlan): RendererPostProcessController;
  setSize(width: number, height: number): void;
}
```

Rules:

- the runtime is backend-specific but policy-neutral,
- `RendererBackendV2` remains the public seam,
- each backend may internally own a runtime or bypass it when postprocessing is disabled,
- and `GameRenderer` continues to interact only through backend methods.

This avoids leaking WebGL composer classes or WebGPU node classes upward.

### 8.2 Keep the WebGL backend as the reference adapter

Do not rewrite the shipping path first.

Instead:

- extract the current WebGL composer setup into a `WebGLPostProcessRuntime`,
- preserve current behavior and tuning,
- and use it as the compatibility reference while the WebGPU runtime comes online.

This reduces regression risk and makes backend parity diffable.

### 8.3 Add a native WebGPU postprocess runtime

Create a dedicated WebGPU runtime adjacent to `webgpu-renderer-backend.ts`.

Recommended ownership:

- `webgpu-renderer-backend.ts` remains responsible for renderer creation and capability publication,
- a new runtime module owns node/postprocess graph construction,
- the backend lazily creates or rebuilds that runtime when the effect plan changes.

Implementation direction:

- use official Three.js `PostProcessing`, [S1]
- build the graph from official nodes rather than custom WebGL-era pass shims,
- use `RenderOutputNode` for final output transform placement, [S3]
- and add bloom through `BloomNode`, not a legacy effect pass. [S2]

### 8.4 Use a phased bloom strategy

Bloom should land in two steps so the team can restore glow quickly without locking in the wrong routing model.

#### Phase A. Whole-scene bloom parity

Goal:

- restore a visible glow path in WebGPU,
- prove output ordering,
- and let quality gating and diagnostics turn the feature on truthfully.

Constraints:

- threshold and intensity must be conservative,
- screenshot review must verify worldmap readability,
- and this phase is acceptable only if it does not blur terrain or movement feedback excessively.

#### Phase B. Selective bloom routing

Goal:

- limit bloom to intended emissive contributors,
- reduce map-wide haze,
- and restore the "glow where it matters" look.

Recommended selective targets for the first pass:

- Essence Rift / `FragmentMine` emissive structures,
- wonder / crystal accent materials,
- world-space reveal/reward FX that are intended to glow,
- fast-travel accent surfaces if their current look depends on emissive bloom.

Recommended implementation direction:

- follow the official selective-bloom example pattern built on the WebGPU postprocessing stack and MRT routing, [S4][S5]
- keep the routing mechanism scene-owned and explicit,
- avoid implicit "everything above emissive threshold blooms" as the long-term rule.

### 8.5 Preserve capability truth during the migration

Capabilities must move in lockstep with real implementation.

Expected transitions:

1. `supportsToneMappingControl` stays true only if the WebGPU runtime can honor the current policy knobs.
2. `supportsBloom` stays false until the WebGPU runtime really renders bloom.
3. `supportsColorGrade`, `supportsVignette`, and `supportsChromaticAberration` remain false until their node/runtime
   mapping exists.

Diagnostics must keep publishing:

- capability truth,
- active effect plan,
- active postprocess policy,
- and feature degradations.

### 8.6 Keep quality and rebuild behavior explicit

The runtime must define when the graph rebuilds versus when it just updates parameters.

Recommended rule set:

- toggling bloom on/off may rebuild the graph,
- resizing updates runtime size without policy recomputation,
- intensity/exposure updates prefer parameter mutation over full rebuild when supported,
- and destroy tears down runtime-owned resources independently of the renderer surface.

### 8.7 Add scene-owned glow participation tagging

Selective bloom requires explicit participation signals.

Recommended design:

- scene/manager code marks glow participants through a narrow helper or userData contract,
- the tagging model is renderer-agnostic,
- and the WebGPU runtime is the only layer that interprets those tags into selective bloom routing.

This prevents gameplay/managers from directly depending on WebGPU postprocess primitives.

## 9. Phase Plan

## Phase 0: Baseline Lock and Glow Repro Harness

Purpose:

- lock the current failing behavior before implementation starts,
- define the screenshot/scenario matrix that will prove parity.

Tests first:

- add failing tests that document current WebGPU postprocess capability truth,
- add failing tests for "bloom requested but unsupported" diagnostics,
- add a repro-oriented smoke checklist for Essence Rift/world FX glow.

Deliverables:

- baseline degradation matrix,
- glow-target inventory,
- named screenshot scenes and camera views.

Acceptance:

- the team can point to one baseline proving exactly what is missing today.

## Phase 1: Shared Postprocess Contract and Test Seam

Purpose:

- extract a backend-owned runtime seam before the WebGPU graph lands.

Implementation:

- add the postprocess runtime abstraction,
- adapt the WebGL backend to it first,
- keep `RendererBackendV2` public API stable.

Tests first:

- add failing tests for runtime ownership and disposal,
- add failing tests for resize propagation,
- add failing tests that the effect plan is still translated from one shared policy input.

Acceptance:

- the WebGL path still behaves the same,
- the codebase has a safe seam for the WebGPU runtime.

## Phase 2: Native WebGPU PostProcessing Graph Boot

Purpose:

- replace the current "tone mapping only" WebGPU path with a real node-based graph.

Implementation:

- add the WebGPU postprocess runtime,
- wire `RenderOutputNode`-based output transform,
- keep bloom disabled initially if needed while the graph boots cleanly.

Tests first:

- add failing tests for WebGPU runtime creation/disposal,
- add failing tests for frame rendering through the runtime,
- add failing tests for output transform / exposure routing.

Acceptance:

- native WebGPU renders through a supported postprocessing graph,
- tone mapping/exposure are no longer applied as the only postprocess behavior.

## Phase 3: Bloom Parity and Selective Glow Routing

Purpose:

- restore visible glow in WebGPU and constrain it to the intended surfaces.

Implementation:

- enable bloom support in the WebGPU runtime,
- land whole-scene bloom first if needed,
- add selective routing/tagging immediately after if whole-scene bloom is too broad.

Tests first:

- add failing tests for capability flip from unsupported to supported,
- add failing tests for plan-to-runtime bloom enablement,
- add failing tests for selective glow participant routing/tagging,
- add smoke expectations for Essence Rift and at least one FX surface.

Acceptance:

- bloom is visibly present in native WebGPU,
- diagnostics report it truthfully,
- and screenshot review confirms the result is not just "entire scene softened".

## Phase 4: Optional Grade / Vignette / Aberration Closure

Purpose:

- close the remaining optional postprocess gaps after core bloom parity is stable.

Implementation:

- add backend-safe mappings for color grade and vignette if the official node/runtime stack supports them cleanly,
- keep chromatic aberration optional and evidence-driven.

Tests first:

- add failing tests for supported feature toggles,
- add failing tests for controller mutation behavior,
- add failing tests ensuring unsupported optional effects remain explicitly degraded when not implemented.

Acceptance:

- optional features are either implemented truthfully or still reported as unsupported,
- no hidden no-op tuning path remains.

## Phase 5: Diagnostics, Smoke Matrix, and Rollout Gate Update

Purpose:

- turn the implementation into a decision-ready evidence packet.

Implementation:

- update renderer diagnostics and postprocess policy reporting,
- extend smoke checklist and rollout docs,
- classify remaining known degradations.

Tests first:

- add failing tests for diagnostics snapshot shape if new state is added,
- add failing checks for missing glow evidence in the rollout packet where feasible.

Acceptance:

- renderer diagnostics, smoke evidence, and rollout docs all tell the same story.

## 10. TDD Slice Plan

### Slice 1: Postprocess runtime seam

Files:

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- `client/apps/game/src/three/renderer-backend.ts`
- new runtime seam tests

Tests first:

- backend can own a postprocess runtime,
- resize/dispose propagate to the runtime,
- effect plan still flows through one policy translation path.

### Slice 2: WebGPU graph boot

Files:

- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- new WebGPU postprocess runtime module
- `client/apps/game/src/three/webgpu-renderer-backend.test.ts`

Tests first:

- runtime initializes after renderer init,
- frame rendering routes through the runtime,
- tone mapping / exposure are applied through the runtime graph.

### Slice 3: Bloom enablement

Files:

- WebGPU runtime module
- `client/apps/game/src/three/game-renderer-policy.ts`
- `client/apps/game/src/three/game-renderer.backend.test.ts`
- `client/apps/game/src/three/renderer-diagnostics.test.ts`

Tests first:

- bloom can become supported in native WebGPU,
- requested bloom no longer degrades as unsupported,
- diagnostics and effect plan stay aligned.

### Slice 4: Selective glow routing

Files:

- scene/manager tagging helpers
- structure or FX managers that register glow participants
- runtime tests and selected scene harness tests

Tests first:

- only tagged participants contribute to selective bloom,
- non-participants do not get accidental glow,
- destroy/unmount clears participation cleanly.

### Slice 5: Optional feature closure

Files:

- WebGPU runtime module
- `client/apps/game/src/three/game-renderer-policy.ts`
- targeted diagnostics/backend tests

Tests first:

- supported optional controls mutate runtime state,
- unsupported optional controls still report degradations cleanly.

## 11. Recommended File Plan

Expected primary touch points:

- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/renderer-backend.ts`
- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/game-renderer-policy.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/webgpu-postprocess-policy.ts`
- selected scene/manager files that opt assets into selective glow participation

Likely new files:

- `client/apps/game/src/three/webgpu-postprocess-runtime.ts`
- `client/apps/game/src/three/webgl-postprocess-runtime.ts`
- targeted tests for runtime ownership and selective glow routing

## 12. Risks

### 12.1 Full-scene bloom haze risk

If the first pass uses whole-scene bloom only, the map may become soft or foggy.

Mitigation:

- keep thresholds conservative,
- validate close/medium/far views,
- and escalate quickly to selective routing.

### 12.2 Output ordering drift risk

Incorrect placement of output transform/tone mapping around bloom and FXAA will create non-parity color and glow
behavior.

Mitigation:

- lock the ordering in tests,
- and use official `RenderOutputNode` semantics rather than ad hoc sequencing. [S3]

### 12.3 Capability false-positive risk

If capability flags flip before behavior is fully implemented, diagnostics become misleading again.

Mitigation:

- require tests and runtime evidence before each capability flip,
- keep unsupported reporting until the graph really renders the feature.

### 12.4 Tagging sprawl risk

Selective bloom can turn into a fragile set of per-manager hacks.

Mitigation:

- keep one narrow tagging contract,
- centralize interpretation in the runtime,
- avoid scene code depending on backend node details.

## 13. Definition of Done

This PRD is complete when:

1. native WebGPU owns a real postprocessing graph,
2. bloom is supported and visibly restores intended glow for emissive targets such as Essence Rift,
3. output transform ordering is explicit and tested,
4. diagnostics and rollout docs describe the active postprocess state truthfully,
5. and the legacy WebGL backend remains stable as the shipping reference lane.

## 14. Sources

- [S1] Three.js docs: `PostProcessing`
  https://threejs.org/docs/pages/PostProcessing.html
- [S2] Three.js docs: `BloomNode`
  https://threejs.org/docs/pages/BloomNode.html
- [S3] Three.js docs: `RenderOutputNode`
  https://threejs.org/docs/pages/RenderOutputNode.html
- [S4] Three.js example: WebGPU postprocessing bloom
  https://threejs.org/examples/webgpu_postprocessing_bloom.html
- [S5] Three.js example source: WebGPU postprocessing bloom
  https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_bloom.html
