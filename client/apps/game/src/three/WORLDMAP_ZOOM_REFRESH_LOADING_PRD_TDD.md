# Worldmap Zoom Refresh Loading PRD / TDD

## Status

- Status: Proposed for implementation
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx`, a small worldmap loading helper seam, and the world loading
  UI copy path
- Primary goal: replace visible zoom-refresh jitter with an explicit loading state while the worldmap swaps or refreshes
  chunks after zoom

## Problem Statement

Worldmap zoom already uses stepped camera bands, but chunk refresh work still happens after the zoom gesture settles.

Today:

1. A zoom gesture updates the camera band.
2. Controls-change hardening can request a chunk refresh when the distance change is large enough.
3. Chunk hydration and presentation then run asynchronously.
4. During that window the map can visibly pop or stall while terrain catches up.

The current UI does not clearly communicate that this is active loading work.

The result is a jittery-feeling zoom transition even when the renderer is behaving correctly.

## User Goal

When zoom crosses into a chunk refresh, the player should see a short loading state instead of perceiving the renderer
as stuttering.

## Goals

- Show a world loading state while a zoom-triggered chunk refresh or chunk switch is actively executing.
- Keep the loading state scoped to zoom refresh work so normal world interaction is not constantly masked.
- Preserve existing Torii fetch loading behavior.
- Preserve timeout recovery so loading does not get stuck if a chunk phase times out.

## Non-goals

- Reworking the chunk hydration pipeline.
- Removing the existing world loading banner or replacing it with a new overlay.
- Showing loading for every pan, shortcut selection, or background prefetch.
- Changing camera zoom behavior in this pass.

## Proposed Behavior

### Loading trigger

The loading state should turn on when a zoom-requested chunk refresh begins execution.

That includes both outcomes of `updateVisibleChunks(...)` when entered from zoom refresh execution:

- `switch_chunk`
- `refresh_current_chunk`

### Loading lifetime

The loading state should stay on for the duration of the active refresh execution and clear when the refresh settles,
whether it:

- commits successfully
- no-ops after refresh bookkeeping
- throws and is caught by the refresh execution wrapper

### Loading presentation

Reuse the existing map loading affordance so the user gets a clear, consistent signal instead of a second loading UI.

The copy should explain that the map is refreshing for zoom rather than only implying initial map charting.

## Architecture

## 1. Separate zoom refresh loading from Torii fetch counting

The existing `toriiLoadingCounter` is fetch-specific. A zoom refresh can feel jittery outside the fetch window, so the
zoom refresh loading state needs its own ownership.

Introduce a small helper that answers:

- should map loading be visible?
- how should zoom refresh loading start?
- how should zoom refresh loading finish?

This helper should compose with Torii fetch loading instead of replacing it.

## 2. Scope the loading state at the refresh execution boundary

The right orchestration layer is the zoom refresh execution path, not every lower-level hydration helper.

At the top level this should read like:

1. resolve whether this refresh should show zoom loading
2. start zoom refresh loading if needed
3. execute visible chunk update
4. clear zoom refresh loading in `finally`

## 3. Keep timeout recovery safe

Chunk timeout recovery currently clears the map loading flag for fetch-related stalls.

That recovery must be updated so it clears the combined loading state correctly when fetch loading is forced back to
idle, without leaving zoom-refresh loading stuck on or accidentally hiding a still-active zoom refresh.

## TDD Plan

## Red phase

Add failing tests for:

1. loading visibility helper
   - map loading stays visible when either Torii fetch loading or zoom refresh loading is active
   - clearing fetch loading does not hide an active zoom refresh
   - clearing zoom refresh loading does not hide an active fetch

2. worldmap wiring
   - zoom refresh execution starts map loading before `updateVisibleChunks(...)`
   - zoom refresh execution clears map loading after the awaited refresh settles
   - the worldmap source uses the loading helper instead of directly toggling `LoadingStateKey.Map` in the zoom refresh
     path

3. loading copy
   - the world loading UI surfaces copy that reads correctly for the refreshed map state

## Green phase

Implement the minimum code to make those tests pass:

- a focused worldmap loading helper
- zoom refresh loading start/finish wiring in `worldmap.tsx`
- combined loading visibility updates that still work with Torii fetch counting
- updated world loading copy

## Verification

1. Zoom the world map across chunk boundaries and confirm the loading state appears during the refresh window.
2. Wait for the refresh to settle and confirm the loading state clears.
3. Trigger initial worldmap loading and confirm the existing loading behavior still works.
4. Force a chunk timeout in development and confirm loading does not remain stuck.
