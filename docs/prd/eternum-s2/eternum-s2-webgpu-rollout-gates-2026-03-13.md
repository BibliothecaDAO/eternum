# Eternum S2 WebGPU Rollout Gates

Date: 2026-03-13
Scope: Phase 5 compatibility, telemetry, and ship gates for the experimental WebGPU-oriented renderer lane
Status: Approved for controlled internal rollout

## Kill Switch

- Query-param kill switch: `?rendererMode=legacy-webgl`
- Forced fallback lane for parity and CI: `?rendererMode=experimental-webgpu-force-webgl`
- Experimental lane: `?rendererMode=experimental-webgpu-auto`

The kill switch intentionally overrides experimental env configuration so QA and operators can force the client back to
the shipping legacy renderer without a new build.

## Telemetry Contract

The renderer diagnostics surface records:

- `activeMode`
- `buildMode`
- `requestedMode`
- `fallbackReason`
- `initTimeMs`
- `sceneName`
- `effectPlan`
- `fallbacks`
- `initErrors`

These fields are covered by:

- `client/apps/game/src/three/renderer-diagnostics.test.ts`
- `client/apps/game/src/three/renderer-backend-loader.test.ts`
- `client/apps/game/src/three/renderer-backend-v2.test.ts`

## Rollout Checklist

- Enable the experimental lane only for internal users first.
- Verify `activeMode`, `requestedMode`, and `fallbackReason` in renderer diagnostics during smoke sessions.
- Exercise both `experimental-webgpu-auto` and `experimental-webgpu-force-webgl`.
- Confirm the legacy kill switch returns the app to `legacy-webgl`.
- Confirm init failures fall back cleanly to legacy and increment fallback counters.
- Confirm scene parity sign-off remains green after rollout toggles.

## Browser / Device QA Matrix

| Platform | Expected lane | Required check |
| --- | --- | --- |
| Chrome desktop with WebGPU | `webgpu` | Boot, switch scenes, resize, destroy / re-init |
| Chrome desktop without WebGPU | `webgl2-fallback` or `legacy-webgl` | Forced experimental fallback lane and kill switch |
| Safari desktop | `legacy-webgl` or `webgl2-fallback` | No crash, diagnostics populated |
| Mobile Safari | `legacy-webgl` | Stable boot, no silent renderer failure |
| Android Chrome | `legacy-webgl` or `webgl2-fallback` | Diagnostics + scene parity spot check |
| CI / headless | `experimental-webgpu-force-webgl` | Deterministic fallback execution |

## Quality-Tier Evaluation

| Tier | Anti-aliasing | Bloom | Vignette / color grade | Expected usage |
| --- | --- | --- | --- | --- |
| High | FXAA | Enabled | Enabled | Desktop parity runs |
| Mid | FXAA or none | Enabled when stable | Enabled when stable | Internal fallback parity |
| Low / mobile | None by default | Disabled unless explicitly approved | Disabled unless explicitly approved | Stability-first path |

## Failure Dashboard Inputs

- count of `initErrors`
- count of `fallbacks`
- distribution of `activeMode`
- distribution of `fallbackReason`
- scene name at failure time
- requested lane vs resolved active lane

## Decision

Phase 5 is considered complete because:

- the kill switch is explicit and test-covered,
- the telemetry surface is already implemented and covered,
- the fallback-on-error path is already covered,
- and rollout / QA requirements are documented for controlled internal use.
