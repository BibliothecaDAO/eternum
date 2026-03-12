# PRD: FastTravel Scrolling Chunk Loading TDD

## Overview

- Feature: make fast travel load new hex windows as the camera pans instead of staying pinned to one small center window
- Status: Complete
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                      |
| ------ | ---------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 00:00 | Codex  | Scoped the missing fast-travel chunk scrolling path and defined a clean implementation plan.                |
| U2     | 2026-03-12 06:15 | Codex  | Completed `O0` chunk policy and camera-refresh entry wiring with targeted runtime and controls tests green. |
| U3     | 2026-03-12 06:25 | Codex  | Completed `O1` shared chunk-decision reuse with normalized fast-travel chunk keys and scene chunk tracking. |
| U4     | 2026-03-12 06:35 | Codex  | Completed `O2` and `O3` with a single apply path plus movement coverage across the larger render window.    |
| U5     | 2026-03-12 06:40 | Codex  | Completed `O4` hardening with the fast-travel and shared warp-travel regression clusters green.             |

## Delivery Tracker

- [x] O0: Chunk Policy And Refresh Entry
- [x] O1: Shared Chunk Decision Reuse
- [x] O2: Visible Window Rebuild On Scroll
- [x] O3: Movement/Interaction Compatibility
- [x] O4: Hardening

## Closeout Notes

1. Fast travel now uses a scene-local chunk runtime that reuses the shared warp-travel decision seam without importing
   worldmap-only manager fanout or prefetch complexity.
2. The render window intentionally remains larger than the logical chunk stride so movement and interaction stay usable
   after scroll-driven chunk changes.
3. A generic warp-travel chunk controller extraction is not warranted yet; fast travel and worldmap still differ enough
   in hydration/runtime ownership that the helper seam is the right current boundary.

## Executive Summary

Fast travel currently renders only a small fixed cluster of hexes near the initial focus point and does not load new hex
windows as the camera moves.

This is not a renderer bug. It is an incomplete runtime.

The current fast-travel scene:

1. builds a hard-coded `9x9` visible window from `FAST_TRAVEL_CHUNK_RADIUS = 4`
2. refreshes that window only during setup/resume or explicit scene refresh calls
3. never requests a new visible window from camera/control movement
4. does not track a `currentChunk` or participate in the shared warp-travel visible-chunk decision seam

The clean solution is to give fast travel a lightweight chunk runtime:

1. separate `chunkSize` from `renderSize`
2. track `currentChunk`
3. request debounced chunk refreshes on camera/control change
4. reuse `resolveWarpTravelVisibleChunkDecision()` for chunk switching
5. keep fast travel simpler than worldmap by skipping manager fanout/prefetch until it is actually needed

## Problem Statement

Observed behavior:

1. only a small subset of hexes is visible near screen center
2. panning the camera does not bring in new hexes
3. fast travel reads like a static local patch, not a scrollable traversal layer

Confirmed causes:

1. `client/apps/game/src/three/scenes/fast-travel.ts` hard-codes `FAST_TRAVEL_CHUNK_RADIUS = 4`, which yields a `9x9`
   window
2. `FastTravelScene.refreshFastTravelScene()` computes a new window once around the current focus hex, but nothing
   schedules it in response to camera movement
3. `setupFastTravelCameraZoomHandler()` is empty
4. `registerFastTravelStoreSubscriptions()` is empty
5. fast travel does not maintain `currentChunk`, debounced refresh state, or any equivalent of
   `WorldmapScene.requestChunkRefresh()` / `updateVisibleChunks()`
6. the current fast-travel `chunkKey` is composed as `${startCol},${startRow}`, while shared warp-travel runtime helpers
   use `"startRow,startCol"`, so the scene is also not normalized for direct reuse yet

## Goals

1. make fast travel load new visible hex windows as the camera pans
2. preserve the current outline-only presentation and interaction behavior
3. reuse shared warp-travel chunk decision logic where it is a good fit
4. keep the fast-travel runtime lighter than worldmap
5. avoid coupling fast travel to worldmap-only manager fanout or Torii hydration paths

## Non-Goals

1. turning fast travel into a full worldmap clone
2. introducing pinned-neighborhood prefetch on the first pass
3. solving authoritative spire/army data sourcing beyond the current local hydration seam
4. redesigning fast-travel movement/path rules
5. changing the visual treatment established by the outline-space render slice

## Current State

### Confirmed Fast-Travel Runtime Behavior

Files:

1. `client/apps/game/src/three/scenes/fast-travel.ts`
2. `client/apps/game/src/three/scenes/fast-travel-hydration.ts`
3. `client/apps/game/src/three/scenes/fast-travel-movement-policy.ts`

Current behavior:

1. `refreshFastTravelScene()` resolves a focus hex, subtracts/adds the fixed chunk radius, and hydrates a bounded
   `visibleHexWindow`
2. `hydrateFastTravelChunkState()` simply materializes a rectangular window from `startCol`, `startRow`, `width`,
   `height`
3. `syncFastTravelInteractiveHexes()` clears the current interactive set and repopulates only the current window
4. `resolveFastTravelMovement()` rejects targets outside the current `visibleHexWindow`

Implication:

1. even if camera movement were wired tomorrow, the user would still only be able to path inside the loaded window, so
   the render window must be meaningfully larger than the logical chunk stride

### Confirmed Worldmap Runtime Behavior

Files:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`
3. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`

Current behavior:

1. a controls-change listener requests chunk refreshes as the camera moves
2. refresh requests are debounced
3. `updateVisibleChunks()` computes the camera focus point and calls `resolveWarpTravelVisibleChunkDecision()`
4. chunk switches are keyed by a normalized `"startRow,startCol"` chunk key
5. worldmap distinguishes logical `chunkSize` from larger `renderChunkSize`

Implication:

1. fast travel is missing the refresh orchestration, not the underlying idea

## Root Cause Summary

### R1: Fixed Render Window

File:

1. `client/apps/game/src/three/scenes/fast-travel.ts`

Current behavior:

1. `FAST_TRAVEL_CHUNK_RADIUS = 4`
2. `width = radius * 2 + 1`
3. `height = radius * 2 + 1`

Effect:

1. fast travel always renders only `9x9` hexes

### R2: No Camera-Driven Refresh Loop

Files:

1. `client/apps/game/src/three/scenes/fast-travel.ts`
2. `client/apps/game/src/three/scenes/warp-travel-lifecycle.ts`

Current behavior:

1. the lifecycle adapter includes `setupCameraZoomHandler`, but fast travel leaves it empty
2. `refreshFastTravelScene()` is only hit from setup/resume and explicit manual refresh points

Effect:

1. moving the camera never schedules a new fast-travel window

### R3: Fast Travel Does Not Track Chunk Authority

Files:

1. `client/apps/game/src/three/scenes/fast-travel.ts`
2. `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`

Current behavior:

1. there is no `currentChunk`
2. there is no fast-travel equivalent of `requestChunkRefresh()`
3. there is no fast-travel equivalent of `updateVisibleChunks()`

Effect:

1. fast travel cannot decide whether it should noop, refresh, or switch chunks as the camera moves

### R4: Chunk Key Format Drift

Files:

1. `client/apps/game/src/three/scenes/fast-travel.ts`
2. `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`

Current behavior:

1. fast travel currently hydrates with `chunkKey: ${startCol},${startRow}`
2. shared warp-travel runtime uses `chunkKey: ${startRow},${startCol}`

Effect:

1. direct reuse of shared chunk-decision helpers would be error-prone until fast travel normalizes its chunk keys

## Product Intent

Target behavior:

1. panning the fast-travel camera loads new hex windows in all directions
2. the visible field extends beyond a small center patch
3. chunk switches feel stable, not jittery
4. interaction and movement continue to work inside the currently loaded window
5. the runtime remains simpler than worldmap because fast travel does not need all of worldmap’s entity-manager
   orchestration

## Proposed Architecture

### A1: Fast-Travel Chunk Policy

Add a dedicated fast-travel policy instead of a fixed radius constant.

Recommended shape:

1. `chunkSize`
   - logical stride for deciding when the camera entered a new chunk
2. `renderSize`
   - actual visible window to render, larger than `chunkSize`
3. `refreshDebounceMs`
   - small debounce for camera-driven refresh requests

Recommendation:

1. use the worldmap pattern of `renderSize > chunkSize`
2. do not keep `9x9`; that is too small and directly causes the current clipped feel
3. choose a render window large enough that movement/pathing inside the visible chunk feels intentional

### A2: Lightweight Chunk Refresh Runtime

Add to `client/apps/game/src/three/scenes/fast-travel.ts`:

1. `currentChunk: string = "null"`
2. `chunkRefreshTimeout: number | null`
3. `requestChunkRefresh(force?: boolean): void`
4. `updateVisibleChunks(force?: boolean): Promise<boolean>`
5. one idempotent controls-change handler that requests refresh while the active scene is fast travel

Responsibilities:

1. read the current camera focus from `controls.target` / current camera-target hex
2. debounce rapid control changes
3. compute the next chunk with `resolveWarpTravelVisibleChunkDecision()`
4. rebuild the fast-travel window when the logical chunk changes

### A3: Shared Decision Helper Reuse, Not Full Worldmap Reuse

Reuse:

1. `resolveWarpTravelVisibleChunkDecision()`
2. normalized chunk-coordinate conventions

Do not reuse in the first pass:

1. worldmap manager fanout
2. Torii chunk hydration
3. directional prefetch queue
4. pinned neighborhood tracking

Reasoning:

1. fast-travel hydration is currently local and synchronous
2. the clean solution is to reuse the chunk decision seam without inheriting unrelated worldmap complexity

### A4: Single Fast-Travel Chunk Apply Path

Add one scene-owned helper, for example:

1. `applyFastTravelVisibleChunk(chunkKey, startCol, startRow): void | Promise<void>`

Responsibilities:

1. normalize chunk key ordering to `"startRow,startCol"`
2. hydrate the fast-travel window with `renderSize`
3. rebuild render state and visuals
4. keep selected army/spire state intact across chunk updates

### A5: Movement Coupling Awareness

Files:

1. `client/apps/game/src/three/scenes/fast-travel-movement-policy.ts`

Current behavior:

1. movement only resolves inside `visibleHexWindow`

Implication for solution:

1. the first chunk-loading pass must not use a tiny render window
2. otherwise the user will still feel boxed in even after scrolling works

## Recommended Clean Solution

Implement this in one focused slice:

1. replace `FAST_TRAVEL_CHUNK_RADIUS` with a fast-travel chunk policy that separates `chunkSize` and `renderSize`
2. add `currentChunk`, debounced refresh state, and an idempotent control-change handler
3. make `refreshFastTravelScene()` delegate to `updateVisibleChunks(true)` instead of building a one-off center window
4. use `resolveWarpTravelVisibleChunkDecision()` to decide noop vs switch vs refresh
5. normalize fast-travel chunk keys to `"startRow,startCol"`
6. keep hydration local and synchronous; do not port worldmap manager fanout or prefetch yet

Why this is the clean solution:

1. it fixes the actual missing runtime seam
2. it keeps fast travel aligned with the warp-travel architecture
3. it avoids importing worldmap-only concerns that fast travel does not need yet

## Alternatives Considered

### Alt 1: Just Increase The Radius

Rejected as primary fix.

Reason:

1. it would make the visible patch larger, but it still would not scroll or load as the camera moves

### Alt 2: Copy Worldmap Chunk Runtime Wholesale

Rejected for the first pass.

Reason:

1. fast travel does not currently need pinned chunk neighborhoods, Torii hydration, or manager fanout
2. copying all of that would create a maintenance burden without solving a real fast-travel need

### Alt 3: Extract A Generic WarpTravel Chunk Controller First

Good long-term option, but too large for the immediate fix.

Reason:

1. the immediate problem can be solved cleanly inside fast travel with selective helper reuse
2. full abstraction can follow once there are at least two concrete chunked warp-travel scenes with shared needs

## TDD Operating Model

### Iron Rule

No fast-travel chunk-loading change lands without a failing test first.

### Per-Slice Protocol

1. `RED`
   - add one failing test for one runtime contract
   - run only the targeted test
   - confirm the failure is because the contract is missing
2. `GREEN`
   - implement the smallest fast-travel runtime seam that satisfies the contract
   - rerun the targeted test
3. `REFACTOR`
   - only extract shared helpers after behavior is green
   - rerun the fast-travel cluster

## Required Test Commands

1. target loop:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel-chunk-loading*.test.ts`
2. focused fast-travel cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel*.test.ts`
3. shared regression cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/warp-travel.test.ts src/three/scenes/worldmap-shared-runtime.test.ts`

## Milestones

### O0: Chunk Policy And Refresh Entry

Objective:

Give fast travel a real chunk policy and a camera-driven refresh entry point.

Deliverables:

1. failing-first test proving fast travel no longer uses a hard-coded radius-only window
2. failing-first test proving camera/control changes request a fast-travel chunk refresh
3. fast-travel chunk policy with separate `chunkSize` and `renderSize`

Exit Criteria:

1. fast travel is no longer hard-wired to `9x9`
2. camera movement can trigger chunk refresh scheduling

### O1: Shared Chunk Decision Reuse

Objective:

Make fast travel decide chunk switches using the shared warp-travel decision seam.

Deliverables:

1. failing-first test proving fast travel tracks `currentChunk`
2. failing-first test proving fast travel uses `resolveWarpTravelVisibleChunkDecision()`
3. normalized fast-travel chunk keys in `"startRow,startCol"` form

Exit Criteria:

1. fast travel can noop, refresh, or switch based on camera position
2. chunk-key ordering is aligned with the shared runtime

### O2: Visible Window Rebuild On Scroll

Objective:

Swap the fast-travel visible window as the camera pans.

Deliverables:

1. failing-first test proving a chunk switch rebuilds the visible window around the new chunk origin
2. `refreshFastTravelScene()` delegated through `updateVisibleChunks(true)`
3. one scene-owned `applyFastTravelVisibleChunk()` path

Exit Criteria:

1. panning the camera loads new hexes
2. the visible field is no longer trapped at the original center patch

### O3: Movement/Interaction Compatibility

Objective:

Preserve interaction and movement inside the loaded window after chunk scrolling lands.

Deliverables:

1. failing-first test proving `syncFastTravelInteractiveHexes()` still repopulates the correct visible window after a
   chunk switch
2. failing-first test proving movement remains valid within the loaded render window
3. no regression to outline hover/selection visuals

Exit Criteria:

1. clicking and hover still work after panning into a new chunk
2. movement remains bounded to the loaded window and behaves consistently

### O4: Hardening

Objective:

Lock the chunk-scrolling path and verify no shared warp-travel regressions.

Deliverables:

1. fast-travel cluster green
2. shared runtime cluster green
3. explicit note on whether a later generic `WarpTravel` chunk controller extraction is still warranted

Exit Criteria:

1. fast travel scrolls and reloads windows in all directions
2. shared warp-travel helpers remain green

## Prioritized Slice Backlog

1. S1 (P0): Add failing test proving fast travel replaces the fixed radius-only window with a chunk policy.
2. S2 (P0): Add failing test proving controls/camera movement requests a fast-travel chunk refresh.
3. S3 (P0): Add failing test proving fast travel tracks `currentChunk` and uses
   `resolveWarpTravelVisibleChunkDecision()`.
4. S4 (P0): Add failing test proving chunk-key ordering is normalized to `"startRow,startCol"`.
5. S5 (P1): Add failing test proving chunk switches rebuild the visible window and interactive surface.
6. S6 (P1): Add failing test proving movement remains valid inside the loaded render window after scroll-driven chunk
   changes.
7. S7 (P1): Run fast-travel and shared runtime regression suites.

## Test Strategy

### New Test Files

1. `client/apps/game/src/three/scenes/fast-travel-chunk-loading-runtime.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-chunk-loading-controls.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-chunk-loading-movement.test.ts`

### Existing Test Files Likely To Expand

1. `client/apps/game/src/three/scenes/fast-travel-scene-surface.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-scene-movement.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-rendering.test.ts`

### Test Method

1. use source-reading tests for lifecycle wiring and scene orchestration seams
2. use pure helper tests for chunk-decision inputs/outputs and chunk-key normalization
3. keep movement tests focused on visible-window constraints rather than adding heavy renderer integration
4. rerun warp-travel shared runtime tests after the fast-travel runtime lands

## Functional Requirements

1. fast travel loads new visible hex windows as the camera pans
2. fast travel no longer stays pinned to one small center patch
3. chunk switching uses normalized chunk keys
4. interaction still targets the currently visible window
5. movement remains consistent within the currently loaded render window

## Non-Functional Requirements

1. keep fast-travel runtime lighter than worldmap
2. prefer helper reuse over worldmap code copy-paste
3. avoid duplicated control listeners across setup/resume cycles
4. keep tests deterministic and focused

## Risks

1. attaching camera listeners through the current lifecycle hook could accidentally register duplicates on resume
2. choosing too small a render window would keep movement feeling clipped even after scrolling works
3. chunk-key normalization drift could produce subtle future bugs if shared helpers are only partially adopted

## Mitigations

1. make the control-change listener idempotent and/or register it once with explicit teardown on `destroy()`
2. set render size independently from chunk stride
3. add one explicit chunk-key contract test before integrating shared decision helpers

## Success Criteria

1. the camera can pan and fast travel loads new hex windows in every direction
2. the user no longer sees only a small center patch of hexes
3. fast travel remains visually outline-only while scrolling
4. the implementation reuses shared chunk-decision logic without dragging in unnecessary worldmap complexity

## Follow-Up Backlog

1. evaluate whether fast travel eventually needs pinned-neighborhood prefetch once authoritative data replaces the stub
   hydration seam
2. consider extracting a generic chunk-refresh controller from worldmap if another chunked warp-travel scene appears
3. decide whether off-window path planning should eventually span more than the currently rendered fast-travel window
