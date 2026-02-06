---
domain: priorities
---

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
