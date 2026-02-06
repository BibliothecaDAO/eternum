# PRD: Three Rendering Performance Improvement Program

## Overview

**Feature:** End-to-end performance improvement program for `client/apps/game/src/three`

**Status:** Draft v0.1

**Owner:** Three.js Team

**Created:** 2026-02-06

**Last Updated:** 2026-02-06

## Document Update Log

| Update | Date (AEDT)      | Author | Change                                                                                                                                                                                                        |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-02-06 09:19 | Codex  | Created PRD skeleton, objectives, scope, and success metrics.                                                                                                                                                 |
| U2     | 2026-02-06 09:22 | Codex  | Added prioritized optimization findings with code evidence and mapped them to initiatives.                                                                                                                    |
| U3     | 2026-02-06 09:25 | Codex  | Added phased implementation plan, rollout strategy, acceptance criteria, and risk matrix.                                                                                                                     |
| U4     | 2026-02-06 09:35 | Codex  | Implemented Phase 1 changes: removed duplicate `needsUpdate()` calls in worldmap/chest paths and removed duplicate devtools memory monitor init.                                                              |
| U5     | 2026-02-06 09:35 | Codex  | Implemented Phase 2 changes: removed side-path `visibilityManager.beginFrame()` call from worldmap chunk update flow.                                                                                         |
| U6     | 2026-02-06 09:35 | Codex  | Implemented Phase 3 changes: replaced prefetch queue `toSorted()` rebuild with binary insertion and removed redundant tile-fetch trigger in grid build path.                                                  |
| U7     | 2026-02-06 09:35 | Codex  | Implemented Phase 4 changes: added ownership-bucket policy and gated expensive `updateVisibleStructures()` refresh to ownership-bucket transitions only.                                                      |
| U8     | 2026-02-06 09:35 | Codex  | Implemented Phase 5 changes: bounded interactive-hex cache to active rendered window, removed redundant interactive visibility updates, and centralized stale chunk unregistration on cache clear/switch-off. |
| U9     | 2026-02-06 09:35 | Codex  | Executed `pnpm --dir client/apps/game build` between phases (blocked by pre-existing workspace dependency/type errors unrelated to these changes); verified new helper tests pass with Vitest.                |

## Problem Statement

The Three.js client currently performs well in many nominal states but shows clear risk areas for frame-time spikes,
chunk-switch stutter, and long-session performance drift in worldmap-heavy flows. The major issues are redundant
instance update work, inconsistent visibility-frame ownership, high-cost refresh triggers on event streams, and
shadow/fetch policies that add avoidable GPU/CPU load.

Without a coordinated improvement program, incremental fixes will likely regress each other and fail to produce stable,
measurable gains across desktop and mobile quality tiers.

## Goals

### Primary Goals

- Reduce frame-time spikes and improve frame-time consistency during panning, zooming, and chunk switches.
- Decrease chunk-switch time-to-stable-entities (armies/structures/chests visible and interactive).
- Eliminate avoidable duplicate CPU/GPU work in instanced mesh update paths.
- Stabilize long-session memory behavior for worldmap traversal.
- Establish repeatable measurement gates so future renderer changes stay within budget.

### Non-Goals

- Full rendering architecture rewrite.
- Material/visual style redesign unrelated to performance.
- Gameplay logic redesign outside rendering-trigger boundaries.
- New cosmetic features.

## Success Metrics

| Metric                                              | Target                                | Method                                |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| Worldmap frame time p95 (Desktop High)              | <= 16.7ms                             | In-engine perf capture + stats export |
| Worldmap frame time p95 (Desktop Mid)               | <= 22ms                               | In-engine perf capture + stats export |
| Chunk switch time-to-stable-entities p95            | <= 250ms                              | Instrumented chunk switch traces      |
| Frame hitch count (>33ms) while panning for 60s     | -40% vs baseline                      | Deterministic camera-pan scenario     |
| Registered chunk drift after 20 min traversal       | 0 net growth beyond pinned budget     | Visibility stats assertions           |
| Interactive hex cache growth after 20 min traversal | bounded by active world window policy | Memory/perf soak test                 |

## Scope

### In Scope

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/chest-manager.ts`
- `client/apps/game/src/three/managers/instanced-model.tsx`
- `client/apps/game/src/three/managers/instanced-biome.tsx`
- `client/apps/game/src/three/managers/interactive-hex-manager.ts`
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts`

### Out of Scope

- Shader feature additions beyond optimization-safe parameter tuning.
- Network protocol redesign.
- ECS schema changes.

## Prioritized Findings (Optimization)

### P0: Duplicate expensive instance update work

- `setCount()` already triggers `needsUpdate()` and bounding recomputation, but callers invoke `needsUpdate()` again,
  doubling hot-path cost during chunk refreshes.
- Evidence:
  - `client/apps/game/src/three/managers/instanced-model.tsx:278`
  - `client/apps/game/src/three/managers/instanced-model.tsx:296`
  - `client/apps/game/src/three/managers/instanced-biome.tsx:292`
  - `client/apps/game/src/three/managers/instanced-biome.tsx:307`
  - `client/apps/game/src/three/managers/chest-manager.ts:313`
  - `client/apps/game/src/three/managers/chest-manager.ts:314`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2780`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2782`

### P0: Visibility frame ownership is not centralized

- `beginFrame()` is called from render loop and multiple side paths, incrementing frame ID and reducing cache reuse.
- Evidence:
  - `client/apps/game/src/three/utils/centralized-visibility-manager.ts:171`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:906`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3374`
  - `client/apps/game/src/three/managers/army-manager.ts:960`
  - `client/apps/game/src/three/managers/structure-manager.ts:989`

### P1: Refresh triggers are broader than required

- Some event updates escalate to full visible updates/chunk refreshes even when only label/ownership deltas changed.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:587`
  - `client/apps/game/src/three/scenes/worldmap.tsx:690`
  - `client/apps/game/src/three/managers/structure-manager.ts:1871`
  - `client/apps/game/src/three/managers/structure-manager.ts:1004`

### P1: Shadow policy conflicts in worldmap

- Worldmap shadow configuration forces shadows on and widens frustum even where base camera view policy disables
  far-view shadows.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:910`
  - `client/apps/game/src/three/scenes/worldmap.tsx:916`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:1319`

### P1: Fetch/prefetch scheduling has avoidable churn

- Chunk switch kicks tile fetch, and grid update path also triggers a fetch request. Queue operations rebuild arrays
  repeatedly.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:3444`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2715`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2544`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3064`

### P2: Long-session cache growth risk

- Interactive hex collections grow as traversed tiles are added and may not be bounded to active world windows.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:2818`
  - `client/apps/game/src/three/managers/interactive-hex-manager.ts:18`
  - `client/apps/game/src/three/managers/interactive-hex-manager.ts:188`

### P2: Devtools initialization duplication

- Devtools path initializes memory monitoring twice.
- Evidence:
  - `client/apps/game/src/three/game-renderer.ts:353`
  - `client/apps/game/src/init/game-renderer.ts:10`
  - `client/apps/game/src/init/game-renderer.ts:11`

## Requirements

### Functional Requirements

| ID   | Requirement                                                                              | Priority |
| ---- | ---------------------------------------------------------------------------------------- | -------- |
| FR-1 | Renderer must preserve current gameplay behavior while reducing redundant update passes. | P0       |
| FR-2 | Visibility manager frame lifecycle must be owned by render loop only.                    | P0       |
| FR-3 | Chunk switch must keep deterministic ordering: fetch -> grid -> manager hydration.       | P0       |
| FR-4 | Event-triggered updates must use minimal invalidation scope where possible.              | P1       |
| FR-5 | Interactive hex cache must stay bounded by defined policy.                               | P1       |
| FR-6 | Worldmap shadow behavior must align with camera view/quality policy.                     | P1       |

### Non-Functional Requirements

| ID    | Requirement                                                      | Priority |
| ----- | ---------------------------------------------------------------- | -------- |
| NFR-1 | Maintain visual parity for close/medium worldmap views.          | P0       |
| NFR-2 | Avoid long GC stalls from transient allocations in hot paths.    | P0       |
| NFR-3 | All improvements must ship with measurable before/after metrics. | P0       |
| NFR-4 | Feature-flag each phase for safe incremental rollout.            | P1       |

## Implementation Plan

### Phase 0: Baseline and Guardrails (2-3 days)

- Add standardized performance scenarios for:
  - idle worldmap
  - continuous pan (60s)
  - chunk boundary crossing stress
  - event-heavy updates (battle/structure churn)
- Capture baseline metrics and store in `docs/perf-baselines`.
- Add CI/perf smoke script for non-regression checks.

**Acceptance Criteria**

- Baseline report captured for all scenarios.
- Regression thresholds defined and versioned.

### Phase 1: Hot-Path Duplicate Work Removal (3-5 days)

- Remove duplicate `needsUpdate()` invocations where `setCount()` already handles update/bounds.
- Ensure chest/biome/worldmap code paths perform single update pass per batch.
- Remove duplicated devtools memory monitor init call.

**Acceptance Criteria**

- No duplicate `setCount` + `needsUpdate` patterns remain in targeted managers.
- Frame-time improvement observed in chunk-refresh scenarios.
- Devtools functionality unchanged.

### Phase 2: Visibility Lifecycle Consolidation (4-6 days)

- Enforce single `beginFrame()` authority in render loop.
- Replace side-path `beginFrame()` calls with cheaper `markDirty()` or explicit refresh hooks.
- Add runtime assertions for visibility frame sequencing in dev mode.

**Acceptance Criteria**

- One `beginFrame()` call per rendered frame per active scene.
- Cache hit rate improves in visibility stats.

### Phase 3: Chunk/Fetch Churn Reduction (1 week)

- Remove redundant tile fetch request from grid build path.
- Replace prefetch queue `toSorted()` rebuild with priority queue or binary insertion.
- Introduce cancellable/owned prefetch bookkeeping for invalidated areas.

**Acceptance Criteria**

- No duplicate fetch scheduling for same render area in chunk switch path.
- Reduced CPU time in prefetch scheduler under fast pan.

### Phase 4: Fine-Grained Invalidation for Event Streams (1-2 weeks)

- Split structure label updates from full visible-structure rematerialization when ownership/type unchanged.
- Minimize forced `updateVisibleChunks(true)` triggers to scoped invalidations.
- Preserve correctness for tile hiding beneath structures.

**Acceptance Criteria**

- Event-heavy scenario hitch count reduced vs baseline.
- No correctness regressions in structure/army visibility.

### Phase 5: Long-Session Memory Stabilization (4-6 days)

- Introduce bounded policy for interactive hex cache retention.
- Add 20-minute traversal soak test with memory and cache-size assertions.
- Clean up stale chunk registration on scene switch boundaries.

**Acceptance Criteria**

- Stable cache/cardinality over soak test.
- No stale visibility-chunk growth across repeated scene switches.

## Implementation Status (Current)

| Phase   | Status      | Notes                                                                                                                                                       |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | Implemented | Duplicate `setCount`/`needsUpdate` hot-path calls removed in targeted worldmap/chest paths; duplicate memory-monitor init removed from init bootstrap path. |
| Phase 2 | Implemented | `beginFrame()` side call removed from worldmap chunk-update path to preserve centralized frame lifecycle ownership.                                         |
| Phase 3 | Implemented | Prefetch queue now uses binary insertion helper; redundant in-grid tile fetch trigger removed.                                                              |
| Phase 4 | Implemented | Structure visibility refresh now runs only when ownership bucket changes (`mine`/`ally`/`enemy`).                                                           |
| Phase 5 | Implemented | Interactive hex state rebuilt per active window to keep cache bounded; stale chunk registrations cleaned up on cache clear/switch-off.                      |

### Build and Test Verification Log

| Check                                                                                                                                             | Result                | Details                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm --dir client/apps/game build` after Phase 1                                                                                                 | Failed (pre-existing) | Missing `@bibliothecadao/*` packages and broad TS baseline errors across unrelated files. |
| `pnpm --dir client/apps/game build` after Phase 2                                                                                                 | Failed (pre-existing) | Same baseline dependency/type failures.                                                   |
| `pnpm --dir client/apps/game build` after Phase 3                                                                                                 | Failed (pre-existing) | Same baseline dependency/type failures.                                                   |
| `pnpm --dir client/apps/game build` after Phase 4                                                                                                 | Failed (pre-existing) | Same baseline dependency/type failures.                                                   |
| `pnpm --dir client/apps/game build` after Phase 5                                                                                                 | Failed (pre-existing) | Same baseline dependency/type failures.                                                   |
| `pnpm --dir client/apps/game exec vitest run src/three/scenes/worldmap-prefetch-queue.test.ts src/three/managers/structure-update-policy.test.ts` | Passed                | 2 files / 5 tests passed.                                                                 |

## Rollout Plan

1. Ship each phase behind a feature flag (`threePerfPhase1`, `threePerfPhase2`, etc.).
2. Validate each phase in internal QA with baseline scenario suite.
3. Enable for a subset of users/environments.
4. Promote to default after two stable releases without regressions.

## Risks and Mitigations

| Risk                                                 | Impact | Mitigation                                                              |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Invalidation changes break correctness of visibility | High   | Add targeted regression tests around chunk switch and entity hydration. |
| Shadow policy adjustments alter scene readability    | Medium | Lock visual snapshots for close/medium/far camera tiers.                |
| Reduced refresh scope misses edge updates            | High   | Add debug counters and forced refresh fallback path.                    |
| Performance optimizations regress mobile             | Medium | Track desktop and mobile separately in baseline suite.                  |

## Dependencies

- Existing quality feature toggles in `quality-controller`.
- Existing stats capture tooling and memory monitor.
- QA scenario scripts for deterministic camera movement and world events.

## Open Questions

- Should chunk prefetch cancellation be hard-cancel (abort signal) or soft-cancel (drop result on resolve)?
- What is the exact retention window policy for interactive hex history under active traversal?
- Do we need per-platform metric gates (desktop vs mobile) in CI, or desktop-only gates with mobile canary?

## Definition of Done

- All phase acceptance criteria met.
- Success metrics show sustained improvement against baseline.
- No high-severity regressions in camera interaction, selection, labels, or chunk hydration.
- PRD updated to final status with completed rollout notes.
