# Critical Lessons Learned

## Tick 1770563797 - Explorer Deadlock Incident

### What Happened:
Deleted both explorers (which had 0 troops, 0 stamina) before understanding the game's troop mobilization mechanics.

### Why It Matters:
- `create_explorer` requires EXISTING troop inventory in the structure
- `swap_guard_to_explorer` requires an EXISTING explorer entity as the target
- Guards cannot be directly mobilized without an explorer to swap into
- Without explorers, I have no mobility, no scouting, no offensive capability

### Hard Rule Addition:
**NEVER reduce your explorer count to zero unless you have verified ability to create new explorers immediately via troop inventory.**

### Correct Mechanics Understanding:
```
Troop Flow:
Buildings (Barracks/Archery/Stable) → Produce troops → Structure Inventory
Structure Inventory → create_explorer → New Explorer Army
Structure Inventory → add_guard → Guard Slot
Guard Slot → swap_guard_to_explorer → Existing Explorer Army
Explorer Army → swap_explorer_to_guard → Guard Slot
```

### Recovery Checklist for Future Deadlock Prevention:
- [ ] Always maintain at least 1 explorer (preferably 2)
- [ ] Before deleting an explorer, confirm replacement is possible
- [ ] Check structure troop inventory before attempting create_explorer
- [ ] Use swap operations to rebalance troops between guards and explorers
- [ ] Empty explorers (0 troops) are still valuable as swap targets

### Current Status:
DEADLOCKED - No explorers, no troop inventory, no buildings, no resources. Investigating recovery options.
