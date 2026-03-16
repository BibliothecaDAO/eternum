# Eternum S2 Lighting, Weather, and WebGPU Ambiance PRD / TDD

Date: 2026-03-16
Status: In Progress
Scope: `client/apps/game/src/three` lighting and weather runtime, day/night modulation, world atmosphere, renderer capability truth, WebGPU parity, ambience scheduling, selected tests and smoke coverage

## Implementation Tracking

- [x] Phase 0: Baseline Lock and Harness Setup
- [x] Phase 1: Weather State Machine Correctness
- [x] Phase 2: Storm and Lightning Gating
- [x] Phase 3: Fog and Atmosphere Activation
- [ ] Phase 4: Lighting Rig Rebalance and Preset Contract
- [x] Phase 5: World-Space Weather FX Architecture
- [x] Phase 6: WebGPU Capability Truth and Fallback Lighting Parity
- [x] Phase 7: Ambience, Color, and Post-FX Parity
- [ ] Phase 8: Smoke Matrix, Rollout Gates, and Decision Packet

## 1. Objective

Make the lighting and weather stack visually coherent, architecturally truthful, and staged for WebGPU-era rendering without
pretending a renderer swap alone will create parity.

The desired end state is:

1. world lighting and weather behave correctly as systems, not as loosely coupled effects,
2. clear, rain, and storm states produce distinct ambiance and do not leak into each other,
3. weather visuals are rendered in a scene-appropriate layer instead of a HUD-only approximation,
4. the experimental WebGPU lane is explicit about what lighting and post-FX parity it does and does not provide,
5. future optimization work has a clear path toward GPU-driven atmosphere rather than more CPU-updated overlay effects.

## 2. Background

The current renderer work already established:

- backend extraction for legacy WebGL vs experimental `three/webgpu`,
- capability-aware degradation for several postprocessing and FX surfaces,
- WebGPU-safe billboard work for world-space gameplay FX,
- rollout documents that correctly keep native WebGPU as non-default.

That foundation is necessary, but the current ambiance stack still has concentrated debt:

- weather state correctness is fragile,
- storm lighting and lightning are not truthfully gated by weather,
- fog is effectively disabled by default,
- environment IBL remains WebGL-only,
- weather particles live in the HUD overlay instead of the world scene,
- current WebGPU parity does not cover the most atmosphere-defining surfaces.

## 3. Problem Statement

The current lighting and weather runtime is caught between three different models:

1. a world-scene lighting model driven by `HexagonScene` and `DayNightCycleManager`,
2. a HUD-overlay weather model driven by `HUDScene`, `RainEffect`, and `AmbientParticleSystem`,
3. a renderer capability model that currently treats environment and most weather-adjacent post-FX as unavailable in native WebGPU.

That split causes concrete problems:

1. weather state changes can enter invalid combinations,
2. storm drama leaks into clear weather,
3. fog-based atmosphere is mostly absent in production behavior,
4. HUD rain and particles cannot integrate with world depth or world lighting,
5. native WebGPU loses a large portion of the shipping ambiance because environment IBL and most grading parity are not implemented.

If left unresolved, the project risks shipping two different artistic directions:

- legacy WebGL with richer material response and more atmospheric shaping,
- experimental WebGPU with flatter fallback lighting and partial weather expression.

## 4. Confirmed Findings

### 4.1 Environment lighting parity is still WebGL-only

The legacy backend applies PMREM/HDR environment maps and the experimental backend does not.

Implication:

- material response and scene shaping differ materially across renderer lanes,
- the current fill-light rig is compensating for missing IBL rather than matching it.

### 4.2 Weather transition correctness is not fully implemented

The weather manager defines multi-phase transitions and peak timing, but the current clear/retarget logic can manufacture
invalid states and `peakMinDuration` is not actually enforced.

Implication:

- the stack cannot be trusted as the single source of truth for storm activation,
- visual and audio consumers may respond to states that are semantically wrong.

### 4.3 Storm effects are not truly weather-gated

Storm fill lighting, flicker, and lightning triggers are still driven by unconditional scene logic and cycle timing.

Implication:

- clear-weather readability is being contaminated by storm drama,
- lifecycle safety remains weaker than the renderer hardening standard already established elsewhere.

### 4.4 Fog atmosphere is effectively off by default

Fog exists, but it is behind a user/dev toggle and weather modulation does not actually change live fog range.

Implication:

- one of the cheapest atmosphere tools is not participating in the shipped look,
- weather intensity is overloading light color and post-FX to do work fog should help with.

### 4.5 Weather is implemented as overlay spectacle, not world atmosphere

Rain and ambient particles live in the HUD scene with a separate orthographic camera and separate lights.

Implication:

- weather does not depth-test against terrain, structures, or armies,
- the effect reads more like a screen-space layer than a world condition.

### 4.6 Native WebGPU currently exposes only partial atmosphere parity

Environment IBL is unavailable, native WebGPU postprocessing is intentionally minimal, and weather-specific parity is not
modeled as a first-class capability surface.

Implication:

- the project lacks an explicit contract for what “weather parity” means in WebGPU,
- rollout decisions remain at risk of mixing required ambiance parity with optional polish parity.

## 5. Goals

1. Fix weather-state correctness so the rest of the stack can trust one authoritative atmosphere snapshot.
2. Gate storm lighting and lightning strictly from actual weather state.
3. Make fog a real production atmosphere tool, not a dev-only toggle.
4. Rebalance lighting so environment, key, fill, and ambient roles are explicit and consistent.
5. Move weather rendering toward a world-space architecture compatible with WebGPU-safe materials.
6. Define truthful renderer capability reporting for atmosphere-related features.
7. Preserve legacy WebGL as the shipping lane until required ambiance parity is proven.
8. Build a TDD-first plan with pure-policy tests, runtime tests, and browser smoke gates.

## 6. Non-Goals

- Rewriting every scene material to TSL in one delivery.
- Implementing full volumetric clouds or physically based sky scattering in this PRD.
- Retiring the legacy WebGL path.
- Reworking unrelated gameplay systems, map rules, or terrain generation.
- Achieving pixel-perfect parity between legacy and WebGPU in the first pass.
- Migrating the mobile app in the same delivery.

## 7. Design Principles

### 7.1 One authoritative atmosphere snapshot

Lighting, fog, particles, audio ambience, and post-FX should all consume one shared weather/time snapshot.

### 7.2 World conditions belong to the world

Rain, fog, storm fill, and lightning should be world-space concerns. HUD-only rendering is acceptable only for intentionally
screen-space presentation, not for world atmosphere.

### 7.3 Required parity before cosmetic parity

Required:

- environment or explicit no-IBL fallback lighting,
- truthful tone mapping / output path,
- correct storm gating,
- readable atmosphere in world scenes.

Optional:

- exact bloom/vignette match,
- compute-driven particles in the first shipping slice,
- perfect visual match between legacy sprite-era and new weather FX.

### 7.4 Capability truth over hidden degradation

If WebGPU cannot support a surface yet, the capability contract and diagnostics must say so explicitly.

### 7.5 Prefer WebGPU-era extension points

When the project invests beyond stock materials, the default target should be the modern Three path:

- `three/webgpu`,
- TSL / Node materials,
- RenderPipeline-era postprocessing,
- GPU-driven simulation only where it materially helps scale or look.

## 8. Product Requirements

### R1. Weather state transitions must be semantically correct

The weather state machine must support:

- clear -> approaching -> arriving -> peak -> departing -> clear,
- retargeting during transition without entering invalid combinations,
- clearing from any phase without synthesizing a fake peak state,
- minimum peak duration enforcement where configured.

Acceptance:

- `currentType`, `targetType`, `phase`, and derived intensities stay consistent,
- `clearWeather()` from any non-clear phase never produces a transient “clear type with storm intensities” state,
- peak duration semantics are implemented or removed from the contract,
- tests lock all transition edges.

### R2. Storm lighting and lightning must be weather-gated and lifecycle-safe

Storm lighting, ambient flicker, point-light fill, and lightning sequencing must only run when the authoritative weather
snapshot says storm behavior is active.

Acceptance:

- clear weather does not pulse storm fill lights,
- rain without storm does not trigger lightning,
- delayed lightning triggers are cancellable on scene switch and destroy,
- scene teardown cannot resurrect storm visuals later.

### R3. Fog and weather atmosphere must be live in production

Fog must participate in the shipped lighting/weather look for supported graphics tiers.

Acceptance:

- fog is not gated only by dev GUI state,
- weather intensity can influence live fog range or equivalent depth shaping, not just fog color,
- close-view exceptions remain allowed where readability requires them,
- quality policy can reduce or disable fog intentionally, with diagnostics.

### R4. Lighting roles must be explicit and artistically stable

The lighting rig must clearly distinguish:

- key light,
- fill / hemisphere,
- ambient / mood,
- storm-only fill,
- environment response when available.

Acceptance:

- time-of-day presets are represented as data, not scattered overrides,
- no-IBL fallback lighting is documented as an explicit profile,
- world scenes do not rely on extreme ambient/fill values to compensate for missing renderer features,
- HUD overlay lights are not used as a crutch for world atmosphere.

### R5. Weather rendering must move to a world-space contract

Weather FX must no longer depend on HUD overlay ownership for their core behavior.

Acceptance:

- a `WorldWeatherFxBackend` or equivalent contract exists,
- world scenes can choose the correct backend based on renderer capabilities,
- rain and ambient atmospheric particles can render in a depth-aware world layer or an explicitly justified alternative layer,
- HUD-only rendering remains limited to intentionally screen-space visuals.

### R6. Renderer capability truth must include atmosphere surfaces

The renderer capability contract must distinguish:

- environment IBL availability,
- tone mapping control availability,
- color grading availability,
- optional post-FX availability,
- weather world-FX support,
- any temporary fallback-lighting mode.

Acceptance:

- `GameRenderer` does not infer atmosphere parity from unrelated feature flags,
- diagnostics can explain why a given atmosphere surface is degraded,
- tests fail if capability publication and runtime behavior diverge.

### R7. The first world-weather implementation must remain WebGPU-safe

The first parity-safe weather backend must avoid primitives already known to be risky in native WebGPU.

Acceptance:

- no WebGL-only material assumptions are introduced into the new weather path,
- first-pass implementation uses stock or already-approved WebGPU-safe surfaces,
- any future TSL or compute path is additive, not required for initial correctness.

### R8. Ambience and post-FX must consume the same atmosphere truth

Audio ambience and weather-driven color/post adjustments must consume the same snapshot as lighting and particles.

Acceptance:

- audio does not infer rain/storm independently from stale type values,
- post-FX modulation is capability-aware,
- no backend silently no-ops required weather shaping.

## 9. Recommended Decisions Up Front

1. Keep legacy WebGL as the shipping renderer for this workstream.
2. Treat environment / IBL parity or explicit fallback-lighting parity as a required gate for native WebGPU sign-off.
3. Treat bloom, vignette, and exact grade matching as optional parity.
4. Move rain out of the HUD overlay in the first functional implementation slice, not as a later polish task.
5. Make subtle fog opt-out by quality policy, not opt-in by dev GUI.
6. Keep the first weather FX path stock-material and capability-aware.
7. Treat compute-driven particles as a phase-two optimization path, not a blocker for correctness.

## 10. Proposed Design

### 10.1 Introduce a shared atmosphere snapshot

Add a single snapshot object that is produced once per frame and passed to all consumers:

```ts
interface AtmosphereSnapshot {
  cycleProgress: number;
  timeOfDay: "deep-night" | "dawn" | "day" | "dusk" | "evening";
  weatherType: "clear" | "rain" | "storm";
  weatherPhase: "clear" | "approaching" | "arriving" | "peak" | "departing";
  intensity: number;
  rainIntensity: number;
  stormIntensity: number;
  fogFactor: number;
  skyDarkness: number;
  sunOcclusion: number;
  windDirection: { x: number; y: number };
  windSpeed: number;
}
```

Consumers:

- day/night lighting,
- fog policy,
- storm fill and lightning policy,
- world weather FX backend,
- ambience manager,
- optional weather-driven post-FX controller.

### 10.2 Split weather correctness from effect rendering

The current `WeatherManager` mixes transition semantics, wind, and rain application.

Refactor target:

- weather state core owns phase transitions and derived atmosphere values,
- effect backends consume the snapshot,
- rain spawning and particles are not embedded in the weather state machine.

Recommended seam:

```ts
interface AtmosphereController {
  update(deltaTime: number): AtmosphereSnapshot;
  transitionToWeather(type: WeatherType): void;
  clearWeather(): void;
  getSnapshot(): AtmosphereSnapshot;
}
```

### 10.3 Replace implicit storm logic with explicit storm policy

Add a pure storm policy that decides:

- whether storm fill is active,
- whether lightning is allowed,
- whether lightning may be scheduled this frame,
- what intensity envelope applies.

Recommended seam:

```ts
interface StormVisualPolicyResult {
  allowStormFill: boolean;
  allowLightning: boolean;
  stormFillIntensity: number;
  ambientFlicker: number;
  hemisphereFlicker: number;
}
```

This removes storm behavior from cycle-position heuristics and makes it fully testable.

### 10.4 Introduce a lighting preset contract

Move all key/fill/ambient data into explicit presets that can be blended by time of day and weather.

Recommended shape:

```ts
interface LightingPreset {
  skyColor: number;
  fogColor: number;
  sunColor: number;
  ambientColor: number;
  groundColor: number;
  keyIntensity: number;
  hemisphereIntensity: number;
  ambientIntensity: number;
  stormFillIntensity: number;
  environmentIntensityWhenAvailable: number;
  noIblFallbackBias: number;
}
```

Rules:

- day/night owns the baseline preset blend,
- weather applies controlled modulation on top,
- no-IBL mode uses a documented fallback variant instead of silently inflating fill everywhere.

### 10.5 Add a world-weather FX backend seam

Introduce a backend contract similar to the world FX refactor:

```ts
interface WorldWeatherFxBackend {
  setSnapshot(snapshot: AtmosphereSnapshot): void;
  update(deltaTime: number, camera: Camera, sceneTarget: Vector3): void;
  resize?(width: number, height: number): void;
  destroy(): void;
}
```

Initial backend decisions:

- `legacy-webgl` and `webgl2-fallback`: stock world-space rain / particles with depth-aware placement,
- `webgpu`: same behavior through WebGPU-safe primitives and materials,
- no backend should depend on HUD-scene lighting ownership.

### 10.6 Keep the first world-weather path simple and portable

First pass:

- rain uses instanced or batched world-space geometry with stock materials,
- ambient particles use world-space points or billboard meshes in a dedicated atmosphere layer,
- effects follow the main scene camera and depth behavior.

Deferred optimization:

- GPU-simulated particles via TSL / storage-buffer / compute path,
- denser far-field rain,
- volumetric storm accents.

### 10.7 Extend capability truth for atmosphere

Add atmosphere-specific capability data adjacent to current renderer capabilities:

```ts
interface RendererAtmosphereCapabilities {
  supportsEnvironmentIbl: boolean;
  supportsToneMappingControl: boolean;
  supportsColorGrade: boolean;
  supportsWorldWeatherFx: boolean;
  supportsWeatherColorPostFx: boolean;
  fallbackLightingMode: "none" | "no-ibl-balanced-rig";
}
```

Rules:

- `supportsWorldWeatherFx` must reflect the actual weather rendering path,
- `fallbackLightingMode` must be set when native WebGPU lacks environment IBL but uses an intentional compensating rig,
- diagnostics must publish this surface.

### 10.8 Keep ambience scheduling on the shared snapshot

Audio should consume the same atmosphere truth as visuals.

Required changes:

- stop deriving storm/rain semantics from stale type-only state where intensity is the actual driver,
- use `AtmosphereSnapshot.weatherType` plus intensity thresholds from one source,
- preserve current audio manager integration.

## 11. TDD Delivery Plan

### Phase 0: Baseline Lock and Harness Setup

Scope:

- lock current lighting/weather behavior with snapshot tests and targeted unit harnesses,
- define pure-policy seams before changing runtime behavior,
- document required-vs-optional parity surfaces for atmosphere.

Tests first:

- add failing tests for current weather transition edge cases,
- add failing tests for storm policy under clear/rain/storm inputs,
- add failing tests for fog policy defaults by quality tier,
- add failing tests for renderer atmosphere capability publication.

Acceptance:

- baseline harnesses exist for state machine, storm policy, fog policy, and capability policy,
- implementation work can proceed without relying on ad hoc browser-only validation.

### Phase 1: Weather State Machine Correctness

Scope:

- harden `WeatherManager` or replace it with a pure core controller,
- implement clear/retarget semantics correctly,
- resolve `peakMinDuration` contract.

Tests first:

- clear during `APPROACHING`,
- clear during `ARRIVING`,
- retarget rain -> storm at peak,
- retarget storm -> rain while departing,
- minimum peak duration behavior.

Acceptance:

- no invalid “clear with storm intensities” state exists,
- all derived atmosphere values are consistent with semantic weather type and phase.

### Phase 2: Storm and Lightning Gating

Scope:

- extract storm visual policy,
- gate point-light fill and lightning from atmosphere truth,
- track and clean all delayed lightning timers.

Tests first:

- clear weather never enables storm fill,
- rain without storm never schedules lightning,
- destroy/switch-off cancels delayed lightning kickoff,
- worldmap override behavior is consistent with its intent.

Acceptance:

- storm drama appears only during actual storm conditions,
- no pending delayed timeout survives scene cleanup.

### Phase 3: Fog and Atmosphere Activation

Scope:

- replace fog GUI-only enablement with production policy,
- make weather affect live fog shaping,
- preserve close-view readability exceptions.

Tests first:

- medium/high quality enables subtle fog by default,
- close view disables or softens fog as designed,
- storm intensity changes fog range or equivalent depth shaping,
- low quality disables fog intentionally and reports degradation.

Acceptance:

- fog is part of the shipped ambiance on supported tiers,
- weather modulation affects more than fog tint.

### Phase 4: Lighting Rig Rebalance and Preset Contract

Scope:

- formalize blended lighting presets,
- reduce fill-heavy defaults,
- define explicit no-IBL fallback lighting data.

Tests first:

- preset blending yields stable monotonic ranges,
- weather modulation never drives fill above configured ceilings,
- no-IBL fallback profile differs intentionally from IBL profile,
- HUD light ownership is no longer required for world ambiance.

Acceptance:

- time-of-day and weather combine through data-driven presets,
- the rig stays readable without over-flattening forms.

### Phase 5: World-Space Weather FX Architecture

Scope:

- introduce `WorldWeatherFxBackend`,
- move rain and ambient atmospheric particles out of HUD ownership,
- keep backend selection capability-aware.

Tests first:

- world weather backend lifecycle test,
- backend selection test by renderer mode,
- render-path policy proving HUD overlay is no longer the default weather path,
- cleanup tests for scene switch and destroy.

Acceptance:

- weather FX render from a world-aware contract,
- backend selection is renderer-aware but gameplay code is not.

### Phase 6: WebGPU Capability Truth and Fallback Lighting Parity

Scope:

- extend capability contract for atmosphere,
- implement explicit fallback-lighting mode when IBL is unavailable,
- ensure diagnostics reflect real runtime behavior.

Tests first:

- native WebGPU publishes atmosphere capability truth,
- no-IBL fallback mode is recorded when used,
- environment application is skipped only when fallback policy is present,
- diagnostics snapshot includes atmosphere surfaces.

Acceptance:

- WebGPU atmosphere limitations are explicit,
- experimental lane no longer silently loses core ambiance surfaces.

### Phase 7: Ambience, Color, and Post-FX Parity

Scope:

- connect ambience manager to shared atmosphere snapshot,
- make weather-driven post-FX capability-aware,
- classify required vs optional atmosphere post-FX.

Tests first:

- ambience scheduling responds to shared snapshot state,
- unsupported backend paths do not silently no-op required weather shaping,
- optional post-FX degrade with explicit diagnostics.

Acceptance:

- audio and post-FX stay in sync with lighting/weather truth,
- native WebGPU parity claims are honest.

### Phase 8: Smoke Matrix, Rollout Gates, and Decision Packet

Scope:

- browser smoke matrix for clear/rain/storm across scenes,
- capture screenshots or diagnostics snapshots for legacy vs experimental lanes,
- produce rollout recommendation.

Required smoke lanes:

- legacy WebGL,
- experimental WebGPU auto,
- experimental WebGPU forced WebGL fallback.

Required scenarios:

- boot into worldmap clear weather,
- transition clear -> rain,
- transition rain -> storm,
- storm lightning sequence,
- resize,
- switch scenes,
- destroy / re-init,
- quality tier changes.

Acceptance:

- decision packet can say whether native WebGPU remains experimental or can advance,
- known degradations are listed explicitly.

## 12. File and Surface Impact

Primary runtime surfaces:

- `client/apps/game/src/three/managers/weather-manager.ts`
- `client/apps/game/src/three/effects/day-night-cycle.ts`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/hud-scene.ts`
- `client/apps/game/src/three/effects/rain-effect.ts`
- `client/apps/game/src/three/systems/ambient-particle-system.ts`
- `client/apps/game/src/three/managers/ambience-manager.ts`
- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/game-renderer-policy.ts`
- `client/apps/game/src/three/renderer-backend-v2.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/renderer-fx-capabilities.ts`

Recommended new seams:

- `client/apps/game/src/three/atmosphere/atmosphere-controller.ts`
- `client/apps/game/src/three/atmosphere/storm-visual-policy.ts`
- `client/apps/game/src/three/atmosphere/fog-policy.ts`
- `client/apps/game/src/three/atmosphere/lighting-presets.ts`
- `client/apps/game/src/three/atmosphere/world-weather-fx-backend.ts`
- `client/apps/game/src/three/atmosphere/renderer-atmosphere-capabilities.ts`

## 13. Test Plan

Unit / policy tests:

- `weather-manager.transition.test.ts`
- `storm-visual-policy.test.ts`
- `fog-policy.test.ts`
- `lighting-presets.test.ts`
- `renderer-atmosphere-capabilities.test.ts`
- `world-weather-fx-policy.test.ts`

Runtime / integration tests:

- `hexagon-scene.weather-lifecycle.test.ts`
- `game-renderer.atmosphere-parity.test.ts`
- `world-weather-fx-backend.test.ts`
- `ambience-manager.snapshot-routing.test.ts`

Smoke:

- reuse or extend the existing renderer smoke harness for scene boot/switch/resize,
- add weather-state scenarios and diagnostics capture.

## 14. Risks and Mitigations

### Risk 1: World-space weather adds too much render cost

Mitigation:

- ship a stock-material first pass,
- cap density by quality tier,
- defer compute-driven simulation to a later optimization slice.

### Risk 2: No-IBL fallback still looks materially flatter in WebGPU

Mitigation:

- treat this as a rollout gate, not a hidden compromise,
- capture side-by-side diagnostics and screenshots before promoting the lane.

### Risk 3: TDD stalls on giant scene coupling

Mitigation:

- extract pure policy seams first,
- keep scene tests focused on ownership and lifecycle, not giant snapshot structures.

### Risk 4: Ambience and post-FX remain semantically out of sync

Mitigation:

- centralize the snapshot contract before modifying consumers,
- prohibit independent weather interpretation in downstream systems.

## 15. Open Questions

1. Should the first world-weather backend live inside each scene, or should `GameRenderer` own one shared atmosphere layer?
2. Is fast-travel required for full weather parity in the first implementation, or can it consume only the snapshot and fallback lighting at first?
3. Should no-IBL fallback lighting be tuned once globally, or per scene profile?
4. Does the team want compute-driven particles in the same milestone if the stock-material first pass already meets performance and look targets?

## 16. Definition of Done

This PRD is complete when:

1. weather state transitions are correct and fully tested,
2. storm fill and lightning are weather-gated and teardown-safe,
3. fog participates in shipped atmosphere on supported tiers,
4. world weather is no longer fundamentally a HUD overlay trick,
5. atmosphere capability truth is explicit in diagnostics,
6. native WebGPU either has acceptable lighting/weather parity or an explicit documented reason it remains experimental,
7. rollout evidence exists for clear, rain, and storm scenarios across supported renderer lanes.

## 17. Primary Research Inputs

- Three.js WebGPURenderer manual: https://threejs.org/manual/en/webgpurenderer.html
- Three.js WebGPURenderer docs: https://threejs.org/docs/pages/WebGPURenderer.html
- Three.js PMREMGenerator docs: https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js Color Management manual: https://threejs.org/manual/en/color-management.html
- Three.js TSL docs: https://threejs.org/docs/TSL.html
- Three.js ColorEnvironment docs: https://threejs.org/docs/pages/ColorEnvironment.html
- web.dev WebGPU support update, 2025-11-25: https://web.dev/blog/webgpu-supported-major-browsers
