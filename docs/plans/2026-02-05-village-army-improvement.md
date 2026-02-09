# ES2 Village and Army Improvement - Implementation Summary

**Issue:** #3948 **Status:** In Progress

---

## Implemented Features

### 1. Army Strength / Deployment Caps (TroopLimitConfig)

Replaced the old flat 100k `explorer_guard_max_troop_count` cap with a tier-aware, level-based deployment cap system.
All new fields are added directly to the existing `TroopLimitConfig` struct (packed).

**Config fields added to `TroopLimitConfig`:**

- `settlement_deployment_cap: u32` (6,000)
- `city_deployment_cap: u32` (30,000)
- `kingdom_deployment_cap: u32` (90,000)
- `empire_deployment_cap: u32` (180,000)
- `t1_tier_strength: u8` (1), `t2_tier_strength: u8` (3), `t3_tier_strength: u8` (9)
- `t1_tier_modifier: u8` (50 = 0.5x), `t2_tier_modifier: u8` (100 = 1.0x), `t3_tier_modifier: u8` (150 = 1.5x)

**Config fields removed:**

- `explorer_max_party_count: u8` — removed, explorer limits now come from `troop_max_explorer_count` on `StructureBase`
- `explorer_guard_max_troop_count: u32` — replaced by deployment cap system

**Config field type changes:**

- `guard_resurrection_delay`: `u32` → `u16`
- `mercenaries_troop_lower_bound`: `u32` → `u16`
- `mercenaries_troop_upper_bound`: `u32` → `u16`
- `agents_troop_lower_bound`: `u32` → `u16`
- `agents_troop_upper_bound`: `u32` → `u16`

**Formula:** `Max_Army_Size = (Deployment_Cap * Tier_Modifier) / (Tier_Strength * 100)`

The divisor `100` is a constant via `TroopLimitImpl::tier_modifier_divisor()`. All multiplications are performed before
divisions to preserve precision.

**Key files:**

- `contracts/game/src/models/config.cairo` — `TroopLimitConfig` struct
- `contracts/game/src/models/troop.cairo` — `TroopLimitImpl` with `max_army_size(level, tier)`,
  `max_slot_size(level, blitz_mode_on)`, and `tier_modifier_divisor()`

**Callsites updated:**

- `systems/utils/troop.cairo` — `iGuardImpl::add` and `iExplorerImpl::create` now use `max_army_size` with tier
- `systems/combat/contracts/troop_management.cairo` — `explorer_add`, `explorer_explorer_swap`, `guard_explorer_swap`
  all pass tier to `max_army_size`
- Error messages now include the computed max: `"reached limit of structure guard troop count. max: {}"`

### 2. Level-Based Army Slots

`TroopLimitImpl::max_slot_size(level, blitz_mode_on)` returns `(explorer_slots, guard_slots)` per structure level:

| Level | Name       | Explorer Slots | Guard Slots |
| ----- | ---------- | -------------- | ----------- |
| 0     | Settlement | 1              | 1           |
| 1     | City       | 3              | 2           |
| 2     | Kingdom    | 5              | 3           |
| 3     | Empire     | 8              | 4           |

In blitz mode, slots are equal: `(level+1, level+1)`.

### 3. Village Spawn Immunity (48h)

Villages get immunity from all attacks for 48h after creation, checked via the existing `is_cloaked` mechanism in
`StructureBaseImpl::is_cloaked()`. Uses `BattleConfig.village_immunity_ticks`.

### 4. Post-Raid Resource Immunity (24h)

After a successful raid on a village, the village gets 24h immunity from resource raiding. Troop stocks
(knight/crossbow/paladin resources) can still be pillaged.

**New model:** `VillageRaidImmunity { village_id: ID, last_raided_at: u64 }`

**New config field:** `BattleConfig.village_raid_immunity_ticks: u8` (default: 24 ticks = 24h)

**Implementation in `raid_explorer_vs_guard`:**

1. After raid outcome is determined and raid succeeds:
2. Check if defender is a village
3. If village, read `VillageRaidImmunity` and check if within immunity window
4. Pass `troop_resources_only` flag to `structure_to_troop_raid_instant`
5. If `troop_resources_only`, validate all requested resources pass `TroopResourceImpl::is_troop()` via
   `ensure_only_troop_resource()`
6. After successful raid on village, write updated `VillageRaidImmunity` with current tick

**Key files:**

- `contracts/game/src/models/structure.cairo` — `VillageRaidImmunity` model
- `contracts/game/src/systems/combat/contracts/troop_raid.cairo` — immunity check in raid flow
- `contracts/game/src/systems/utils/resource.cairo` — `troop_resources_only` param on `structure_to_troop_raid_instant`,
  `ensure_only_troop_resource()` function

### 5. Deposit Restrictions

`arrivals_offload` is blocked for cloaked villages during spawn immunity.

### 6. Village Militia Claim System

Villages receive only resources at creation (no troops). Troops are claimed later via a militia system with a
configurable delay (`VillageTroopConfig.troop_delay_ticks`).

**Models:** `VillageTroop { village_id, claimed }`, `VillageTroopConfig { troop_delay_ticks }`

---

## TypeScript Configuration

### Constants (`config/environments/utils/troop.ts`)

```ts
export const TROOP_TIER_STRENGTH = { T1: 1, T2: 3, T3: 9 };
export const TROOP_TIER_MODIFIER = { T1: 50, T2: 100, T3: 150 };
export const TROOP_SETTLEMENT_DEPLOYMENT_CAP = 6_000;
export const TROOP_CITY_DEPLOYMENT_CAP = 30_000;
export const TROOP_KINGDOM_DEPLOYMENT_CAP = 90_000;
export const TROOP_EMPIRE_DEPLOYMENT_CAP = 180_000;
```

### Battle Config Renames

- `graceTickCount` → `regularImmunityTicks`
- `graceTickCountHyp` → `villageImmunityTicks`
- Added: `villageRaidImmunityTicks` (default: 24)

### Updated Packages

- `packages/types/src/types/provider.ts` — `SetBattleConfigProps`, `TroopLimitConfigProps`
- `packages/types/src/types/common.ts` — battle and troop limit type definitions
- `packages/types/src/dojo/contract-components.ts` — field definitions and type arrays
- `packages/provider/src/index.ts` — calldata arrays for `set_battle_config` and `set_troop_config`
- `packages/core/src/managers/config-manager.ts` — default values
- `config/deployer/config.ts` — deployer destructuring, calldata, console output
- `config/environments/_shared_.ts` — shared config object
- `config/environments/{local,slot,slottest,mainnet,sepolia}.ts` — environment overrides
