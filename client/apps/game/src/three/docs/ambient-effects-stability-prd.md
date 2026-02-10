# PRD: Ambient Effects Coherence and Stability

## Overview

**Feature:** Ambient effects coherence and stability program for `client/apps/game/src/three`

**Status:** Draft v0.1

**Owner:** Three.js Team

**Created:** 2026-02-10

**Last Updated:** 2026-02-10

## Document Update Log

| Update | Date (AEDT)      | Author | Change |
| ------ | ---------------- | ------ | ------ |
| U1     | 2026-02-10 13:20 | Codex  | Created PRD with current-state analysis, prioritized issues, implementation phases, testing strategy, and rollout plan. |

## Problem Statement

The ambient stack in `client/apps/game/src/three` has solid building blocks (day/night, weather, wind, rain, ambience, and particles), but there are several integration defects that break intended transitions and reduce perceptual coherence:

- Weather departure can zero rain/storm effects immediately instead of fading out.
- Ambience weather control is driven by two paths that can fight each other frame-to-frame.
- Ambient particle weather fade is overwritten by per-frame updates.
- Random-interval ambience playback is only partially lifecycle-managed after initial source creation.
- Storm visuals in world lighting are cycle-driven while rain/audio/post-processing are weather-manager-driven.
- HUD teardown misses `RainEffect.dispose()` in current cleanup path.

These issues increase transition jitter, create audible/visual popping risk, and make tuning difficult because systems do not share a single authoritative weather timeline.

## Goals

### Primary Goals

- Make all ambient systems transition smoothly and deterministically across clear/rain/storm lifecycle phases.
- Establish one coherent weather authority consumed by visual, audio, and particle ambient systems.
- Eliminate per-frame state fights between ambience and weather modulation paths.
- Ensure all ambient subsystems have reliable lifecycle cleanup and no stale-source behavior.
- Add focused tests for weather/ambience transition correctness.

### Non-Goals

- Full lighting art-direction redesign.
- Broad post-processing redesign beyond weather cohesion changes.
- New ambient content/assets.
- Gameplay balance changes.

## Current System Understanding

### Runtime Topology

- `HexagonScene` manages directional/hemisphere/ambient lighting, fog, and storm lightning visuals.
- `HUDScene` manages rain particles, weather simulation, ambience audio, and ambient particles.
- `GameRenderer` applies weather-modulated post-processing by reading state from `HUDScene` weather manager.

### Update Order (Current)

1. Main scene update runs (`worldmapScene.update` or `hexceptionScene.update`).
2. Composer renders main scene.
3. `hudScene.update(deltaTime, cycleProgress)` runs:
   - `weatherManager.update(...)`
   - `ambienceManager.update(...)`
   - `ambienceManager.updateFromWeather(...)`
   - ambient particle updates
4. `game-renderer` applies `updateWeatherPostProcessing()` from weather state.
5. HUD scene renders.

### Key Integration Risks in Current Order

- Ambience weather state can be set by `update(...)` and then replaced by `updateFromWeather(...)` in same frame.
- Particle weather fade can be set before particle update, then overwritten in update methods.

## Prioritized Findings

### P0: Weather departure does not preserve source weather config for fade-out

- `WeatherManager.computeIntensities()` uses `weatherConfigs[this.targetType]`.
- During `transitionToWeather(CLEAR)` from PEAK, `targetType` becomes `CLEAR`, so departing uses clear config and forces rain/storm intensity to zero instead of fading from current weather.
- Evidence:
  - `client/apps/game/src/three/managers/weather-manager.ts:294`
  - `client/apps/game/src/three/managers/weather-manager.ts:337`
  - `client/apps/game/src/three/managers/weather-manager.ts:338`
  - `client/apps/game/src/three/managers/weather-manager.ts:384`

### P0: Ambience weather is controlled by conflicting update paths

- `HUDScene.update()` calls both:
  - `ambienceManager.update(this.cycleProgress, currentWeatherType, deltaTime)`
  - `ambienceManager.updateFromWeather(weatherIntensity, stormIntensity)`
- `update()` sets `currentWeather`; `updateFromWeather()` can immediately remap and trigger `updateSoundLayers()` again.
- This can cause rapid layer churn and unstable fades at thresholds.
- Evidence:
  - `client/apps/game/src/three/scenes/hud-scene.ts:154`
  - `client/apps/game/src/three/scenes/hud-scene.ts:157`
  - `client/apps/game/src/three/managers/ambience-manager.ts:203`
  - `client/apps/game/src/three/managers/ambience-manager.ts:535`

### P0: Ambient particle weather fade is overwritten during frame updates

- `setWeatherIntensity()` writes opacity with weather fade multiplier.
- `updateDust()` and `updateFireflies()` recalculate material opacity each frame without that weather multiplier.
- Result: weather fade does not reliably persist.
- Evidence:
  - `client/apps/game/src/three/systems/ambient-particle-system.ts:479`
  - `client/apps/game/src/three/systems/ambient-particle-system.ts:480`
  - `client/apps/game/src/three/systems/ambient-particle-system.ts:305`
  - `client/apps/game/src/three/systems/ambient-particle-system.ts:384`

### P1: Random-interval ambience plays are not fully lifecycle-managed

- Layer tracks one `source` in `activeSounds`.
- Later random interval plays are fire-and-forget and not added to layer ownership, so layer fade/stop logic does not own all currently playing transient sources.
- Evidence:
  - `client/apps/game/src/three/managers/ambience-manager.ts:304`
  - `client/apps/game/src/three/managers/ambience-manager.ts:395`
  - `client/apps/game/src/three/managers/ambience-manager.ts:414`
  - `client/apps/game/src/three/managers/ambience-manager.ts:344`

### P1: Weather authority split between cycle-based storm visuals and weather manager

- Lighting storm modulation is currently tied to cycle window in `HexagonScene` (`cycleProgress < 20`).
- Rain/audio/post-processing derive from `WeatherManager`.
- This can create inconsistent atmosphere where visual storm cues and precipitation/audio timing diverge.
- Evidence:
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:1025`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:1034`
  - `client/apps/game/src/three/scenes/hud-scene.ts:140`
  - `client/apps/game/src/three/game-renderer.ts:1142`

### P2: Rain effect teardown inconsistency in HUD destroy path

- `HUDScene.destroy()` checks for `rainEffect.destroy()` dynamically.
- `RainEffect` exposes `dispose()` but no `destroy()`.
- Weather manager dispose currently clears wind intervals only; rain cleanup should be explicit and deterministic at HUD scope.
- Evidence:
  - `client/apps/game/src/three/scenes/hud-scene.ts:204`
  - `client/apps/game/src/three/effects/rain-effect.ts:494`

## Requirements

### Functional Requirements

| ID   | Requirement | Priority |
| ---- | ----------- | -------- |
| FR-1 | Departing weather must fade rain and storm intensities from the previously active weather profile, not clear profile defaults. | P0 |
| FR-2 | Ambience weather activation and intensity modulation must be driven by one consistent weather input path per frame. | P0 |
| FR-3 | Ambient particle opacity must apply both time-of-day visibility and weather fade consistently every frame. | P0 |
| FR-4 | Random-interval ambience clips must be fully controllable by layer stop/fade/disable operations. | P1 |
| FR-5 | Main-scene storm modulation must consume weather-manager state (or a clearly defined adapter), not an unrelated cycle gate. | P1 |
| FR-6 | HUD teardown must fully dispose rain resources and detach scene objects deterministically. | P2 |

### Non-Functional Requirements

| ID    | Requirement | Priority |
| ----- | ----------- | -------- |
| NFR-1 | No audible pops/clicks introduced during ambience transitions. | P0 |
| NFR-2 | No per-frame source churn at weather threshold crossings. | P0 |
| NFR-3 | Ambient systems must remain allocation-light in update paths. | P1 |
| NFR-4 | All fixed bugs must be protected by targeted tests for transition correctness. | P0 |

## Proposed Solution

### 1) Weather Departure Source Tracking

- Add departure source tracking in `WeatherManager`:
  - `departingFromType: WeatherType | null`
- On transition from `PEAK -> DEPARTING`, capture the weather being departed.
- During `DEPARTING`, compute rain/storm fade against `departingFromType` config.
- Clear `departingFromType` when phase returns to `CLEAR`.

### 2) Single-Path Ambience Weather Update

- Consolidate ambience weather inputs so activation + modulation are evaluated once per frame from a single weather snapshot.
- Replace current dual-callback pattern with one method, e.g.:
  - `ambienceManager.update(cycleProgress, weatherState, deltaTime)`
- Keep threshold mapping (clear/rain/storm) internal to that method and avoid mutating weather state twice in same frame.

### 3) Persistent Weather Fade in AmbientParticleSystem

- Store `weatherFade` as internal scalar state (`0..1`).
- `setWeatherIntensity()` updates only this scalar.
- `updateDust()` and `updateFireflies()` compute final opacity as:
  - `timeOfDayOpacity * params.opacity * weatherFade`
- Ensure no direct material opacity writes bypass this composition path.

### 4) Layer-Owned Random-Interval Source Management

- Extend active layer model to track currently playing transient random clips.
- On `stopSound`/`setEnabled(false)`/dispose:
  - stop all transient clips owned by that layer
  - clear pending schedule state
- Ensure volume updates apply to all active clips or only currently playing clip per explicit design (must be documented).

### 5) Weather Authority Unification for Storm Visuals

- `HexagonScene.updateStormEffects()` should consume weather state from shared weather authority.
- Replace hardcoded `cycleProgress < 20` storm gate with weather-driven intensity (`state.intensity`, `state.stormIntensity`, `state.fogDensity`, `state.skyDarkness`).
- Preserve existing art tuning multipliers but move timing source to weather manager.

### 6) Deterministic Rain Disposal in HUD

- In `HUDScene.destroy()`, call `this.rainEffect.dispose()` directly.
- Remove dynamic `destroy` probe for rain effect.

## Implementation Plan

### Phase 0: Baseline and Test Harness (1-2 days)

- Add unit tests for weather-phase intensity progression:
  - clear -> rain/storm -> clear departure behavior
- Add ambience state transition tests:
  - weather threshold crossing without activation churn
- Add particle opacity composition tests:
  - time-of-day + weather fade composition.

**Acceptance Criteria**

- Tests fail on current behavior for identified regressions.
- Baseline transition traces captured for before/after comparison.

### Phase 1: P0 Transition Correctness (2-3 days)

- Implement weather departure source tracking (FR-1).
- Unify ambience weather path (FR-2).
- Fix ambient particle opacity composition with persistent weather fade (FR-3).

**Acceptance Criteria**

- Rain/storm fade out smoothly during departure.
- No per-frame ambience weather oscillation around thresholds.
- Ambient particles visibly fade with weather and return correctly when weather clears.

### Phase 2: P1 Playback and Authority Cohesion (2-4 days)

- Implement random-interval lifecycle ownership for layer clips (FR-4).
- Switch storm visual modulation to weather-manager authority (FR-5).

**Acceptance Criteria**

- Stopping/disabling ambience reliably halts all layer-owned playback.
- Visual storm cues align with rain/audio/post-processing onset and departure.

### Phase 3: P2 Cleanup and Hardening (0.5-1 day)

- Fix HUD rain disposal path (FR-6).
- Run regression pass for scene teardown/re-entry behavior.

**Acceptance Criteria**

- No lingering rain drawables/sources after scene destroy.
- No console warnings from stale audio/scene objects on re-entry.

## Detailed Acceptance Criteria

### AC-1: Weather Departure Fade

- Given weather is `STORM` at `PEAK`, when transitioning to `CLEAR`:
  - `rainIntensity` and `stormIntensity` reduce continuously to zero through `DEPARTING`.
  - no one-frame drop to zero at departure start.

### AC-2: Ambience Stability

- For weather intensity hovering around thresholds:
  - layer start/stop events occur only on actual effective-weather transitions.
  - no repeated start-stop churn across consecutive frames with unchanged effective bucket.

### AC-3: Particle Fade Composition

- At fixed time-of-day visibility:
  - particle opacity scales linearly with weather intensity.
  - opacity value is stable across frames unless weather/time-of-day input changes.

### AC-4: Random Clip Ownership

- If ambience is disabled or layer is faded out while a random clip is playing:
  - the clip is stopped/faded according to policy.
  - no orphaned source continues playing after layer deactivation.

### AC-5: Cross-System Weather Coherence

- During automated weather transition scenario:
  - rain intensity, ambience weather layer, storm visual modulation, and post-processing modulation move in same temporal direction.

### AC-6: Teardown Correctness

- After `HUDScene.destroy()`:
  - rain geometry/material are disposed.
  - no rain scene object remains attached.

## Testing Strategy

### Unit Tests

- `weather-manager`:
  - departure behavior for rain/storm.
  - phase progression correctness with target changes.
- `ambience-manager`:
  - single-path weather evaluation.
  - start/stop behavior at thresholds.
  - random-interval lifecycle handling.
- `ambient-particle-system`:
  - opacity composition for time-of-day and weather fade.

### Integration / Scenario Tests

- Simulated 5-minute weather cycle:
  - verify coherence of weather state, rain enabled/intensity, ambience layer counts, and post-processing parameters.
- Scene destroy/recreate cycle:
  - assert no retained rain objects/sources.

### Manual QA

- Transition listening pass with headphones:
  - clear -> rain -> storm -> clear.
- Camera pan/zoom during weather transitions:
  - verify no obvious popping/jitter in particles or lighting.

## Rollout Plan

### Flags and Safe Deployment

- Add optional runtime flags for:
  - unified ambience weather path
  - weather-driven storm visuals
- Roll out to internal/dev first; then enable by default after QA signoff.

### Monitoring

- Dev metrics counters:
  - active ambience layers
  - random interval active clips
  - weather transition state changes
- Log warnings only for abnormal states (not expected transitions).

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
| ---- | ------ | ---------- | ---------- |
| Changing ambience update path alters perceived mix balance | Medium | Medium | Keep existing base volumes; only fix control flow first, then retune. |
| Weather-driven storm visuals reduce current dramatic timing | Medium | Medium | Preserve current multipliers and map them onto weather intensities. |
| Added clip ownership increases complexity | Medium | Medium | Keep layer model minimal and test stop/dispose thoroughly. |
| Regressions in audio lifecycle under muted/uninitialized states | Medium | Low | Keep `AudioManager.play()` null-safe behavior and guard all stop calls. |

## Scope

### In Scope

- `client/apps/game/src/three/managers/weather-manager.ts`
- `client/apps/game/src/three/managers/ambience-manager.ts`
- `client/apps/game/src/three/systems/ambient-particle-system.ts`
- `client/apps/game/src/three/scenes/hud-scene.ts`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/effects/rain-effect.ts`
- Targeted tests for these modules.

### Out of Scope

- Asset production/recording changes.
- Full lighting preset redesign.
- Global audio architecture rewrite.

## Open Questions

1. Should random-interval layers allow overlapping clips per layer or enforce at most one active clip?
2. Should ambience weather use hard thresholds (current behavior) or hysteresis to reduce boundary toggling?
3. Should storm visuals be fully disabled for specific scenes (comment in `worldmap.tsx` currently conflicts with implementation)?

## Implementation Status

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase 0 | Planned | Test harness and baseline trace capture. |
| Phase 1 | Planned | P0 fixes for weather departure, ambience path, particle fade composition. |
| Phase 2 | Planned | Random-interval ownership and weather authority unification. |
| Phase 3 | Planned | Teardown hardening and cleanup verification. |
