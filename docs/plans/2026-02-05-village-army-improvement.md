# ES2 Village and Army Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement village tutorial system, army strength mechanics, level-based deployment caps, and raid immunity improvements for Season 2.

**Architecture:** Add new config structs for army strength and deployment caps. Modify existing troop validation to use strength-based limits instead of flat count limits. Add per-structure immunity tracking for villages (spawn + post-raid). Extend level-up system to require buildings and grant specific slot counts.

**Tech Stack:** Cairo (Dojo framework), Starknet smart contracts, TypeScript configuration

---

## Overview

This plan implements GitHub Issue #3948 with 5 major components:

1. **Army Strength System** - New `Tier_Strength` values (T1=1, T2=3, T3=9) and `Army_Strength` calculation
2. **Level-Based Deployment Caps** - Replace 100k flat cap with strength-based caps per structure level
3. **Level-Based Army Slots** - Replace military building slots with fixed slots per level
4. **Village Tutorial/Quest System** - 24h tutorial with troop reward + spawn immunity
5. **Post-Raid Immunity** - 24h resource protection after being raided (troops remain vulnerable)

---

## Task 1: Add Army Strength Config and Calculation

**Files:**
- Modify: `contracts/game/src/models/config.cairo:888-892` (near BattleConfig)
- Modify: `contracts/game/src/models/troop.cairo:30-46` (TroopTier enum area)

**Step 1: Add ArmyStrengthConfig struct to config.cairo**

Add after `BattleConfig` (around line 892):

```cairo
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct ArmyStrengthConfig {
    // Tier strength multipliers (without precision)
    pub t1_strength: u32,  // 1
    pub t2_strength: u32,  // 3
    pub t3_strength: u32,  // 9
    // Tier modifiers for max army size calculation (percentage, 100 = 1.0)
    pub t1_modifier: u32,  // 100 (1.0)
    pub t2_modifier: u32,  // 125 (1.25)
    pub t3_modifier: u32,  // 150 (1.5)
}

#[generate_trait]
pub impl ArmyStrengthConfigImpl of ArmyStrengthConfigTrait {
    fn get(ref world: WorldStorage) -> ArmyStrengthConfig {
        WorldConfigUtilImpl::get_member(world, selector!("army_strength_config"))
    }
}
```

**Step 2: Add tier_strength method to TroopTier in troop.cairo**

Add after `TroopTierIntoFelt252` impl (around line 46):

```cairo
#[generate_trait]
pub impl TroopTierStrengthImpl of TroopTierStrengthTrait {
    fn strength(self: TroopTier, config: ArmyStrengthConfig) -> u32 {
        match self {
            TroopTier::T1 => config.t1_strength,
            TroopTier::T2 => config.t2_strength,
            TroopTier::T3 => config.t3_strength,
        }
    }

    fn modifier(self: TroopTier, config: ArmyStrengthConfig) -> u32 {
        match self {
            TroopTier::T1 => config.t1_modifier,
            TroopTier::T2 => config.t2_modifier,
            TroopTier::T3 => config.t3_modifier,
        }
    }
}
```

**Step 3: Add import for ArmyStrengthConfig in troop.cairo**

Update imports at top of troop.cairo:

```cairo
use crate::models::config::{ArmyStrengthConfig, TroopDamageConfig, TroopStaminaConfig};
```

**Step 4: Add army_strength calculation to Troops**

Add to `TroopsImpl` (after line 528):

```cairo
fn army_strength(self: Troops, config: ArmyStrengthConfig) -> u128 {
    // Army_Strength = Troop_Amount * Tier_Strength
    // Note: troop count includes RESOURCE_PRECISION, strength does not
    let tier_strength: u128 = self.tier.strength(config).into();
    (self.count / RESOURCE_PRECISION) * tier_strength
}
```

**Step 5: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add contracts/game/src/models/config.cairo contracts/game/src/models/troop.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add army strength calculation system

Add ArmyStrengthConfig with tier strength values (T1=1, T2=3, T3=9)
and tier modifiers for deployment cap calculations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Deployment Cap Config per Structure Level

**Files:**
- Modify: `contracts/game/src/models/config.cairo:958-971` (StructureMaxLevelConfig area)

**Step 1: Add DeploymentCapConfig struct**

Add after `StructureMaxLevelConfig` (around line 962):

```cairo
/// Deployment cap and army slot configuration per structure level
/// Level names: 1=Settlement, 2=City, 3=Kingdom, 4=Empire
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct DeploymentCapConfig {
    #[key]
    pub level: u8,
    // Maximum army strength that can be deployed (without precision)
    pub deployment_cap: u32,      // Settlement=9k, City=45k, Kingdom=180k, Empire=360k
    // Number of field army (explorer) slots
    pub max_explorer_count: u8,   // Settlement=1, City=3, Kingdom=5, Empire=8
    // Number of guard army slots
    pub max_guard_count: u8,      // Settlement=1, City=2, Kingdom=3, Empire=4
}

#[generate_trait]
pub impl DeploymentCapConfigImpl of DeploymentCapConfigTrait {
    fn get(ref world: WorldStorage, level: u8) -> DeploymentCapConfig {
        world.read_model(level)
    }

    /// Calculate max army size based on deployment cap, tier strength, and tier modifier
    /// Max_Army_Size = (Deployment_Cap / Tier_Strength) * Tier_Modifier
    fn max_army_size(
        self: DeploymentCapConfig,
        tier_strength: u32,
        tier_modifier: u32,
    ) -> u128 {
        // tier_modifier is percentage (100 = 1.0, 125 = 1.25)
        let base_size: u128 = (self.deployment_cap / tier_strength).into();
        (base_size * tier_modifier.into()) / 100
    }
}
```

**Step 2: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/config.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add deployment cap config per structure level

Add DeploymentCapConfig model with deployment_cap, max_explorer_count,
and max_guard_count per structure level (Settlement/City/Kingdom/Empire).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update Structure Creation to Use Level-Based Slots

**Files:**
- Modify: `contracts/game/src/models/structure.cairo:301-341` (StructureImpl::new)

**Step 1: Update StructureImpl::new to read DeploymentCapConfig**

Replace the current slot assignment logic in `StructureImpl::new`:

```cairo
#[generate_trait]
pub impl StructureImpl of StructureTrait {
    fn new(
        ref world: WorldStorage,
        entity_id: ID,
        category: StructureCategory,
        coord: Coord,
        resources_packed: u128,
        metadata: StructureMetadata,
    ) -> Structure {
        assert!(category != StructureCategory::None, "category cannot be none");
        let mut structure: Structure = Default::default();
        structure.entity_id = entity_id;
        structure.category = category.into();
        structure.base.category = category.into();
        structure.base.coord_x = coord.x;
        structure.base.coord_y = coord.y;
        structure.resources_packed = resources_packed;
        structure.metadata = metadata;
        structure.base.level = 1; // All structures start at level 1 (Settlement)

        match category {
            StructureCategory::Realm | StructureCategory::Village => {
                // Use level-based deployment cap config
                let deployment_cap: DeploymentCapConfig = world.read_model(1_u8);
                structure.base.troop_max_explorer_count = deployment_cap.max_explorer_count.into();
                structure.base.troop_max_guard_count = deployment_cap.max_guard_count;
            },
            StructureCategory::Hyperstructure => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 4;
            },
            StructureCategory::Bank => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 4;
            },
            StructureCategory::FragmentMine => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 1;
            },
            _ => { panic!("invalid structure category"); },
        }
        structure.base.created_at = starknet::get_block_timestamp().try_into().unwrap();
        structure
    }
}
```

**Step 2: Add import for DeploymentCapConfig**

Add to imports at top of structure.cairo:

```cairo
use crate::models::config::{
    BattleConfig, DeploymentCapConfig, SeasonConfig, StructureMaxLevelConfig, TickInterval, TickTrait, WorldConfigUtilImpl,
};
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/models/structure.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): use level-based slots for structure creation

Update StructureImpl::new to read DeploymentCapConfig for initial
explorer and guard slot counts based on structure level.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Level-Up to Use DeploymentCapConfig

**Files:**
- Modify: `contracts/game/src/systems/structure/contracts.cairo:37-137`

**Step 1: Update level_up to read DeploymentCapConfig for slot counts**

Replace the slot increment logic (lines 91-93):

```cairo
// update structure level and troop counts from config
structure_base.level = next_level;
let deployment_cap: DeploymentCapConfig = world.read_model(next_level);
structure_base.troop_max_guard_count = deployment_cap.max_guard_count;
structure_base.troop_max_explorer_count = deployment_cap.max_explorer_count.into();
StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);
```

**Step 2: Add DeploymentCapConfig to imports**

Update imports at top of contracts.cairo:

```cairo
use crate::models::config::{DeploymentCapConfig, SeasonConfigImpl, SettlementConfigImpl, StructureLevelConfig, WorldConfigUtilImpl};
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/structure/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): level-up uses DeploymentCapConfig for slot counts

Replace +1 slot increment with reading configured values from
DeploymentCapConfig based on the new structure level.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Strength-Based Army Size Validation

**Files:**
- Modify: `contracts/game/src/systems/combat/contracts/troop_management.cairo:366-373`
- Modify: `contracts/game/src/systems/utils/troop.cairo` (iGuardImpl::add)

**Step 1: Update explorer_add validation to use strength-based cap**

Replace the current validation (lines 368-373):

```cairo
// ensure explorer count does not exceed strength-based max
let army_strength_config: ArmyStrengthConfig = WorldConfigUtilImpl::get_member(world, selector!("army_strength_config"));
let explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, explorer.owner);
let deployment_cap: DeploymentCapConfig = world.read_model(explorer_owner_structure.level);

let tier_strength = explorer.troops.tier.strength(army_strength_config);
let tier_modifier = explorer.troops.tier.modifier(army_strength_config);
let max_army_size = deployment_cap.max_army_size(tier_strength, tier_modifier);

assert!(
    explorer.troops.count <= max_army_size * RESOURCE_PRECISION,
    "army exceeds deployment cap for structure level",
);
```

**Step 2: Add imports for ArmyStrengthConfig and DeploymentCapConfig**

Add to imports in troop_management.cairo:

```cairo
use crate::models::config::{
    ArmyStrengthConfig, CombatConfigImpl, DeploymentCapConfig, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
    WorldConfigUtilImpl,
};
use crate::models::troop::{
    ExplorerTroops, GuardImpl, GuardSlot, GuardTrait, GuardTroops, TroopTier, TroopTierStrengthTrait, TroopType, Troops,
};
```

**Step 3: Update explorer_create to validate strength-based cap**

In `explorer_create` function, add validation after creating explorer:

```cairo
// ensure explorer does not exceed strength-based cap
let army_strength_config: ArmyStrengthConfig = WorldConfigUtilImpl::get_member(world, selector!("army_strength_config"));
let deployment_cap: DeploymentCapConfig = world.read_model(structure.level);
let tier_strength = tier.strength(army_strength_config);
let tier_modifier = tier.modifier(army_strength_config);
let max_army_size = deployment_cap.max_army_size(tier_strength, tier_modifier);
assert!(
    amount <= max_army_size * RESOURCE_PRECISION,
    "army exceeds deployment cap for structure level",
);
```

**Step 4: Update guard_add to validate strength-based cap**

In `guard_add` function, add similar validation.

**Step 5: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add contracts/game/src/systems/combat/contracts/troop_management.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): replace flat army cap with strength-based deployment cap

Army size now limited by structure level deployment cap divided by
tier strength, multiplied by tier modifier. Removes old 100k flat cap.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Village Immunity Tracking Model

**Files:**
- Modify: `contracts/game/src/models/structure.cairo` (add new model)

**Step 1: Add VillageImmunity model**

Add after StructureMetadata struct (around line 128):

```cairo
/// Tracks immunity periods for villages
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct VillageImmunity {
    #[key]
    pub village_id: ID,
    // Tick when spawn immunity ends (24h after creation)
    pub spawn_immunity_end_tick: u64,
    // Tick when post-raid resource immunity ends (24h after being raided)
    pub raid_immunity_end_tick: u64,
}

#[generate_trait]
pub impl VillageImmunityImpl of VillageImmunityTrait {
    fn is_spawn_immune(self: VillageImmunity, current_tick: u64) -> bool {
        current_tick < self.spawn_immunity_end_tick
    }

    fn is_raid_resource_immune(self: VillageImmunity, current_tick: u64) -> bool {
        current_tick < self.raid_immunity_end_tick
    }

    fn set_raid_immunity(ref self: VillageImmunity, current_tick: u64, immunity_ticks: u64) {
        self.raid_immunity_end_tick = current_tick + immunity_ticks;
    }
}
```

**Step 2: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/structure.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add VillageImmunity model for spawn and raid immunity

Track separate immunity periods for village spawn protection (24h)
and post-raid resource protection (24h, troops remain vulnerable).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Village Immunity Config

**Files:**
- Modify: `contracts/game/src/models/config.cairo`

**Step 1: Add VillageImmunityConfig struct**

Add after BattleConfig:

```cairo
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VillageImmunityConfig {
    // Number of ticks for spawn immunity (should equal ~24 hours)
    pub spawn_immunity_ticks: u64,
    // Number of ticks for post-raid resource immunity (should equal ~24 hours)
    pub raid_resource_immunity_ticks: u64,
}

#[generate_trait]
pub impl VillageImmunityConfigImpl of VillageImmunityConfigTrait {
    fn get(ref world: WorldStorage) -> VillageImmunityConfig {
        WorldConfigUtilImpl::get_member(world, selector!("village_immunity_config"))
    }
}
```

**Step 2: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/config.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add VillageImmunityConfig for spawn and raid immunity

Configure spawn_immunity_ticks (24h) and raid_resource_immunity_ticks (24h)
for village protection periods.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Village Creation to Set Spawn Immunity

**Files:**
- Modify: `contracts/game/src/systems/village/contracts.cairo:36-140`

**Step 1: Set VillageImmunity on village creation**

Add after creating village (around line 119):

```cairo
// Set village spawn immunity
let tick = TickImpl::get_tick_interval(ref world);
let current_tick = tick.current();
let village_immunity_config: VillageImmunityConfig = VillageImmunityConfigImpl::get(ref world);
let village_immunity = VillageImmunity {
    village_id: village_id,
    spawn_immunity_end_tick: current_tick + village_immunity_config.spawn_immunity_ticks,
    raid_immunity_end_tick: 0,
};
world.write_model(@village_immunity);
```

**Step 2: Add imports**

Add to imports:

```cairo
use crate::models::config::{SeasonConfigImpl, TickImpl, VillageImmunityConfig, VillageImmunityConfigImpl, VillageTokenConfig, WorldConfigUtilImpl};
use crate::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl, StructureVillageSlots, VillageImmunity,
};
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/village/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): set 24h spawn immunity on village creation

New villages receive spawn_immunity_ticks protection period that
prevents them from being raided until the immunity expires.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update Raid to Check Village Spawn Immunity

**Files:**
- Modify: `contracts/game/src/systems/combat/contracts/troop_raid.cairo:77-365`

**Step 1: Add spawn immunity check for villages**

Add after the existing cloaked check (around line 111):

```cairo
// Check village-specific spawn immunity
if guarded_structure.category == StructureCategory::Village.into() {
    let village_immunity: VillageImmunity = world.read_model(structure_id);
    assert!(
        !village_immunity.is_spawn_immune(tick.current()),
        "village is protected by spawn immunity",
    );
}
```

**Step 2: Add imports**

Add to imports:

```cairo
use crate::models::structure::{
    StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
    StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl, VillageImmunity, VillageImmunityTrait,
};
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/combat/contracts/troop_raid.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): check village spawn immunity before allowing raid

Villages with active spawn immunity cannot be raided. This gives
new villages 24h protection after creation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add Post-Raid Resource Immunity

**Files:**
- Modify: `contracts/game/src/systems/combat/contracts/troop_raid.cairo`

**Step 1: Set raid immunity after successful raid on village**

Add after successful raid resource transfer (around line 346):

```cairo
// Set post-raid resource immunity for villages
if guarded_structure.category == StructureCategory::Village.into() {
    let village_immunity_config: VillageImmunityConfig = VillageImmunityConfigImpl::get(ref world);
    let mut village_immunity: VillageImmunity = world.read_model(structure_id);
    village_immunity.set_raid_immunity(tick.current(), village_immunity_config.raid_resource_immunity_ticks);
    world.write_model(@village_immunity);
}
```

**Step 2: Check raid resource immunity before stealing resources**

Add check before `iResourceTransferImpl::structure_to_troop_raid_instant` (around line 329):

```cairo
// Check if village has post-raid resource immunity (troops can still be attacked)
let mut can_steal_resources = true;
if guarded_structure.category == StructureCategory::Village.into() {
    let village_immunity: VillageImmunity = world.read_model(structure_id);
    if village_immunity.is_raid_resource_immune(tick.current()) {
        can_steal_resources = false;
    }
}

// steal resources (only if not resource-immune)
if raid_success && can_steal_resources {
    // existing resource transfer code...
}
```

**Step 3: Add imports for VillageImmunityConfig**

```cairo
use crate::models::config::{
    BattleConfig, CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig,
    VillageImmunityConfig, VillageImmunityConfigImpl, WorldConfigUtilImpl,
};
```

**Step 4: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add contracts/game/src/systems/combat/contracts/troop_raid.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add post-raid resource immunity for villages

After being raided, villages receive 24h resource protection.
Troop stocks can still be pillaged during this period.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add Village Tutorial Quest Model

**Files:**
- Modify: `contracts/game/src/models/quest.cairo`

**Step 1: Add VillageTutorial model**

Add after existing quest models:

```cairo
/// Tracks village tutorial/quest progress
#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct VillageTutorial {
    #[key]
    pub village_id: ID,
    // Tick when tutorial was started (village creation)
    pub started_at_tick: u64,
    // Tick when tutorial ends (after ~24h)
    pub ends_at_tick: u64,
    // Whether tutorial has been completed and troops claimed
    pub completed: bool,
    // Whether troops have been claimed
    pub troops_claimed: bool,
}

/// Configuration for village tutorial rewards
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct VillageTutorialConfig {
    // Duration of tutorial in ticks (~24h)
    pub duration_ticks: u64,
    // Troop reward amount (without precision)
    pub reward_troop_count: u32,
    // Troop reward type (Knight=0, Paladin=1, Crossbowman=2)
    pub reward_troop_type: u8,
    // Troop reward tier (T1=0, T2=1, T3=2)
    pub reward_troop_tier: u8,
}

#[generate_trait]
pub impl VillageTutorialImpl of VillageTutorialTrait {
    fn is_active(self: VillageTutorial, current_tick: u64) -> bool {
        !self.completed && current_tick < self.ends_at_tick
    }

    fn can_complete(self: VillageTutorial, current_tick: u64) -> bool {
        !self.completed && current_tick >= self.ends_at_tick
    }
}
```

**Step 2: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/quest.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add VillageTutorial model and config

Track village tutorial progress with duration (~24h) and troop
reward configuration for completing the tutorial period.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create Village Tutorial System Contract

**Files:**
- Create: `contracts/game/src/systems/village/tutorial.cairo`

**Step 1: Create tutorial system contract**

```cairo
use crate::alias::ID;

#[starknet::interface]
pub trait IVillageTutorialSystems<T> {
    /// Complete the tutorial and claim starting troops
    fn complete_tutorial(ref self: T, village_id: ID);
    /// Check if a village can complete its tutorial
    fn can_complete_tutorial(self: @T, village_id: ID) -> bool;
}

#[dojo::contract]
pub mod village_tutorial_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, RESOURCE_PRECISION};
    use crate::models::config::{SeasonConfigImpl, TickImpl, WorldConfigUtilImpl};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::quest::{VillageTutorial, VillageTutorialConfig, VillageTutorialTrait};
    use crate::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureTroopGuardStoreImpl,
    };
    use crate::models::troop::{GuardSlot, GuardTroops, TroopTier, TroopType, Troops};
    use crate::systems::utils::troop::iGuardImpl;

    #[abi(embed_v0)]
    impl VillageTutorialSystemsImpl of super::IVillageTutorialSystems<ContractState> {
        fn complete_tutorial(ref self: ContractState, village_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // Ensure caller owns the village
            let village_owner = StructureOwnerStoreImpl::retrieve(ref world, village_id);
            village_owner.assert_caller_owner();

            // Ensure structure is a village
            let village_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, village_id);
            assert!(
                village_base.category == StructureCategory::Village.into(),
                "structure is not a village",
            );

            // Get tutorial state
            let mut tutorial: VillageTutorial = world.read_model(village_id);
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick = tick.current();

            // Ensure tutorial can be completed
            assert!(tutorial.can_complete(current_tick), "tutorial cannot be completed yet");
            assert!(!tutorial.troops_claimed, "troops already claimed");

            // Get tutorial config for rewards
            let tutorial_config: VillageTutorialConfig = WorldConfigUtilImpl::get_member(
                world, selector!("village_tutorial_config"),
            );

            // Grant starting troops to village guard slot
            let troop_type: TroopType = match tutorial_config.reward_troop_type {
                0 => TroopType::Knight,
                1 => TroopType::Paladin,
                _ => TroopType::Crossbowman,
            };
            let troop_tier: TroopTier = match tutorial_config.reward_troop_tier {
                0 => TroopTier::T1,
                1 => TroopTier::T2,
                _ => TroopTier::T3,
            };
            let troop_count: u128 = tutorial_config.reward_troop_count.into() * RESOURCE_PRECISION;

            // Add troops to village guard (Delta slot - first slot)
            let mut village_base_mut = village_base;
            let mut guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, village_id);
            let (mut troops, troops_destroyed_tick) = guards.from_slot(GuardSlot::Delta);

            // Create new troops for the reward
            let troop_stamina_config = crate::models::config::CombatConfigImpl::troop_stamina_config(ref world);
            let troop_limit_config = crate::models::config::CombatConfigImpl::troop_limit_config(ref world);
            iGuardImpl::add(
                ref world,
                village_id,
                ref village_base_mut,
                ref guards,
                ref troops,
                GuardSlot::Delta,
                troop_type,
                troop_tier,
                troops_destroyed_tick,
                troop_count,
                tick,
                troop_limit_config,
                troop_stamina_config,
                false, // Don't require payment for tutorial reward
            );

            StructureTroopGuardStoreImpl::store(ref guards, ref world, village_id);
            StructureBaseStoreImpl::store(ref village_base_mut, ref world, village_id);

            // Mark tutorial as completed
            tutorial.completed = true;
            tutorial.troops_claimed = true;
            world.write_model(@tutorial);
        }

        fn can_complete_tutorial(self: @ContractState, village_id: ID) -> bool {
            let mut world = self.world(DEFAULT_NS());
            let tutorial: VillageTutorial = world.read_model(village_id);
            let tick = TickImpl::get_tick_interval(ref world);
            tutorial.can_complete(tick.current())
        }
    }
}
```

**Step 2: Add module to village/mod.cairo or create it**

If `contracts/game/src/systems/village/mod.cairo` exists, add:
```cairo
pub mod tutorial;
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/village/
git commit -m "$(cat <<'EOF'
feat(contracts): add village tutorial completion system

Add IVillageTutorialSystems with complete_tutorial function that
grants starting troops to villages after 24h tutorial period.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Initialize Tutorial on Village Creation

**Files:**
- Modify: `contracts/game/src/systems/village/contracts.cairo`

**Step 1: Create VillageTutorial when village is created**

Add after setting VillageImmunity (in village creation):

```cairo
// Initialize village tutorial
let tutorial_config: VillageTutorialConfig = WorldConfigUtilImpl::get_member(
    world, selector!("village_tutorial_config"),
);
let village_tutorial = VillageTutorial {
    village_id: village_id,
    started_at_tick: current_tick,
    ends_at_tick: current_tick + tutorial_config.duration_ticks,
    completed: false,
    troops_claimed: false,
};
world.write_model(@village_tutorial);
```

**Step 2: Add import for VillageTutorial**

```cairo
use crate::models::quest::{VillageTutorial, VillageTutorialConfig};
```

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/village/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): initialize village tutorial on creation

Start 24h tutorial period when village is created. Tutorial
completion grants starting troops to the village.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Add Building Requirement for Level-Up

**Files:**
- Modify: `contracts/game/src/models/config.cairo`
- Modify: `contracts/game/src/systems/structure/contracts.cairo`

**Step 1: Add building count requirement to StructureLevelConfig**

Update StructureLevelConfig (line 966):

```cairo
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureLevelConfig {
    #[key]
    pub level: u8,
    pub required_resources_id: ID,
    pub required_resource_count: u8,
    // Minimum number of buildings required to upgrade to this level
    pub required_building_count: u8,
}
```

**Step 2: Add building count check in level_up**

Add after resource payment check in level_up:

```cairo
// Check building requirement
let building_count = BuildingImpl::get_building_count(ref world, structure_id);
assert!(
    building_count >= structure_level_config.required_building_count.into(),
    "need {} buildings to upgrade, have {}",
    structure_level_config.required_building_count,
    building_count,
);
```

**Step 3: Add import for BuildingImpl if needed**

```cairo
use crate::models::resource::production::building::BuildingImpl;
```

**Step 4: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add contracts/game/src/models/config.cairo contracts/game/src/systems/structure/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add building requirement for structure level-up

Players must construct a minimum number of buildings before they
can upgrade their Realm or Village to the next level.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Prevent Troop Transfer to Villages

**Files:**
- Modify: `contracts/game/src/systems/combat/contracts/troop_management.cairo`

**Step 1: Add check in explorer_guard_swap to prevent transfers to villages**

In `explorer_guard_swap` function, add:

```cairo
// Prevent troop transfer to villages from external sources
let to_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, to_structure_id);
if to_structure.category == StructureCategory::Village.into() {
    // Only allow if explorer belongs to the same village
    assert!(
        from_explorer.owner == to_structure_id,
        "cannot transfer troops to village from external source",
    );
}
```

**Step 2: Add similar check in guard_explorer_swap if transferring TO village guards**

**Step 3: Verify changes compile**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/combat/contracts/troop_management.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): prevent external troop transfers to villages

Villages can only receive troops from their own explorers, not
from external sources. This maintains village troop isolation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Final Build Verification

**Step 1: Run full build**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb build`
Expected: Build succeeds with no errors

**Step 2: Run tests if available**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb test`
Expected: All tests pass

**Step 3: Format code**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/contracts/game && scarb fmt`
Expected: Code formatted

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(contracts): format and verify ES2 village/army improvements

All changes for issue #3948 complete:
- Army strength system with tier-based calculations
- Level-based deployment caps (Settlement/City/Kingdom/Empire)
- Level-based army slots (replacing military building slots)
- Village tutorial system with 24h duration and troop reward
- Village spawn immunity (24h after creation)
- Post-raid resource immunity (24h, troops remain vulnerable)
- Building requirement for structure level-ups
- Troop transfer prevention to villages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Configuration Values Reference

When setting up configs, use these values:

**ArmyStrengthConfig:**
- t1_strength: 1
- t2_strength: 3
- t3_strength: 9
- t1_modifier: 100
- t2_modifier: 125
- t3_modifier: 150

**DeploymentCapConfig per level:**
| Level | Name | deployment_cap | max_explorer_count | max_guard_count |
|-------|------|----------------|-------------------|-----------------|
| 1 | Settlement | 9000 | 1 | 1 |
| 2 | City | 45000 | 3 | 2 |
| 3 | Kingdom | 180000 | 5 | 3 |
| 4 | Empire | 360000 | 8 | 4 |

**VillageImmunityConfig:**
- spawn_immunity_ticks: (calculate for 24h based on tick interval)
- raid_resource_immunity_ticks: (calculate for 24h based on tick interval)

**VillageTutorialConfig:**
- duration_ticks: (calculate for 24h based on tick interval)
- reward_troop_count: TBD (e.g., 1000)
- reward_troop_type: 0 (Knight)
- reward_troop_tier: 0 (T1)

---

# Part 2: TypeScript Configuration Changes

The following tasks add the TypeScript configuration and deployer functions to support the new Cairo contracts.

---

## Task 17: Add Config Type Definitions

**Files:**
- Modify: `packages/types/src/types/common.ts`

**Step 1: Add new config types to the Config interface**

Add after the `troop` section in the Config interface (around line 544):

```typescript
  armyStrength: {
    t1Strength: number;
    t2Strength: number;
    t3Strength: number;
    t1Modifier: number;
    t2Modifier: number;
    t3Modifier: number;
  };
  deploymentCaps: {
    [key in RealmLevels]: {
      deploymentCap: number;
      maxExplorerCount: number;
      maxGuardCount: number;
    };
  };
  villageImmunity: {
    spawnImmunityTicks: number;
    raidResourceImmunityTicks: number;
  };
  villageTutorial: {
    durationTicks: number;
    rewardTroopCount: number;
    rewardTroopType: number;
    rewardTroopTier: number;
  };
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/credence/conductor/workspaces/eternum2/copenhagen/packages/types && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/types/src/types/common.ts
git commit -m "$(cat <<'EOF'
feat(types): add army strength, deployment cap, and village config types

Add TypeScript type definitions for new ES2 village and army
improvement configurations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Add Army Strength Constants

**Files:**
- Create: `config/environments/utils/armyStrength.ts`

**Step 1: Create army strength configuration file**

```typescript
// Army strength multipliers by tier
// Used for deployment cap calculations: Max_Army_Size = (Deployment_Cap / Tier_Strength) * Tier_Modifier
export const ARMY_STRENGTH_T1 = 1;
export const ARMY_STRENGTH_T2 = 3;
export const ARMY_STRENGTH_T3 = 9;

// Tier modifiers (percentage, 100 = 1.0x, 125 = 1.25x)
// Higher tier troops get a bonus to max deployable army size
export const ARMY_TIER_MODIFIER_T1 = 100;  // 1.0x
export const ARMY_TIER_MODIFIER_T2 = 125;  // 1.25x
export const ARMY_TIER_MODIFIER_T3 = 150;  // 1.5x
```

**Step 2: Commit**

```bash
git add config/environments/utils/armyStrength.ts
git commit -m "$(cat <<'EOF'
feat(config): add army strength tier constants

Define tier strength values (1/3/9) and tier modifiers (1.0/1.25/1.5)
for deployment cap calculations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Add Deployment Cap Constants

**Files:**
- Modify: `config/environments/utils/levels.ts`

**Step 1: Add deployment cap configuration**

Add to levels.ts:

```typescript
import { RealmLevels } from "@bibliothecadao/types";

// Deployment caps by structure level (army strength units, not troop count)
// Max_Army_Size = (Deployment_Cap / Tier_Strength) * Tier_Modifier
export const DEPLOYMENT_CAPS: { [key in RealmLevels]: {
  deploymentCap: number;
  maxExplorerCount: number;
  maxGuardCount: number;
}} = {
  [RealmLevels.Settlement]: {
    deploymentCap: 9_000,
    maxExplorerCount: 1,
    maxGuardCount: 1,
  },
  [RealmLevels.City]: {
    deploymentCap: 45_000,
    maxExplorerCount: 3,
    maxGuardCount: 2,
  },
  [RealmLevels.Kingdom]: {
    deploymentCap: 180_000,
    maxExplorerCount: 5,
    maxGuardCount: 3,
  },
  [RealmLevels.Empire]: {
    deploymentCap: 360_000,
    maxExplorerCount: 8,
    maxGuardCount: 4,
  },
};

// Building requirements for level-up
export const LEVEL_BUILDING_REQUIREMENTS: { [key in RealmLevels]: number } = {
  [RealmLevels.Settlement]: 0,
  [RealmLevels.City]: 3,     // Need 3 buildings to upgrade to City
  [RealmLevels.Kingdom]: 6,  // Need 6 buildings to upgrade to Kingdom
  [RealmLevels.Empire]: 10,  // Need 10 buildings to upgrade to Empire
};
```

**Step 2: Commit**

```bash
git add config/environments/utils/levels.ts
git commit -m "$(cat <<'EOF'
feat(config): add deployment caps and building requirements per level

Define level-based deployment caps (Settlement=9k to Empire=360k),
army slots per level, and building requirements for level-up.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Add Village Immunity and Tutorial Constants

**Files:**
- Create: `config/environments/utils/village.ts`

**Step 1: Create village configuration file**

```typescript
const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;
const ONE_DAY_IN_SECONDS = 24 * ONE_HOUR_IN_SECONDS;

// Village spawn immunity - protection period after village creation
export const VILLAGE_SPAWN_IMMUNITY_SECONDS = ONE_DAY_IN_SECONDS; // 24 hours

// Post-raid resource immunity - resources protected, troops remain vulnerable
export const VILLAGE_RAID_RESOURCE_IMMUNITY_SECONDS = ONE_DAY_IN_SECONDS; // 24 hours

// Village tutorial configuration
export const VILLAGE_TUTORIAL_DURATION_SECONDS = ONE_DAY_IN_SECONDS; // 24 hours
export const VILLAGE_TUTORIAL_REWARD_TROOP_COUNT = 1_000; // 1000 troops (without precision)
export const VILLAGE_TUTORIAL_REWARD_TROOP_TYPE = 0; // Knight
export const VILLAGE_TUTORIAL_REWARD_TROOP_TIER = 0; // T1

// Helper to convert seconds to ticks
export const secondsToTicks = (seconds: number, tickIntervalSeconds: number): number => {
  return Math.ceil(seconds / tickIntervalSeconds);
};
```

**Step 2: Commit**

```bash
git add config/environments/utils/village.ts
git commit -m "$(cat <<'EOF'
feat(config): add village immunity and tutorial constants

Define 24h spawn immunity, 24h post-raid resource immunity, and
tutorial configuration with troop rewards.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Update _shared_.ts Configuration

**Files:**
- Modify: `config/environments/_shared_.ts`

**Step 1: Import new configuration modules**

Add to imports:

```typescript
import {
  ARMY_STRENGTH_T1,
  ARMY_STRENGTH_T2,
  ARMY_STRENGTH_T3,
  ARMY_TIER_MODIFIER_T1,
  ARMY_TIER_MODIFIER_T2,
  ARMY_TIER_MODIFIER_T3,
} from "./utils/armyStrength";
import { DEPLOYMENT_CAPS, LEVEL_BUILDING_REQUIREMENTS } from "./utils/levels";
import {
  VILLAGE_SPAWN_IMMUNITY_SECONDS,
  VILLAGE_RAID_RESOURCE_IMMUNITY_SECONDS,
  VILLAGE_TUTORIAL_DURATION_SECONDS,
  VILLAGE_TUTORIAL_REWARD_TROOP_COUNT,
  VILLAGE_TUTORIAL_REWARD_TROOP_TYPE,
  VILLAGE_TUTORIAL_REWARD_TROOP_TIER,
  secondsToTicks,
} from "./utils/village";
```

**Step 2: Add new configuration sections to EternumGlobalConfig**

Add after `troop` section:

```typescript
  armyStrength: {
    t1Strength: ARMY_STRENGTH_T1,
    t2Strength: ARMY_STRENGTH_T2,
    t3Strength: ARMY_STRENGTH_T3,
    t1Modifier: ARMY_TIER_MODIFIER_T1,
    t2Modifier: ARMY_TIER_MODIFIER_T2,
    t3Modifier: ARMY_TIER_MODIFIER_T3,
  },
  deploymentCaps: DEPLOYMENT_CAPS,
  levelBuildingRequirements: LEVEL_BUILDING_REQUIREMENTS,
  villageImmunity: {
    spawnImmunityTicks: secondsToTicks(VILLAGE_SPAWN_IMMUNITY_SECONDS, ARMIES_TICK_INTERVAL_SECONDS),
    raidResourceImmunityTicks: secondsToTicks(VILLAGE_RAID_RESOURCE_IMMUNITY_SECONDS, ARMIES_TICK_INTERVAL_SECONDS),
  },
  villageTutorial: {
    durationTicks: secondsToTicks(VILLAGE_TUTORIAL_DURATION_SECONDS, ARMIES_TICK_INTERVAL_SECONDS),
    rewardTroopCount: VILLAGE_TUTORIAL_REWARD_TROOP_COUNT,
    rewardTroopType: VILLAGE_TUTORIAL_REWARD_TROOP_TYPE,
    rewardTroopTier: VILLAGE_TUTORIAL_REWARD_TROOP_TIER,
  },
```

**Step 3: Commit**

```bash
git add config/environments/_shared_.ts
git commit -m "$(cat <<'EOF'
feat(config): integrate new ES2 configs into _shared_.ts

Add army strength, deployment caps, village immunity, and tutorial
configurations to the global EternumGlobalConfig.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Add Deployer Functions

**Files:**
- Modify: `config/deployer/config.ts`

**Step 1: Add setArmyStrengthConfig function**

```typescript
export const setArmyStrengthConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  💪 Army Strength Configuration
  ═══════════════════════════════`),
  );

  const calldata = {
    signer: config.account,
    t1_strength: config.config.armyStrength.t1Strength,
    t2_strength: config.config.armyStrength.t2Strength,
    t3_strength: config.config.armyStrength.t3Strength,
    t1_modifier: config.config.armyStrength.t1Modifier,
    t2_modifier: config.config.armyStrength.t2Modifier,
    t3_modifier: config.config.armyStrength.t3Modifier,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Tier Strength Values")}
    │  ${chalk.gray("T1 Strength:")}     ${chalk.white(calldata.t1_strength)}
    │  ${chalk.gray("T2 Strength:")}     ${chalk.white(calldata.t2_strength)}
    │  ${chalk.gray("T3 Strength:")}     ${chalk.white(calldata.t3_strength)}
    │
    │  ${chalk.yellow("Tier Modifiers (percentage)")}
    │  ${chalk.gray("T1 Modifier:")}     ${chalk.white(calldata.t1_modifier + "%")}
    │  ${chalk.gray("T2 Modifier:")}     ${chalk.white(calldata.t2_modifier + "%")}
    │  ${chalk.gray("T3 Modifier:")}     ${chalk.white(calldata.t3_modifier + "%")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_army_strength_config(calldata);
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};
```

**Step 2: Add setDeploymentCapConfig function**

```typescript
export const setDeploymentCapConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🎯 Deployment Cap Configuration
  ═══════════════════════════════`),
  );

  const calldataArray = [];
  for (const [level, caps] of Object.entries(config.config.deploymentCaps)) {
    const calldata = {
      level: Number(level),
      deployment_cap: caps.deploymentCap,
      max_explorer_count: caps.maxExplorerCount,
      max_guard_count: caps.maxGuardCount,
    };

    console.log(
      chalk.cyan(`
    ┌─ ${chalk.yellow(`Level ${calldata.level}`)}
    │  ${chalk.gray("Deployment Cap:")}      ${chalk.white(calldata.deployment_cap.toLocaleString())}
    │  ${chalk.gray("Max Explorers:")}       ${chalk.white(calldata.max_explorer_count)}
    │  ${chalk.gray("Max Guards:")}          ${chalk.white(calldata.max_guard_count)}
    └────────────────────────────────`),
    );

    calldataArray.push(calldata);
  }

  const tx = await config.provider.set_deployment_cap_config({
    signer: config.account,
    calls: calldataArray,
  });
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};
```

**Step 3: Add setVillageImmunityConfig function**

```typescript
export const setVillageImmunityConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  🛡️  Village Immunity Configuration
  ═══════════════════════════════`),
  );

  const calldata = {
    signer: config.account,
    spawn_immunity_ticks: config.config.villageImmunity.spawnImmunityTicks,
    raid_resource_immunity_ticks: config.config.villageImmunity.raidResourceImmunityTicks,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Immunity Periods")}
    │  ${chalk.gray("Spawn Immunity:")}         ${chalk.white(calldata.spawn_immunity_ticks + " ticks")}
    │  ${chalk.gray("Raid Resource Immunity:")} ${chalk.white(calldata.raid_resource_immunity_ticks + " ticks")}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_village_immunity_config(calldata);
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};
```

**Step 4: Add setVillageTutorialConfig function**

```typescript
export const setVillageTutorialConfig = async (config: Config) => {
  console.log(
    chalk.cyan(`
  📚 Village Tutorial Configuration
  ═══════════════════════════════`),
  );

  const calldata = {
    signer: config.account,
    duration_ticks: config.config.villageTutorial.durationTicks,
    reward_troop_count: config.config.villageTutorial.rewardTroopCount,
    reward_troop_type: config.config.villageTutorial.rewardTroopType,
    reward_troop_tier: config.config.villageTutorial.rewardTroopTier,
  };

  console.log(
    chalk.cyan(`
    ┌─ ${chalk.yellow("Tutorial Settings")}
    │  ${chalk.gray("Duration:")}         ${chalk.white(calldata.duration_ticks + " ticks")}
    │  ${chalk.gray("Reward Troops:")}    ${chalk.white(calldata.reward_troop_count.toLocaleString())}
    │  ${chalk.gray("Troop Type:")}       ${chalk.white(calldata.reward_troop_type === 0 ? "Knight" : calldata.reward_troop_type === 1 ? "Paladin" : "Crossbowman")}
    │  ${chalk.gray("Troop Tier:")}       ${chalk.white("T" + (calldata.reward_troop_tier + 1))}
    └────────────────────────────────`),
  );

  const tx = await config.provider.set_village_tutorial_config(calldata);
  console.log(chalk.green(`\n    ✔ Configuration complete `) + chalk.gray(tx.statusReceipt) + "\n");
};
```

**Step 5: Update setupNonBank to call new config functions**

Add to setupNonBank function after existing calls:

```typescript
await setArmyStrengthConfig(config);
await this.sleepNonLocal();

await setDeploymentCapConfig(config);
await this.sleepNonLocal();

await setVillageImmunityConfig(config);
await this.sleepNonLocal();

await setVillageTutorialConfig(config);
await this.sleepNonLocal();
```

**Step 6: Commit**

```bash
git add config/deployer/config.ts
git commit -m "$(cat <<'EOF'
feat(deployer): add config deployer functions for ES2 improvements

Add setArmyStrengthConfig, setDeploymentCapConfig, setVillageImmunityConfig,
and setVillageTutorialConfig deployer functions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: Add Provider Methods (if needed)

**Files:**
- Check: `packages/provider/src/provider.ts` (may need to add new provider methods)

**Step 1: Verify provider has methods for new configs**

Check if provider needs new methods like:
- `set_army_strength_config`
- `set_deployment_cap_config`
- `set_village_immunity_config`
- `set_village_tutorial_config`

If not present, add them following the existing pattern.

**Step 2: Commit if changes needed**

```bash
git add packages/provider/
git commit -m "$(cat <<'EOF'
feat(provider): add provider methods for ES2 config deployment

Add set_army_strength_config, set_deployment_cap_config,
set_village_immunity_config, and set_village_tutorial_config methods.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Final TypeScript Build Verification

**Step 1: Build all packages**

Run:
```bash
cd /Users/credence/conductor/workspaces/eternum2/copenhagen
pnpm install
pnpm build
```
Expected: Build succeeds

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: finalize ES2 village/army TypeScript configuration

Complete TypeScript configuration changes for issue #3948:
- Config type definitions in packages/types
- Army strength constants
- Deployment cap constants per level
- Village immunity and tutorial constants
- Deployer functions for on-chain configuration
- Provider method stubs (if needed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```
