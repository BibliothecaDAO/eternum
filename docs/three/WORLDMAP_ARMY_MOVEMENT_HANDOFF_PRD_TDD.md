# Worldmap Army Movement Handoff PRD / TDD

## Status

- Status: Proposed for implementation
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx`
- Scope: `client/apps/game/src/three/managers/army-manager.ts`
- Scope: movement timing, arrival ghost timing, and travel FX lifecycle

## Problem Statement

The local army move flow currently mixes three separate clocks:

1. transaction submission
2. authoritative world tile sync
3. visual movement start and completion

Those clocks are currently wired together incorrectly.

Today the worldmap clears pending movement as soon as it sees the authoritative tile update, but the visual movement
does not start until `ArmyManager` finishes applying the move and kicks off the renderer path.

This creates a visible and gameplay gap:

1. the move transaction succeeds
2. the destination ghost and movement FX disappear
3. the unit remains visible at the source tile
4. the unit becomes reselectable even though its onchain state already changed
5. a second action can fail because the render state is behind the chain state
6. the movement animation finally starts later

## Findings From The Trace

### Stable facts

1. Submit path
   - `onArmyMovement(...)` creates movement FX, creates the arrival ghost, and marks the army pending.

2. Tile sync path
   - `updateArmyHexes(...)` updates the worldmap cache immediately when tile or explorer troop updates arrive.

3. Render path
   - `ArmyManager.onTileUpdate(...)` calls `moveArmy(...)`.
   - `moveArmy(...)` can await worker pathfinding before it calls `armyModel.startMovement(...)`.

4. Current mismatch
   - pending movement clears from cache sync
   - visual movement starts later from army-manager sync

5. Explorer troop updates are especially risky
   - they call `updateArmyHexes(...)`
   - they do not call `moveArmy(...)`
   - they must never clear local visual pending state

### Most important implication

Authoritative tile sync is not a safe proxy for visual movement start.

Pending local movement must clear from a renderer-owned event, not from the first world cache update.

## Goals

### User goals

- Local armies should stay blocked until the rendered move actually starts.
- The source army should never sit reselectable in a stale pre-move pose after the chain state changed.
- The destination ghost should remain until the rendered move actually completes.
- Travel FX should still end when the rendered move completes.

### Engineering goals

- Separate cache sync from movement presentation state.
- Give `WorldmapScene` a clean way to observe visual movement start.
- Resolve arrival ghosts from movement completion, not from pending-cache heuristics.
- Prevent explorer troop updates from clearing local pending movement.

## Non-goals

- Reworking remote army movement.
- Changing onchain timing or Torii delivery order.
- Changing travel path generation.
- Redesigning source-visual suppression for unrelated army removal cases.

## Proposed Behavior

### Movement lifecycle

For local moves the lifecycle should be:

1. submit move
2. mark local movement pending
3. create travel FX and destination ghost
4. accept authoritative tile sync without clearing pending
5. `ArmyManager` starts the rendered move
6. clear local pending movement
7. keep travel FX alive during the rendered move
8. `ArmyManager` completes the rendered move
9. resolve the arrival ghost into the landed unit
10. clean up travel FX

### Source of truth

- world cache sync owns authoritative position caches
- `ArmyManager` owns visual movement lifecycle
- `WorldmapScene` reacts to army-manager lifecycle events

## Architecture

## 1. Add a visual movement start seam to `ArmyManager`

`ArmyManager` already exposes `onMovementComplete(...)`.

Add a matching `onMovementStart(...)` seam that fires only when the renderer has actually accepted the move:

- after `armyModel.startMovement(...)` for animated moves
- after destination rendering is restored for the no-animation fallback path

This keeps movement lifecycle ownership inside the army manager.

## 2. Stop clearing pending movement from `updateArmyHexes(...)`

`updateArmyHexes(...)` should remain a cache synchronizer only.

It should:

- update normalized position caches
- update worker caches
- invalidate affected render areas

It should not:

- clear local pending movement
- resolve arrival ghosts
- infer visual progress from authoritative state alone

## 3. Resolve ghosts from movement completion

The arrival ghost should no longer resolve from:

- `!hasPendingMovement`
- `isArmyRenderableInCurrentChunk`

That condition is too weak because the stale source unit can still be renderable.

Instead:

- register a movement-complete callback when the local move is submitted
- request ghost resolution only from that callback
- let the ghost manager animate the absorb only when the destination chunk is visible

## 4. Keep travel FX completion on movement completion

Travel FX already use `onMovementComplete(...)`.

That remains correct.

The important change is that pending movement must no longer be assumed equivalent to travel-FX lifetime.

## Implementation Plan

### Step 1. Add the PRD/TDD and failing wiring tests

Cover:

- visual start listener registration
- pending clear moving out of `updateArmyHexes(...)`
- arrival ghost resolution moving to movement completion

### Step 2. Add `ArmyManager` movement-start listeners

Mirror the existing movement-complete listener structure.

### Step 3. Move local pending clear to the visual-start listener

Install the listener from the local submit path.

### Step 4. Move arrival ghost resolution to the movement-complete listener

Install the listener from the local submit path and remove the pending-based resolution path.

### Step 5. Simplify worldmap per-frame ghost handling

Keep chunk visibility syncing. Remove the per-frame “pending cleared and renderable” resolve heuristic.

### Step 6. Add the user-facing changelog entry

Describe the movement handoff fix in `latest-features.ts`.

## TDD Plan

## Red phase

Add failing tests for:

1. source wiring in the move submit path
   - registers `onMovementStart(...)`
   - registers `onMovementComplete(...)` for ghost resolution

2. cache sync path
   - `updateArmyHexes(...)` no longer clears pending movement

3. ghost timing
   - worldmap no longer resolves ghosts from `!hasPendingMovement && isArmyRenderableInCurrentChunk`

4. army-manager seam
   - source contains a public `onMovementStart(...)`
   - source fires movement-start listeners from the renderer-owned move path

## Green phase

Implement the smallest clean changes that satisfy those tests.

## Refactor phase

- keep listener registration isolated in well-named helpers
- keep `updateArmyHexes(...)` at one level of abstraction
- keep worldmap update loop focused on per-frame orchestration, not movement state inference

## Verification

Targeted tests:

- `worldmap-arrival-ghost.source.test.ts`
- `worldmap-travel-effect-lifecycle.source.test.ts`
- new movement-start source tests

Broader checks:

- `pnpm run format`
- `pnpm run knip`

## Expected Outcome

After the fix:

- the unit is not reselectable during the stale pre-animation gap
- the destination ghost stays up until the rendered move completes
- travel FX continue to match rendered movement completion
- authoritative tile sync no longer pretends the visual move already happened
