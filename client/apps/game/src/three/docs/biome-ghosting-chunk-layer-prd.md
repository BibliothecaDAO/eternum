# PRD: Worldmap Biome Ghosting in Chunk Layer

## Overview

- Feature: Eliminate intermittent biome disappearance (blank hex under visible units) during rapid chunk transitions.
- Status: Draft v1
- Owner: Three / Worldmap Team
- Created: 2026-02-12
- Last Updated: 2026-02-12

## Executive Summary

Players can reproduce a rendering integrity bug where units remain visible but underlying biome terrain disappears after
rapid camera movement across chunk boundaries and return to the unit location. The issue appears tied to chunk
transition timing, bounds subscription switching, and stale terrain matrix cache reuse.

This PRD defines a deterministic chunk/stream/cache convergence plan to prevent terrain ghosting while preserving
current chunking performance.

## User-Reported Reproduction

1. Move a unit.
2. Move camera quickly to another chunk.
3. Return camera to the unit location.
4. Observe biome tiles missing while units remain visible.

Additional field notes:

1. Missing visuals are biome-only.
2. Units are not missing, standing on blank hexes.
3. One move updates, next move may not visually update.
4. Suspected subscription-chunk race.

## Problem Statement

The worldmap can enter a partial visual state where entity managers remain coherent but terrain state is stale or empty.
This violates visual integrity and creates player distrust in map correctness.

## Goals

1. Ensure terrain, entities, and interaction state converge to the same chunk/render authority after rapid movement.
2. Prevent stale or out-of-order Torii bounds switches from leaving the world in a partially subscribed state.
3. Prevent reuse of stale terrain cache entries that no longer reflect latest tile/occupier updates.
4. Add deterministic recovery and diagnostics for any residual divergence.

## Non-Goals

1. Rewriting worldmap architecture.
2. Replacing Torii transport.
3. Changing worldmap UX, art, or chunk geometry constants.
4. Large-scale performance optimization unrelated to ghosting correctness.

## Scope

In scope:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/dojo/torii-stream-manager.ts`
3. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
4. `client/apps/game/src/three/docs/biome-ghosting-chunk-layer-prd.md`
5. Targeted unit tests in `client/apps/game/src/three/scenes/*.test.ts` and `client/apps/game/src/dojo/*.test.ts`

Out of scope:

1. Contract/indexer model changes.
2. New render model loading system.
3. Mobile renderer parity work.

## Current Findings (Code Review)

### F1: Bounds Switch Can Desync From Active Area Key

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:3361`
2. `client/apps/game/src/three/scenes/worldmap.tsx:3397`
3. `client/apps/game/src/three/scenes/worldmap.tsx:3398`
4. `client/apps/game/src/three/scenes/worldmap.tsx:3401`
5. `client/apps/game/src/dojo/torii-stream-manager.ts:99`
6. `client/apps/game/src/dojo/torii-stream-manager.ts:126`

Risk:

1. A stale transition can still swap the live subscription.
2. Stale-token return can skip `toriiBoundsAreaKey` update.
3. Internal area key and actual active stream can diverge.

Impact:

1. Tile updates may stop arriving for the expected current area.
2. Missing biome updates become visible after re-entry.

### F2: Terrain Cache Invalidation Is Too Narrow For Overlapping Render Windows

Relevant code:

1. `client/apps/game/src/three/constants/world-chunk-config.ts:37`
2. `client/apps/game/src/three/constants/world-chunk-config.ts:39`
3. `client/apps/game/src/three/scenes/worldmap.tsx:2746`
4. `client/apps/game/src/three/scenes/worldmap.tsx:2755`
5. `client/apps/game/src/three/scenes/worldmap.tsx:3624`

Risk:

1. Stride chunk is 24, render window is 48, so each hex participates in multiple cached chunk views.
2. Invalidating only the containing chunk leaves neighboring render caches stale.
3. Returning through a neighboring chunk can reapply stale biome matrices.

Impact:

1. Units appear on blank hexes (entity state updated, biome cache stale).

### F3: Single-Area Live Subscription vs Multi-Area Pinned/Cache Model

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:3267`
2. `client/apps/game/src/three/scenes/worldmap.tsx:3449`
3. `client/apps/game/src/three/scenes/worldmap.tsx:3361`

Risk:

1. Multiple areas remain relevant by pinning/cache policy.
2. Live updates are only bound to one area at a time.
3. Re-entered area may rely on stale cached terrain until forced refresh.

Impact:

1. Intermittent missing biome updates during high-velocity camera traversal.

### F4: Duplicate Tile Early Return Can Suppress Visual Reconciliation

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:2505`
2. `client/apps/game/src/three/scenes/worldmap.tsx:2508`

Risk:

1. If `exploredTiles` already contains the tile, update returns before invalidation/repair path.
2. Visual state can remain stale despite repeated updates.

Impact:

1. Long-lived blank terrain until unrelated forced refresh occurs.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Torii bounds switching must be latest-wins and serialized; stale switches must not mutate active stream state. | P0 |
| FR-2 | `toriiBoundsAreaKey` must always represent the currently active Torii bounds subscription. | P0 |
| FR-3 | Terrain cache invalidation for a hex update must cover all cached chunk views whose render bounds include that hex. | P0 |
| FR-4 | Re-entering any previously visible area after rapid chunk traversal must render biome terrain without blank hex artifacts. | P0 |
| FR-5 | Hydrated refresh flow must reconcile terrain even when tile data already exists in `exploredTiles`. | P1 |
| FR-6 | On detected terrain/entity divergence, self-heal refresh must converge within one refresh cycle. | P1 |

### Non-Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-1 | No chunk switch p95 regression greater than 10% from baseline. | P0 |
| NFR-2 | No growth in leaked subscriptions or orphaned pending switch promises in 20-minute stress run. | P0 |
| NFR-3 | Add diagnostics for bounds switch races, stale switch drops, cache invalidation fanout, and terrain-zero recovery events. | P0 |
| NFR-4 | Keep steady-state frame-time p95 regression within 5%. | P1 |

## Proposed Solution

### S1: Deterministic Torii Bounds Switching

1. Serialize `switchBounds` with monotonic switch generation.
2. Apply latest-wins semantics at manager level and stream manager level.
3. Prevent stale switch completion from overriding active subscription bookkeeping.
4. Expose debug counters:
   1. `bounds_switch_started`
   2. `bounds_switch_applied`
   3. `bounds_switch_stale_dropped`
   4. `bounds_switch_mismatch_detected`

### S2: Overlap-Aware Terrain Cache Invalidation

1. Replace single-containing-chunk invalidation with render-overlap invalidation.
2. For hex `(col,row)`, evict every cached chunk whose render bounds contain `(col,row)`.
3. Bound invalidation scope to currently cached keys to avoid brute-force world scan.
4. Add instrumentation:
   1. `cache_invalidation_hits`
   2. `cache_invalidation_chunks_per_hex`

### S3: Reconciliation Path Hardening

1. Ensure tile updates that are deduped by data state can still trigger targeted terrain reconciliation when needed.
2. Keep current self-heal (`monitorTerrainVisibilityHealth`) but add cause-tagged telemetry.
3. Run forced refresh if terrain count is zero while units/structures are visible in same chunk.

### S4: Tests

1. Unit tests for stale bounds switch suppression and area-key consistency.
2. Unit tests for overlap-aware cache invalidation.
3. Integration test for rapid chunk A -> B -> A with tile update in A during B residency.
4. Regression test that validates units-visible + terrain-zero cannot persist beyond recovery threshold.

## Implementation Plan

### Milestone M0: Instrumentation Baseline

Deliverables:

1. Add diagnostics fields and debug hooks for bounds switch and cache invalidation.
2. Capture baseline metrics for chunk-switch/refresh flows.

Exit criteria:

1. Diagnostics visible in dev with no behavior change.

### Milestone M1: Bounds Switch Correctness

Deliverables:

1. Serialize and guard Torii bounds switch flow.
2. Make `toriiBoundsAreaKey` authoritative and race-safe.

Exit criteria:

1. No reproducible subscription/area-key mismatch in synthetic rapid-switch test.

### Milestone M2: Cache Invalidation Correctness

Deliverables:

1. Implement overlap-aware invalidation helper.
2. Replace existing single-chunk invalidation path.

Exit criteria:

1. Repro path no longer produces blank biome on return.

### Milestone M3: Reconciliation Hardening + Tests

Deliverables:

1. Reconciliation trigger for deduped tile updates.
2. Add regression tests for ghosting sequence.

Exit criteria:

1. Full automated test matrix passes.
2. No manual ghosting reproduction in stress scenario.

### Milestone M4: Rollout

Deliverables:

1. Rollout behind flag if needed.
2. Dev soak and canary observation period.

Exit criteria:

1. Zero reported biome ghosting incidents in canary window.

## QA Test Matrix

1. Standard repro:
   1. Move unit in chunk A.
   2. Pan quickly to chunk B.
   3. Return to chunk A.
   4. Verify terrain present beneath units.
2. Boundary stress loop:
   1. Repeated A <-> B cross-boundary movement for 5 minutes.
   2. Validate no blank hexes.
3. Delayed switch race:
   1. Artificially delay bounds switch completion.
   2. Trigger rapid follow-up switch.
   3. Verify stale completion does not alter active area key.
4. Tile dedupe path:
   1. Emit update for already-known tile biome.
   2. Verify terrain remains correct or reconciles immediately.
5. Soak:
   1. 20-minute pan/zoom traversal.
   2. Verify counters show no leaked switches and no persistent terrain-zero windows.

## Telemetry and Observability

Add structured logs/counters:

1. `chunk_transition_token`
2. `torii_bounds_target_area`
3. `torii_bounds_active_area`
4. `torii_bounds_stale_drop_count`
5. `terrain_cache_invalidation_overlap_count`
6. `terrain_instances_total`
7. `terrain_self_heal_invocations`

Dashboards and alerts:

1. Alert when `torii_bounds_active_area != torii_bounds_target_area` persists across 2 consecutive transitions.
2. Alert when `terrain_instances_total === 0` while `visible.armies + visible.structures > 0` for > N frames.

## Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Overlap invalidation increases refresh cost | Medium | Invalidate only cached chunks whose render bounds contain updated hex; track fanout metrics and cap if necessary. |
| Serialized switching increases switch latency | Medium | Keep coalescing latest target and drop intermediate stale requests. |
| Added reconciliation introduces extra refreshes | Low | Gate by explicit divergence checks and cooldown. |
| Hidden edge cases in legacy listeners | Medium | Add targeted integration tests with synthetic delayed callbacks. |

## Open Questions

1. Should Torii bounds support a short overlap subscription window for old+new area to reduce delta gaps?
2. Should terrain reconciliation be chunk-local or tile-local when dedupe suppresses full update?
3. Do we want cache invalidation fanout fixed to max 4 windows (current geometry) or data-driven from render config?

## Acceptance Criteria

1. Reproduction sequence no longer causes missing biome tiles.
2. No observed case of units visible on blank hex after rapid cross-chunk camera movement.
3. Bounds subscription diagnostics show no persistent active-area mismatch.
4. Regression tests for stale switch and overlap invalidation pass in CI.

