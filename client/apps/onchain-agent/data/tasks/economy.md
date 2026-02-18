---
domain: economy
urgency: high
autoload: false
---

# Economy Handbook

## Resource IDs

All resource types and their onchain IDs. Use these IDs with `send_resources`, `buy_resources`, `sell_resources`, etc.

| ID | Resource | ID | Resource | ID | Resource |
|----|----------|----|----------|----|----------|
| 1 | Stone | 14 | Diamonds | 27 | Knight T2 |
| 2 | Coal | 15 | Hartwood | 28 | Knight T3 |
| 3 | Wood | 16 | Ignium | 29 | Crossbowman |
| 4 | Copper | 17 | TwilightQuartz | 30 | Crossbowman T2 |
| 5 | Ironwood | 18 | TrueIce | 31 | Crossbowman T3 |
| 6 | Obsidian | 19 | Adamantine | 32 | Paladin |
| 7 | Gold | 20 | Sapphire | 33 | Paladin T2 |
| 8 | Silver | 21 | EtherealSilica | 34 | Paladin T3 |
| 9 | Mithral | 22 | Dragonhide | 35 | Wheat |
| 10 | AlchemicalSilver | 23 | Labor | 36 | Fish |
| 11 | ColdIron | 24 | AncientFragment | 37 | Lords |
| 12 | DeepCrystal | 25 | Donkey | 38 | Essence |
| 13 | Ruby | 26 | Knight | | |

Note: Building type IDs (used with `create_building`) are different from resource IDs. See Building sections below.

## Production Chain

```
Basic (Wood, Coal, Copper)
  → Mid-Tier (Ironwood, Gold, Cold Iron)
    → Rare (Adamantine, Mithral, Dragonhide) — also require Essence
      → T2/T3 troops — also require Essence
```

## Resource Building Costs (Blitz)

### Basic Resource Buildings

| Building | Type ID | Labor-Only Cost | Resource Cost |
|----------|---------|----------------|---------------|
| Wood Mill | 5 | 30 Labor | 30 Labor |
| Coal Mine | 4 | 90 Labor | 30 Labor, 30 Wood |
| Copper Smelter | 6 | 300 Labor | 60 Labor, 60 Wood, 30 Coal |

### Mid-Tier Resource Buildings

| Building | Type ID | Labor-Only Cost | Resource Cost |
|----------|---------|----------------|---------------|
| Ironwood Mill | 7 | 720 Labor | 120 Labor, 120 Wood, 60 Coal, 30 Copper |
| Cold Iron Foundry | 13 | 720 Labor | 120 Labor, 120 Wood, 60 Coal, 30 Copper |
| Gold Mine | 9 | 720 Labor | 120 Labor, 120 Wood, 60 Coal, 30 Copper |

### Rare Resource Buildings (Resource Mode Only)

| Building | Type ID | Resource Cost |
|----------|---------|---------------|
| Adamantine Mine | 21 | 240 Labor, 180 Wood, 120 Copper, 60 Ironwood, 600 Essence |
| Mithral Forge | 11 | 240 Labor, 180 Wood, 120 Copper, 60 Cold Iron, 600 Essence |
| Dragonhide Tannery | 24 | 240 Labor, 180 Wood, 120 Copper, 60 Gold, 600 Essence |

## Other Building IDs

| ID | Building | Notes |
|----|----------|-------|
| 1 | WorkersHut | +6 population capacity |
| 25 | Labor | Free to build, free upkeep |
| 37 | Wheat/Farm | Foundation of all production |
| 27 | Donkey | Transport |

## Structure Levels & Building Slots

| Level | Name | Building Slots |
|-------|------|---------------|
| L0 | Settlement | 6 |
| L1 | Village | 18 |
| L2 | Kingdom | 36 |
| L3 | Empire | 60 (max) |

## Building Placement

Building placement uses direction arrays from the structure center:
- Ring 1: 6 slots
- Ring 2: 12 slots
- Ring 3: 18 slots
- Ring 4: 24 slots (L3 Empire only)

Use `inspect_realm` to get available free building paths. Occupied slots return `"space is occupied"` error.

## Building Actions

- `create_building` — params: `entityId`, `directions[]` (path from center), `buildingCategory`, `useSimple`
- `destroy_building` — params: `entityId`, `buildingCoord {x, y}`
- `pause_production` — stop a building's output (saves consumed resources)
- `resume_production` — restart a paused building

## Common Errors

- `"Insufficient Balance: COPPER"` — not enough Copper to build
- `"space is occupied"` — slot already used, check free paths via `inspect_realm`
- `"village owner not set"` — villages cannot receive direct resource transfers

## Active Economy Tasks

(None yet — will be populated after first observation.)
