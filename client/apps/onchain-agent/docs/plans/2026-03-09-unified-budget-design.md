# Unified Budget System — Design

## Goal

Unify building and production into a single budget system so they compete fairly for the same 90% resource budget, with smart tiered weights based on development stage.

## Architecture

Buildings become targets in the production planner's ordered list alongside resource and troop production. The runner still determines *what* to build and *where* (slots, population), but affordability is decided by the planner via shared budget. Smart weights from the game client's preset system control what percentage of each input resource is available per target.

## Unified Target List

A single ordered list of targets, processed sequentially with shared budget:

1. T1 resource buildings (economy growth — more buildings = more production next tick)
2. T1 resource production (complex + simple)
3. Donkey production
4. T2 resource buildings
5. T2 resource production (complex + simple)
6. T3 resource buildings
7. T3 resource production (complex + simple)
8. T1 troop buildings
9. T1 troop production (complex + simple)
10. T2 troop buildings + production
11. T3 troop buildings + production
12. WorkersHut buildings (population — injected when needed)
13. Wheat buildings (food)

Buildings interleave with production at each tier so economy infrastructure is prioritised before consumption at that tier.

## Smart Weights

Determined by building counts (matches game client's smart preset logic):

### Development Stage Detection

- **T1 incomplete**: fewer than 3 distinct T1 resource buildings (Wood + Coal + Copper)
- **T1 complete**: all 3 T1 resource building types present
- **Higher tiers present**: T2 or T3 resource/troop buildings exist

### Weight Table

| Stage | T1 Resources | T2 Resources | T3 Resources | Troops |
|-------|-------------|-------------|-------------|--------|
| T1 incomplete | 5% labor only | — | — | — |
| T1 complete only | 30% resource each | — | — | — |
| T1 + higher tiers | 20/20/30% (W/Co/Cu) | 10/5/3% | 10/5/3% | T3:50%, T2:30%, T1:10% |

Weights cap the percentage of each *input* resource's balance available to that target. The 90% overall cap still applies. Buildings don't use weights — they consume their exact scaled cost from remaining budget.

## Target Method Types

Currently: `"complex" | "simple"`

New: `"complex" | "simple" | "building"`

Building targets carry:
- `buildingType: number` — which building to construct
- `costs: { resource: number; amount: number }[]` — pre-computed scaled costs
- `useSimple: boolean` — whether to use simple recipe for construction
- `slot: SlotResult` — placement info from the runner

## Data Flow

```
1. Runner determines what to build + where (slots, population)
   → BuildIntent[] (no affordability check)

2. Slot finder assigns positions
   → SlotResult[] with direction arrays

3. Planner receives:
   - snapshot.balances (raw, for budget)
   - buildingCounts (for stage detection + weights)
   - troopPath (for target ordering)
   - gameConfig (recipes + building costs)
   - buildIntents with slots (buildings to attempt)

4. Planner computes smart weights from building counts

5. Planner walks unified target list:
   - Production targets: apply weight, compute cycles from budget
   - Building targets: check if exact cost fits in remaining budget
   - All deduct from shared budget

6. Planner returns:
   - ProductionPlan (calls, consumed, produced, skipped)
   - AffordableBuilds (subset of buildIntents that fit the budget)

7. Executor receives both and fires transactions
```

## Changes

### `production.ts`
- Add `"building"` method to ProductionTarget
- Add `computeSmartWeights()` — returns weight per resource based on building counts
- Apply weights to budget: `weightedBudget = floor(balance * weight / 100)` per resource, capped at 90%
- Handle building targets: check exact cost against remaining budget, deduct if affordable
- Return both production calls and affordable build actions

### `loop.ts`
- Remove the separate building cost reservation loop (lines 231-298)
- Pass build intents + slots into the planner
- Receive back both production plan and affordable builds
- Pass both to executor

### `runner.ts`
- No changes — still determines what to build based on slots and population
- Affordability moves to the planner

### `executor.ts`
- No changes — still receives BuildAction[] and ProductionActions

### `snapshot.ts`
- No changes

## Testing

- Smart weights computed correctly for each development stage
- Buildings compete with production for budget (building skipped when budget exhausted)
- Production weights applied correctly (T1 incomplete → 5% labor, T1 complete → 30%, etc.)
- Building at tier N is prioritised before production at tier N
- Existing production tests still pass (weights just add a cap layer)
