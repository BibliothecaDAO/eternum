# Priority Ordering

## Default Priority Stack (highest to lowest)

1. **Immediate defense** -- Respond to active battles or enemy armies within 2 tiles of any owned structure.
2. **Guard coverage** -- Ensure every realm and structure has at least one guard slot filled.
3. **Claim arrivals** -- Offload pending resource arrivals before they expire or pile up.
4. **Production upkeep** -- Resume any paused productions. Build missing production buildings if resources allow.
5. **Resource balance** -- If any critical resource (food, wood, stone) is below 20% of your highest resource, trade or produce to rebalance.
6. **Exploration** -- If fewer than 2 explorers are active, create one. Move idle explorers toward unexplored tiles.
7. **Expansion** -- Upgrade realms or create villages when resource surplus exceeds 150% of maintenance costs.
8. **Trade optimization** -- Check bank prices. Buy low, sell high. Place limit orders for scarce resources.
9. **Hyperstructure contributions** -- Contribute surplus resources to allied hyperstructures for points.
10. **Offensive military** -- Attack or raid enemy structures only when you have 2x simulated strength advantage.

## Priority Shift Triggers

- **Enemy army spotted within 3 tiles**: Shift to defense. Train guards, recall nearby explorers.
- **Resource below 10% threshold**: Shift to economy. Pause non-essential production, sell excess resources, buy the shortage.
- **All structures guarded and economy stable**: Shift to exploration and expansion.
- **Hyperstructure nearing completion**: Shift to contribution if you have surplus resources and allied access.
- **Leaderboard position dropping**: Evaluate whether points come from military, economy, or hyperstructures and focus accordingly.

## Per-Tick Budget

- Spend at most 3 actions per tick on economy (trades, resource sends, building).
- Spend at most 2 actions per tick on military (troop creation, attacks, swaps).
- Spend at most 2 actions per tick on exploration (moves, explores).
- Reserve at least 1 action slot for reactive defense if threats are present.

## Current Situation (Tick 1770566102)

### Status: ✅ STABLE - EXPLORATION PHASE

**Completed:**
- ✅ Guard coverage: All 3 structures defended
- ✅ No arrivals pending
- ✅ All productions running
- ✅ Created first explorer (entity 3380)

**Active Priorities:**
1. **Exploration** (HIGH) - Move explorer 3380 to reveal map
2. **Resource monitoring** (MEDIUM) - Track Wood/Copper production over next 3-5 ticks
3. **Map awareness** (HIGH) - Identify banks, threats, and expansion opportunities
4. **Second explorer** (MEDIUM) - Create once first explorer proves viable

**Deferred:**
- Resource rebalancing (waiting to observe natural production rates)
- Realm upgrades (Wood/Copper too low for building projects)
- Offensive operations (no targets identified yet)
- Diplomacy (no guild or alliance established yet)

### Next Tick Immediate Actions
1. Move explorer 3380 east with explore=true
2. Observe resource deltas (especially Wood and Copper)
3. Scout for banks or strategic structures

### Troop Creation Learnings
**CRITICAL: Use tier=0 for basic troops**
- tier=0 → T1 (basic)
- tier=1 → T2 (advanced)
- tier=2 → T3 (elite)

**Category mapping:**
- 0 = Paladin
- 1 = Knight
- 2 = Crossbowman

**Tested explorer size:** 100B troops works well for scouting
