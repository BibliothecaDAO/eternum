# Eternum S2 WebGPU Parity Closure PRD / TDD

Date: 2026-03-14
Status: Proposed
Scope: `client/apps/game/src/three` renderer backend parity, environment / IBL, postprocessing migration, line/path policy, diagnostics, rollout gates, selected tooling and tests

## Implementation Tracking

- [x] Phase 0: Baseline Lock and Capability Truth
- [ ] Phase 1: Tooling and Type-Skew Cleanup
- [ ] Phase 2: Backend Capability Contract and Diagnostics
- [ ] Phase 3: Environment / IBL Strategy and Runtime Parity
- [ ] Phase 4: Postprocessing Closure and Required-Vs-Optional FX Split
- [ ] Phase 5: Path / Line Readability Policy
- [ ] Phase 6: Rollout Gates, Smoke Matrix, and Decision Packet

## 1. Objective

Close the remaining gap between the current experimental `three/webgpu` lane and the shipping WebGL renderer path without
pretending all legacy visuals can or should be ported 1:1.

The desired end state is:

1. the experimental lane is architecturally truthful about what it supports,
2. required visuals keep gameplay readable,
3. unsupported legacy-only surfaces are either migrated to a WebGPU-era path or intentionally degraded,
4. rollout decisions can be made from explicit diagnostics and smoke evidence rather than inference.

## 2. Background

The repo already completed the first WebGPU migration stages:

- experimental build modes exist,
- `three/webgpu` aliasing exists,
- backend initialization and fallback selection exist,
- world-space FX already has a WebGPU-safe billboard path,
- several shader/material surfaces were already simplified or replaced.

Those changes were necessary, but they did not finish parity. The remaining issues are now concentrated around the
rendering stack itself, not project-wide architecture cleanup.

This PRD narrows scope to the unresolved issues identified by the latest WebGPU research and repo audit:

1. postprocessing parity,
2. environment / PMREM / image-based lighting parity,
3. truthfulness of backend capability reporting,
4. tactical path rendering constraints under WebGPU-safe materials,
5. Three.js tooling/version skew that makes future migration riskier than necessary.

## 3. Problem Statement

The current experimental lane is viable as an internal path, but it still has parity debt:

1. `client/apps/game/src/three/webgpu-renderer-backend.ts` can boot and render, but full environment and post-FX parity are not yet implemented.
2. `client/apps/game/src/three/game-renderer.ts` still conceptually assumes that environment and postprocess hooks exist even when the active backend cannot match the WebGL path.
3. `client/apps/game/src/three/renderer-backend.ts` still owns the old WebGL-specific `EffectComposer` and `PMREMGenerator` path, which means the most visually important parity surfaces remain trapped in the legacy backend.
4. Current stock line materials are portable, but their visual ceiling is low because line width remains effectively `1`.
5. `client/apps/game/package.json` currently pins `three` to `^0.182.0` while `@types/three` is `^0.163.0`, which is an unnecessary migration hazard around newer WebGPU APIs.

If left unresolved, the project ends up in an ambiguous middle state:

- WebGPU "works" but only with silent feature loss,
- parity claims become hard to trust,
- future rendering work keeps depending on WebGL-era assumptions,
- rollout decisions stay subjective.

## 4. Confirmed Findings

### 4.1 Platform support is strong enough for an experimental client lane

Current primary-source research indicates:

- WebGPU is available in Chrome desktop and Android, Safari 26, and Firefox 141 on Windows.
- Chrome 144 adds Linux support.
- Chrome 146 adds compatibility mode on Android devices limited to OpenGL ES 3.1.
- secure context remains a hard requirement.

Implication:

- the project no longer needs to treat WebGPU as purely theoretical,
- but rollout still needs browser-aware gating and smoke coverage.

### 4.2 Three.js is clear about the migration direction

Current Three.js docs state:

- `WebGPURenderer` is the supported path,
- `three/webgpu` is the supported import surface,
- `ShaderMaterial` and `onBeforeCompile` remain WebGL-only,
- TSL is the intended portable shading language,
- official postprocessing direction is shifting toward `RenderPipeline`,
- `PMREMGenerator` remains tied to `WebGLRenderer`.

Implication:

- trying to force the old WebGL postprocessing architecture through the experimental lane is the wrong strategy,
- the right strategy is explicit capability accounting plus staged migration of only the visuals that matter.

### 4.3 The repo already proved the value of staged degradation

The codebase already replaced or downgraded several risky surfaces:

- world FX falls back from sprite-based scene FX to billboard meshes,
- path rendering moved to stock line materials,
- hover visuals are texture-driven instead of a custom shader path.

Implication:

- the project does not need a perfection-first parity strategy,
- it needs a correctness-first and readability-first parity strategy.

### 4.4 The remaining blockers are not evenly important

Not all parity gaps deserve the same priority.

Must-have parity:

- scene boot and teardown stability,
- required environment / lighting support or an explicit fallback lighting policy,
- required tone mapping / exposure,
- readable selection and path visuals,
- explicit diagnostics about what is active and what is degraded.

Nice-to-have parity:

- bloom,
- vignette,
- chromatic aberration,
- exact look-matching of WebGL-only post-FX.

Implication:

- the implementation plan must split required parity from cosmetic parity up front.

## 5. Goals

1. Make backend capabilities explicit and testable.
2. Eliminate silent no-op behavior for environment and postprocess features.
3. Define a supported environment / IBL story for the experimental lane.
4. Move required postprocessing behavior onto a backend-safe path and classify optional effects clearly.
5. Preserve tactical readability for movement paths and selection feedback in WebGPU mode.
6. Remove preventable Three.js type/version skew before deeper migration work continues.
7. Produce a rollout packet with smoke evidence, known degradations, and decision criteria.

## 6. Non-Goals

- Rewriting all existing materials to TSL in one pass.
- Reproducing every WebGL post effect exactly.
- Retiring the legacy WebGL lane in this PRD.
- Reworking scene gameplay logic unrelated to renderer parity.
- Migrating `HexceptionScene` or `FastTravelScene` visuals beyond the parity surfaces named here.
- Introducing worker/offscreen rendering as part of this delivery.
- Changing gameplay pathfinding, movement cost, or world rules.

## 7. Product Requirements

### R1. Backend capability support must be explicit

The renderer backend contract must expose capability truth, not rely on call-site guesses or silent no-ops.

Required capability surfaces:

- `supportsEnvironmentIbl`
- `supportsToneMappingControl`
- `supportsColorGrade`
- `supportsBloom`
- `supportsVignette`
- `supportsChromaticAberration`
- `supportsWideLines` or an equivalent policy-level indicator

Acceptance:

- `GameRenderer` and related policies make decisions from explicit capability data.
- Diagnostics can tell the difference between "feature disabled by user/quality" and "feature unavailable on this backend".
- Tests fail if a backend claims support it does not actually implement.

### R2. Environment parity must be resolved, not deferred implicitly

The experimental lane must either:

1. support environment / IBL in a backend-safe way, or
2. apply an intentional fallback lighting policy and report the degradation.

Preferred decision:

- treat environment / IBL as required parity,
- do not ship native WebGPU mode if the scene lighting is materially flatter or darker than the legacy baseline.

Acceptance:

- a chosen environment strategy is documented and implemented,
- missing environment support is visible in diagnostics during development,
- worldmap, hexception, and fast-travel smoke runs confirm the chosen lighting path.

### R3. Postprocessing must be split into required and optional parity

Required parity:

- tone mapping mode selection where supported,
- tone mapping exposure,
- any effect needed for gameplay readability or scene legibility.

Optional parity:

- bloom,
- vignette,
- chromatic aberration,
- exact legacy grade stack.

Acceptance:

- the effect plan distinguishes required vs optional surfaces,
- unsupported optional effects do not block the experimental lane,
- unsupported required effects do block sign-off.

### R4. Path readability must be preserved under WebGPU-safe rendering

The tactical path system must remain readable in WebGPU mode even if stock line materials are retained.

Allowed outcomes:

1. accept 1px lines with adjusted opacity, contrast, outline pairing, or duplication policy, or
2. move to an alternative geometry/material path for thicker lines.

Acceptance:

- the project chooses one path explicitly,
- worldmap path visuals are checked in close, medium, and far camera views,
- the chosen path is backed by tests or policy snapshots.

### R5. Tooling and type skew must be cleaned up before deeper renderer work

The repo must stop carrying an avoidable version skew between `three` and `@types/three`.

Acceptance:

- the chosen resolution is implemented and documented,
- WebGPU-related imports and types compile cleanly under the repo-supported Node / TypeScript toolchain,
- the fix does not widen unrelated type debt silently.

### R6. Diagnostics must become rollout-grade

The debug/telemetry surface must expose:

- requested vs active backend mode,
- backend capabilities,
- feature degradations,
- fallback reason,
- init error count,
- current scene.

Acceptance:

- the debug snapshot can explain why a feature is missing,
- smoke reports can be evaluated without reading source code,
- rollout decisions use explicit evidence.

## 8. Recommended Decisions Up Front

1. Keep the legacy WebGL path as the shipping lane until this PRD is complete.
2. Treat environment / IBL and tone-mapping exposure as required parity.
3. Treat bloom, vignette, and chromatic aberration as optional parity for the first completion pass.
4. Keep stock line materials unless visual validation proves them insufficient.
5. Prefer capability exposure and intentional degradation over hidden partial support.
6. Prefer official Three.js WebGPU-era primitives over extending the old WebGL composer path.

## 9. Proposed Design

### 9.1 New backend capability contract

Add a backend capability descriptor adjacent to `RendererBackendV2`.

Recommended contract:

```ts
interface RendererBackendCapabilities {
  supportsEnvironmentIbl: boolean;
  supportsToneMappingControl: boolean;
  supportsColorGrade: boolean;
  supportsBloom: boolean;
  supportsVignette: boolean;
  supportsChromaticAberration: boolean;
  supportsWideLines: boolean;
}
```

Rules:

- capabilities describe backend reality, not desired effect plans,
- quality settings do not change the capability object,
- diagnostics publish capabilities alongside the current effect plan.

### 9.2 Environment / IBL strategy

Two valid implementation strategies exist:

#### Option A. WebGPU-native environment parity

Move environment handling to a WebGPU-era path:

- prefiltered environment asset pipeline, or
- TSL / `PMREMNode`-oriented environment path during a newer Three.js migration.

Pros:

- honest parity,
- future-proof,
- avoids keeping lighting quality tied to legacy WebGL internals.

Cons:

- more implementation work,
- likely depends on a tighter Three.js upgrade path.

#### Option B. Explicit experimental degradation with lighting compensation

Temporarily mark `supportsEnvironmentIbl = false` in native WebGPU mode and compensate with a documented lighting preset.

Pros:

- faster,
- lower technical risk.

Cons:

- visual mismatch remains,
- sign-off quality depends on how tolerant the team is to flatter lighting.

Recommended decision:

- start with Option B only if the team needs immediate experimental testing,
- plan Option A as the actual parity completion target.

### 9.3 Postprocessing closure strategy

Do not attempt to port the full legacy `EffectComposer` stack verbatim.

Instead:

1. keep tone-mapping / exposure as backend-supported controls,
2. classify optional effects explicitly,
3. migrate only required post-FX to a backend-safe implementation,
4. defer purely cosmetic parity until required parity is stable.

This keeps the migration aligned with current Three.js direction.

### 9.4 Path / line strategy

Short-term policy:

- preserve stock `LineBasicMaterial`,
- tune color, opacity, and contrast by camera view if needed,
- pair line readability with selection / endpoint emphasis where useful.

Escalation trigger:

- if manual validation shows the 1px policy is not readable in medium or far view, escalate to a thicker path geometry strategy.

### 9.5 Tooling resolution

Resolve `three` / `@types/three` skew before new capability or TSL work fans out.

Preferred order:

1. verify whether the repo still needs `@types/three`,
2. if needed, align versions,
3. if not needed, remove it and lock the repo to the package-shipped types from `three`.

## 10. Phase Plan

## Phase 0: Baseline Lock and Capability Truth

Scope:

- lock the current baseline,
- define the capability contract,
- prevent further hidden parity drift.

Deliverables:

- capability interface,
- diagnostics extensions,
- baseline smoke checklist,
- documented current-state degradation matrix.

Tests first:

- add failing tests for capability snapshot shape,
- add failing tests for diagnostics exposure,
- add failing tests that distinguish unsupported vs disabled effects.

Acceptance:

- capability truth exists as code, tests, and diagnostics.

## Phase 1: Tooling and Type-Skew Cleanup

Scope:

- resolve `three` / `@types/three` skew,
- verify repo-supported Node / TypeScript behavior for WebGPU-related test files.

Tests first:

- add a compile-oriented guard or selected type coverage around the backend surfaces,
- add a small test proving WebGPU-specific types import cleanly.

Acceptance:

- the repo no longer carries unexplained Three.js typing skew.

## Phase 2: Backend Capability Contract and Diagnostics

Scope:

- wire capability descriptors into the WebGL and experimental backends,
- expose them through diagnostics and any relevant policy helpers,
- remove ambiguous no-op assumptions from `game-renderer.ts`.

Tests first:

- add failing tests for backend capability publication,
- add failing tests for capability-aware call-site decisions,
- add failing tests for diagnostics snapshots that include capability data.

Acceptance:

- call sites no longer infer capability from backend mode alone,
- diagnostics explain degraded behavior directly.

## Phase 3: Environment / IBL Strategy and Runtime Parity

Scope:

- implement the chosen environment path or explicit fallback policy,
- make scene environment behavior consistent across target scenes.

Tests first:

- add failing tests for environment application routing,
- add failing tests for degraded-mode diagnostics if environment support is absent,
- add scene-level smoke expectations for worldmap, hexception, and fast-travel.

Acceptance:

- lighting behavior is intentionally correct, not accidentally reduced.

## Phase 4: Postprocessing Closure and Required-Vs-Optional FX Split

Scope:

- classify effect plan surfaces by importance,
- implement required parity,
- expose optional parity gaps without blocking the experimental lane.

Tests first:

- add failing tests for required effect routing,
- add failing tests for optional-effect degradation reporting,
- add failing tests for tone mapping / exposure parity behavior.

Acceptance:

- required post-FX parity is achieved,
- optional gaps are explicit and documented.

## Phase 5: Path / Line Readability Policy

Scope:

- validate whether stock lines are sufficient,
- tune or replace path visuals only if evidence demands it.

Tests first:

- add failing policy tests for path opacity/contrast by display state,
- add failing view-policy tests for medium/far readability assumptions,
- add smoke evidence requirements for close/medium/far path screenshots.

Acceptance:

- path visuals remain tactically legible in WebGPU mode.

## Phase 6: Rollout Gates, Smoke Matrix, and Decision Packet

Scope:

- combine diagnostics, smoke evidence, known degradations, and browser coverage into a go/no-go packet.

Deliverables:

- updated rollout checklist,
- smoke matrix results,
- known limitations list,
- recommendation on whether the experimental lane is ready for wider internal use.

Tests first:

- add failing tests or fixtures for smoke-report shape where feasible,
- add failing checks for missing capability evidence in rollout artifacts.

Acceptance:

- rollout decisions can be made from one evidence packet.

## 11. TDD Slice Plan

### Slice 1: Capability contract

Files:

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- new capability tests

Tests first:

- backend exposes capability object,
- diagnostics snapshot includes capabilities.

### Slice 2: Capability-aware runtime decisions

Files:

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- relevant backend/game-renderer tests

Tests first:

- runtime chooses behavior from capability truth,
- unsupported optional effects do not masquerade as active.

### Slice 3: Tooling cleanup

Files:

- `client/apps/game/package.json`
- any TS config or test harness updates required

Tests first:

- selected type/import coverage for WebGPU-related surfaces.

### Slice 4: Environment parity

Files:

- `client/apps/game/src/three/renderer-backend.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/game-renderer.ts`
- scene smoke evidence or harness utilities

Tests first:

- environment routing works or explicit degradation is reported.

### Slice 5: Required post-FX parity

Files:

- `client/apps/game/src/three/renderer-backend.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- postprocess policy/tests

Tests first:

- tone mapping/exposure parity,
- required-vs-optional effect classification.

### Slice 6: Path readability policy

Files:

- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/three/scenes/worldmap-movement-fx-policy.ts`
- related tests/smoke docs

Tests first:

- path readability policy locked before visual tuning.

### Slice 7: Rollout packet

Files:

- rollout docs,
- smoke runner docs/scripts if touched,
- diagnostics artifacts

Tests first:

- decision artifacts must include capability and degradation evidence.

## 12. Test Matrix

### 12.1 Unit and contract tests

- backend capability contract
- diagnostics snapshot shape
- effect-plan routing policy
- environment routing policy
- path readability policy

### 12.2 Backend integration tests

- experimental backend boot
- capability-aware quality application
- environment application or degradation reporting
- tone mapping / exposure behavior
- dispose / resize / render ownership

### 12.3 Scene smoke tests

- worldmap
- hexception
- fast-travel

Required checks:

- boot success,
- no renderer init fallback unless expected,
- expected scene visible,
- lighting and path readability acceptable,
- debug snapshot matches observed behavior.

### 12.4 Manual browser matrix

Minimum matrix:

- Chrome desktop
- Safari desktop
- one Android Chrome device
- Firefox on Windows if part of the target audience

Optional but recommended:

- Linux Chrome due newly supported status

## 13. Risks

### Risk 1: The team overcommits to full WebGL look-matching

Mitigation:

- lock required-vs-optional parity up front.

### Risk 2: Capability truth becomes inconsistent across code paths

Mitigation:

- centralize capability publication at the backend layer and test it directly.

### Risk 3: Environment parity becomes a hidden blocker late in rollout

Mitigation:

- make environment parity a named phase with scene smoke evidence, not an implied follow-up.

### Risk 4: Tooling skew causes false confidence

Mitigation:

- resolve `three` typing/tooling before deeper WebGPU API work.

### Risk 5: Path visuals are accepted without far-view validation

Mitigation:

- require close/medium/far evidence before sign-off.

## 14. Proposed File Targets

- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/renderer-backend-compat.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/renderer-backend.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/three/renderer-fx-capabilities.ts` if capability surfaces are consolidated there
- `client/apps/game/package.json`
- selected test files in `client/apps/game/src/three/*.test.ts`

## 15. Definition of Done

This PRD is complete when:

1. the experimental lane advertises capabilities truthfully,
2. environment parity is either implemented or explicitly degraded with sign-off,
3. required post-FX parity is in place,
4. path visuals remain readable in WebGPU mode,
5. Three.js tooling skew is resolved,
6. rollout evidence exists for the target browser matrix,
7. the team can explain every missing effect as either unsupported, intentionally deferred, or signed off.

## 16. Source References

- Chrome WebGPU overview: https://developer.chrome.com/docs/web-platform/webgpu/overview
- Chrome WebGPU from WebGL migration guide: https://developer.chrome.com/docs/web-platform/webgpu/from-webgl-to-webgpu
- Chrome WebGPU troubleshooting tips: https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
- Chrome 144 WebGPU updates: https://developer.chrome.com/blog/new-in-webgpu-144/
- Chrome 146 WebGPU updates: https://developer.chrome.com/blog/new-in-webgpu-146/
- Three.js WebGPU manual: https://threejs.org/manual/en/webgpu.html
- Three.js WebGPURenderer docs: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js TSL docs: https://threejs.org/docs/pages/TSL.html
- Three.js PostProcessing docs: https://threejs.org/docs/pages/PostProcessing.html
- Three.js PMREMGenerator docs: https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js LineBasicMaterial docs: https://threejs.org/docs/pages/LineBasicMaterial.html
- Three.js ShaderMaterial docs: https://threejs.org/docs/pages/ShaderMaterial.html
- WebKit Safari 26.2 WebGPU notes: https://webkit.org/blog/17606/webgpu-for-safari-26-2/
- GPUWeb implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
