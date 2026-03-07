# PRD + TDD: Worldmap "Charting Territories" Fetch Latency

## Overview

- Feature: Reduce world-map lag that coincides with the `LoadingStateKey.Map` / `"Charting Territories"` loader.
- Status: Draft v0.1
- Owner: Three / Worldmap / Dojo Sync
- Created: 2026-03-07
- Last Updated: 2026-03-07

## Executive Summary

The current world-map lag during `"Charting Territories"` is no longer primarily a renderer problem. The label is
raised directly by `beginToriiFetch()` / `endToriiFetch()` in
`client/apps/game/src/three/scenes/worldmap.tsx`, which means the user-visible hitch is now dominated by **cold tile
fetch + client-side ingestion**.

The current fetch strategy is intentionally broad:

1. stride chunk size is `24`
2. visible render window is `48x48`
3. Torii fetches are coalesced into `4x4` stride-chunk super-areas

That means a single cold area fetch can cover roughly `120x120` hexes before overlap is accounted for. The first
playable frame is therefore coupled to a large `TileOpt` fetch and a large ECS write.

The next optimization pass should focus on **shrinking first-playable fetch cost** and **separating critical readiness
from background hydration**, not on more terrain CPU work.

## Problem Statement

When `"Charting Territories"` is visible, the map still feels laggy or frozen. This is because the loader currently
tracks the full lifecycle of cold `TileOpt` fetches, and those fetches are both:

1. large on the network side
2. heavy on the main-thread ingest side

Even with smoother warm chunk crossings, the user still experiences lag at the moment the loader appears because the
client is synchronously waiting on too much map data to become available and applied.

## Current Findings

### F1. `"Charting Territories"` is specifically the map fetch state

Evidence:

1. `WorldLoading` renders `"Charting Territories"` only when `loadingStates[LoadingStateKey.Map]` is true:
   `client/apps/game/src/ui/shared/components/world-loading.tsx`
2. `LoadingStateKey.Map` is toggled by `beginToriiFetch()` / `endToriiFetch()`:
   `client/apps/game/src/three/scenes/worldmap.tsx`

Implication:

1. When users report lag while this label is visible, they are describing the map tile fetch path, not a generic
   unrelated loader.

### F2. Cold map fetches are large by design

Evidence:

1. Chunk stride is `24` and render window is `48x48`:
   `client/apps/game/src/three/constants/world-chunk-config.ts`
2. Torii fetches are coalesced into `4x4` stride-chunk super-areas:
   `client/apps/game/src/three/constants/world-chunk-config.ts`
3. Fetch bounds use the first and last render window in that super-area:
   `client/apps/game/src/three/scenes/worldmap-chunk-bounds.ts`
4. `getMapFromToriiExact(...)` fetches every `TileOpt` row in the resulting rectangle:
   `client/apps/game/src/dojo/queries.ts`

Implication:

1. The first fetch for a new cold area is much bigger than the visible `48x48` window.
2. The loader stays up for a super-area fetch, not only the minimal current viewport.

### F3. The fetch cost includes main-thread ECS ingestion

Evidence:

1. `getMapFromToriiExact(...)` delegates to `getEntities(...)` with the `TileOpt` model:
   `client/apps/game/src/dojo/queries.ts`
2. World-map tile fetch completion is part of cold chunk hydration in:
   `client/apps/game/src/three/scenes/worldmap.tsx`

Implication:

1. `"Charting Territories"` measures network + parse + ECS write cost together.
2. The visible hitch can be a main-thread ingest stall even if network latency is acceptable.

### F4. Chunk switch fetch fan-out still amplifies cold area entry

Evidence:

1. `performChunkSwitch(...)` fetches the target chunk and also kicks surrounding chunk fetches:
   `client/apps/game/src/three/scenes/worldmap.tsx`
2. Directional prefetch is also active:
   `client/apps/game/src/three/scenes/worldmap.tsx`

Implication:

1. Deduping prevents true duplicate requests, but the first cold entry into a new render area still triggers expensive
   work immediately.

### F5. Startup sync was partially serialized

Evidence:

1. `initialSync()` previously created `parallelTasks` but only used it for the bank query:
   `client/apps/game/src/dojo/sync.ts`
2. Config, address names, guilds, and `MapDataStore.refresh()` were awaited one-by-one.

Implication:

1. Bootstrap loader time included unnecessary serialization beyond the map tile fetch path.
2. This has already been improved, but it does not remove the cold `TileOpt` fetch bottleneck itself.

## Goals

1. Reduce time-to-first-playable-world-map while `"Charting Territories"` is active.
2. Reduce the amount of `TileOpt` data required before the first stable visible map frame.
3. Keep background hydration working after the first playable frame without correctness regressions.
4. Add explicit measurements so future fetch changes are evaluated with real cold-start numbers.

## Non-Goals

1. Torii protocol redesign.
2. ECS library rewrite.
3. Removal of all background map hydration.
4. Worldmap visual redesign.

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-bounds.ts`
3. `client/apps/game/src/dojo/queries.ts`
4. `client/apps/game/src/dojo/sync.ts`
5. `client/apps/game/src/ui/shared/components/world-loading.tsx`
6. Loader/ready policy docs/tests around world-map readiness

### Out of Scope

1. Contract/indexer schema changes
2. General-purpose Torii client changes outside this app
3. Broad onboarding/landing UX redesign

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                   | Priority |
| ---- | --------------------------------------------------------------------------------------------- | -------- |
| FR-1 | First playable world-map frame must not require the full coalesced super-area payload.        | P0       |
| FR-2 | Background hydration must continue after first render for surrounding/prefetch areas.         | P0       |
| FR-3 | `LoadingStateKey.Map` must represent critical blocking fetch only, not all background fetches | P0       |
| FR-4 | Chunk switch correctness must remain unchanged under stale-token, switch-off, and retry paths | P0       |
| FR-5 | Cold fetch failures must still retry safely without wedging map state                         | P1       |

### Non-Functional Requirements

| ID    | Requirement                                                            | Priority |
| ----- | ---------------------------------------------------------------------- | -------- |
| NFR-1 | Cold world-map first-playable latency should drop measurably           | P0       |
| NFR-2 | No regression in warm chunk-crossing p95 from the strip-update pass    | P0       |
| NFR-3 | New tests must be deterministic and not depend on network timing       | P0       |
| NFR-4 | Loader semantics must become more accurate, not just less visible       | P1       |

## Proposed Design

### D1. Split "critical map fetch" from "background hydration"

Current behavior:

1. `beginToriiFetch()` marks `LoadingStateKey.Map = true` whenever any `getMapFromToriiExact(...)` begins.
2. This includes cold critical fetches and non-critical background area fetches.

Target behavior:

1. Introduce a scoped loading counter for **critical** world-map fetches.
2. Background surrounding/prefetch fetches should not keep `"Charting Territories"` visible once the current visible
   area is playable.

### D2. Reduce first-playable fetch area

Current behavior:

1. `computeTileEntities(...)` fetches by render-area key using `4x4` stride-chunk coalescing.

Target behavior:

1. For the first render of a cold target area, fetch only the minimal area needed for the current visible chunk.
2. Defer the wider super-area hydration until after first playable frame.

Possible first cut:

1. Add a `fetchMode: "critical" | "background"` path.
2. Critical path uses chunk-local render bounds.
3. Background path keeps current super-area behavior.

### D3. Keep surrounding/prefetch work, but demote its priority

Current behavior:

1. Surrounding chunk fetches are kicked immediately in `performChunkSwitch(...)`.

Target behavior:

1. The current visible area fetch remains blocking only until the first stable render.
2. Surrounding and directional prefetches run after commit as non-blocking background hydration.

### D4. Make loader readiness match "first playable frame"

Current behavior:

1. Loader state reflects whether any map fetch is in flight.

Target behavior:

1. `"Charting Territories"` ends when the current visible area can render and interact.
2. Background hydration can continue silently or through a lighter non-blocking indicator.

## TDD Delivery Plan

- [ ] T1. Add source/behavior tests proving `LoadingStateKey.Map` is only used for critical fetch state.
- [ ] T2. Add tests for a fetch-plan helper that distinguishes critical current-area fetch from background area hydration.
- [ ] T3. Add tests for cold world-map switch scheduling so surrounding/prefetch fetches are not part of the blocking loader path.
- [ ] T4. Implement a pure helper for world-map fetch scope selection.
- [ ] T5. Implement critical-vs-background loader counters in `worldmap.tsx`.
- [ ] T6. Implement minimal current-area fetch for first-playable render.
- [ ] T7. Defer surrounding/prefetch super-area hydration until after critical commit.
- [ ] T8. Run targeted tests and collect before/after cold-start timings.

## Milestone Breakdown

### M1. Measurement and helper scaffolding

Deliverables:

1. fetch-scope helper
2. test coverage for critical/background classification
3. explicit benchmark fields for critical fetch vs background hydration

Acceptance:

1. No behavior change yet
2. Tests red then green around helper logic

### M2. Critical-path reduction

Deliverables:

1. current visible area fetch becomes the only blocking map fetch
2. loader tracks critical fetch only

Acceptance:

1. `"Charting Territories"` duration decreases on cold area entry
2. first visible map frame appears before wider hydration completes

### M3. Background hydration hardening

Deliverables:

1. surrounding/prefetch area hydration after first render
2. retry-safe transition handling

Acceptance:

1. Warm traversal remains smooth
2. No missing structures/tiles after hydration settles

## Risks

1. If the critical fetch area is made too small, the first visible frame may lack expected neighboring data.
2. Loader decoupling can create false-ready states if critical readiness is defined too loosely.
3. Background hydration may reintroduce refresh churn if it is not carefully scoped.

## Acceptance Criteria

1. Cold `"Charting Territories"` duration is lower on real player flow.
2. The first visible playable map frame arrives before full background hydration completes.
3. No regression in warm chunk-crossing numbers from the strip-update pass.
4. No reintroduction of blank-map or stale-transition bugs.

## Open Questions

1. Should the current visible area fetch use exact current render bounds, or a slightly padded bounds set?
2. Should background hydration remain silent, or surface through a lighter non-blocking loading treatment?
3. Do we need a separate diagnostic counter for critical fetch wait vs background hydration wait?
