# PRD: Worldmap Zoom Visibility Hardening

## Overview

**Feature:** Stabilize worldmap terrain visibility during rapid zoom-out and zoom-in interactions.

**Status:** Draft v0.1

**Owner:** Three.js / Worldmap Team

**Created:** 2026-02-09

**Last Updated:** 2026-02-09

## Problem Statement

Players intermittently observe the worldmap hex terrain disappearing when they zoom out and then zoom back in. The map
usually recovers, but the disappearance window is highly visible and undermines trust in render correctness.

This is primarily a sequencing and state-coordination issue across:

- chunk switching lifecycle
- frustum/world-bounds culling
- debounced chunk refresh scheduling under high-frequency camera updates

## User Impact

### Primary Impact

- Brief full-map disappearance during normal camera interactions.
- Perceived instability in chunk visibility logic.
- Potentially broken interaction affordances when the terrain is hidden.

### Secondary Impact

- Increased support/debug burden due to low-repro intermittent behavior.
- Hard-to-diagnose regressions because current tests do not cover zoom/chunk integration races.

## Current-System Findings

### Finding 1: Chunk identity and bounds are committed before full transition settle

- `client/apps/game/src/three/scenes/worldmap.tsx:3629`
- `client/apps/game/src/three/scenes/worldmap.tsx:3630`

`performChunkSwitch` updates `currentChunk` and current chunk bounds early in the flow. If the rest of the switch path
has delay or failure, render/culling can temporarily operate on a partially committed state.

### Finding 2: Biome meshes are hard-frustum culled against current world bounds

- `client/apps/game/src/three/managers/instanced-biome.tsx:319`
- `client/apps/game/src/three/managers/instanced-biome.tsx:322`

Each biome mesh uses the active chunk world bounds for frustum culling. If bounds are moved before visual data is safely
ready, the active biome meshes can be culled out.

### Finding 3: Refresh scheduling is debounced and can lag trailing camera state

- `client/apps/game/src/three/scenes/worldmap.tsx:3530`
- `client/apps/game/src/three/scenes/worldmap.tsx:3539`
- `client/apps/game/src/three/game-renderer.ts:743`

Controls `change` events can arrive at high frequency during zoom. The current debounce model can delay or collapse
refresh work without a strict latest-state token, creating stale apply windows.

### Finding 4: Zero-instance mesh states can appear during transition windows

- `client/apps/game/src/three/scenes/worldmap.tsx:2944`

Biome meshes are explicitly set to count `0` when no matrices are available for that stage of grid finalization.
Combined with stale bounds/culling timing, this can present as complete terrain disappearance.

### Finding 5: Tests do not cover the high-risk integration path

Existing tests validate chunk transition helpers and queue utilities, but not rapid zoom and boundary switching
integration:

- `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
- `client/apps/game/src/three/scenes/worldmap-prefetch-queue.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-policy.test.ts`

## Goals

1. Eliminate transient full-terrain disappearance during rapid zoom interactions.
2. Make chunk switch and refresh sequencing deterministic under high camera event rates.
3. Ensure no destructive render-state commit occurs until target state is safely ready.
4. Add observability and tests for zoom + chunk boundary stress behavior.

## Non-Goals

- Full rewrite of worldmap rendering architecture.
- New rendering style, assets, or camera UX redesign.
- Torii transport replacement.
- Broad performance redesign unrelated to this failure mode.

## Functional Requirements

| ID   | Requirement                                                                                                       | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | Chunk switch must use explicit lifecycle phases: `prepare -> hydrate -> render -> commit -> cleanup`.             | P0       |
| FR-2 | `currentChunk` and active bounds must only commit at `commit` phase, after required hydrate/render preconditions. | P0       |
| FR-3 | Old and new chunk bounds must overlap during handoff; old bounds unregister only after successful commit.         | P0       |
| FR-4 | Refresh scheduler must guarantee trailing latest camera state is eventually processed (latest-wins).              | P0       |
| FR-5 | Stale transition/update applies must be dropped deterministically using transition tokens.                        | P0       |
| FR-6 | Add a non-destructive self-heal path if visible terrain unexpectedly drops to zero during active worldmap view.   | P1       |
| FR-7 | Chunk refresh behavior under rapid zoom in/out must be covered by integration-level tests.                        | P1       |

## Non-Functional Requirements

| ID    | Requirement                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | No measurable FPS regression beyond +5% p95 frame time in worldmap camera-movement scenarios.            | P0       |
| NFR-2 | No chunk registration leaks after 20-minute traversal + zoom stress soak.                                | P0       |
| NFR-3 | Add structured telemetry for transition phase timings, dropped stale applies, and self-heal invocations. | P0       |
| NFR-4 | No meaningful increase in chunk-switch p95 latency beyond +10% baseline.                                 | P1       |

## Proposed Design

### 1) Transactional Chunk Switch Commit (P0)

Refactor `performChunkSwitch` into explicit phases:

1. `prepare`
2. `hydrate` (target + required prereqs)
3. `render` (grid ready)
4. `commit` (single atomic state swap)
5. `cleanup`

Commit-time state changes only:

- `this.currentChunk = chunkKey`
- `this.currentChunkBounds = bounds`
- manager chunk updates
- old chunk unregistration

Pre-commit, retain previous active chunk as render authority.

### 2) Bound Overlap Handoff (P0)

Maintain both old and candidate chunk bounds in visibility manager during transition:

- register candidate bounds in `prepare`
- keep previous bounds registered
- unregister old only after successful `commit`

This removes destructive culling gaps during handoff.

### 3) Latest-Wins Refresh Scheduler (P0)

Replace plain debounce-only semantics with tokenized trailing execution:

- increment `cameraRefreshToken` on controls change
- schedule refresh with that token
- only process when token equals latest token at execution time
- if a switch is in-flight, queue a single trailing refresh with latest token

Guarantee: final camera state after a zoom gesture is eventually reconciled.

### 4) Transition Token Strictness (P0)

Tighten transition acceptance to exact token match at apply points (where safe), not `>=` semantics.

Current helper (`shouldAcceptTransitionToken`) allows future token values. For worldmap chunk update applies,
exact-match guards improve ordering determinism and reduce accidental out-of-order apply acceptance.

### 5) Self-Heal Guardrail (P1)

Add a low-frequency invariant check in worldmap update loop:

- if scene is active and expected render window is non-empty
- and aggregate biome visible instance count is unexpectedly zero for N consecutive frames

then:

- log telemetry event
- force one-shot `updateVisibleChunks(true)`
- attempt cached matrix restore for active chunk before destructive recomputation

### 6) Observability (P0)

Add debug counters and structured logs:

- transition phase start/end timestamps
- refresh token superseded/dropped counts
- stale apply drops
- zero-terrain invariant breaches
- self-heal attempts/success/failure

## Technical Scope

### In Scope

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts` (if overlap tracking needs extensions)
- `client/apps/game/src/three/managers/instanced-biome.tsx` (only if lightweight visibility counters needed)
- `client/apps/game/src/three/scenes/*.test.ts` for new zoom/chunk integration tests

### Out of Scope

- shader/material pipeline redesign
- contract/indexer changes
- major camera UX changes

## Implementation Plan

### Phase 0: Baseline + Instrumentation (1-2 days)

- Add transition phase telemetry and refresh token telemetry.
- Add dev-only diagnostics for registered/visible chunks and biome visible counts.
- Record baseline p95 chunk switch and frame time.

### Phase 1: Core Correctness (2-4 days)

- Implement transactional commit sequencing in chunk switch.
- Implement old/new bound overlap handoff.
- Implement latest-wins refresh scheduler.
- Tighten transition token checks for manager applies.

### Phase 2: Guardrails + Testing (2-3 days)

- Add zero-terrain self-heal guard.
- Add integration tests for rapid zoom in/out near boundary.
- Add stress simulation script/harness for repeated zoom gestures.

### Phase 3: Rollout (1-2 days)

- Ship behind feature flag (e.g. `VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING`).
- Canary to internal/dev first.
- Monitor telemetry and performance.
- Gradual full enable.

### Phase 3 Implementation Snapshot (2026-02-09)

- Added `VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING` (default `true`) to gate zoom hardening runtime paths.
- Added `VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY` (default `false`) for structured console telemetry while
  canarying.
- Worldmap refresh path now supports:
  - legacy debounce mode when hardening is disabled
  - tokenized latest-wins mode when hardening is enabled
- Zero-terrain self-heal monitor is active only when hardening is enabled.
- Added unit tests for rollout-toggle resolution:
  - `client/apps/game/src/three/scenes/worldmap-zoom-hardening.test.ts`

## Test Plan

### Unit Tests

1. Refresh token supersession logic (latest-wins).
2. Transition phase guard logic (no pre-commit state mutation).
3. Exact token acceptance for manager update applies.

### Integration Tests

1. Rapid zoom out/in while stationary near chunk boundary.
2. Rapid zoom + pan + boundary crossing while fetch delay is injected.
3. Failed hydrate during zoom gesture must preserve old visual state.
4. Self-heal triggers only on sustained zero-terrain anomaly, not transient single-frame changes.

### Soak/Stress

1. 10-minute scripted random zoom/pan traversal.
2. 20-minute traversal leak check for registered chunk bounds and cache growth.
3. p95 frame time and chunk-switch latency comparison versus baseline.

## Success Metrics

| Metric                                                      | Target                            |
| ----------------------------------------------------------- | --------------------------------- |
| Terrain disappearance incidents during scripted zoom stress | 0                                 |
| Stale apply commits in telemetry                            | 0                                 |
| Self-heal activations in normal play                        | 0 (or near-0 after stabilization) |
| Chunk-switch p95 regression                                 | <= +10% from baseline             |
| Worldmap frame-time p95 regression                          | <= +5% from baseline              |
| Registered chunk/bounds leak over 20-minute soak            | None                              |

## Risks and Mitigations

| Risk                                                     | Impact | Mitigation                                                                 |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Added chunk-switch complexity introduces new regressions | Medium | Keep phase model explicit; add assertions and high-signal telemetry.       |
| Overlap bounds window increases temporary cull workload  | Low    | Keep overlap short and bounded to transition lifetime only.                |
| Latest-wins refresh logic starves intermediate updates   | Low    | Intended behavior; guarantee final state reconcile and bounded queue size. |
| Self-heal hides root-cause bugs                          | Medium | Telemetry every trigger; keep as fallback, not primary correctness path.   |

## Open Questions

1. Should commit require target-area hydrate only, or also a minimum surrounding-area readiness threshold?
2. Do we want exact token matching globally, or only at selected apply points where strictness is required?
3. What should be the zero-terrain invariant threshold (`N` consecutive frames) to avoid false positives?

## Acceptance Criteria

1. No observable terrain disappearance during rapid zoom out/in in QA stress scenarios.
2. Chunk transition state changes occur only at commit phase for active chunk authority.
3. Refresh scheduler always reconciles the latest camera state after gesture completion.
4. New tests cover zoom/chunk integration path and pass in CI.
5. Performance remains within defined non-functional budgets.
