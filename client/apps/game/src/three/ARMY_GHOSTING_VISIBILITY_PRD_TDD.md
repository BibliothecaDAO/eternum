# Army Ghosting Visibility Recovery PRD / TDD

## Status

- Status: Implemented
- Scope:
  - `client/apps/game/src/three/managers/army-manager.ts`
  - `client/apps/game/src/three/managers/army-model.ts`
  - `client/apps/game/src/three/managers/player-indicator-manager.ts`
  - `client/apps/game/src/three/scenes/worldmap.tsx`
  - focused Three.js regression tests in `client/apps/game/src/three/**`
- Primary goal: stop moving armies from disappearing until zoom or chunk refresh work happens to rebuild their visuals

## Why This Exists

Players sometimes see a unit disappear mid-move, including the ownership-color dot above it, and then reappear after a
zoom change.

That is a bad failure mode because:

1. it looks like the move failed even when simulation state is still correct
2. it destroys trust in manual army control
3. it forces the player to use zoom as a recovery tool for a rendering bug

The investigation found two plausible mechanisms that can produce the same symptom:

1. moving instanced meshes update position every frame, but their culling bounds are only recomputed during chunk or
   visible-buffer refresh work
2. deferred army-removal suppression can leave an army hidden until a later refresh restores it

This change fixes both seams so the worldmap no longer depends on zoom churn to recover army visibility.

## Follow-up Regression

The first recovery patch fixed the broad ghosting symptom, but two narrower races remained:

1. `cancelPendingArmyRemoval()` tried to redraw immediately, before the fresh tile or troop update had applied the
   latest army state.
2. `renderArmyIntoCurrentChunkIfVisible()` could cross an async preload boundary and still redraw after the army had
   been suppressed again for a real removal.

That left one bad edge case on each side of the seam:

1. a real army could stay hidden because recovery used stale `hexCoords` and happened before
   `ArmyManager.onTileUpdate()`
2. a dead army could briefly flash back because an in-flight recovery finished after zero-count suppression reapplied

The follow-up fix moves recovery to the point where world state has already caught up and makes the restore path prove
that suppression is still cleared before it redraws.

## Current-State Diagnosis

### Moving army meshes

1. `ArmyModel.updateMovements()` rewrites instance transforms every frame.
2. `PlayerIndicatorManager.updateIndicator()` also rewrites the ownership-dot transform every frame for moving armies.
3. Army-model bounding spheres are recomputed during `updateVisibleArmyBuffers()`, not during normal movement frames.
4. Indicator bounding spheres are only marked dirty on add/remove count changes, not when an existing indicator moves.

Result:

- moving armies can be culled against stale bounds
- the colored dot can be culled against stale bounds
- a later forced refresh or chunk switch can make both reappear at once

### Deferred-removal suppression

1. `scheduleArmyRemoval()` immediately hides the army visually through `hideArmyVisual()`
2. `cancelPendingArmyRemoval()` only clears suppression when an active timeout still exists
3. if the removal was already deferred during a chunk switch, a fresh army update can leave the army suppressed
4. `unsuppressArmy()` only clears the flag, it does not redraw the army

Result:

- a valid army can remain hidden until a later chunk refresh happens to rebuild its slot

## Product Goals

### User goals

1. Moving armies stay visible throughout their movement path.
2. The ownership-color dot stays in sync with the army body.
3. Fresh army updates immediately recover visibility when a deferred removal was stale.
4. Players never need to zoom out just to make an army reappear.

### Engineering goals

1. Movement-driven bounds refresh has explicit ownership in the army rendering path.
2. Indicator bounds track translation changes, not only add/remove churn.
3. Suppression recovery restores visuals immediately instead of relying on a later chunk refresh.
4. The top-level orchestration still reads in business terms: update movement, refresh moving bounds, recover stale
   suppression.

## Non-goals

1. Rebuilding the whole worldmap chunking system.
2. Removing frustum culling from armies or indicators globally.
3. Reworking label or point-icon rendering beyond what is needed for this bug.
4. Retuning zoom behavior itself.

## Product Requirements

### Movement visibility

1. Moving army model bounds must be refreshed during active movement at a controlled cadence.
2. Moving indicator-dot bounds must be marked dirty when an existing indicator changes position.
3. Bounds refresh must happen after per-frame movement and indicator position updates, not before.

### Suppression recovery

1. Canceling a pending army removal must recover armies that were deferred during chunk switching, not only armies with
   an active timeout handle.
2. Clearing suppression must attempt to redraw the army immediately if it belongs in the current visible chunk.
3. Recovery must not reintroduce stale hidden-army ghosts during real removals.

## Proposed Design

## Movement bounds refresh

Add a dedicated movement-bounds refresh step in `ArmyManager.update()`.

### Rules

1. Only run while at least one army is actively moving.
2. Run after `updateVisibleArmiesBatched()` so indicator positions are already current.
3. Recompute army-model bounds through the existing deferred-bounds seam.
4. Recompute indicator bounds only when the indicator manager marked them dirty.
5. Throttle the expensive refresh work to a small fixed interval instead of every frame.

### Expected effect

This keeps culling bounds close to the real moving positions without turning every frame into a full visibility reset.

## Suppression recovery

Make pending-removal cancellation read as a recovery flow:

1. resolve whether the entity has any tracked pending-removal state
2. clear timeout and tracked metadata if present
3. clear suppression
4. return a recovery signal to the update listener that already owns the fresh state mutation
5. attempt visual recovery only after the latest tile or troop update has applied

That avoids the current bug where deferred-removal state can survive because the timeout already moved into a different
tracking map.

## TDD Plan

## Red

1. Add a real `PlayerIndicatorManager` test that fails until moving an existing indicator marks bounds dirty.
2. Add an `ArmyManager` wiring test that fails until `update()` invokes a dedicated moving-bounds refresh step after
   batched visible-army updates.
3. Add a `Worldmap` suppression test that fails until `cancelPendingArmyRemoval()` handles deferred removals and tries
   immediate army-visual recovery.
4. Add a regression test that fails until recovery happens after `ArmyManager.onTileUpdate()` and
   `updateArmyFromExplorerTroopsUpdate()`.
5. Add a regression test that fails until `renderArmyIntoCurrentChunkIfVisible()` rechecks suppression after model
   preload resolves.
6. Run the targeted tests and confirm they fail for those exact missing seams.

## Green

1. Mark indicator bounds dirty on indicator translation updates.
2. Add a movement-bounds refresh helper to `ArmyManager.update()` and wire it through the existing deferred-bounds path.
3. Add a public army-manager recovery seam that can re-render a visible army after suppression is cleared.
4. Update `cancelPendingArmyRemoval()` to clear deferred removal state and return whether recovery still needs to run.
5. Restore visuals from the tile and troop listeners only after fresh state has been applied.
6. Recheck suppression after async model preload so a real removal cannot redraw a dead army.
7. Resync visible attachments during immediate recovery so cosmetics do not wait for a later chunk refresh.
8. Add a latest-features entry describing the worldmap army visibility fix.

## Refactor

1. Extract policy helpers for movement-bounds cadence and pending-removal cancellation if the orchestration stops
   reading clearly.
2. Re-read `ArmyManager.update()` and `Worldmap.cancelPendingArmyRemoval()` in isolation and keep them at one conceptual
   level.

## Verification Plan

1. Run the targeted Three.js regression tests for the new seams.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. Manually verify:
   - move an army near the viewport edge
   - keep zoom steady while the army travels
   - confirm the army body and ownership dot remain visible
   - trigger a move during chunk-transition churn if possible
   - confirm the army recovers without needing zoom

## Verification Notes

1. Red phase:
   `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/three/managers/army-manager.suppression.test.ts src/three/scenes/worldmap-army-suppression.test.ts`
   failed on the missing post-preload suppression check and the missing post-update recovery wiring.
2. Green phase:
   `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/three/managers/army-manager.suppression.test.ts src/three/scenes/worldmap-army-suppression.test.ts`
   passed.
3. Regression sweep:
   `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/three/managers/player-indicator-manager.test.ts src/three/managers/army-manager.moving-bounds-refresh.test.ts src/three/managers/army-model.deferred-bounds.test.ts src/three/managers/army-manager.suppression.test.ts src/three/managers/army-manager.chunk-eviction-ghost.test.ts src/three/scenes/worldmap-army-suppression.test.ts src/three/scenes/worldmap-army-removal.visual-hide.test.ts`
   passed.
4. `npx -y node@20.19.0 $(which pnpm) run format` passed.
5. `npx -y node@20.19.0 $(which pnpm) run knip` passed.
6. Manual in-game verification was not run in this session.
