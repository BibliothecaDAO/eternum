---
domain: combat
urgency: low
autoload: false
---

# Combat Handbook

## Troop Types

| Category    | T1 (Resource ID) | T2 (Resource ID) | T3 (Resource ID) |
| ----------- | ---------------- | ---------------- | ---------------- |
| Knight      | 26               | 27               | 28               |
| Crossbowman | 29               | 30               | 31               |
| Paladin     | 32               | 33               | 34               |

- All T1 troops = 1 strength per unit
- Production: 5 troops/tick per military building
- T2 requires: 10 T1/tick + mid-tier resource + Essence
- T3 requires: 10 T2/tick + rare resource + Essence

## Army (Explorer) Management

- **Create**: `create_explorer` — spawns army from structure's troop reserves
  - Params: `forStructureId`, `category` (0=Knight, 1=Paladin, 2=Crossbow), `tier` (0=T1, 1=T2, 2=T3), `amount`,
    `spawnDirection`
- **Reinforce**: `add_to_explorer` — add troops to existing army (must be adjacent to home structure)
- **Disband**: `delete_explorer` — return troops to structure instantly
- **Army limit**: Each structure has a max army count (check "Armies: X/Y" in inspect output)

## Combat Actions

| Action                  | What It Does                              | Stamina Cost             |
| ----------------------- | ----------------------------------------- | ------------------------ |
| `attack_explorer`       | Army vs army (field battle)               | 50 attacker, 40 defender |
| `attack_guard`          | Army vs structure's guards (capture)      | Varies                   |
| `guard_attack_explorer` | Structure guards attack nearby army       | Varies                   |
| `raid`                  | Steal resources without destroying guards | Varies                   |

- Combat resolution is instant (onchain)
- Higher total strength wins
- Winner can steal specified resources from loser
- `"IN BATTLE"` flag appears during combat, clears after

## Guard Slots

- 4 slots per structure: Alpha (0), Bravo (1), Charlie (2), Delta (3)
- Each slot holds one troop type/tier at any count
- Total guard strength = sum across all slots
- `add_guard` — assign troops from reserves to a guard slot
- `delete_guard` — recall guard troops back to reserves
- `swap_explorer_to_guard` / `swap_guard_to_explorer` — transfer between armies and guard slots (must be adjacent)

## Stamina

- Armies have 0-120 stamina, regenerates +2 per phase (10 minutes)
- Travel (explored tiles): ~10 stamina/hex
- Explore (new tiles): 30 stamina/hex (minimum 10 troops required)
- Attacks consume 50 stamina (attacker), 40 (defender)

## Common Errors

- `"reached limit of troops for your structure"` — army cap reached, use different structure or delete armies
- Insufficient stamina — wait for regeneration or use a different army

## Active Combat Tasks

(None yet — will be populated when threats are identified.)
