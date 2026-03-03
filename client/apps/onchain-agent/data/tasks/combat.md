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

- **Create**: `explorer_create` — spawns army from structure's troop reserves
  - Params: `for_structure_id`, `category` (0=Knight, 1=Paladin, 2=Crossbow), `tier` (0=T1, 1=T2, 2=T3), `amount`,
    `spawn_direction`
- **Reinforce**: `explorer_add` — add troops to existing army (must be adjacent to home structure)
- **Disband**: `explorer_delete` — return troops to structure instantly
- **Swap troops**: `explorer_explorer_swap` — transfer troops between two adjacent explorers
- **Army limit**: Each structure has a max army count (check "Armies: X/Y" in inspect output)

## Combat Actions

| Action                        | What It Does                                    | Stamina Cost             |
| ----------------------------- | ----------------------------------------------- | ------------------------ |
| `attack_explorer_vs_explorer` | Army vs army — strength-based, steal on victory | 50 attacker, 40 defender |
| `attack_explorer_vs_guard`    | Army vs structure guard — capture on victory    | 30                       |
| `attack_guard_vs_explorer`    | Guard attacks nearby army — defensive action    | 30                       |
| `raid_explorer_vs_guard`      | Steal resources without destroying guard        | 30                       |

- Combat resolution is instant (onchain)
- Higher total strength wins — use `simulate_battle` or `simulate_raid` to predict outcomes
- `attack_explorer_vs_explorer`: winner can steal specified resources from the defeated explorer
- `attack_explorer_vs_guard`: victory destroys the guard and captures the structure
- `raid_explorer_vs_guard`: guard survives, you only steal resources — useful when guard is too strong to defeat
- `"IN BATTLE"` flag appears during combat, clears after

## Guard Slots

Guard slot names depend on structure level:

| Slot | Settlement | City       | Kingdom     | Empire     |
| ---- | ---------- | ---------- | ----------- | ---------- |
| 0    | Watchtower | Outer Wall | Castle Wall | Inner Wall |
| 1    | —          | Outer Wall | Castle Wall | Inner Wall |
| 2    | —          | —          | Castle Wall | Inner Wall |
| 3    | —          | —          | —           | Inner Wall |

- Each slot holds one troop type/tier at any count
- Total guard strength = sum across all slots
- `guard_add` — assign troops from reserves to a guard slot
- `guard_delete` — recall guard troops back to reserves
- `explorer_guard_swap` / `guard_explorer_swap` — transfer between armies and guard slots (must be adjacent)

## Stamina

- Armies have 0-120 stamina, regenerates +20 per phase (every ~1 minute in Blitz)
- Travel (explored tiles): ~10 stamina/hex
- Explore (new tiles): 30 stamina/hex (minimum 10 troops required)
- `attack_explorer_vs_explorer`: 50 attacker, 40 defender
- `attack_explorer_vs_guard` / `attack_guard_vs_explorer` / `raid_explorer_vs_guard`: 30 stamina

## Common Errors

- `"reached limit of troops for your structure"` — army cap reached, use different structure or delete armies
- Insufficient stamina — wait for regeneration or use a different army

## Active Combat Tasks

(None yet — will be populated when threats are identified.)
