# PRD + TDD: Worldmap Incremental Strip Updates

## Overview

- Feature: Replace full visible-window terrain rebuilds with conservative strip updates during chunk crossings.
- Status: Draft v0.1
- Owner: Three / Worldmap
- Created: 2026-03-07
- Last Updated: 2026-03-07

## Executive Summary

Current worldmap chunk switches still rebuild the entire `48x48` visible render window in
`updateHexagonGrid(...)`, even when the camera only moves by one chunk and half of the visible
terrain overlaps the previous render. That keeps `hexGrid.processCells` and `chunkSwitch.terrainBuild`
on the hot path.

The first safe optimization is **not** a full geometry redesign. It is a conservative incremental path:

1. Detect exact one-chunk moves on a single axis.
2. Retain the overlapping half of the already-rendered matrices.
3. Recompute only the newly exposed row/column strip.
4. Fall back to the existing full rebuild for every other move.

This keeps correctness risk bounded while directly attacking the measured CPU work.

## Problem Statement

Even after optimistic chunk commit, transition smoothness is still limited by:

1. `updateHexagonGrid(...)` processing the full render window for most switches.
2. Matrix upload/cache work being paid for terrain that was already visible in the previous chunk.
3. Chunk-crossing latency feeling heavier than steady-state panning.

## Goals

1. Reduce `hexGrid.processCells` p95 for exact one-chunk moves.
2. Reduce `chunkSwitch.terrainBuild` p95 for the same traversal.
3. Preserve current rendering correctness by falling back to full rebuild outside the narrow safe path.
4. Keep the new logic fully test-driven with isolated planning helpers.

## Non-Goals

1. Arbitrary multi-chunk incremental diffing.
2. Diagonal strip merging in the first pass.
3. Manager-side incremental diffing.
4. Cache format redesign outside the minimum needed for strip reuse.

## Constraints

1. The optimization must be correct first and fast second.
2. Exact behavior outside one-axis, one-chunk moves must remain the current full rebuild path.
3. Existing chunk caches and hydrated refresh behavior must continue to work.

## TDD Delivery Checklist

- [x] I1. Add a pure strip-update planning helper with failing tests for left/right/up/down/same/diagonal/full-fallback cases.
- [x] I2. Add a pure retained-window helper with failing tests for overlap bounds and incoming strip bounds.
- [x] I3. Add a source/behavior regression test that the worldmap switch path can choose incremental strip updates.
- [x] I4. Implement live terrain-window reuse for the overlapping window.
- [x] I5. Implement strip-only terrain recompute and append path for exact one-axis chunk moves.
- [x] I6. Keep full rebuild fallback for all unsupported cases.
- [x] I7. Re-run targeted Vitest suites.
- [x] I8. Re-run live worldmap movement benchmark and compare `hexGrid.processCells`, `chunkSwitch.terrainBuild`, and switch feel.

## Proposed Design

### D1. Planning Helper

Add a pure helper in `worldmap-hex-grid.ts` that resolves whether a move qualifies for strip updates.

Input:

1. Previous chunk start row/col
2. Next chunk start row/col
3. `chunkSize`
4. `renderChunkSize`

Output:

1. `mode: "full" | "strip"`
2. Movement axis and direction
3. Overlap bounds to retain
4. Incoming strip bounds to recompute

Rules:

1. Only exact `chunkSize` movement on one axis qualifies.
2. Diagonal, multi-chunk, or unknown movement falls back to `"full"`.

### D2. Retained Terrain-Window Reuse

For strip-qualified moves:

1. Keep a lightweight live terrain-window index keyed by `col,row -> biomeKey`.
2. Retain only the overlapping half-window from that index when the move is strip-qualified.
3. Rebuild matrix transforms for retained cells using the next window's row metadata, then append the new strip.

### D3. Strip Recompute

For the incoming strip only:

1. Reuse the existing terrain cell logic.
2. Compute matrices only for the exposed rows/columns.
3. Merge retained matrices + strip matrices into the next visible window.

### D4. Fallback

If any prerequisite is missing or suspicious:

1. Retained extraction fails
2. Cache/model counts are inconsistent
3. Movement is not exact one-axis chunk movement

Then:

1. Run the existing full `updateHexagonGrid(...)` path unchanged.

## Risks

1. Matrix retention can drift if retained positions are decoded incorrectly.
2. Land color retention can desync from matrices if counts are merged incorrectly.
3. Partial-strip correctness bugs could be subtle, so the fallback path must stay easy to trigger.

## Acceptance Criteria

1. Exact one-chunk moves use the strip path.
2. Unsupported moves still use the full path.
3. Targeted tests cover plan resolution and overlap math.
4. Live benchmark shows lower `hexGrid.processCells` and lower `chunkSwitch.terrainBuild` on repeated one-chunk moves.

## Implementation Log

- [x] P0. Checkpoint commit created before strip work: `5e47f0918` `perf(game): commit chunk switches before hydration`
- [x] P1. PRD written
- [x] P2. Planning tests added and watched fail
- [x] P3. Planning helpers implemented
- [x] P4. Strip path integrated into worldmap terrain build
- [x] P5. Benchmarked and summarized
