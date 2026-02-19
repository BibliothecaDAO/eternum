# PRD: Worldmap Chunking Ambiguity and Consistency Hardening

## Overview

- Feature: Remove remaining ambiguous chunking behavior and consistency drift in `client/apps/game/src/three`.
- Status: In Validation (implementation complete; perf and CI validation pending)
- Owner: Three / Worldmap Team
- Created: 2026-02-18
- Last Updated: 2026-02-18

## Scope

In scope:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-policy.ts`
3. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
4. `client/apps/game/src/three/scenes/worldmap-chunk-bounds.ts`
5. `client/apps/game/src/three/constants/world-chunk-config.ts`
6. `client/apps/game/src/three/scenes/worldmap-perf-simulation.ts`
7. `client/apps/game/src/three/scenes/hexagon-scene.ts`
8. `client/apps/game/src/three/managers/army-manager.ts`
9. `client/apps/game/src/three/managers/structure-manager.ts`
10. `client/apps/game/src/three/managers/chest-manager.ts`
11. `client/apps/game/src/three/README.md`
12. Chunking-focused tests under `client/apps/game/src/three/scenes`, `client/apps/game/src/three/managers`, and
    `client/apps/game/src/three/utils`.

Out of scope:

1. New chunk geometry strategy.
2. Torii transport/API redesign.
3. Visual design or camera UX redesign.
4. Broad non-chunking lint cleanup.

## Findings (Patch Candidates)

### P0-1: Directional prefetch band is axis-ambiguous

Evidence:

1. Forward direction is computed by primary axis and sign in `client/apps/game/src/three/scenes/worldmap.tsx:2852`.
2. Prefetch target expansion always adds positive row depth in `client/apps/game/src/three/scenes/worldmap.tsx:2886`.
3. No dedicated tests found for directional prefetch geometry (no `prefetchDirectionalChunks`-targeted coverage in scene
   tests).

Risk:

1. Prefetch work can be off-axis (wasted fetches) and still miss actual motion direction.
2. Pop-in remains under fast pan despite extra prefetch load.

### P0-2: Chunk policy is partial while runtime still reads raw config

Evidence:

1. Policy includes only subset fields in `client/apps/game/src/three/scenes/worldmap-chunk-policy.ts:4`.
2. Runtime still reads `WORLD_CHUNK_CONFIG` directly for torii and prefetch behavior in:
   1. `client/apps/game/src/three/scenes/worldmap.tsx:223`
   2. `client/apps/game/src/three/scenes/worldmap.tsx:2780`
   3. `client/apps/game/src/three/scenes/worldmap.tsx:2803`
   4. `client/apps/game/src/three/scenes/worldmap.tsx:2861`
   5. `client/apps/game/src/three/scenes/worldmap.tsx:2884`

Risk:

1. Multiple config read paths create drift risk and weaken testability.
2. Hard to reason about effective chunk policy at runtime.

### P0-3: Cache budget is below pinned chunk floor

Evidence:

1. Pin radius `2` (`5x5` pinned neighborhood) in `client/apps/game/src/three/constants/world-chunk-config.ts:42`.
2. Hardcoded cache max `16` in `client/apps/game/src/three/scenes/worldmap.tsx:414`.
3. Runtime warning already acknowledges overflow pressure in `client/apps/game/src/three/scenes/worldmap.tsx:3675`.

Risk:

1. Cache eviction cannot converge under normal pinned set.
2. Increased churn and noisy runtime warnings during traversal.

### P1-1: Render-size mutation path can desync scene/managers/model capacity

Evidence:

1. Runtime GUI mutates scene render size in `client/apps/game/src/three/scenes/worldmap.tsx:523`.
2. Managers snapshot constructor-time render size/stride in:
   1. `client/apps/game/src/three/managers/army-manager.ts:202`
   2. `client/apps/game/src/three/managers/structure-manager.ts:255`
   3. `client/apps/game/src/three/managers/chest-manager.ts:71`
3. Biome instancing capacity is allocated once from initial size in
   `client/apps/game/src/three/scenes/hexagon-scene.ts:833`.

Risk:

1. Debug/perf mode can create scene/manager bounds mismatch.
2. Large runtime render-size increases can exceed initial instance budgets.

### P1-2: Visibility frame ownership is still split

Evidence:

1. Base scene owns per-frame visibility update in `client/apps/game/src/three/scenes/hexagon-scene.ts:908`.
2. Managers also call `beginFrame()` in:
   1. `client/apps/game/src/three/managers/army-manager.ts:1035`
   2. `client/apps/game/src/three/managers/structure-manager.ts:1060`
3. Prior performance PR recorded side-path removal intent in
   `client/apps/game/src/three/docs/three-performance-prd.md:23`.

Risk:

1. Frame IDs can advance multiple times in one render loop.
2. Cache reuse and visibility determinism degrade.

### P2-1: Documentation and inline comments are stale

Evidence:

1. README states render window `64x64` in `client/apps/game/src/three/README.md:69`, but config is `48x48` in
   `client/apps/game/src/three/constants/world-chunk-config.ts:38`.
2. README states `50ms` debounce in `client/apps/game/src/three/README.md:81`, runtime is `200ms` in
   `client/apps/game/src/three/scenes/worldmap.tsx:243`.
3. Inline comment says `3x3 grid` in `client/apps/game/src/three/scenes/worldmap.tsx:4138`, runtime pins `5x5` via
   policy.

Risk:

1. Onboarding and future changes are guided by incorrect assumptions.

### P2-2: Small dead/ambiguous surfaces remain

Evidence:

1. Unused helper in `client/apps/game/src/three/scenes/worldmap.tsx:2786`.
2. Non-exact token helper remains exported but unused in runtime
   (`client/apps/game/src/three/scenes/worldmap-chunk-transition.ts:152`).
3. Chunk key parsing in `client/apps/game/src/three/scenes/worldmap-chunk-bounds.ts:15` does not validate malformed
   keys.

Risk:

1. Refactor noise and confusion around intended invariants.
2. Malformed inputs can silently produce invalid keys/bounds.

## Goals

1. Make chunking behavior explicit, single-sourced, and testable.
2. Remove off-axis or inconsistent prefetch behavior.
3. Align cache policy with pinned neighborhood requirements.
4. Keep debug/perf controls from violating core chunking invariants.
5. Restore documentation fidelity for chunking decisions.

## Functional Requirements

| ID   | Requirement                                                                                      | Priority |
| ---- | ------------------------------------------------------------------------------------------------ | -------- |
| FR-1 | Directional prefetch target derivation is deterministic and axis-correct for all pan directions. | P0       |
| FR-2 | A single typed policy contract drives all runtime chunking/prefetch/torii constants.             | P0       |
| FR-3 | Matrix cache budget is guaranteed to be >= pinned neighborhood floor (plus defined slack).       | P0       |
| FR-4 | Render-size debug controls cannot desync scene and manager chunk visibility assumptions.         | P1       |
| FR-5 | Visibility frame advancement has one authoritative owner per render frame.                       | P1       |
| FR-6 | Chunking docs/comments reflect actual runtime constants and semantics.                           | P2       |
| FR-7 | Dead/ambiguous chunk helpers are removed or made explicit with input validation.                 | P2       |

## Non-Functional Requirements

| ID    | Requirement                                                                       | Priority |
| ----- | --------------------------------------------------------------------------------- | -------- |
| NFR-1 | No chunk-switch p95 latency regression > 10% baseline.                            | P0       |
| NFR-2 | No increase in tile fetch volume due to off-axis prefetching under same pan path. | P0       |
| NFR-3 | No persistent cache-pressure warnings during normal 5-minute traversal.           | P1       |
| NFR-4 | Chunking-focused tests run deterministically in CI.                               | P0       |

## TDD Plan

### M0: Baseline Harness and RED Tests

Objectives:

1. Add failing tests for unresolved ambiguity points before implementation changes.

RED test targets:

1. New scene policy tests for directional prefetch geometry (all axis/sign combinations).
2. New policy tests asserting all runtime chunk fields come from one policy contract.
3. New cache-budget test asserting pinned floor compatibility.
4. New tests covering malformed chunk key handling.

Exit:

1. All targeted ambiguity tests fail for intended reasons.

### M1: Policy Contract Unification (P0)

Implementation:

1. Expand `createWorldmapChunkPolicy` to include:
   1. torii super-area stride
   2. directional prefetch depth/side
   3. prefetch concurrency
   4. derived pinned chunk count and recommended cache floor
2. Replace direct raw-config reads in `worldmap.tsx` with policy reads.

GREEN gates:

1. `worldmap-chunk-policy.test.ts` expanded and passing.
2. No remaining direct `WORLD_CHUNK_CONFIG.*` reads in `worldmap.tsx` except policy bootstrap.

### M2: Directional Prefetch Correctness (P0)

Implementation:

1. Extract pure directional target derivation helper from `worldmap.tsx`.
2. Fix forward-band expansion to align with true movement axis and sign.

GREEN gates:

1. New axis/sign prefetch tests pass.
2. Existing prefetch queue tests remain green.

### M3: Cache Budget Alignment (P0)

Implementation:

1. Replace hardcoded `maxMatrixCacheSize = 16` with policy-derived minimum.
2. Keep explicit slack constant and test it.

GREEN gates:

1. Cache floor tests pass.
2. Warning path becomes exceptional, not expected under baseline pin settings.

### M4: Render-Size Safety Contract (P1)

Implementation options (choose one):

1. Preferred: make runtime render-size immutable for this branch and keep perf GUI read-only.
2. Alternative: implement synchronized resize path that updates scene/managers/model capacities together.

GREEN gates:

1. New tests verify no scene/manager chunk-bound divergence under allowed render-size changes.
2. No out-of-capacity instance writes during perf simulation path.

### M5: Visibility Ownership and Cleanup (P1/P2)

Implementation:

1. Remove manager-side `beginFrame()` calls and rely on scene-owned frame lifecycle.
2. Remove dead helpers and add strict chunk-key parse validation.
3. Update README and stale inline comments.

GREEN gates:

1. Visibility ownership tests pass.
2. Chunk bounds parser tests pass for malformed keys.
3. README values match runtime config.

## Test File Plan

Add/update:

1. `client/apps/game/src/three/scenes/worldmap-chunk-policy.test.ts`
2. `client/apps/game/src/three/scenes/worldmap-prefetch-queue.test.ts`
3. `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
4. `client/apps/game/src/three/scenes/worldmap-chunk-bounds.test.ts`
5. New: `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.test.ts`
6. New: `client/apps/game/src/three/scenes/worldmap-cache-budget-policy.test.ts`
7. New manager/scene visibility ownership test file (targeting `beginFrame` authority).

## Acceptance Criteria

1. P0 findings (directional prefetch, policy split, cache floor) are closed with failing-first tests.
2. No stale chunking constants remain in README/comments.
3. Debug/perf render-size path is either made safe or explicitly constrained.
4. Chunking behavior is policy-driven and free of raw config drift in runtime call sites.
5. All new chunking-focused tests pass in CI.

## Implementation Status (2026-02-18)

### Milestone Status

| Milestone | Status | Notes                                                                                                                               |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| M0        | Done   | RED tests were added and used to drive implementation on directional prefetch, policy shape, cache floor, and chunk key validation. |
| M1        | Done   | Policy expanded and adopted by runtime chunking call sites in worldmap scene.                                                       |
| M2        | Done   | Directional prefetch extracted to pure helper and aligned by axis/sign.                                                             |
| M3        | Done   | Matrix cache capacity now policy-derived (`pinned floor + slack`).                                                                  |
| M4        | Done   | Runtime render-size mutation removed; perf control is read-only fixed value.                                                        |
| M5        | Done   | Manager-side `beginFrame()` ownership split removed, cleanup and docs updates landed.                                               |

### Requirement Status

| ID    | Status                             | Evidence                                                                                                                                                                                                       |
| ----- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1  | Done                               | `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.ts`, `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.test.ts`                                                  |
| FR-2  | Done                               | `client/apps/game/src/three/scenes/worldmap-chunk-policy.ts`, `client/apps/game/src/three/scenes/worldmap.tsx`                                                                                                 |
| FR-3  | Done                               | `client/apps/game/src/three/scenes/worldmap-chunk-policy.ts`, `client/apps/game/src/three/scenes/worldmap.tsx`                                                                                                 |
| FR-4  | Done                               | `client/apps/game/src/three/scenes/worldmap-perf-simulation.ts`, `client/apps/game/src/three/scenes/worldmap-render-size-safety.test.ts`                                                                       |
| FR-5  | Done                               | `client/apps/game/src/three/scenes/hexagon-scene.ts`, `client/apps/game/src/three/scenes/worldmap-visibility-frame-ownership.test.ts`                                                                          |
| FR-6  | Done                               | `client/apps/game/src/three/README.md`, `client/apps/game/src/three/scenes/worldmap.tsx`                                                                                                                       |
| FR-7  | Done                               | `client/apps/game/src/three/scenes/worldmap-chunk-bounds.ts`, `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`, `client/apps/game/src/three/scenes/worldmap-directional-prefetch-policy.ts`    |
| NFR-1 | Pending validation (tooling ready) | p95 comparator implemented via `worldmap-chunk-latency-regression.ts` + `window.evaluateWorldmapChunkSwitchP95Regression(...)`; requires controlled baseline/current run data capture.                         |
| NFR-2 | Pending validation (tooling ready) | Fetch-volume comparator implemented via `worldmap-tile-fetch-volume-regression.ts` + `window.evaluateWorldmapTileFetchVolumeRegression(...)`; requires controlled identical-path baseline/current run capture. |
| NFR-3 | Pending validation                 | Requires 5-minute traversal soak verifying no persistent cache-pressure warning pattern.                                                                                                                       |
| NFR-4 | Pending CI run                     | Local deterministic test runs pass; CI pass still required for acceptance closure.                                                                                                                             |

### What Is Left

1. Run performance benchmark pass for `NFR-1` and record baseline vs current p95 chunk-switch latency.
2. Run fetch-volume comparison for `NFR-2` with identical camera movement script/path.
3. Run 5-minute traversal soak for `NFR-3` and confirm cache warnings are non-persistent.
4. Get CI green on chunking-focused tests for `NFR-4`.
5. After items 1-4, flip status from `In Validation` to `Complete`.

### NFR-1 Controlled Validation Runbook (Implemented)

1. In DEV worldmap session, run `window.resetWorldmapChunkDiagnostics?.()`.
2. Capture baseline anchor: `window.captureWorldmapChunkBaseline?.("nfr1-baseline-start")`.
3. Execute the fixed traversal script/path for the baseline branch build.
4. Capture baseline end: `window.captureWorldmapChunkBaseline?.("nfr1-baseline-end")`.
5. In the current build on the same traversal path/hardware, run the same sequence and then evaluate:
   1. `window.evaluateWorldmapChunkSwitchP95Regression?.("nfr1-baseline-end", 0.1)`
6. Mark `NFR-1` complete only when result status is `pass` and artifact the diagnostics snapshot.

### NFR-2 Controlled Validation Runbook (Implemented)

1. In DEV worldmap session, run `window.resetWorldmapChunkDiagnostics?.()`.
2. Capture baseline anchor: `window.captureWorldmapChunkBaseline?.("nfr2-baseline-start")`.
3. Execute the fixed camera traversal path used for comparison.
4. Capture baseline end: `window.captureWorldmapChunkBaseline?.("nfr2-baseline-end")`.
5. In the comparison run on identical traversal path/hardware, evaluate:
   1. `window.evaluateWorldmapTileFetchVolumeRegression?.("nfr2-baseline-end", 0)`
6. Mark `NFR-2` complete only when result status is `pass` (no fetch-volume increase) and artifact the diagnostics
   snapshot.
