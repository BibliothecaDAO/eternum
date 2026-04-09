# Army Stamina Sync PRD / TDD

## Status

- Status: In progress
- Scope:
  - `client/apps/game/src/three/managers/army-manager.ts`
  - `client/apps/game/src/ui/features/world/components/entities/hooks/use-army-entity-detail.ts`
  - `client/apps/game/src/ui/shared/components/block-timestamp-poller.tsx`
  - shared stamina helpers in `client/apps/game/src/**`
- Primary goal: make the world map army label and the selected-army UI stamina bar resolve from the same live troop
  state on the same tick cadence

## Why This Exists

Players can see different stamina values for the same army depending on where they look:

1. the world map label can tick forward before the selected-army UI bar
2. the selected-army UI can keep using a stale Torii explorer snapshot after troop stamina has already changed in the
   live component store
3. the world map label's passive stamina recompute ignores stamina regen boosts even though `StaminaManager` supports
   them

That creates three visible failure modes:

1. same army, same moment, different displayed stamina
2. map label updates after a move/attack/explore while the detail panel stays stale
3. boosted armies drift apart because the map label recomputes with zeroed boosts

## Product Goals

### User goals

1. The world map label and selected-army detail bar show the same stamina for the same army.
2. Passive stamina regen appears to advance consistently across map and UI.
3. Live stamina spends and boosted regen show up without waiting for manual refresh.

### Engineering goals

1. One shared stamina resolution path chooses live troop state before stale snapshots.
2. `ArmyManager` passive recompute uses the same troop source as the selected-army UI.
3. The selected-army UI tick cadence matches the world label cadence closely enough that players do not see drift.

## Non-goals

1. Reworking every stamina consumer in the client.
2. Replacing Torii explorer/resource fetches outside stamina-sensitive rendering.
3. Rewriting the full chain-time system.

## Current-State Diagnosis

### Data-source split

1. `WorldUpdateListener` can seed army map updates from live `ExplorerTroops`.
2. `ArmyManager` later passively recomputes from cached `onChainStamina` plus zeroed boosts.
3. `useArmyEntityDetail` derives stamina from the Torii-fetched `explorer.troops` snapshot.

Result:

- map and UI can be mathematically correct against different inputs

### Tick-cadence split

1. `ArmyManager` checks stamina tick changes every second.
2. `BlockTimestampPoller` only refreshes `useBlockTimestampStore` every 10 seconds.

Result:

- the selected-army UI can lag one or more armies ticks behind the world label

## Proposed Design

### Shared troop preference

Introduce a shared helper that resolves display stamina from:

1. live `ExplorerTroops` when available
2. fallback snapshot troops when live troops are unavailable
3. cached army data only as a final fallback for map-only paths

### Boost-aware passive recompute

Refactor `ArmyManager` passive stamina recompute so it:

1. asks for live explorer troops by entity id when components are available
2. uses those live troops for regen math, including boosts
3. falls back to cached category/tier/count/on-chain stamina only when live troops are unavailable

### Faster UI tick cadence

Bring the timestamp poller cadence down to one second so UI consumers using `useBlockTimestampStore` stop visibly
lagging the world label.

## TDD Plan

## Red

1. Add a selected-army detail hook test that fails until the hook prefers live component troops over a stale Torii
   snapshot.
2. Add an `ArmyManager` passive recompute test that fails until recompute consults live troop state instead of only the
   cached zero-boost snapshot.
3. Add a `BlockTimestampPoller` runtime test that fails until the poller refreshes once per second.

## Green

1. Add the shared troop/stamina resolver.
2. Use it in `useArmyEntityDetail`.
3. Use it in `ArmyManager` passive recompute and explicit troop-update recompute.
4. Reduce `BlockTimestampPoller` interval to one second.

## Refactor

1. Keep top-level orchestration in `ArmyManager` readable by extracting any inline fallback troop construction.
2. Re-read exported helpers and hook flow so the stamina source is obvious without descending into implementation
   details.

## Verification Plan

1. Run the focused stamina sync tests.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. Manually verify:
   - select an army on the world map and compare label stamina with the side panel
   - wait for passive regen and confirm both surfaces advance together
   - test an army with stamina regen boost and confirm both surfaces stay aligned
