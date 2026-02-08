# PRD: Worldmap Chunking & Visibility Stability Program

## Overview

**Feature:** Stabilize worldmap chunk transitions, visibility updates, and entity hydration to eliminate transient unit/structure disappearance and ghosting.

**Status:** Draft v0.1

**Owner:** Three.js / Worldmap Team

**Created:** 2026-02-08

**Last Updated:** 2026-02-08

## Document Update Log

| Update | Date (UTC)       | Author | Change |
| ------ | ---------------- | ------ | ------ |
| U1     | 2026-02-08 00:00 | Codex  | Initial PRD with scope, requirements, rollout plan, and acceptance metrics. |

## Problem Statement

Players observe intermittent rendering instability during chunk movement:

- Units occasionally disappear for a short interval and then reappear.
- Visual continuity degrades around chunk boundaries, especially while camera movement and async data hydration overlap.

This is a reliability issue, not only a performance issue. The system currently allows partial render updates to occur when data is stale/incomplete and has race windows between chunk identity, pinned/fetched area state, and manager refreshes.

## Product Goal

Create deterministic, race-safe chunk transition behavior such that entities in the current render window remain visually stable across camera motion, chunk switches, and delayed Torii hydration.

## Non-Goals

- Rewrite worldmap architecture from scratch.
- Replace Torii transport layer.
- Add new gameplay features or new visual FX unrelated to stability.
- Change rendering style, assets, or camera UX.

## User Impact

### Primary User Outcomes

- No transient disappearance of units/chests/structures during normal panning and crossing chunk boundaries.
- Stable interaction behavior (selection and hover) during chunk transitions.
- Reduced visual pop-in tied to async fetch timing.

### Secondary Outcomes

- Better confidence in game state correctness.
- Lower support/debug load due to fewer intermittent reproduction cases.

## Current-System Findings (High Confidence)

1. **Managers can refresh even when fetch for the target area failed**
   - `client/apps/game/src/three/scenes/worldmap.tsx:3459`
   - `client/apps/game/src/three/scenes/worldmap.tsx:3478`
   - `client/apps/game/src/three/scenes/worldmap.tsx:3131`
   
   `performChunkSwitch` catches fetch errors and still progresses to manager update, which can briefly render empty/incomplete subsets.

2. **`currentChunk` is advanced before target chunk hydration is complete**
   - `client/apps/game/src/three/scenes/worldmap.tsx:3452`
   - `client/apps/game/src/three/scenes/worldmap.tsx:3455`

   Old chunk visibility registration is removed immediately, while new chunk data may still be pending.

3. **Pinned-area cleanup can invalidate pending dedupe state without canceling in-flight work**
   - `client/apps/game/src/three/scenes/worldmap.tsx:2941`

   `pendingChunks` entries are dropped when areas unpin, allowing duplicate fetches and racey refresh sequencing during rapid camera movement.

4. **Spatial index overlap can double-process moving entities (partially addressed)**
   - `client/apps/game/src/three/managers/army-manager.ts:1173`

   Moving entities can exist in source+destination buckets; without dedupe, ordering/visibility jitter can occur.

## Scope

### In Scope

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/chest-manager.ts`
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
- `client/apps/game/src/three/docs/*` (documentation + rollout playbook)

### Out of Scope

- Contract/indexer schema changes.
- New map chunk geometry strategy.
- Full replacement of manager APIs.

## Requirements

### Functional Requirements

| ID   | Requirement | Priority |
| ---- | ----------- | -------- |
| FR-1 | A failed chunk-area fetch must not trigger destructive visibility/manager state transitions for the active chunk. | P0 |
| FR-2 | Chunk switch must follow deterministic lifecycle states (`prepare -> hydrate -> commit -> cleanup`) with explicit guards. | P0 |
| FR-3 | Manager update calls for chunk `K` must be ignored if `K` is no longer current at apply time. | P0 |
| FR-4 | Pending-fetch dedupe must remain valid while work is in flight, even if pinned state changes. | P0 |
| FR-5 | Moving armies crossing boundaries must remain visible if source or destination is in bounds. | P0 |
| FR-6 | Selection/interaction must not break during transition windows. | P1 |
| FR-7 | Deferred removals (chunk-transition suppression) must flush deterministically after chunk settle. | P1 |

### Non-Functional Requirements

| ID    | Requirement | Priority |
| ----- | ----------- | -------- |
| NFR-1 | No measurable increase in chunk-switch p95 latency. | P0 |
| NFR-2 | No net growth in registered chunks/pinned areas over long traversal (20 min soak). | P0 |
| NFR-3 | Add debug-grade telemetry for chunk lifecycle and dropped/stale updates. | P0 |
| NFR-4 | Maintain current FPS envelope (no >5% regression in p95 frame time). | P1 |

## Success Metrics

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| Unit disappearance incidents during scripted boundary traversal | 0 | Automated scenario + event counters |
| Chunk-switch consistency errors (`stale apply`, `out-of-order transition`) | 0 in happy path, explicit counted in stress path | Structured debug logs |
| Chunk switch p95 (`start -> managers-settled`) | <= current baseline + 5% | Perf trace |
| Duplicate fetches for same area during rapid pan test | <= 1 active fetch per area | Fetch registry telemetry |
| Deferred-removal spillover after transition | 0 pending after settle | Internal queue gauges |

## Proposed Design

### 1. Chunk Transition State Machine (P0)

Introduce explicit transition tokens:

- `transitionId` increments per requested chunk switch.
- Async branches (fetch, grid update, manager updates) carry token.
- Apply step validates token + `currentChunkCandidate` before mutating visible state.

State model:

1. `prepare`: compute target chunk/area and register transition token.
2. `hydrate`: fetch target area + warm surrounding area.
3. `commit`: set `currentChunk`, update bounds, refresh managers.
4. `cleanup`: unpin old areas, retry deferred removals, publish settled event.

### 2. Fetch Outcome Gating (P0)

- Convert fetch result to explicit status object (`success`, `retryableFailure`, `stale`).
- If core fetch for target chunk fails, do not commit destructive manager refresh for that transition.
- Keep old chunk visible until successful hydration/commit path.

### 3. Pending-Fetch Registry Hardening (P0)

- Separate data structures for:
  - `inFlightFetches` (authoritative dedupe map)
  - `pinnedAreas` (render relevance)
  - `cacheRetention` (eviction policy)
- Unpinning an area must not delete the in-flight dedupe entry; only completion/error handlers can retire it.

### 4. Manager Apply Guards (P0)

For army/structure/chest manager update entrypoints:

- Pass transition token and target chunk.
- Before commit/apply, verify token/chunk still valid.
- Ignore stale apply without mutating counts/maps.

### 5. Visibility Registration Ordering (P1)

- Delay `unregisterChunk(oldChunk)` until `commit` succeeds for the new chunk.
- Keep overlap window where both old and new bounds are valid during controlled handoff.

### 6. Deferred Removal Determinism (P1)

- `deferredChunkRemovals` flush only on `transition settled` event.
- Add max-age safety and strict reconciliation once settled.

## Implementation Plan

### Phase 0: Instrumentation & Baseline (1-2 days)

- Add transition/fetch/apply counters and structured logs in dev mode.
- Add scripted camera traversal benchmark.
- Capture baseline metrics.

### Phase 1: P0 Correctness Path (3-5 days)

- Transition token + state machine in worldmap switch path.
- Fetch outcome gating for commit path.
- Harden pending-fetch registry semantics.
- Manager apply guards for stale updates.

### Phase 2: P1 Stability Improvements (2-3 days)

- Visibility unregister ordering improvements.
- Deferred-removal deterministic settle handling.
- Additional guardrails around interaction during transitions.

### Phase 3: Validation & Rollout (1-2 days)

- Soak tests (rapid pan, jitter camera, chunk edge loops).
- Perf comparison vs baseline.
- Rollout behind feature flag with quick rollback.

## Technical Deliverables

- Chunk lifecycle utility/types in worldmap scene.
- Updated manager signatures for guarded update applies.
- Fetch registry refactor (`inFlight`, `pinned`, `cached` separation).
- Added tests for:
  - stale transition ignore
  - failed-fetch no-destructive-commit
  - dedupe persistence across unpin
  - moving-entity boundary visibility

## QA Plan

### Test Matrix

1. Slow pan across single chunk boundary (desktop + medium zoom).
2. Fast continuous pan across multiple chunk boundaries.
3. Forced fetch failure/retry simulation.
4. Active army movement crossing boundary while transition in progress.
5. Interaction checks: select army before/during/after chunk switch.

### Required Automated Tests

- Unit tests for transition token validity logic.
- Unit tests for fetch registry semantics.
- Regression tests for moving source/destination visibility.
- Integration test for worldmap chunk switch with mocked delayed fetch.

## Rollout Strategy

- Guard behind `VITE_PUBLIC_CHUNK_TRANSITION_V2`.
- Stage rollout:
  1. Dev only
  2. Internal QA sessions
  3. Canary cohort
  4. Full enable
- Rollback path: disable flag to return to current behavior.

## Risks & Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Added state complexity in chunk switch logic | Medium | Keep explicit state enum + transition token assertions in dev mode |
| Latency increase due to stricter gating | Medium | Parallelize safe stages; only gate destructive commit |
| Manager API churn | Low-Medium | Backward-compatible optional params for first pass |
| Hidden stale path remains | Medium | Add explicit stale counters and test hooks |

## Open Questions

1. Should commit require only target-area success, or target + minimum surrounding areas?
2. What retry budget is acceptable before surfacing user-facing loading hints?
3. Do we want a short cross-fade/overlap window between old/new chunk visuals, or strict hard swap?
4. Should stale manager apply events be logged always in dev, or sampled to avoid spam?

## Acceptance Criteria (Release Gate)

- No reproducible unit disappearance in scripted boundary scenarios.
- No stale manager apply mutating visible state.
- Fetch dedupe remains stable under rapid pin/unpin churn.
- p95 chunk switch time within target budget.
- Feature flag rollout passes canary without regression reports.
