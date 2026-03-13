# Eternum S2 Legacy Backend Retirement Decision

Date: 2026-03-13
Scope: Phase 6 decision memo for the WebGPU client implementation PRD
Decision: Keep both backends longer
Status: Approved

## Options Considered

1. Keep both backends longer.
2. Ship only the WebGPU-oriented build and rely on `WebGPURenderer` fallback.
3. Defer retirement work entirely because parity or rollout quality is still unresolved.

## Decision

Choose option 1: keep both backends longer.

## Why This Decision Wins

- Phase 4 parity sign-off is now explicit, but it is still driven by automated coverage and structured checklists rather
  than a completed broad external device rollout.
- Phase 5 rollout gates now exist, including telemetry coverage and a query-param kill switch, but those gates are
  designed for controlled internal rollout, not immediate backend retirement.
- The legacy backend remains the cleanest operational fallback while WebGPU / fallback lane data is collected.
- Retaining the legacy path keeps regression recovery simple while the experimental lane accumulates telemetry across
  desktop, mobile, and fallback-only environments.

## Retirement Gate Evaluation

| Gate | Status | Notes |
| --- | --- | --- |
| All target scenes green | Passed | Covered by the Phase 4 parity sign-off artifact |
| Parity checklist approved | Passed | Scene matrix approved |
| Rollout telemetry acceptable | Not yet proven | Instrumentation exists, but broad production evidence is still pending |
| No unresolved blocker class tied to legacy backend availability | Not yet proven | Legacy remains the operational safety net |

## Operational Policy

- Keep `legacy-webgl` as the default shipping lane for now.
- Continue exposing `experimental-webgpu-auto` for controlled internal rollout.
- Use `experimental-webgpu-force-webgl` for parity and CI fallback validation.
- Preserve `?rendererMode=legacy-webgl` as the rollout kill switch.

## Exit Criteria For A Future Retirement Memo

- Internal rollout produces acceptable fallback and init-error rates.
- Scene parity remains stable across the QA matrix in the rollout-gates artifact.
- No material regressions or scene-specific blockers emerge from the WebGPU-oriented lane.
- The team has enough telemetry confidence to remove the separate legacy shipping lane without losing recovery options.
