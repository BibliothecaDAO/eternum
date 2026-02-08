# Priority Ordering - UPDATED

## CRITICAL WARNING - Explorer Minimum
**HARD RULE: NEVER reduce total explorer count below 1.**
- Empty explorers (0 troops, 0 stamina) still serve as targets for swap_guard_to_explorer
- Without explorers, guard troops cannot be mobilized
- Without explorers, no movement, scouting, or offensive capability exists
- Violation of this rule creates DEADLOCK STATE

## Default Priority Stack (highest to lowest)

1. **Explorer preservation** -- NEVER delete your last explorer. Maintain minimum of 1, preferably 2.
2. **Immediate defense** -- Respond to active battles or enemy armies within 2 tiles of any owned structure.
3. **Guard coverage** -- Ensure every realm and structure has at least one guard slot filled.
4. **Troop inventory check** -- Before deleting an explorer, verify structure has troop inventory to create replacements.
5. **Claim arrivals** -- Offload pending resource arrivals before they expire or pile up.
6. **Production upkeep** -- Resume any paused productions. Build missing production buildings if resources allow.
7. **Resource balance** -- If any critical resource (food, wood, stone) is below 20% of your highest resource, trade or produce to rebalance.
8. **Exploration** -- If fewer than 2 explorers are active, create one. Move idle explorers toward unexplored tiles.
9. **Expansion** -- Upgrade realms or create villages when resource surplus exceeds 150% of maintenance costs.
10. **Trade optimization** -- Check bank prices. Buy low, sell high. Place limit orders for scarce resources.
11. **Hyperstructure contributions** -- Contribute surplus resources to allied hyperstructures for points.
12. **Offensive military** -- Attack or raid enemy structures only when you have 2x simulated strength advantage.

## Priority Shift Triggers

- **Explorer count = 1**: BLOCK all explorer deletion actions. Priority shifts to creating second explorer.
- **Explorer count = 0**: DEADLOCK STATE. All other priorities suspended. Focus on recovery.
- **Enemy army spotted within 3 tiles**: Shift to defense. Train guards, recall nearby explorers.
- **Resource below 10% threshold**: Shift to economy. Pause non-essential production, sell excess resources, buy the shortage.
- **All structures guarded and economy stable**: Shift to exploration and expansion.
- **Hyperstructure nearing completion**: Shift to contribution if you have surplus resources and allied access.
- **Leaderboard position dropping**: Evaluate whether points come from military, economy, or hyperstructures and focus accordingly.

## Troop Mobilization Flow

Understanding troop flow prevents deadlock:
```
Production Buildings → Troop Inventory (in structure)
Troop Inventory → create_explorer → New Explorer
Troop Inventory → add_guard → Guard Slot
Guard Slot → swap_guard_to_explorer → Existing Explorer (requires target)
Guard Slot → swap_guard_to_explorer → BLOCKED if no explorers exist
```

## Per-Tick Budget

- Spend at most 3 actions per tick on economy (trades, resource sends, building).
- Spend at most 2 actions per tick on military (troop creation, attacks, swaps).
- Spend at most 2 actions per tick on exploration (moves, explores).
- Reserve at least 1 action slot for reactive defense if threats are present.
- **NEVER spend action on deleting last explorer.**

## Recovery from Near-Deadlock

If explorer count drops to 1:
1. Immediately create second explorer from structure with highest troop inventory
2. If no troop inventory, build Barracks/Archery/Stable immediately
3. If no resources for buildings, prioritize resource acquisition above all else
4. Consider swapping guard troops to the remaining explorer if structure will remain adequately guarded
