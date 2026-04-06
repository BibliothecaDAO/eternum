# Army Ghosting Suppression Runtime PRD / TDD

## Status

- Status: In progress
- Scope:
  - `client/apps/game/src/three/managers/army-manager.ts`
  - `client/apps/game/src/three/managers/army-model.ts`
  - `client/apps/game/src/three/scenes/worldmap.tsx`
  - focused Three.js regression tests in `client/apps/game/src/three/**`
- Primary goal: make deferred-removal suppression authoritative at runtime so hidden armies stay hidden until fresh tile
  state proves they should render again

## Why This Exists

The first army ghosting recovery patch fixed stale bounds and early redraw timing, but players can still see ghosts
after those changes.

This follow-up exists because suppression is still only partially enforced:

1. chunk visibility selection skips suppressed armies
2. immediate recovery waits for tile state
3. normal per-frame movement and visual updates still repaint suppressed armies
4. deferred chunk retry still treats any world update as good enough to restore visuals

That leaves one ugly failure mode alive:

1. a supposedly hidden army can reappear because a later frame rewrites its instance matrix, dot, or attachments
2. a deferred retry can restore from stale manager state when only troop data changed

## Current-State Diagnosis

### Suppression is not a render policy yet

1. `Worldmap.scheduleArmyRemoval()` calls `ArmyManager.hideArmyVisual()`.
2. `ArmyManager.hideArmyVisual()` suppresses the entity and zeroes the current slot.
3. `ArmyManager.update()` still runs `ArmyModel.updateMovements()` every frame.
4. `ArmyModel.updateMovements()` still reaches `updateInstance()` for hidden movers.
5. `ArmyManager.updateVisibleArmiesBatched()` still updates dots, point icons, and attachments for suppressed armies.

Result:

- hidden armies can repaint on the next frame
- secondary visuals can ghost even if the body was zeroed once

### Deferred retry still trusts the wrong freshness signal

1. `Worldmap.retryDeferredChunkRemovals()` restores when `armyLastUpdateAt > scheduledAt`.
2. that generic update timestamp was updated by army hex churn, including troop updates.
3. troop updates do not update `ArmyManager`'s internal `hexCoords`.
4. recovery still renders from `ArmyManager` state, not worldmap cache state.

Result:

- deferred retry can still restore from stale manager position data

## Product Goals

### User goals

1. Once an army is visually hidden for deferred removal, it stays hidden.
2. Hidden armies do not leave behind ownership dots, icons, or attachments.
3. Recovery only happens after authoritative tile state has updated the manager.
4. Armies moving back into the visible chunk recover without requiring zoom churn.

### Engineering goals

1. Suppression is enforced in the same runtime path that writes matrices.
2. Secondary visuals follow the same suppression policy as the body mesh.
3. Deferred retry uses a tile-sync timestamp, not a generic update timestamp.
4. Slotless movement recovery reads clearly at the orchestration layer.

## Non-goals

1. Reworking the full worldmap chunking system.
2. Disabling frustum culling globally.
3. Rewriting movement animation.
4. Reworking label behavior outside suppression needs.

## Proposed Design

### Hidden slot persistence

Make `ArmyModel` own hidden-slot persistence:

1. when a slot is hidden, remember that hidden state
2. `updateInstance()` must keep logical state fresh while refusing to repaint hidden slots
3. moving a hidden slot during compaction must preserve hidden state
4. un-suppressing must explicitly clear the hidden-slot gate before recovery redraws

### Suppressed auxiliary visuals

Make `ArmyManager.hideArmyVisual()` hide all army-owned visuals:

1. body mesh remains hidden through the model gate
2. remove indicator dot
3. remove point icon
4. remove visible attachments
5. skip suppressed armies during per-frame batched visual updates

### Authoritative tile-sync recovery

Track the last time tile state has actually been applied to `ArmyManager`:

1. record tile-sync time only after `await this.armyManager.onTileUpdate(update)`
2. deferred timeout cancellation and deferred chunk retry must use that tile-sync time
3. troop updates must not advance the recovery gate

### Slotless movement recovery

When `moveArmy()` updates a destination for an army that currently has no visible slot:

1. update tracking state
2. attempt `renderArmyIntoCurrentChunkIfVisible()`
3. let the normal visibility checks decide whether the army should appear now

## TDD Plan

## Red

1. Add an `ArmyModel` runtime test that fails until a hidden moving slot stays hidden across `updateMovements()`.
2. Add an `ArmyModel` runtime test that fails until hidden state survives slot compaction.
3. Add an `ArmyManager` wiring test that fails until suppression hides auxiliary visuals and skips suppressed per-frame
   updates.
4. Add a `Worldmap` wiring test that fails until deferred retry uses a tile-sync timestamp owned by the tile listener.
5. Add an `ArmyManager` wiring test that fails until slotless `moveArmy()` attempts immediate render recovery.

## Green

1. Persist hidden-slot state in `ArmyModel`.
2. Clear hidden-slot state when suppression is lifted or the slot is freed.
3. Hide army-owned auxiliary visuals from `ArmyManager.hideArmyVisual()`.
4. Skip suppressed armies in the batched per-frame visual pass.
5. Replace the generic recovery timestamp with a tile-sync timestamp that is only updated after manager tile sync.
6. Attempt immediate render recovery when a moved army has no visible slot.

## Refactor

1. Extract helpers if suppression logic starts mixing orchestration and render detail.
2. Re-read `hideArmyVisual()`, `unsuppressArmy()`, `moveArmy()`, and deferred retry top-to-bottom for readability.

## Verification Plan

1. Run the focused ghosting regression tests.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. Manually verify:
   - suppress a moving army and confirm it stays hidden
   - confirm the ownership dot and icon do not linger
   - move an offscreen army into the current chunk without zooming
   - confirm it renders when tile state arrives
