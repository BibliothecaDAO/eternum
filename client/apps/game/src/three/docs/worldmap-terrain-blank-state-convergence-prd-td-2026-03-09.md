# PRD + TD: Worldmap Terrain Blank-State Convergence

## Overview

- Feature: Eliminate intermittent full-biome blank states in the worldmap terrain layer.
- Status: Draft v0.1
- Owner: Three / Worldmap
- Created: 2026-03-09
- Last Updated: 2026-03-09

## Executive Summary

The intermittent "all biome terrain disappeared" failure is most likely a **terrain convergence bug in the client
worldmap pipeline**, not a `MapDataStore` or SQL consistency issue.

## Delivery Checklist

- [x] M0. Instrument terrain candidate lifecycle, reconcile ownership, and terrain health snapshot metadata.
- [x] M1. Add terrain snapshot promotion/rejection rules so blank candidates cannot replace an active valid snapshot.
- [x] M2. Route fetch completion through latest-wins terrain reconcile ownership metadata.
- [x] M3. Gate cache replay and strip reuse on terrain revision compatibility.
- [x] M4. Re-run targeted worldmap tests and TypeScript compile validation.

Current worldmap behavior already contains several recovery mechanisms:

1. critical vs background Torii fetch separation
2. spectator terrain coverage polling
3. overlap-aware cache invalidation helpers
4. zero/partial/offscreen self-heal in `monitorTerrainVisibilityHealth()`

Those changes reduce symptom frequency, but they do not yet establish a single authoritative rule for when terrain is
allowed to replace the currently rendered snapshot. As a result, the scene can still temporarily commit or preserve a
terrain state that is:

1. built from stale/incomplete `exploredTiles`
2. accepted from cache reuse without a freshness proof
3. visually culled under new bounds before the replacement terrain is known-good
4. recovered only after a user-visible blank interval

This document defines a clean fix: make terrain updates **transactional and snapshot-based**, tie fetch completion to
an explicit terrain reconcile contract, and demote the current self-heal path to a fallback rather than the primary
correctness mechanism.

## Problem Statement

Players intermittently observe the worldmap with units or interaction still present while biome terrain is blank or
near-blank. The map usually recovers after a refresh, chunk movement, or zoom-triggered self-heal, but the failure
window is visible and erodes trust in world state.

This is a correctness issue first and a performance issue second. The terrain layer currently lacks a strict commit
contract across:

1. chunk transition sequencing
2. Torii fetch and stream hydration
3. terrain rebuild and cache reuse
4. bounds/frustum visibility handoff

## User Impact

### Primary Impact

1. Entire visible terrain can disappear temporarily.
2. Units and structures can remain visible on blank hexes, making the map look corrupted.
3. Recovery depends on secondary actions or heuristics instead of deterministic convergence.

### Secondary Impact

1. Debugging is noisy because the failure can recover before inspection.
2. Existing telemetry proves anomalies happened, but not why the bad terrain state was accepted.
3. Performance optimizations such as strip updates and cache reuse are harder to trust.

## Scope Source

This PRD/TD is based on the current codebase and the fresh scope note in:

1. `.context/worldmap-biome-missing-scope-2026-03-09.md`

It also consolidates adjacent prior docs in the same symptom family:

1. `client/apps/game/src/three/docs/worldmap-disappearing-hexes-tdd-prd.md`
2. `client/apps/game/src/three/docs/worldmap-zoom-visibility-hardening-prd.md`
3. `client/apps/game/src/three/docs/biome-ghosting-chunk-layer-prd.md`

## Current Findings

### F1. Terrain fetch success does not directly produce an authoritative terrain commit

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`

Evidence:

1. `computeTileEntities()` and `executeTileEntitiesFetch()` fetch tile data and then schedule later reconciliation.
2. Critical fetch completion may mark areas fetched and queue refresh behavior, but it does not itself atomically prove
   that the next terrain window is safe to commit.
3. Spectator mode has a coverage gate; non-spectator mode largely relies on rebuild timing and later refreshes.

Risk:

1. Terrain can rebuild from an incomplete source-of-truth window.

### F2. `updateHexagonGrid()` owns terrain commit, but not terrain freshness

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`

Evidence:

1. `updateHexagonGrid()` can apply cached matrices, strip-reused cells, or newly computed cells.
2. The function is optimized for frame budget and reuse, but it does not carry an explicit freshness/version proof for
   the terrain source it is committing.
3. `currentTerrainCells` and `currentTerrainWindow` represent what is currently committed, but not why it is still
   valid.

Risk:

1. A terrain window can be committed because it is available, not because it is authoritative.

### F3. Visibility and bounds can advance independently from terrain viability

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/managers/instanced-biome.tsx`

Evidence:

1. `performChunkSwitch()` registers candidate bounds early and updates current bounds on commit.
2. Biome meshes are still frustum/world-bounds sensitive.
3. Recovery code already tracks offscreen current chunk anomalies, which indicates this handoff is still fragile.

Risk:

1. A good terrain snapshot can be hidden by bounds state, or a bad snapshot can become the only visible authority.

### F4. Self-heal currently masks a missing invariant

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-terrain-health.ts`
3. `client/apps/game/src/three/scenes/worldmap-zoom-hardening.ts`

Evidence:

1. `monitorTerrainVisibilityHealth()` tracks zero-terrain, low-terrain, and offscreen anomalies.
2. On threshold breach it forces `updateVisibleChunks(true)`.
3. This is useful, but it triggers only after the user-visible failure has already happened.

Risk:

1. The system recovers from invalid terrain states instead of preventing them.

### F5. Cache reuse is treated as an optimization, but behaves like authority

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-hex-grid.ts`

Evidence:

1. Full cached matrix replay and strip updates are allowed when shape/bounds conditions match.
2. Cache invalidation exists, including overlap-aware invalidation, but cache keys are not versioned against terrain
   source revisions.
3. A reused terrain window can therefore survive source changes unless every relevant invalidation path fired.

Risk:

1. Optimization state can outlive correctness state.

### F6. Torii bounds switching is improved, but integration still has a verification gap

Relevant code:

1. `client/apps/game/src/dojo/torii-stream-manager.ts`
2. `client/apps/game/src/three/scenes/worldmap.tsx`

Evidence:

1. `ToriiStreamManager` uses latest-wins switching and stale-drop semantics.
2. The local scope note explicitly records a remaining integration-test gap because the Torii stream suite did not run
   in this environment due to a `.wasm` loader issue.

Risk:

1. Stream correctness may still be weaker in integration than it appears in isolated logic.

## Goals

1. Prevent full-terrain blank states from being committed during active worldmap use.
2. Ensure terrain, chunk identity, and bounds visibility converge under one explicit contract.
3. Preserve current performance work such as strip updates and background hydration, but make them subordinate to
   correctness.
4. Keep self-heal as a fallback and telemetry source, not the primary success path.
5. Add deterministic tests for the specific failure class: fetch succeeded or stream updated, but terrain still became
   blank.

## Non-Goals

1. Rewriting the worldmap renderer from scratch.
2. Replacing Torii transport or indexer schema.
3. Moving biome authority into `MapDataStore`.
4. Changing world art, mesh assets, or chunk geometry constants.
5. Solving every worldmap visual issue unrelated to terrain convergence.

## Product Requirements

### Functional Requirements

| ID   | Requirement                                                                                                         | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | Terrain replacement must use an explicit commit gate; candidate terrain cannot replace active terrain opportunistically. | P0       |
| FR-2 | Active terrain must remain render-authoritative until the replacement snapshot is proven viable.                    | P0       |
| FR-3 | Critical map fetch completion for the active area must trigger a deterministic terrain reconcile path.             | P0       |
| FR-4 | Cache replay or strip reuse must require source-version compatibility, not only geometric compatibility.           | P0       |
| FR-5 | Bounds and frustum handoff must not create a blank window while switching terrain authority.                       | P0       |
| FR-6 | Zero-terrain or severe partial-terrain candidates must be rejected unless the system can prove the window is legitimately empty. | P0       |
| FR-7 | Recovery telemetry must include enough state to explain why a candidate was rejected or why fallback ran.          | P1       |
| FR-8 | Spectator and non-spectator flows must share the same terrain commit rules, with spectator allowed stricter coverage checks. | P1       |

### Non-Functional Requirements

| ID    | Requirement                                                                                          | Priority |
| ----- | ---------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | Chunk-switch p95 regression must stay within +10% of current worldmap baseline.                     | P0       |
| NFR-2 | No new long-lived terrain blank states in scripted traversal and spectator entry scenarios.          | P0       |
| NFR-3 | New tests must be deterministic and not depend on real network timing.                              | P0       |
| NFR-4 | Background hydration and strip-update performance wins must remain available when correctness permits. | P1       |
| NFR-5 | Diagnostics must clearly separate prevention events, rejected candidates, and fallback recoveries.  | P1       |

## Success Metrics

1. `terrain_blank_commit_rejected` counter is non-zero in stress tests only when a bad candidate was prevented, not
   when a user-visible blank state occurred.
2. `monitorTerrainVisibilityHealth()` fallback triggers become rare and trend toward zero in local stress validation.
3. Worldmap scripted traversal shows no persistent `totalTerrainInstances === 0` interval after initial scene entry.
4. Spectator entry reaches viable terrain without requiring a second forced refresh in the happy path.

## Technical Design

### D1. Introduce Terrain Snapshot Authority

Add a small scene-local model that separates:

1. `activeTerrainSnapshot`
2. `candidateTerrainSnapshot`

Proposed shape:

```ts
interface WorldmapTerrainSnapshot {
  chunkKey: string;
  areaKey: string;
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
  transitionToken: number;
  terrainRevision: number;
  source: "cache" | "strip" | "critical_fetch" | "background_fetch" | "stream";
  totalInstances: number;
  referenceInstances: number;
  biomeCounts: Record<string, number>;
  fetchedAreaLoaded: boolean;
  criticalAreaLoaded: boolean;
  builtAtMs: number;
}
```

Rules:

1. `activeTerrainSnapshot` is the only terrain state allowed to drive visible authority.
2. `candidateTerrainSnapshot` is built off-thread or incrementally exactly as today, but it is not promoted until it
   passes a viability check.
3. `terrainRevision` increments whenever terrain source changes materially:
   1. `updateExploredHex(...)`
   2. `hydrateExploredTilesFromFetchedBounds(...)`
   3. forced invalidation of active render area

### D2. Add a Terrain Candidate Viability Gate

Before promoting a candidate:

1. verify `transitionToken === this.chunkTransitionToken`
2. verify candidate chunk/area still matches the intended active render target
3. verify cache/strip source revision is compatible with the latest terrain revision
4. evaluate a viability policy:
   1. reject total-zero terrain if the previous active snapshot had visible terrain and the target window is expected to
      contain terrain
   2. reject severe partial terrain collapse relative to reference thresholds
   3. allow zero terrain only when the expected visible terrain count is legitimately zero
   4. allow stricter coverage rules in spectator mode

If the candidate fails:

1. keep `activeTerrainSnapshot`
2. emit a structured reject event
3. request a targeted reconcile rather than allowing the blank candidate through

This makes prevention explicit instead of relying on post-failure self-heal.

### D3. Link Critical Fetch Completion to Terrain Reconcile Ownership

Current fetch flow should be extended so critical fetch completion for the active area produces a deterministic terrain
reconcile request with ownership metadata:

1. `chunkKey`
2. `areaKey`
3. `transitionToken`
4. `terrainRevisionAtFetchStart`
5. `terrainRevisionAtFetchComplete`
6. `priority`

Rules:

1. Critical fetch completion for the current area schedules an immediate or latest-wins terrain reconcile job.
2. Background fetch completion may warm caches and schedule non-blocking reconcile only when the area is still relevant.
3. Terrain reconcile jobs older than the latest revision/transition are dropped before apply.

This replaces the loose "fetch completed, hope later refresh converges" model.

### D4. Version Cache Reuse and Strip Updates

Keep cache replay and strip reuse, but gate them by source revision:

1. Cache entries store `terrainRevision` and `areaKey`.
2. Strip-update planning remains geometric, but strip application requires that retained cells come from the same
   revision lineage as the target window.
3. Any tile update that overlaps cached windows invalidates cache entries whose render bounds include that tile.
4. Cache application is a candidate-build optimization only; it cannot bypass the viability gate.

This preserves the performance work while making stale reuse observable and rejectable.

### D5. Make Bounds Handoff Terrain-Aware

Current bounds overlap behavior should be formalized around terrain commit:

1. Candidate chunk bounds may be registered during prepare.
2. Previous active bounds remain render-authoritative until candidate terrain promotion succeeds.
3. `currentChunkBounds` and active terrain snapshot advance together at commit time.
4. Old bounds unregister only after successful terrain promotion.

Result:

1. no blank interval caused by visibility authority moving ahead of terrain authority

### D6. Reframe Self-Heal as Fallback Only

Keep `monitorTerrainVisibilityHealth()` and current terrain health state, but reposition them:

1. primary purpose: detect invariant breach and collect evidence
2. fallback purpose: recover if prevention failed
3. not primary purpose: routine convergence

Add new diagnostics:

1. `terrain_candidate_built`
2. `terrain_candidate_rejected`
3. `terrain_candidate_promoted`
4. `terrain_cache_reuse_attempted`
5. `terrain_cache_reuse_rejected`
6. `terrain_reconcile_requested`
7. `terrain_reconcile_dropped_stale`
8. `terrain_fallback_recovery_started`

### D7. Centralize the Policy in a Pure Helper Layer

Avoid burying the new rules entirely inside `worldmap.tsx`.

Add pure helpers for:

1. candidate viability evaluation
2. terrain snapshot promotion decision
3. terrain reconcile ownership decision
4. cache compatibility evaluation

This follows the existing pattern already used in `worldmap-chunk-transition.ts` and keeps the bug fix testable without
full runtime construction.

## Invariants

1. Visible terrain authority is always represented by exactly one promoted terrain snapshot.
2. Cache reuse is never authoritative without revision compatibility.
3. A stale transition or stale terrain revision may build a candidate, but it may not promote it.
4. The system prefers keeping the last known-good terrain over promoting a blank or suspicious candidate.
5. Fallback recovery means prevention failed and must be observable as such.

## Implementation Plan

### M0. Instrumentation and Proof of Failure

Deliverables:

1. Add terrain revision counters and candidate lifecycle telemetry.
2. Extend terrain health debug snapshots with candidate rejection reason and last promoted snapshot metadata.
3. Add one deterministic integration fixture reproducing:
   1. active chunk switch
   2. successful fetch or stream hydration
   3. candidate terrain build that would otherwise become blank
   4. candidate rejection and targeted reconcile

Exit criteria:

1. We can distinguish "candidate was bad but rejected" from "blank state became visible".

### M1. Terrain Snapshot Promotion

Deliverables:

1. Add `activeTerrainSnapshot` / `candidateTerrainSnapshot`.
2. Promote terrain only through the new viability gate.
3. Keep previous terrain visible when the next candidate is rejected.

Exit criteria:

1. Blank candidate cannot replace an already valid terrain window in tests.

### M2. Fetch-to-Reconcile Ownership

Deliverables:

1. Add ownership metadata from critical fetch completion to terrain reconcile scheduling.
2. Make reconcile latest-wins by transition token and terrain revision.
3. Apply the same model to spectator hydration retry logic.

Exit criteria:

1. Fetch success for the active area deterministically drives the next authoritative terrain attempt.

### M3. Cache and Bounds Hardening

Deliverables:

1. Add revision-aware cache metadata.
2. Reject cache or strip reuse when revision compatibility is missing.
3. Couple current bounds commit with terrain snapshot promotion.

Exit criteria:

1. Returning to a cached area cannot replay known-stale terrain as authority.

### M4. Validation and Rollout

Deliverables:

1. Run targeted worldmap tests and the worldmap terrain health E2E/spec harness.
2. Validate chunk-switch p95 and fetch volume against current baselines.
3. Roll out behind a dedicated feature flag if needed.

Exit criteria:

1. No user-visible terrain blank interval in the target repro paths.

## Test Plan

### Unit Tests

1. Candidate viability rejects total-zero terrain when prior active terrain is valid.
2. Candidate viability allows legitimate empty result only when expected terrain count is zero.
3. Cache compatibility rejects mismatched terrain revisions.
4. Promotion logic drops stale transition-token candidates.
5. Fetch-to-reconcile ownership keeps only the latest terrain reconcile request.

### Integration Tests

1. Chunk switch with successful critical fetch but stale/incomplete candidate must preserve previous terrain.
2. Spectator hydration timeout path must reject under-covered terrain and retry reconcile without blank promotion.
3. Bounds handoff must not make current chunk invisible while active terrain remains valid.
4. Cache replay of a previously rendered area must be rejected when overlapping tile updates changed terrain revision.

### Runtime Validation

1. Existing `worldmap-performance.spec.ts`
2. Existing `worldmap-terrain-health.spec.ts`
3. A new worldmap traversal scenario focused on "fetch succeeded, terrain remained blank"

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
3. `client/apps/game/src/three/scenes/worldmap-terrain-health.ts`
4. `client/apps/game/src/three/scenes/worldmap-zoom-hardening.ts`
5. `client/apps/game/src/dojo/torii-stream-manager.ts`
6. targeted worldmap scene tests and E2E terrain health specs

### Out of Scope

1. `packages/core/src/stores/map-data-store.ts`
2. structure/army SQL enrichment logic
3. contract/indexer schema changes
4. renderer asset/model loading work unless new evidence points there

## Risks and Mitigations

| Risk                                             | Impact | Mitigation                                                                 |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| Snapshot promotion adds state complexity         | Medium | Keep policy helpers pure and scene-local; instrument every reject/promotion |
| Overly strict viability gate blocks valid updates | Medium | Make thresholds explicit and mode-aware; stage with telemetry first        |
| Revision-aware cache policy reduces perf wins    | Medium | Keep cache reuse enabled when revisions match; measure p95 regression      |
| Bounds coupling introduces new switch timing     | Medium | Reuse existing transition token model and overlap strategy                 |

## Open Questions

1. Should non-spectator mode use a lightweight expected-terrain estimate, or only reject zero candidates when a prior
   active snapshot proves terrain should exist?
2. Is a dedicated feature flag needed, or can this ship under existing zoom-hardening/worldmap hardening controls?
3. Should stream-manager integration get a non-wasm test seam before rollout, given the current environment gap?

## Acceptance Criteria

1. The worldmap never promotes a blank terrain candidate over a valid active terrain snapshot in the target repro
   scenarios.
2. Critical fetch completion for the active area deterministically results in a terrain reconcile attempt with revision
   ownership.
3. Cache replay and strip reuse are rejected when their source revision is stale.
4. Fallback terrain recovery becomes an exceptional path rather than a routine convergence mechanism.
5. Targeted unit and integration tests cover the prevention path, not only the fallback path.
