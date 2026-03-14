# Eternum S2 WebGPU Rollout Packet

Date: 2026-03-14
Status: Decision Ready
Recommendation: No-go for shipping native WebGPU as the default lane. Keep legacy WebGL as shipping and keep WebGPU
internal or opt-in only until the required parity blockers are removed.

## Decision Summary

- Shipping lane: `legacy-webgl`
- Experimental lane: `experimental-webgpu-auto`
- Current blocker: `environmentIbl`
- Current advisories: `colorGrade`, `bloom`, `vignette`, `chromaticAberration`
- Readability policy: keep stock lines with medium/far opacity floors, do not claim wide-line support

## Why This Is A No-Go Today

Blocking parity evidence:

- `environmentIbl` is still unsupported in the experimental backend and now reports as an explicit degradation with a
  `scene key/fill fallback lighting policy` detail.
- Required parity gates treat `environmentIbl` and `toneMappingControl` as blockers. The current code passes tone
  mapping control but still fails environment IBL.

Advisory parity evidence:

- `colorGrade`, `bloom`, `vignette`, and `chromaticAberration` are intentionally classified as advisory for this
  closure pass.
- The runtime no longer masquerades those optional effects as active when the backend cannot implement them.

## Automated Evidence

Contract and policy checks:

```bash
pnpm --dir client/apps/game test:three:types
pnpm --dir client/apps/game exec vitest run \
  src/three/renderer-backend-v2.test.ts \
  src/three/renderer-diagnostics.test.ts \
  src/three/game-renderer-policy.test.ts \
  src/three/game-renderer.backend.test.ts \
  src/three/renderer-parity-gates.test.ts \
  src/three/scenes/path-readability-policy.test.ts \
  src/three/managers/path-renderer.test.ts \
  scripts/run-renderer-scene-smoke.test.mjs
```

Scene smoke command:

```bash
pnpm --dir client/apps/game smoke:renderer-scenes -- --renderer-mode experimental-webgpu-auto --scenes map,hex,travel
```

Expected smoke artifact fields:

- `scene`
- `rendererMode`
- `openedUrl`
- `canvasExists`
- `errors`
- `diagnostics`
- `parity.blocking`
- `parity.advisory`
- `ok`

## Smoke Matrix

| Browser target | Scene coverage | Status | Notes |
| --- | --- | --- | --- |
| Chrome desktop | `map`, `hex`, `travel` | Pending live run | Primary desktop experimental target |
| Safari desktop | `map`, `hex`, `travel` | Pending live run | Required for Apple desktop confidence |
| Android Chrome | `map`, `hex`, `travel` | Pending live run | Required mobile experimental target |
| Firefox on Windows | `map`, `hex`, `travel` | Pending live run | Run if Firefox desktop remains in audience scope |

## Exit Criteria For Go

- `environmentIbl` no longer appears in `parity.blocking` for the experimental lane
- `toneMappingControl` remains absent from `parity.blocking`
- Smoke runs for `map`, `hex`, and `travel` complete without route, canvas, or init errors
- Diagnostics snapshots match observed backend mode and degradation state for each smoke scene

## Current Recommendation

Keep legacy WebGL as the shipping renderer. Continue WebGPU only as an explicit experimental lane until environment IBL
is either implemented natively or signed off as acceptable after live smoke review, which this packet does not yet
establish.
