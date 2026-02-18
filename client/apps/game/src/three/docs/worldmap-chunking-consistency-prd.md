# PRD: Worldmap Chunking Consistency and Test Coverage Hardening

## Overview

- Feature: Align worldmap chunking behavior with transactional intent and close critical test gaps.
- Status: In Progress v1
- Owner: Three / Worldmap Team
- Created: 2026-02-17
- Last Updated: 2026-02-18

## Document Update Log

| Update | Date (UTC)       | Author | Change |
| ------ | ---------------- | ------ | ------ |
| U1     | 2026-02-17 00:00 | Codex  | Initial detailed PRD with milestones, TDD slices, acceptance gates, and rollout plan. |
| U2     | 2026-02-17 00:00 | Codex  | M0 progress update: added deterministic async harness + chunk orchestration fixture seams, and replaced two regex-based scene tests with behavior coverage. |
| U3     | 2026-02-17 00:00 | Codex  | M0 progress update: extracted diagnostics baseline capture helper with tests and added pre-M1 runtime baseline runbook; live runtime snapshot capture remains pending. |
| U4     | 2026-02-17 23:10 | Codex  | M0 completion update: captured live pre-M1 runtime diagnostics and persisted `.context/worldmap-pre-m1-baseline.json` + `.context/worldmap-pre-m1-baseline.png`. |
| U5     | 2026-02-17 23:15 | Codex  | M1 completion update: added failing-then-green behavior tests for `performChunkSwitch` success/fetch-failure/stale suppression, and moved chunk authority write to commit phase in `worldmap.tsx`. |
| U6     | 2026-02-17 23:40 | Codex  | M2 completion update: added manager convergence behavior tests, aligned manager startup chunk authority to `null`, and enforced transition-token + target-chunk invariants across army/structure/chest manager updates. |
| U7     | 2026-02-17 23:55 | Codex  | M3 completion update: added failing-then-green scene bounds parity tests, extracted canonical scene chunk-bounds helpers, and refactored worldmap scene/transition bounds paths to reuse shared `getRenderBounds` semantics. |
| U8     | 2026-02-18 00:00 | Codex  | M4 completion update: added failing-then-green render-size robustness coverage for sizes `32/48/64/80/96` across overlap-neighbor derivation and cache invalidation overlap behavior, then refactored worldmap neighbor/cache invalidation derivation to stride-safe helpers in `worldmap-chunk-neighbors.ts`; targeted scene/manager suites green. |

## Executive Summary

Chunking helpers are well-covered, but core runtime orchestration in `worldmap.tsx` and manager integration paths still carry consistency risk with limited behavior-level tests.

This PRD defines a test-first hardening plan to:

1. Restore strict transactional chunk authority semantics.
2. Eliminate chunk-key/render-size drift across scene and managers.
3. Replace fragile source-shape tests with behavioral tests.
4. Add milestone gates that prevent regressions in chunk transition stability.

## Problem Statement

Current chunking behavior can diverge from intended transactional guarantees under pan/zoom and async hydration overlap, while high-risk paths lack direct runtime tests. This can reintroduce missing-entity, blank-terrain, or stale-visibility regressions without CI detection.

## Current Findings

### F1: `currentChunk` authority mutates before commit

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:4129`
2. `client/apps/game/src/three/scenes/worldmap.tsx:4213`

Risk:

1. Transitional state may be treated as committed state before all success guards pass.
2. Rollback paths become harder to reason about and verify.

### F2: Manager initial chunk state is inconsistent with scene initial state

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:224`
2. `client/apps/game/src/three/managers/army-manager.ts:108`
3. `client/apps/game/src/three/managers/chest-manager.ts:31`

Risk:

1. Managers can render against placeholder chunk defaults before scene authority is established.

### F3: Render-size mutability can desynchronize scene and manager assumptions

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:498`
2. `client/apps/game/src/three/scenes/worldmap.tsx:519`
3. `client/apps/game/src/three/scenes/worldmap.tsx:543`
4. `client/apps/game/src/three/scenes/worldmap-perf-simulation.ts:55`

Risk:

1. Non-default render sizes can create chunk/bounds divergence not covered by tests.

### F4: High-risk runtime paths lack direct behavior tests

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`
3. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
4. `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`

Risk:

1. Behavior seams now exist, but critical paths in `worldmap.tsx` are still not directly exercised through real scene orchestration integration.

## Goals

1. Enforce commit-phase-only chunk authority updates for chunk switches.
2. Ensure manager chunk state, bounds, and scene chunk state converge deterministically.
3. Guarantee consistent render-bounds semantics across helpers and scene logic.
4. Add behavior-level test coverage for chunk switch orchestration and edge races.

## Non-Goals

1. Full worldmap architecture rewrite.
2. Torii transport redesign.
3. Gameplay feature changes.
4. Shader or art pipeline changes.

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
3. `client/apps/game/src/three/scenes/worldmap-prefetch-queue.ts`
4. `client/apps/game/src/three/utils/chunk-geometry.ts`
5. `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
6. `client/apps/game/src/three/managers/army-manager.ts`
7. `client/apps/game/src/three/managers/structure-manager.ts`
8. `client/apps/game/src/three/managers/chest-manager.ts`
9. New and updated tests in `client/apps/game/src/three/scenes`, `client/apps/game/src/three/managers`, and `client/apps/game/src/three/utils`

### Out of Scope

1. On-chain/indexer schema changes.
2. Camera UX redesign.
3. New rendering feature work unrelated to chunking consistency.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| FR-1 | `currentChunk` authority changes only at successful commit boundaries. | P0 |
| FR-2 | Failed or stale transitions never leave scene/managers in partial committed chunk state. | P0 |
| FR-3 | Scene and manager initial chunk state must be consistent and explicit. | P0 |
| FR-4 | Shared render-bounds semantics must be canonicalized and reused. | P0 |
| FR-5 | Runtime chunk switch flow must be covered by behavior tests, not source-shape assertions. | P0 |
| FR-6 | Non-default render-size paths must preserve chunk/bounds correctness. | P1 |
| FR-7 | Visibility registration/unregistration ordering remains deterministic through rapid switches. | P1 |

### Non-Functional Requirements

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| NFR-1 | No chunk-switch p95 regression > 10% from baseline. | P0 |
| NFR-2 | No persistent registered-chunk or listener growth in stress runs. | P0 |
| NFR-3 | CI tests cover chunk transition orchestration regressions. | P0 |
| NFR-4 | Debug diagnostics remain intact for transition/bounds/prefetch counters. | P1 |

## Success Metrics

| Metric | Target |
| ------ | ------ |
| Chunk transition regressions caught by new tests | 100% for known failure modes in this PRD |
| Source-shape tests in high-risk chunk paths | Replaced with behavior tests |
| Commit-phase consistency violations in chunk switch tests | 0 |
| Non-default render-size chunk parity test failures | 0 |

## Milestones

### M0: Baseline and Test Harness Setup

Objectives:

1. Capture current chunking behavior baseline.
2. Build a minimal test harness pattern for scene-level behavior tests with mocked async dependencies.

Deliverables:

1. Baseline test plan and fixtures for chunk switch orchestration tests.
2. Initial helper utilities for deterministic async scheduling in tests.

Exit Criteria:

1. Team can author runtime behavior tests without source-regex patterns.

### M1: Transactional Chunk Authority Hardening (P0)

Objectives:

1. Move chunk authority writes to commit phase only.
2. Preserve old authority on fetch failure/stale transitions.

Deliverables:

1. Refined `performChunkSwitch` sequencing.
2. Tests for:
   1. success commit path
   2. failed fetch rollback
   3. stale transition suppression

Exit Criteria:

1. `currentChunk` pre-commit mutation is removed.
2. All M1 behavior tests are green.

### M2: Manager Chunk State Convergence (P0)

Objectives:

1. Align manager initial chunk state with scene startup state.
2. Ensure manager updates obey transition-token and target-chunk invariants.

Deliverables:

1. Army/chest/structure manager init and update-path consistency adjustments.
2. New manager behavior tests for chunk update acceptance/rejection edges.

Exit Criteria:

1. No manager can render from placeholder chunk defaults before first authoritative chunk apply.

### M3: Bounds Canonicalization and Parity (P0)

Objectives:

1. Eliminate duplicated bounds math where practical.
2. Prove parity between scene bounds use and shared chunk geometry helpers.

Deliverables:

1. Canonical bounds utility usage pass.
2. Parity tests comparing scene decision helpers and shared `getRenderBounds`.

Exit Criteria:

1. Bounds parity tests pass for representative chunk/render-size combinations.

### M4: Render-Size Robustness and Cache Invalidation Correctness (P1)

Objectives:

1. Validate chunking behavior under non-default render sizes.
2. Ensure surrounding-chunk/cached-matrix invalidation logic remains stride-consistent.

Deliverables:

1. Tests across sizes (e.g., 32/48/64/80/96) for neighbor derivation and overlap invalidation.
2. Fixes for any stride misalignment surfaced by tests.

Exit Criteria:

1. All render-size matrix/neighbor/invalidation tests are green.

### M5: Replace Fragile Source-Shape Tests with Behavior Tests (P0)

Objectives:

1. Remove regex/source-shape assertions in high-risk chunk orchestration areas.
2. Replace with runtime outcomes validated via public or well-contained internal seams.

Deliverables:

1. Behavior test replacements for:
   1. lifecycle chunk refresh guards
   2. explored-tile duplicate reconciliation flow

Exit Criteria:

1. No critical chunking behavior is validated only through source-text regex.

### M6: Soak, Performance Check, and Rollout (P1)

Objectives:

1. Run stress validation for rapid pan/zoom/chunk boundary traversals.
2. Confirm no unacceptable performance or memory regressions.

Deliverables:

1. Stress test checklist and captured diagnostics.
2. Rollout recommendation with observed metrics.

Exit Criteria:

1. Soak passes with no critical chunk-consistency incidents.
2. Performance envelope remains within NFR thresholds.

## Milestone Status Snapshot

| Milestone | Status | Date (UTC) | Evidence |
| --------- | ------ | ---------- | -------- |
| M0 | Completed | 2026-02-17 | Runtime baseline artifact captured: `.context/worldmap-pre-m1-baseline.json` with `pre-m1-start`/`pre-m1-end` snapshots. |
| M1 | Completed | 2026-02-17 | `performChunkSwitch` behavior tests green in `src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`; chunk authority write moved to commit phase in `src/three/scenes/worldmap.tsx`. |
| M2 | Completed | 2026-02-17 | Manager convergence coverage added in `src/three/managers/manager-update-convergence.test.ts`; startup chunk authority aligned in `src/three/managers/army-manager.ts`, `src/three/managers/chest-manager.ts`, and `src/three/managers/structure-manager.ts`; targeted manager/scene tests green (`manager-update-convergence`, `worldmap-chunk-orchestration-fixture`, `worldmap-chunk-transition`). |
| M3 | Completed | 2026-02-17 | Bounds parity coverage added in `src/three/scenes/worldmap-chunk-bounds.test.ts` and extended in `src/three/scenes/worldmap-chunk-transition.test.ts`; canonical helpers added in `src/three/scenes/worldmap-chunk-bounds.ts`; scene bounds call sites refactored in `src/three/scenes/worldmap.tsx` and `src/three/scenes/worldmap-chunk-transition.ts`; targeted suite green (`worldmap-chunk-bounds`, `worldmap-chunk-transition`, `worldmap-chunk-orchestration-fixture`, `manager-update-convergence`). |
| M4 | Completed | 2026-02-18 | Added size-matrix coverage for `32/48/64/80/96` in `src/three/scenes/worldmap-chunk-neighbors.test.ts` (neighbor derivation + cache invalidation overlap behavior); extracted stride-safe overlap helpers in `src/three/scenes/worldmap-chunk-neighbors.ts`; refactored `src/three/scenes/worldmap.tsx` (`getChunksAround`, `removeCachedMatricesAroundChunk`) to remove half-render-size stride assumptions; targeted suite green via `pnpm --dir ./client/apps/game exec vitest run src/three/scenes/worldmap-chunk-neighbors.test.ts src/three/scenes/worldmap-chunk-transition.test.ts src/three/scenes/worldmap-chunk-bounds.test.ts src/three/scenes/worldmap-chunk-policy.test.ts src/three/utils/chunk-geometry.test.ts src/three/managers/manager-update-convergence.test.ts`. |

## TDD Execution Plan

### Rule

No production changes without a failing test first for that behavior.

### Slice Plan

1. Slice A (M1): failing tests for commit-phase-only authority and rollback behavior.
2. Slice B (M2): failing tests for manager init/update consistency.
3. Slice C (M3): failing tests for bounds parity against shared geometry utility.
4. Slice D (M4): failing tests for non-default render-size chunk math.
5. Slice E (M5): failing behavior tests replacing regex-based integration checks.

### Test Categories

1. Unit tests: decision helpers and utility parity.
2. Component/service behavior tests: manager chunk update semantics.
3. Scene behavior tests: chunk transition lifecycle under controlled async outcomes.

## Risks and Mitigations

1. Risk: Behavior tests become brittle due to heavy scene dependencies.
   Mitigation: use narrow seams and deterministic mocks around fetch, timers, and transition promises.
2. Risk: Fixes for non-default render sizes impact debug tooling unexpectedly.
   Mitigation: include explicit debug/perf simulation path tests.
3. Risk: Transaction sequencing changes introduce timing regressions.
   Mitigation: track switch duration diagnostics before/after each milestone.

## Open Questions

1. Should non-default render-size behavior be production-supported or debug-only guaranteed?
2. Do we want strict exact-token acceptance in all manager update paths or keep monotonic `>=` in selected paths?
3. Should chunk policy include all prefetch/torii fields as one typed contract to remove remaining direct config reads?

## Rollout Plan

1. Land milestones incrementally with green tests per slice.
2. Enable in dev/canary first with diagnostics monitoring.
3. Promote to broader rollout after M6 soak and metric review.
