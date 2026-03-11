# PRD + TDD: Worldmap Rapid Chunk Switch Race Hardening

## Overview

- Feature: Eliminate stale applies, ownership races, and teardown hazards during rapid chunk switching.
- Status: Draft v0.2
- Owner: Three / Worldmap Team
- Created: 2026-02-23
- Last Updated: 2026-02-23

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                                                                                                                                                                  |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-02-23 00:00 | Codex  | Initial PRD+TDD from deep review of chunking paths, focused on rapid switch edges, switch-off/resume races, and test-first delivery milestones.                                                                                                         |
| U2     | 2026-02-23 00:00 | Review | Simplified design: removed lifecycle epoch (D1), use token invalidation (D3) as primary fix. Replaced fetch metadata payload with promise-identity guard. Demoted F3 to monitor-only. Resolved open questions. Consolidated TDD milestones from 6 to 3. |

## Executive Summary

The existing `chunkTransitionToken` mechanism already gates transition commits via `resolveChunkSwitchActions`. However,
`onSwitchOff` never invalidates the token, so in-flight transitions can complete and mutate scene state after teardown.
The fetch finalizer unconditionally deletes pending entries by key, allowing stale completions to erase newer entries.
The reversal policy seeds its baseline from absolute coordinates instead of deltas.

These share a single root cause: **switch-off does not invalidate in-flight ownership.** The fix is to invalidate the
existing token on switch-off, add a promise-identity check to the fetch finalizer, and fix the reversal baseline. No new
ownership dimensions or metadata types are needed.

## Problem Statement

Under rapid camera traversal, boundary oscillation, and scene switch/resume churn, worldmap can observe:

1. Late transition completion after teardown, causing state mutation against a switched-off scene.
2. Pending fetch entry corruption from out-of-order completion across lifecycle boundaries.
3. Unstable force-refresh behavior under quick direction reversals.

These are correctness issues first; performance impact is secondary.

## Current Findings

### F1: Switch-off does not invalidate in-flight transition authority

Evidence:

1. `onSwitchOff` resets state but does not advance `chunkTransitionToken`:
   `client/apps/game/src/three/scenes/worldmap.tsx:2204`.
2. Transition commit unconditionally writes `currentChunk` and fans out manager updates:
   `client/apps/game/src/three/scenes/worldmap.tsx:4401`. `client/apps/game/src/three/scenes/worldmap.tsx:4408`.
3. The existing stale-check at line 4362 (`transitionToken === this.chunkTransitionToken`) already gates the commit path
   — but since `onSwitchOff` never advances the token, an in-flight transition whose token was captured before
   switch-off still passes this check.

Risk:

1. Late completion after `switchOff` can re-register chunks and re-render stale state.

Root cause: The guard mechanism exists but is never triggered on switch-off.

### F2: Fetch pending bookkeeping is not ownership-safe across lifecycle churn

Evidence:

1. Pending fetch map stores `Promise<boolean>` by fetch key only: `client/apps/game/src/three/scenes/worldmap.tsx:3651`.
2. Finalizer always deletes by key unconditionally: `client/apps/game/src/three/scenes/worldmap.tsx:3695`.
3. Runtime lifecycle switch-off clears pending map wholesale:
   `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.ts:56`.

Risk:

1. Old fetch completion can delete newer pending entry for same key after resume.
2. Loading counter semantics can drift under overlapping lifecycle epochs.

### F3: Stale transition suppression leaks partial prepared state (MONITOR ONLY)

Evidence:

1. Target chunk registration and grid update happen before stale determination:
   `client/apps/game/src/three/scenes/worldmap.tsx:4326`. `client/apps/game/src/three/scenes/worldmap.tsx:4355`.
2. Stale branch primarily unregisters target chunk and returns: `client/apps/game/src/three/scenes/worldmap.tsx:4394`.

Risk:

1. Partial prepare work (grid, bounds) can leak transiently when rapid transitions supersede each other.

Assessment: Low severity. The next legitimate transition fully overwrites grid and bounds state. Explicit rollback would
add its own race surface and complexity for marginal benefit. **Monitor only** — add a diagnostic counter for
stale-prepare events and revisit if user-visible artifacts are reported.

### F4: Reversal direction baseline is seeded from absolute position on first movement

Evidence:

1. No previous switch position path sets next vector to raw switch coordinates:
   `client/apps/game/src/three/scenes/worldmap-chunk-reversal-policy.ts:21`.
   `client/apps/game/src/three/scenes/worldmap-chunk-reversal-policy.ts:24`.

Risk:

1. Dot-product reversal checks can be noisy/misleading on second switch depending on world-space origin.

### F5: Test coverage misses runtime interleavings that most threaten correctness

Evidence:

1. Lifecycle tests are short-circuit focused: `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts:18`.
2. Runtime switch-off state helper tests are map-clearing focused:
   `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts:5`.
3. Orchestration fixture covers success/failure/stale token but not switch-off/resume races:
   `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts:5`.

Risk:

1. Core race regressions can pass CI undetected.

## Goals

1. Prevent all stale scene/manager mutation after `switchOff` and `destroy`.
2. Make fetch lifecycle ownership deterministic under overlap and resume.
3. Stabilize reversal-triggered force-refresh behavior.
4. Add behavior-level tests for the two highest-risk race interleavings.

## Non-Goals

1. Chunk geometry redesign.
2. Torii transport/API redesign.
3. Visual/UX redesign.
4. Broad refactor outside chunk lifecycle and associated managers.
5. Explicit prepared-state rollback for stale transitions (monitor only, see F3).
6. New lifecycle epoch ownership dimension separate from existing transition token.

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx` — `onSwitchOff`, `performChunkSwitch`, `executeTileEntitiesFetch`
2. `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.ts` — switch-off state helper
3. `client/apps/game/src/three/scenes/worldmap-chunk-reversal-policy.ts` — baseline seeding
4. Tests in `client/apps/game/src/three/scenes/`

### Out of Scope

1. Contract/indexer schema changes.
2. New worldmap feature behavior unrelated to transition correctness.
3. Manager-internal ownership propagation (scene-level guard is sufficient).

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                             | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | `switchOff`/`destroy` must increment `chunkTransitionToken` before state reset, invalidating all in-flight transitions. | P0       |
| FR-2 | `switchOff` must set `isChunkTransitioning = false` and retire `globalChunkSwitchPromise`.                              | P0       |
| FR-3 | Fetch finalizer must check promise identity before deleting pending entry; stale finalizers must not delete new owners. | P0       |
| FR-4 | Reversal refresh decision must use movement deltas only; return null vector when no previous position exists.           | P1       |
| FR-5 | Rapid boundary oscillation and switch-off/resume churn must be covered by deterministic behavior tests.                 | P0       |
| FR-6 | Stale-prepare events should emit a diagnostic counter for monitoring.                                                   | P2       |

### Non-Functional Requirements

| ID    | Requirement                                                                              | Priority |
| ----- | ---------------------------------------------------------------------------------------- | -------- |
| NFR-1 | Chunk-switch p95 latency regression <= 10% from baseline.                                | P0       |
| NFR-2 | Tile fetch volume does not regress > 5% for same traversal script/path.                  | P0       |
| NFR-3 | New race tests are deterministic and stable in CI (no flaky timing assumptions).         | P0       |
| NFR-4 | No additional warning/error log spam in expected stale-drop paths under rapid switching. | P1       |

## Invariants

1. `currentChunk` is authoritative only when `transitionToken === this.chunkTransitionToken`.
2. Any async completion whose captured token no longer matches is side-effect-free.
3. Pending fetch entry deletion requires promise-identity match, not key-only match.

## Proposed Design

### D1: Transition Token Invalidation on Switch-Off (fixes F1)

In `onSwitchOff` (line 2204), **before** the existing state reset logic:

1. Increment `this.chunkTransitionToken`.
2. Set `this.isChunkTransitioning = false`.
3. Set `this.globalChunkSwitchPromise = undefined`.

This is ~3 lines of code. The existing stale-check in `performChunkSwitch` at line 4362
(`transitionToken === this.chunkTransitionToken`) already prevents commit and manager fanout for invalidated tokens. No
new guard mechanism needed.

Same treatment in `destroy` if it does not already delegate to `onSwitchOff`.

Expected effects:

1. In-flight transitions captured before switch-off fail the existing ownership check and become no-ops.
2. Manager fanout is naturally skipped because `resolveChunkSwitchActions` returns `shouldCommitManagers: false`.

### D2: Fetch Finalizer Promise-Identity Guard (fixes F2)

In `executeTileEntitiesFetch` finalizer (line 3695), replace unconditional delete:

```typescript
// Before:
this.pendingChunks.delete(fetchKey);

// After:
if (this.pendingChunks.get(fetchKey) === fetchPromise) {
  this.pendingChunks.delete(fetchKey);
}
```

This is a 1-line change (replacing the delete with a guarded delete). Zero new types, zero new fields. The
`fetchPromise` reference is already in scope at the finalizer call site.

Expected effects:

1. Old fetch A completing after new fetch B started for the same key cannot erase B's pending entry.
2. Loading counter stays consistent because only the owning promise cleans up.

### D3: Reversal Vector Null Baseline (fixes F4)

In `resolveChunkReversalRefreshDecision` (line 21), when `previousSwitchPosition` is missing:

```typescript
// Before:
nextMovementVector: input.nextSwitchPosition
  ? { x: input.nextSwitchPosition.x, z: input.nextSwitchPosition.z }
  : input.previousMovementVector,

// After:
nextMovementVector: input.previousMovementVector ?? null,
```

Return the previous vector if available, otherwise `null`. The caller skips reversal detection when the vector is null.
No absolute-coordinate seeding.

Expected effects:

1. First-movement reversal detection is skipped (no delta to measure).
2. Second-movement onward uses true deltas, making dot-product checks origin-independent.

## TDD Plan (Failing-First)

### M1: Token Invalidation + Switch-Off Race Tests (P0)

RED — write these tests first, verify they fail:

1. `worldmap-switchoff-transition-race.test.ts`:
   - Transition commit after switch-off must not mutate `currentChunk`.
   - Manager fanout must be skipped when token is invalidated by switch-off.
   - `globalChunkSwitchPromise` must be undefined after switch-off.

Test harness approach: Use deferred promises with manual resolution. Capture transition token before switch-off, call
switch-off, then resolve the deferred transition promise. Assert no state mutation occurred.

GREEN:

1. Add 3 lines to `onSwitchOff`: increment token, clear transitioning flag, clear promise.

REFACTOR:

1. If `destroy` duplicates this logic, extract to shared helper.

Exit criteria: No post-switch-off scene authority mutations in deterministic race tests.

### M2: Fetch Ownership + Reversal Fix (P0/P1)

RED — write these tests first, verify they fail:

1. `worldmap-fetch-ownership-race.test.ts`:
   - Stale fetch finalizer must not delete newer pending entry for same key.
   - Loading counter must remain correct when old fetch completes after new fetch starts.

2. Extend `worldmap-chunk-reversal-policy.test.ts`:
   - First-movement (no previous position) must return null vector, not absolute coordinates.
   - Second-movement reversal detection must be origin-independent.

Test harness approach: For fetch ownership, create two promises for the same fetch key, store the second, resolve the
first, assert second is still in the map. For reversal, add table-driven cases at non-origin positions.

GREEN:

1. Add promise-identity guard to fetch finalizer (~1 line).
2. Fix reversal baseline to return null when no previous position (~3 lines).

Exit criteria: Old fetch cannot delete new pending entry; reversal is origin-independent.

### M3: Validation Gate (P0)

1. Run full chunk test suite, verify all green.
2. Verify p95 switch latency and fetch volume against baseline (NFR-1, NFR-2).
3. Run existing orchestration fixture tests to confirm no regressions.

Exit criteria: All P0 tests green, NFR thresholds satisfied.

## Test File Plan

### New Tests

1. `client/apps/game/src/three/scenes/worldmap-switchoff-transition-race.test.ts`
2. `client/apps/game/src/three/scenes/worldmap-fetch-ownership-race.test.ts`

### Updated Tests

1. `client/apps/game/src/three/scenes/worldmap-chunk-reversal-policy.test.ts`
2. `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts`

## Acceptance Criteria

1. No scene/manager mutation occurs from stale async completions after `switchOff`.
2. Pending fetch ownership survives overlapping lifecycle epochs without corruption.
3. Reversal-triggered force refreshes are deterministic across origin and direction changes.
4. CI includes deterministic rapid-switch race tests and they remain green.

## QA Matrix

1. Rapid boundary oscillation across same two chunks.
2. Multi-boundary sweep with immediate `switchOff` mid-transition.
3. `switchOff` then immediate `setup` while prior fetch completions are still pending.
4. Out-of-order fetch completion for same render area key.
5. Reversal stress: forward/back/forward with jitter around threshold.

## Rollout Plan

### Phase 1: Test-Only Landing (RED)

1. Land failing tests on feature branch.
2. Validate failures are race-specific and deterministic.

### Phase 2: Implementation (GREEN)

1. Apply D1 (token invalidation) — ~3 lines in `onSwitchOff`.
2. Apply D2 (promise-identity guard) — ~1 line in fetch finalizer.
3. Apply D3 (reversal null baseline) — ~3 lines in reversal policy.
4. Verify all tests green.

### Phase 3: Validation

1. Run targeted chunk test suites.
2. Spot-check p95 switch latency and fetch volume against baseline.
3. Merge after P0 criteria pass.

## Risks and Mitigations

| Risk                                                       | Level | Mitigation                                                                           |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| Over-guarding could suppress legitimate updates            | Low   | Token is only invalidated on switch-off/destroy, not during normal transitions.      |
| Promise-identity check could retain stale entries on error | Low   | The wholesale `.clear()` on switch-off already handles cleanup of abandoned entries. |
| Test flakiness in async race coverage                      | Med   | Use deferred promises with manual resolution; no wall-clock timing assumptions.      |
| Stale prepared-state leak (F3) causes visible artifacts    | Low   | Monitor via diagnostic counter; revisit if user reports are received.                |

## Resolved Questions

1. **Should pending fetches be actively aborted on switch-off?** No. Stale-drop only. AbortController adds
   transport-layer complexity for minimal gain — most in-flight fetches are near completion. The promise-identity guard
   ensures stale completions are harmless.
2. **Should lifecycle epoch ownership propagate into manager internals?** No. Scene-level token invalidation is
   sufficient. The existing `resolveChunkSwitchActions` check prevents manager fanout before it starts. No new ownership
   dimension needed.
3. **Should stale prepared-state cleanup restore grid immediately?** No. The next legitimate transition overwrites grid
   and bounds completely. Explicit rollback would add its own race surface. Monitor via diagnostic counter instead.

## Definition of Done

1. All new P0 tests were written first and failed before code changes.
2. All new and updated tests are green and deterministic.
3. P0 functional requirements are satisfied.
4. NFR thresholds are spot-checked and within bounds.
5. No new ownership types, epoch fields, or metadata payloads introduced.
