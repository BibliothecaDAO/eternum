# PRD: WarpTravel Adapter Cleanup TDD

## Overview

- Feature: cleanup and hardening pass for the remaining `WarpTravel` adapter seams
- Status: Draft
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                       |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| U1     | 2026-03-12 00:00 | Codex  | Created focused cleanup PRD/TDD after the shared-scene extraction landed and review surfaced residual risks. |

## Executive Summary

The shared-scene refactor is now largely in place:

1. `WarpTravel` exists
2. `WorldmapScene` uses it
3. chunk decision, hydration, switch finalization, prefetch planning, fanout, and navigation boundary seams exist

What remains is not another large extraction.

What remains is a cleanup pass to reduce adapter churn, remove duplicated ownership updates, centralize the dormant
fast-travel gate, and trim hot-path allocation noise from the prefetch runtime.

This PRD focuses on those cleanup seams only.

## Problem Statement

The current refactor is structurally sound, but several residual adapter patterns leave avoidable maintenance risk:

1. `WorldmapScene` rebuilds fresh lifecycle adapter objects with many one-line closures.
2. committed chunk switches still mutate `currentChunk` through two code paths.
3. the dormant fast-travel navigation gate is hardcoded at call sites instead of owned by the boundary itself.
4. prefetch helpers still allocate transient `Set`s on hot paths.
5. helper extraction has reduced logic size, but the remaining scene code still reads as callback plumbing in a few areas.

None of these are large architectural gaps.

They are cleanup tasks that should be handled before the concrete fast-travel scene starts depending on this layer.

## Goals

1. Reduce adapter/object churn in `WarpTravel` lifecycle wiring.
2. Ensure ownership/state mutation points are singular and explicit.
3. Centralize dormant fast-travel enablement behind one boundary contract.
4. Remove unnecessary hot-path allocation churn from prefetch enqueue/drain plumbing.
5. Leave `WorldmapScene` with named scene-policy methods instead of dense inline callback bundles.

## Non-Goals

1. Implementing the fast-travel scene itself.
2. Changing worldmap gameplay semantics.
3. Reworking chunking policy or manager behavior.
4. Replacing `SceneManager`.
5. Broad UI or navigation redesign outside scene-boundary cleanup.

## Current State

### What Is Already Extracted

1. lifecycle setup/resume/switch-off scaffolding
2. chunk decision and forced-refresh routing
3. chunk hydration
4. chunk switch finalization
5. manager fanout
6. directional prefetch planning
7. prefetch enqueue and drain planning
8. navigation boundary policy

### Residual Cleanup Hotspots

1. `WorldmapScene.getWarpTravelLifecycleAdapter()`
2. `WorldmapScene.performChunkSwitch()` callback bundle
3. `utils/navigation.ts` fast-travel boundary usage
4. repeated `new Set(this.pendingChunks.keys())` in prefetch helpers
5. duplicated `currentChunk` commit assignment

## Confirmed Cleanup Targets

1. Replace or cache the dynamic lifecycle adapter object.
2. Collapse chunk-authority assignment to one commit-path owner.
3. Move fast-travel enabled/disabled ownership into the navigation boundary layer.
4. Reduce hot-path collection reconstruction in prefetch helpers.
5. Convert dense helper call sites into named scene-policy methods where it improves clarity.

## Design Constraints

1. Cleanup must preserve all refactor behavior already protected by tests.
2. No cleanup lands without a failing test first.
3. Cleanup should prefer smaller API refinement over new abstraction layers.
4. `WorldmapScene` should end more readable, not just more fragmented.
5. Dormant fast-travel behavior must remain dormant after cleanup.

## TDD Operating Model

### Iron Rule

No cleanup change lands without a red-green-refactor loop.

### Per-Slice Protocol

1. `RED`
   - write one failing test for one cleanup seam
   - run only the targeted test file
   - confirm failure matches the intended cleanup contract
2. `GREEN`
   - make the minimum code change to pass
   - rerun the targeted file
3. `REFACTOR`
   - tighten naming and remove duplication after behavior is green
   - rerun the affected cluster

### Required Test Commands

1. Targeted loop:
   - `pnpm --dir client/apps/game test client/apps/game/src/three/<path>/<file>.test.ts`
2. Shared-runtime cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/warp-travel*.test.ts`
3. Scene-policy gate:
   - `pnpm --dir client/apps/game test src/three/scene-*.test.ts`
4. Quality gate for touched files:
   - `pnpm --dir client/apps/game exec eslint src/three`

## Milestones

### C0: Cleanup Baseline Lock (0.5 day) [x]

Objective:

Freeze the cleanup-sensitive behaviors before adapter simplification starts.

Deliverables:

1. tests proving chunk authority is advanced only once on commit
2. tests proving navigation boundary owns dormant fast-travel fallback
3. tests proving prefetch helpers do not regress enqueue/drain behavior during cleanup

Exit Criteria:

1. the cleanup seams are covered before further code motion

Completion Notes:

1. `warp-travel-chunk-switch-commit.test.ts` now locks committed chunk authority timing and single commit callback usage.
2. `scene-navigation-boundary.test.ts` now locks dormant fast-travel fallback when no enablement override is present.
3. `warp-travel-prefetch-enqueue.test.ts` and `warp-travel-prefetch-drain.test.ts` remain the baseline guardrail for queue behavior during later cleanup.

### C1: Lifecycle Adapter Simplification (0.5-1 day) [x]

Objective:

Reduce lifecycle adapter churn and inline callback noise.

Target Areas:

1. `getWarpTravelLifecycleAdapter()`
2. label-group attach/detach wiring
3. lifecycle setup/switch-off callback identity

Deliverables:

1. cached lifecycle adapter or protected-method lifecycle API
2. reduced inline closure density in `WorldmapScene`
3. tests proving behavior parity

Exit Criteria:

1. lifecycle cleanup reduces indirection without changing setup/resume/switch-off behavior

Completion Notes:

1. `WarpTravel` now caches a single lifecycle adapter instance instead of requesting a fresh object on each transition.
2. `WorldmapScene` lifecycle wiring now routes the label-group, manager-label, initial-setup, and refresh hooks through named private methods.
3. `warp-travel.test.ts` now verifies adapter construction stays stable across setup, switch-off, and resume cycles.

### C2: Chunk Ownership Cleanup (0.5 day) [x]

Objective:

Remove duplicate chunk-authority mutation and clarify the committed switch path.

Target Areas:

1. `setCurrentChunk` callback vs. `finalizeResult.nextCurrentChunk`
2. commit-path ownership timing

Deliverables:

1. one authoritative chunk commit path
2. tests proving manager fanout runs under committed ownership

Exit Criteria:

1. chunk authority mutation occurs in one place only

Completion Notes:

1. committed chunk authority now advances only through the finalize helper callback path.
2. `finalizeWarpTravelChunkSwitch()` no longer returns a duplicate `nextCurrentChunk` assignment contract.
3. `WorldmapScene.performChunkSwitch()` now routes rollback and visibility side effects through named private methods instead of a dense inline callback bundle.

### C3: Navigation Boundary Hardening (0.5 day) [x]

Objective:

Centralize dormant fast-travel enablement behind one boundary contract.

Target Areas:

1. `scene-navigation-boundary.ts`
2. `utils/navigation.ts`
3. future enablement toggle location

Deliverables:

1. single ownership point for fast-travel enabled/disabled policy
2. call sites no longer hardcode `fastTravelEnabled: false`

Exit Criteria:

1. enabling the concrete fast-travel scene later requires changing one boundary source, not multiple helpers

Completion Notes:

1. dormant fast-travel enablement now defaults from `scene-navigation-boundary.ts`.
2. navigation helpers no longer pass `fastTravelEnabled: false` at each call site.
3. `scene-navigation-boundary.test.ts` now locks both the dormant default and the absence of helper-owned fallback wiring.

### C4: Prefetch Hot-Path Cleanup (0.5-1 day) [ ]

Objective:

Reduce avoidable allocation churn and callback noise in queue helpers.

Target Areas:

1. `new Set(this.pendingChunks.keys())` duplication
2. helper call-site lambda wrappers
3. queue-state plumbing clarity

Deliverables:

1. reduced hot-path collection rebuilding
2. improved readability in prefetch enqueue/drain call sites

Exit Criteria:

1. prefetch queue behavior remains green with simpler call-site code

### C5: Cleanup Closeout (0.5 day) [ ]

Objective:

Finish the cleanup pass with explicit residual risks and a clear handoff to the concrete fast-travel implementation.

Deliverables:

1. README/architecture note update if cleanup changed layer contracts
2. residual-risk list
3. follow-up backlog for the concrete fast-travel scene

Exit Criteria:

1. cleanup is complete and documented

## Prioritized Slice Backlog

1. S1 (P0): Add failing test proving committed chunk switches do not rely on duplicate `currentChunk` mutation sites.
2. S2 (P0): Add failing test proving lifecycle adapter construction is stable across repeated setup/switch-off calls.
3. S3 (P0): Add failing test proving navigation fallback for dormant fast travel is owned only by the boundary layer.
4. S4 (P1): Replace lifecycle adapter object reconstruction with a cached adapter or protected hook methods.
5. S5 (P1): Collapse chunk commit mutation to one owner.
6. S6 (P1): Centralize fast-travel enablement policy in `scene-navigation-boundary.ts`.
7. S7 (P1): Remove repeated `new Set(this.pendingChunks.keys())` creation from prefetch enqueue/drain call sites.
8. S8 (P2): Replace repeated one-line worldmap helper lambdas with named private adapter methods where clarity improves.
9. S9 (P2): Update architecture docs with the final cleaned-up adapter shape.

## Test Strategy

### New Or Expanded Test Files

1. `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.test.ts`
2. `client/apps/game/src/three/scenes/warp-travel.test.ts`
3. `client/apps/game/src/three/scene-navigation-boundary.test.ts`
4. `client/apps/game/src/three/scenes/warp-travel-prefetch-enqueue.test.ts`
5. `client/apps/game/src/three/scenes/warp-travel-prefetch-drain.test.ts`

### Test Method

1. Prefer pure helper tests and small orchestration fixtures over large scene integration tests.
2. Keep assertions focused on:
   - ownership timing
   - stable adapter wiring
   - dormant boundary behavior
   - queue state and skipped/enqueued work
3. Use source-reading tests only when runtime instantiation is impractical.

## Functional Requirements

1. Lifecycle cleanup must preserve setup/resume/switch-off behavior.
2. Chunk commit cleanup must preserve manager update timing and chunk ownership correctness.
3. Navigation boundary cleanup must preserve current map/hex behavior and keep fast travel dormant.
4. Prefetch cleanup must preserve queue ordering and skip behavior.

## Non-Functional Requirements

1. No new runtime allocations on hot paths unless justified.
2. No new flaky tests.
3. No readability regressions from over-abstraction.
4. Helper APIs should become simpler, not broader.

## Risks

1. Cleanup can accidentally re-open already-fixed chunk-switch regressions.
2. Collapsing adapter layers too aggressively can erase useful shared seams.
3. Navigation cleanup may accidentally activate dormant fast-travel routing.
4. Prefetch cleanup may affect queue fairness or cancellation behavior.

## Mitigations

1. Keep cleanup slices narrow and test-first.
2. Preserve current helper boundaries unless a change clearly reduces complexity.
3. Keep fast-travel enablement behind an explicit false-by-default policy.
4. Rerun the shared-runtime cluster after every slice.

## Success Criteria

1. Remaining `WarpTravel` adapters are stable and easy to read.
2. Chunk ownership has one authoritative commit point.
3. Navigation boundary enablement is centralized.
4. Prefetch hot-path churn is reduced without behavior drift.
5. The codebase is ready for the concrete fast-travel scene follow-up PR without another cleanup pass.

## Recommended Execution Order

1. Lock cleanup-sensitive seams with C0 tests.
2. Simplify lifecycle adapters in C1.
3. Remove duplicate chunk authority in C2.
4. Centralize navigation enablement in C3.
5. Trim prefetch hot-path churn in C4.
6. Close out docs and follow-up backlog in C5.
