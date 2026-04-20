# Worldmap Optimistic Movement Resolution PRD / TDD

## Status

- Status: Proposed for implementation
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx`
- Scope: movement timing for local armies
- Related: `WORLDMAP_ARMY_MOVEMENT_HANDOFF_PRD_TDD.md` (prior fix that split cache sync from visual handoff)

## Problem Statement

After the handoff fix, local army movement now presents correctly but still waits on the Torii indexer before the
animation starts. The sequence is:

1. user initiates move
2. transaction submits
3. transaction confirms on chain
4. Torii indexes the new `TileOpt` row (hundreds of ms to several seconds)
5. world update listener delivers `onTileUpdate`
6. `ArmyManager.onTileUpdate(...)` calls `moveArmy(...)`
7. the animation finally starts and the pending gate releases

The wait between 3 and 4-5 is wasted time. At confirmation time the client already knows:

- the tx hash (via `pendingArmyMovementTxMap`)
- the selected entity id
- the exact destination hex (`actionPath[last].hex`)
- the rest of the owner and troop fields (via `ArmyManager.getArmy(entityId)`)

So the visual move can start as soon as the provider emits `transactionComplete` rather than waiting for the indexer
round-trip. The indexer update, when it eventually arrives, should converge to a no-op because the army will already be
at the authoritative destination.

## Findings From The Trace

### Stable facts

1. Submit path
   - `onArmyMovement(...)` at `scenes/worldmap.tsx:2373` captures `actionPath`, the destination hex, creates travel FX,
     creates arrival ghost, installs lifecycle, marks pending.
   - `armyActionManager.moveArmy(...)` returns a promise; on success we map `txHash -> entityId` in
     `pendingArmyMovementTxMap` at `scenes/worldmap.tsx:2541`.

2. Tx confirmation path
   - `bindTransactionFailureLifecycle(...)` at `scenes/worldmap.tsx:1062` wires `transactionComplete` to
     `handleTransactionComplete(...)` at `scenes/worldmap.tsx:1063`.
   - Today this handler only records a `tx_confirmed` latency phase at `scenes/worldmap.tsx:1074`. It does **not**
     resolve the move.

3. Indexer path
   - `registerArmyWorldUpdateSubscriptions(...)` at `scenes/worldmap.tsx:1230` handles `onTileUpdate`, calling
     `updateArmyHexes(update)` and `await this.armyManager.onTileUpdate(update)`.
   - `ArmyManager.onTileUpdate(...)` at `managers/army-manager.ts:622` calls `this.moveArmy(entityId, newPosition)` when
     the army is already tracked.
   - `ArmyManager.moveArmy(...)` at `managers/army-manager.ts:1790` early-returns when `startPos === targetPos` (line
     1801). This is the idempotency guarantee the optimistic path relies on.

4. Render lifecycle
   - `installPendingMovementVisualLifecycle(...)` at `scenes/worldmap.tsx:2751` wires:
     - `onMovementStart` -> `clearPendingArmyMovement(entityId, "movement_started")`
     - `onMovementComplete` -> `arrivalGhostManager.resolveArrivalGhost(entityId)`

5. Data needed to synthesize a tile update
   - `ArmyData` (from `getArmy(entityId)`) has `owner.address`, `owner.ownerName`, `owner.guildName`,
     `owningStructureId`, `category`, `tier`, `isDaydreamsAgent`, `troopCount`, `currentStamina`, `maxStamina`,
     `onChainStamina`, battle fields.
   - That matches every field in `ExplorerTroopsTileSystemUpdate` (`packages/core/src/systems/types.ts:17`).

### Most important implication

Because `moveArmy` is already idempotent on same-position targets, the same code path that Torii drives can be invoked
directly from `transactionComplete` without coordination flags. The later indexer update becomes a confirming no-op.

## Goals

### User goals

- Local army animations begin as soon as the move transaction confirms.
- There is no visible pause between "tx sent → animation running" even under slow indexer lag.
- The indexer update, when it arrives, does not double-animate, re-trigger travel FX, or replay the arrival ghost.

### Engineering goals

- Drive the existing visual pipeline (`updateArmyHexes` + `ArmyManager.onTileUpdate`) from the `transactionComplete`
  event for local armies.
- Keep the indexer path authoritative — it still runs, it just converges on an already-applied state.
- Preserve every existing safety rail: tx-failed clears ghosts; 30s stale fallback still fires; explorer troop updates
  still cannot clear pending movement.

## Non-goals

- Optimistic updates for remote (other players') armies. Those still flow exclusively through the indexer.
- Optimistic resolution for **explore** actions. The explore contract
  (`contracts/game/src/systems/combat/contracts/troop_movement.cairo:170-286`) uses on-chain VRF to decide whether
  treasure is found. When treasure _is_ found, the explorer is rewound to its source hex (lines 277-286 — the
  `occupy_destination == false` branch sets `explorer.coord = from` and re-occupies the source tile). Because we
  cannot predict the VRF result client-side, optimistically animating to the requested destination would produce a
  visible source → destination → source ping-pong whenever treasure is discovered. Explore therefore continues to use
  the indexer-driven path (tx confirmed → `tx_confirmed` latency phase only → real `onTileUpdate` drives the move).
- Optimistic stamina or troop count updates. `queuePendingMovementStamina(...)` already handles stamina; indexer still
  owns troop counts.
- Optimistic explore result (new biome reveal, extra rewards). Biome/reward data still arrives through Torii.
- Changing `ArmyActionManager`, system calls, or tx confirmation plumbing. Only the renderer-side listener changes.

## Proposed Behavior

### New lifecycle for local travel moves

Explore actions deliberately skip step 4 and therefore short-circuit at step 5 (see Non-goals above).

1. submit move
2. mark pending + travel FX + arrival ghost (unchanged)
3. record `tx_submitted`; store `{txHash -> entityId}` (unchanged)
4. **travel actions only** — store `{txHash -> targetHex}` alongside the entity map
5. **on `transactionComplete`**:
   - record `tx_confirmed`
   - synthesize an `ExplorerTroopsTileSystemUpdate` using tracked army data + cached target hex
   - call `updateArmyHexes(synthetic)` and `await this.armyManager.onTileUpdate(synthetic)` — same pipeline the indexer
     triggers
   - record a new `movement_resolved_optimistically` latency phase
   - mark the entity optimistically-resolved so downstream indexer handling can skip redundant convergence steps where
     they would be wasteful
6. later, Torii delivers the real tile update:
   - `updateArmyHexes` re-confirms the cache (no visual effect — same position)
   - `armyManager.onTileUpdate -> moveArmy` early-returns due to same-position guard
   - clear the optimistically-resolved mark
7. `onMovementStart` fires from the renderer → pending clears, lifecycle continues (unchanged)
8. `onMovementComplete` fires → arrival ghost resolves, travel FX ends (unchanged)

### Safety rails (preserved)

- Tx failed: still clears pending, ghost, lifecycle, travel FX.
- 30s stale fallback: still clears pending and ghost if nothing ever animates (handles confirmed tx whose tile never
  arrives).
- Explorer troop updates: still must not clear pending movement.
- Remote armies: never resolve optimistically. We only act when `pendingArmyMovementTxMap` has an entry for the tx hash,
  which we only populate for local moves we initiated.
- Army removed between submit and confirm: if `armyManager.getArmy(entityId)` returns undefined, skip optimistic
  resolution and wait for the indexer.

### Source of truth

- Chain state remains authoritative via Torii.
- Optimistic render is derived from submitted action path; if the tx is reverted post-confirm in any exotic scenario,
  the indexer will emit a corrective update that `updateArmyHexes` will apply through the normal code path.

## Architecture

### 1. Remember the destination per pending tx

Today `pendingArmyMovementTxMap: Map<string, ID>` maps `txHash -> entityId`. Add a parallel structure:

```ts
private pendingArmyMovementTxTargets: Map<string, HexPosition> = new Map();
```

Populated in the `.then(result => ...)` branch of `onArmyMovement` right next to the existing
`pendingArmyMovementTxMap.set(txHash, selectedEntityId)`. The destination hex comes from
`actionPath[actionPath.length - 1].hex` (the same value we already compute for FX and ghost).

Cleared anywhere `pendingArmyMovementTxMap` is cleared (clearPendingArmyMovement, transactionFailed handler, destroy).

### 2. Optimistic resolver

Add a private method (extracted into a pure planner for testability):

```ts
private resolveArmyMovementOptimistically(params: {
  entityId: ID;
  txHash: string;
  targetHex: HexPosition;
}): void
```

Responsibilities:

- short-circuit if the army is no longer tracked
- build the synthetic `ExplorerTroopsTileSystemUpdate` from the tracked `ArmyData`
- call `this.updateArmyHexes(update)`
- `void this.armyManager.onTileUpdate(update)` (fire-and-forget — animation starts)
- record `movement_resolved_optimistically` latency phase
- add `entityId` to a `Set<ID>` named `optimisticallyResolvedArmies` so the later indexer path can assert/log
  convergence

A companion pure function `buildOptimisticArmyTileUpdate(army, targetHex)` lives next to `worldmap.tsx` (e.g. in a
sibling `worldmap-optimistic-movement.ts`) and is unit-tested separately.

### 3. Wire it into `transactionComplete`

`handleTransactionComplete` becomes:

```ts
const entityId = this.pendingArmyMovementTxMap.get(txHash);
if (entityId === undefined) return;

recordArmyMovementLatencyPhase({ phase: "tx_confirmed", source: "worldmap", entityId, txHash });

const targetHex = this.pendingArmyMovementTxTargets.get(txHash);
if (!targetHex) return;

this.resolveArmyMovementOptimistically({ entityId, txHash, targetHex });
```

### 4. Converge on later indexer delivery

`registerArmyWorldUpdateSubscriptions` already calls `updateArmyHexes` + `onTileUpdate`. No changes required for
correctness — `moveArmy`'s same-position early-return handles the no-op. We do:

- record a `movement_optimistic_convergence` phase when the authoritative tile update arrives for an entity that was
  optimistically resolved
- remove the entity from `optimisticallyResolvedArmies`

This gives us latency instrumentation to verify convergence in dev and in traces without changing behavior.

### 5. Cleanup wiring

- `clearPendingArmyMovement(entityId, reason)` also prunes `pendingArmyMovementTxTargets` for any txHash mapped to this
  entity, and removes the entity from `optimisticallyResolvedArmies`.
- The existing `destroy()` path that clears `pendingArmyMovementTxMap` also clears the new maps.

## TDD Plan

### Red phase

Add failing tests for:

1. **Destination capture**: when tx submission resolves with `transaction_hash`, worldmap stores the destination hex
   alongside `pendingArmyMovementTxMap`.
   - Source assertion: `worldmap.tsx` contains `pendingArmyMovementTxTargets` and sets it in the
     `.then((result) => ...)` branch of `onArmyMovement` next to the existing `pendingArmyMovementTxMap.set`.

2. **Optimistic trigger on tx_confirmed**: `handleTransactionComplete` calls the optimistic resolver when a target hex
   is known.
   - Source assertion: `worldmap.tsx` contains `resolveArmyMovementOptimistically` and it is invoked from
     `handleTransactionComplete`.

3. **Synthetic tile update structure**: extracted pure builder returns a well-formed `ExplorerTroopsTileSystemUpdate`
   when given real-looking `ArmyData` and a target hex.
   - Behavioral test in a new file covering `buildOptimisticArmyTileUpdate`. Uses contract-style coordinates, checks
     entityId / hexCoords / ownerAddress / troopType / troopTier are copied through, and that `removed` is never set.

4. **Idempotency reliance**: the optimistic resolver calls `updateArmyHexes` and `armyManager.onTileUpdate` with the
   synthetic update.
   - Source assertion in `worldmap.tsx` and a unit test over an isolated planner that returns
     `{ cacheUpdate, armyManagerUpdate }` payloads.

5. **Latency instrumentation**: worldmap records `movement_resolved_optimistically` and
   `movement_optimistic_convergence` phases.
   - Extend `worldmap-movement-latency-tracing.source.test.ts` to assert those literals appear in source.

6. **Remote army isolation**: when a `transactionComplete` hash has no `pendingArmyMovementTxMap` entry, no optimistic
   resolution runs.
   - Source assertion: the call into the resolver is gated by the existing txMap lookup.

7. **Missing army guard**: when `armyManager.getArmy(entityId)` is undefined, the resolver is a no-op.
   - Unit test against the pure builder: it returns `null` / undefined so the caller skips.

### Green phase

Implement:

- `pendingArmyMovementTxTargets` map + cleanup
- `buildOptimisticArmyTileUpdate(...)` pure function in `scenes/worldmap-optimistic-movement.ts`
- `resolveArmyMovementOptimistically(...)` on `WorldmapScene`
- Wire into `handleTransactionComplete` and converge-log on the indexer tile handler
- Add the two new latency phases in the appropriate places

### Refactor phase

- Keep the optimistic planner a pure function (no `WorldmapScene` dependency) so tests are stable against rendering
  details.
- Keep `handleTransactionComplete` tiny: record phase, lookup, call resolver.
- Keep `registerArmyWorldUpdateSubscriptions` changes minimal: single convergence-log call gated by
  `optimisticallyResolvedArmies.has(entityId)`.

## Verification

Targeted tests:

- `worldmap-optimistic-movement.source.test.ts` (new, red-phase assertions)
- `worldmap-optimistic-movement.test.ts` (new, pure builder)
- `worldmap-movement-latency-tracing.source.test.ts` (extended)
- `worldmap-pending-movement-visual-handoff.source.test.ts` (must still pass — no regression)
- `worldmap-arrival-ghost.source.test.ts` (must still pass)
- `worldmap-travel-effect-lifecycle.source.test.ts` (must still pass)

Broader:

- `pnpm run format`
- `pnpm --filter eternum-game-client test`

## Expected Outcome

After the change:

- On tx confirmation the unit begins animating toward its destination immediately; the "move_requested →
  movement_started" latency phase window collapses to the network+provider confirmation time, not the indexer delivery
  time.
- Indexer tile updates no longer gate visual movement for local armies. They continue to be authoritative but serve as
  silent convergence for already-resolved moves.
- Remote armies, explorer troop updates, failure paths, and the stale-movement fallback are unchanged.
