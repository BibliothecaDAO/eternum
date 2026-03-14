# Eternum S2 WebGPU Parity Baseline

Date: 2026-03-14
Phase: 0
Status: Locked

## Purpose

This artifact locks the baseline capability truth and the initial smoke checklist before deeper parity work changes
environment, postprocessing, or path rendering behavior.

## Baseline Smoke Checklist

Run command:

```bash
pnpm --dir client/apps/game smoke:renderer-scenes
```

Record for each scene:

- Scene: `worldmap`
- Scene: `hexception`
- Scene: `fast-travel`
- Requested backend mode
- Active backend mode
- Fallback reason, if any
- Capability snapshot
- Degradation snapshot
- Boot success or failure
- Whether the scene rendered visibly
- Notes on lighting parity
- Notes on path readability

## Capability Matrix

### Shipping legacy WebGL backend

- `supportsEnvironmentIbl`: `true`
- `supportsToneMappingControl`: `true`
- `supportsColorGrade`: `true`
- `supportsBloom`: `true`
- `supportsVignette`: `true`
- `supportsChromaticAberration`: `true`
- `supportsWideLines`: `false`

### Experimental WebGPU backend

- `supportsEnvironmentIbl`: `false`
- `supportsToneMappingControl`: `true`
- `supportsColorGrade`: `false`
- `supportsBloom`: `false`
- `supportsVignette`: `false`
- `supportsChromaticAberration`: `false`
- `supportsWideLines`: `false`

## Current-State Degradation Matrix

### Required parity surfaces

| Surface | Legacy WebGL | Experimental WebGPU | Baseline status |
| --- | --- | --- | --- |
| Environment / IBL | Supported | Unsupported | Blocking parity gap |
| Tone mapping control | Supported | Supported | Accepted baseline |
| Tone mapping exposure | Supported | Supported | Accepted baseline |
| Path readability with stock lines | 1px line policy | 1px line policy | Needs validation in later phase |

### Optional parity surfaces

| Surface | Legacy WebGL | Experimental WebGPU | Baseline status |
| --- | --- | --- | --- |
| Color grade | Supported | Unsupported | Explicit degradation |
| Bloom | Supported | Unsupported | Explicit degradation |
| Vignette | Supported | Unsupported | Explicit degradation |
| Chromatic aberration | Supported | Unsupported | Explicit degradation |

## Notes

- This baseline is intentionally conservative. Capability truth reflects implemented behavior only.
- Later phases should update the degradation snapshot from runtime policy instead of editing this matrix by hand.
