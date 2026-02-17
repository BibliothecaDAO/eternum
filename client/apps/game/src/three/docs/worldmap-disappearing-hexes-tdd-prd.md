# PRD: Worldmap Disappearing Hexes (TDD)

## Overview

- Feature: Eliminate disappearing discovered hexes after unit movement in worldmap
- Status: Draft v1
- Owner: Three / Worldmap Team
- Created: 2026-02-17
- Last Updated: 2026-02-17

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                        |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-02-17 00:00 | Codex  | Initial detailed TDD PRD covering repro, root-cause hypotheses, test-first slice plan, and acceptance gates. |

## Executive Summary

Players report that after moving a unit, the destination hex sometimes remains visually missing until a small camera or mouse movement occurs. Current evidence points to a convergence bug between:

1. Army tile updates that pre-seed explored tiles.
2. Duplicate tile update handling that can early-return before visual reconciliation.
3. Incremental terrain instance updates that may not always toggle mesh visibility immediately.
4. Refresh scheduling that is commonly triggered by controls changes, making the bug appear input-dependent.

This PRD defines a strict test-first plan to prove failure, implement minimal fixes, and lock regressions.

## User Reproduction

1. Move a unit.
2. The destination hex does not appear as discovered.
3. Move the mouse slightly.
4. The missing hex appears.

## Problem Statement

Worldmap terrain can enter a temporary divergent state where game state marks a tile as explored but terrain render state fails to reflect it until a later refresh. This undermines map trust and creates flickering/disappearing tile behavior.

## Current Findings (Code Review)

### F1: Army pre-seeds explored tile state before Tile update reconciliation

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:641`
2. `client/apps/game/src/three/scenes/worldmap.tsx:648`

Risk:

1. Army movement path may mark destination as explored (`Grassland`) before the tile stream delivers authoritative biome.
2. Later tile update can be classified as duplicate and skip incremental visual apply.

Impact:

1. Destination tile may remain missing or stale until forced refresh.

Confidence: High

### F2: Duplicate tile logic can early-return before visual reconciliation

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:2558`
2. `client/apps/game/src/three/scenes/worldmap.tsx:2562`
3. `client/apps/game/src/three/scenes/worldmap.tsx:2580`

Risk:

1. Duplicate path invalidates caches and may avoid immediate render update.
2. Refresh request is gated by visible/frustum checks and scene-transition state.

Impact:

1. Known explored tile stays visually absent until later camera/refresh events.

Confidence: High

### F3: Incremental add path does not explicitly re-toggle biome mesh visibility

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:2660`
2. `client/apps/game/src/three/scenes/worldmap.tsx:2661`
3. `client/apps/game/src/three/managers/instanced-biome.tsx:222`

Risk:

1. Biome mesh may remain `visible=false` if transitioning from count `0 -> 1` without explicit visibility refresh in this path.

Impact:

1. Tile can be logically added but not drawn until later full rebuild.

Confidence: Medium

### F4: Tile update handler is fire-and-forget and can overlap async visual writes

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:754`
2. `client/apps/game/src/three/scenes/worldmap.tsx:2550`

Risk:

1. Concurrent `updateExploredHex` executions can interleave non-atomic `getCount`/`setCount` behavior.

Impact:

1. Intermittent slot overwrite or delayed convergence under burst updates.

Confidence: Medium

## Goals

1. Ensure moved-to explored hexes render deterministically on first applicable update.
2. Remove dependency on later input/camera movement for terrain reconciliation.
3. Preserve chunking performance and avoid broad architecture rewrites.
4. Add test coverage that reproduces and prevents this exact regression class.

## Non-Goals

1. Rewrite worldmap chunk system.
2. Replace Torii streaming model.
3. Redesign fog-of-war semantics.
4. Change visual style or biome art assets.

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
3. `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
4. `client/apps/game/src/three/managers/instanced-biome.tsx`
5. New targeted tests under `client/apps/game/src/three/scenes` and `client/apps/game/src/three/managers`

### Out of Scope

1. Server/indexer changes.
2. Global renderer loop changes outside directly required fixes.
3. Map controls behavior changes.

## TDD Operating Model (Mandatory)

### Iron Rule

No production code changes for this bug without a failing test first.

### Red-Green-Refactor Loop

1. RED
   1. Add one failing test for one behavior.
   2. Run targeted test.
   3. Verify failure reason matches missing behavior.
2. GREEN
   1. Implement minimal code change to pass.
   2. Re-run targeted test.
3. REFACTOR
   1. Cleanup naming/extraction only with tests green.
   2. Re-run targeted suite.

## Proposed Solution

### S1: Reconcile duplicate tile updates when biome payload is authoritative

Intent:

1. Do not treat all known-tile updates as no-op duplicates.
2. If incoming biome differs from stored biome, run reconciliation path.

Expected effect:

1. Legitimate biome corrections always update visual state immediately.

### S2: Prevent army pre-seed from masking authoritative discover events

Intent:

1. Replace unconditional “new army tile => explored grassland” write with explicit, constrained behavior.
2. Add metadata/guard so Tile updates remain authoritative.

Expected effect:

1. Unit movement no longer suppresses proper discover rendering.

### S3: Ensure incremental terrain add path updates mesh visibility

Intent:

1. After `setCount(currentCount + 1)` in incremental add path, ensure mesh visibility aligns with count.

Expected effect:

1. First instance for a biome variant is rendered immediately.

### S4: Serialize or guard async explored-tile visual updates

Intent:

1. Avoid overlapping asynchronous `updateExploredHex` writes in burst streams.
2. Preserve order for same tile or same chunk when required.

Expected effect:

1. Deterministic instance updates under event bursts.

## TDD Slice Plan

### Slice A: Duplicate Tile Decision Matrix Hardening

RED tests:

1. Known tile + changed biome must not resolve to no-op.
2. Known tile + same biome + offscreen may stay invalidate-only.
3. Known tile + same biome + visible must request refresh or direct reconcile.

GREEN implementation:

1. Extend duplicate decision inputs to include existing biome and incoming biome comparison.
2. Update decision helper and worldmap callsites.

REFACTOR:

1. Keep helper pure and table-driven.

### Slice B: Army Pre-Seed Guarding

RED tests:

1. Army movement update should not permanently mark destination as authoritative explored biome.
2. Tile update after movement should still execute visual apply path.

GREEN implementation:

1. Narrow or remove pre-seeding behavior.
2. Keep pathfinding safety via explicit fallback path not conflated with tile discovery authority.

REFACTOR:

1. Extract utility function for “pathfinding discover fallback” if needed.

### Slice C: Incremental Add Visibility Reliability

RED tests:

1. Biome mesh transitioning from `0 -> 1` instances becomes visible in same update path.

GREEN implementation:

1. Call `updateMeshVisibility()` in incremental add path after count change.

REFACTOR:

1. Optionally centralize “add instance + count + visibility update” helper.

### Slice D: Async Update Ordering

RED tests:

1. Two rapid tile updates for same chunk do not lose a tile instance.
2. Out-of-order completion does not regress latest state.

GREEN implementation:

1. Add queue/lock per chunk or single-flight strategy for `updateExploredHex`.

REFACTOR:

1. Keep orchestration minimal and observable.

## Test Strategy

### Unit Tests

1. `worldmap-chunk-transition.test.ts`
   1. Expand duplicate tile cases with biome delta semantics.
2. New policy tests (if extracted)
   1. Army pre-seed authority decision.
3. `instanced-biome` tests
   1. Visibility transition on count changes in incremental path.

### Integration Tests

1. Worldmap scene test:
   1. Simulate movement event then tile update for destination.
   2. Assert destination tile present without control-change-triggered refresh.
2. Burst event test:
   1. Fire multiple tile updates rapidly.
   2. Assert deterministic final terrain count and no missing target tile.

### Regression Test (Repro-specific)

1. Scripted flow:
   1. Move unit.
   2. Destination tile discovered.
   3. No mouse/camera change.
2. Assertion:
   1. Tile appears immediately in terrain instances.

## Observability and Diagnostics

Add or extend debug counters:

1. `duplicate_tile_reconciled_biome_delta`
2. `duplicate_tile_skipped_same_biome`
3. `terrain_incremental_add_visibility_fix_applied`
4. `update_explored_hex_queue_depth`
5. `update_explored_hex_out_of_order_drop`

## Acceptance Criteria

### Functional

1. Destination hex renders on first discover update without requiring mouse move.
2. Duplicate tile updates with biome correction reconcile render state.
3. No persistent blank-hex cases in movement/discovery repro sequence.

### Non-Functional

1. No increase in chunk refresh thrash beyond current baseline.
2. No new flaky tests in `src/three`.
3. Targeted test suites pass consistently in CI/local.

## Rollout Plan

1. Land slices A-C first behind tests.
2. Land slice D only if race is reproduced by tests or observed in diagnostics.
3. Validate in QA with scripted movement/discovery stress.
4. Monitor diagnostics for one release cycle.

## Risks and Mitigations

1. Risk: Over-refreshing terrain can hurt performance.
   1. Mitigation: Prefer direct reconcile over force refresh where possible.
2. Risk: Removing pre-seed may affect movement/pathfinding UX.
   1. Mitigation: Keep pathfinding fallback separated from visual discovery authority.
3. Risk: Async serialization can add latency.
   1. Mitigation: Scope queue granularity to chunk or tile key, not global lock.

## Open Questions

1. Should pathfinding depend on `exploredTiles` directly, or use a separate “navigable-known” cache?
2. Is biome correction expected for already-known tiles in normal Torii behavior, or only under race conditions?
3. Should duplicate tile updates prefer direct in-place reconcile over chunk refresh in all visible cases?

## Definition of Done

1. All new behavior is covered by failing-first tests.
2. `pnpm --dir client/apps/game test src/three` passes.
3. Manual repro no longer exhibits missing destination hex before mouse movement.
4. PR includes before/after evidence (test output + short repro recording notes).
