# Bitcoin Mine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Bitcoin Mines - discoverable structures in the Ethereal layer that allow players to exhibit 'proof of work' to extract sponsored wBTC via a phase-based lottery system.

**Architecture:**

- New `BitcoinMine` structure category and `TileOccupier::BitcoinMine` variant
- New `Work` and `Satoshi` resource types (Work is weightless, non-transferrable; Satoshis can only be carried by armies)
- New `bitcoin_mine` system module with production, phase calculation, and lottery mechanics
- Phase-based reward distribution (every 10 minutes) using VRF-weighted random selection
- Integration with exploration system for Ethereal-layer-only discovery (1/50 chance)
- T3 bandit defenders matching Ethereal Agents pattern

**Tech Stack:** Cairo 2.13.1, Dojo 1.8.0, snforge for testing

---

## Task 1: Add New Resource Types (Work and Satoshi)

**Files:**

- Modify: `contracts/game/src/constants.cairo`

**Step 1: Add WORK and SATOSHI resource type constants**

Add after `RELIC_E18` in the `ResourceTypes` module:

```cairo
    // Bitcoin Mine Resources
    pub const WORK: u8 = 57;
    pub const SATOSHI: u8 = 58;
```

**Step 2: Update all_resource_ids function**

Add `57, 58` to the array in `all_resource_ids()`.

**Step 3: Update resource_type_name function**

Add cases for WORK and SATOSHI:

```cairo
    } else if resource_type == 57 {
        "WORK"
    } else if resource_type == 58 {
        "SATOSHI"
```

**Step 4: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add contracts/game/src/constants.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add WORK and SATOSHI resource types for Bitcoin Mine

WORK (57) is weightless, non-transferrable, used for proof of work.
SATOSHI (58) is the reward resource that can only be carried by armies.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add BitcoinMine to StructureCategory

**Files:**

- Modify: `contracts/game/src/models/structure.cairo`

**Step 1: Add BitcoinMine variant to StructureCategory enum**

Add after `Camp`:

```cairo
    BitcoinMine,
```

**Step 2: Update StructureCategoryIntoFelt252**

Add case in the `into` match:

```cairo
            StructureCategory::BitcoinMine => 8,
```

**Step 3: Update StructureCategoryIntoU8**

Add case in the `into` match:

```cairo
            StructureCategory::BitcoinMine => 8,
```

**Step 4: Update StructureImpl::new troop slots**

Add case in the match for `category`:

```cairo
            StructureCategory::BitcoinMine => {
                structure.base.troop_max_explorer_count = 0;
                structure.base.troop_max_guard_count = 1; // 1 guard slot for T3 defender
            },
```

**Step 5: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add contracts/game/src/models/structure.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add BitcoinMine to StructureCategory enum

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add BitcoinMine to TileOccupier

**Files:**

- Modify: `contracts/game/src/models/map.cairo`

**Step 1: Add BitcoinMine variant to TileOccupier enum**

Add after `Camp`:

```cairo
    BitcoinMine,
```

**Step 2: Update TileOccupierIntoU8**

Add case in the `into` match:

```cairo
            TileOccupier::BitcoinMine => 38,
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/models/map.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add BitcoinMine to TileOccupier enum

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add BitcoinMine to ExploreFind enum

**Files:**

- Modify: `contracts/game/src/models/events.cairo`

**Step 1: Add BitcoinMine variant to ExploreFind enum**

Add after `Camp`:

```cairo
    BitcoinMine,
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/events.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add BitcoinMine to ExploreFind enum

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add BitcoinMine Config to MapConfig

**Files:**

- Modify: `contracts/game/src/models/config.cairo`

**Step 1: Add bitcoin mine probability fields to MapConfig**

Add after `holysite_fail_probability`:

```cairo
    pub bitcoin_mine_win_probability: u16,   // 1/50 = 2% = 200 (out of 10000)
    pub bitcoin_mine_fail_probability: u16,  // 9800
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/config.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine discovery probabilities to MapConfig

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add BitcoinMineConfig to WorldConfig

**Files:**

- Modify: `contracts/game/src/models/config.cairo`

**Step 1: Add BitcoinMineConfig struct**

Add after `FaithConfig`:

```cairo
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BitcoinMineConfig {
    pub enabled: bool,
    pub phase_duration_seconds: u64,        // 600 = 10 minutes
    pub satoshis_per_phase: u128,           // Amount of satoshis emitted each phase
    pub satoshi_weight_grams: u128,         // Weight per satoshi unit
    // Production rates: labor consumed per second at each level
    pub very_low_labor_per_sec: u16,        // 1
    pub low_labor_per_sec: u16,             // 2
    pub medium_labor_per_sec: u16,          // 3
    pub high_labor_per_sec: u16,            // 4
    pub very_high_labor_per_sec: u16,       // 5
}
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/config.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add BitcoinMineConfig for phase-based satoshi distribution

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add StructureCapacityConfig for BitcoinMine

**Files:**

- Modify: `contracts/game/src/models/config.cairo`

**Step 1: Add bitcoin_mine_capacity to StructureCapacityConfig**

Add after `camp_capacity`:

```cairo
    pub bitcoin_mine_capacity: u64 // grams
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/models/config.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin_mine_capacity to StructureCapacityConfig

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Create Bitcoin Mine Models

**Files:**

- Create: `contracts/game/src/models/bitcoin_mine.cairo`
- Modify: `contracts/game/src/models.cairo`

**Step 1: Create the bitcoin mine models file**

Create `contracts/game/src/models/bitcoin_mine.cairo`:

```cairo
use starknet::ContractAddress;
use crate::alias::ID;

/// Tracks total work produced across all bitcoin mines in the current phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinPhaseWork {
    #[key]
    pub phase_id: u64,
    pub total_work: u128,
    pub lottery_executed: bool,
}

/// Tracks a single bitcoin mine's state
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMineState {
    #[key]
    pub mine_id: ID,
    pub production_level: u8,           // 0=stopped, 1-5=very_low to very_high
    pub work_accumulated: u128,         // Total work produced by this mine
    pub work_last_claimed_phase: u64,   // Last phase when work was claimed
    pub satoshis_won: u128,             // Total satoshis won by this mine
}

/// Tracks a mine's work contribution for a specific phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMinePhaseWork {
    #[key]
    pub phase_id: u64,
    #[key]
    pub mine_id: ID,
    pub work_contributed: u128,
}

/// Global bitcoin mine registry for phase processing
#[derive(Drop, Serde)]
#[dojo::model]
pub struct BitcoinMineRegistry {
    #[key]
    pub world_id: ID,
    pub active_mine_ids: Array<ID>,
    pub current_phase: u64,
    pub phase_start_timestamp: u64,
}

/// Production level enum for clearer code
#[derive(Copy, Drop, Serde, PartialEq)]
pub enum ProductionLevel {
    Stopped,    // 0
    VeryLow,    // 1 - 1 labor/sec = 1 work/sec
    Low,        // 2 - 2 labor/sec = 2 work/sec
    Medium,     // 3 - 3 labor/sec = 3 work/sec
    High,       // 4 - 4 labor/sec = 4 work/sec
    VeryHigh,   // 5 - 5 labor/sec = 5 work/sec
}

pub impl ProductionLevelIntoU8 of Into<ProductionLevel, u8> {
    fn into(self: ProductionLevel) -> u8 {
        match self {
            ProductionLevel::Stopped => 0,
            ProductionLevel::VeryLow => 1,
            ProductionLevel::Low => 2,
            ProductionLevel::Medium => 3,
            ProductionLevel::High => 4,
            ProductionLevel::VeryHigh => 5,
        }
    }
}

pub impl U8IntoProductionLevel of Into<u8, ProductionLevel> {
    fn into(self: u8) -> ProductionLevel {
        if self == 0 {
            ProductionLevel::Stopped
        } else if self == 1 {
            ProductionLevel::VeryLow
        } else if self == 2 {
            ProductionLevel::Low
        } else if self == 3 {
            ProductionLevel::Medium
        } else if self == 4 {
            ProductionLevel::High
        } else {
            ProductionLevel::VeryHigh
        }
    }
}
```

**Step 2: Register bitcoin_mine module in models.cairo**

Add to `contracts/game/src/models.cairo` after existing modules:

```cairo
pub mod bitcoin_mine;
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/models/bitcoin_mine.cairo contracts/game/src/models.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine models

Add BitcoinPhaseWork, BitcoinMineState, BitcoinMinePhaseWork,
BitcoinMineRegistry, and ProductionLevel for the bitcoin mine system.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Bitcoin Mine Events

**Files:**

- Modify: `contracts/game/src/models/events.cairo`

**Step 1: Add Bitcoin Mine event structs**

Add before the closing of the file:

```cairo
///////////////////////////////////////////////
///  Bitcoin Mine System
///
///////////////////////////////////////////////

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BitcoinMineProductionStory {
    pub mine_id: ID,
    pub owner: ContractAddress,
    pub production_level: u8,
    pub labor_consumed: u128,
    pub work_produced: u128,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BitcoinPhaseLotteryStory {
    pub phase_id: u64,
    pub total_work: u128,
    pub winner_mine_id: ID,
    pub winner_owner: ContractAddress,
    pub satoshis_awarded: u128,
    pub roll_value: u128,
}
```

**Step 2: Add variants to Story enum**

Add after `FaithPointsClaimedStory`:

```cairo
    // Bitcoin Mine System
    BitcoinMineProductionStory: BitcoinMineProductionStory,
    BitcoinPhaseLotteryStory: BitcoinPhaseLotteryStory,
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/models/events.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine events

Add BitcoinMineProductionStory and BitcoinPhaseLotteryStory events.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Create Bitcoin Mine Discovery System

**Files:**

- Create: `contracts/game/src/systems/utils/bitcoin_mine.cairo`
- Modify: `contracts/game/src/systems/utils.cairo`

**Step 1: Create the bitcoin mine discovery utility**

Create `contracts/game/src/systems/utils/bitcoin_mine.cairo`:

```cairo
use core::num::traits::zero::Zero;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use crate::alias::ID;
use crate::constants::WORLD_CONFIG_ID;
use crate::models::bitcoin_mine::{BitcoinMineRegistry, BitcoinMineState};
use crate::models::config::{
    BitcoinMineConfig, MapConfig, TickImpl, TickInterval, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
};
use crate::models::map::TileOccupier;
use crate::models::position::Coord;
use crate::models::structure::StructureCategory;
use crate::models::troop::{GuardSlot, TroopTier, TroopType};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
use crate::system_libraries::structure_libraries::structure_creation_library::{
    IStructureCreationlibraryDispatcherTrait, structure_creation_library,
};
use crate::systems::utils::troop::iMercenariesImpl;

#[generate_trait]
pub impl iBitcoinMineDiscoveryImpl of iBitcoinMineDiscoveryTrait {
    fn lottery(map_config: MapConfig, vrf_seed: u256, world: WorldStorage) -> bool {
        // Use unique VRF offset to avoid correlation with other lotteries
        let VRF_OFFSET: u256 = 10;
        let mine_vrf_seed = if vrf_seed > VRF_OFFSET {
            vrf_seed - VRF_OFFSET
        } else {
            vrf_seed + VRF_OFFSET
        };

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let success: bool = rng_library_dispatcher
            .get_weighted_choice_bool_simple(
                map_config.bitcoin_mine_win_probability.into(),
                map_config.bitcoin_mine_fail_probability.into(),
                mine_vrf_seed,
            );

        return success;
    }

    fn create(
        ref world: WorldStorage,
        coord: Coord,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        // Bitcoin mines can only be discovered in the Ethereal (alt) layer
        assert!(coord.alt, "Bitcoin mines can only be in Ethereal layer");

        // Create bitcoin mine structure
        let structure_id = world.dispatcher.uuid();
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .make_structure(
                world,
                coord,
                Zero::zero(), // owner_id: No direct player ownership (bandits)
                structure_id,
                StructureCategory::BitcoinMine,
                array![].span(), // No initial troops
                Default::default(),
                TileOccupier::BitcoinMine,
                false,
            );

        // Add T3 guards to structure (same tier as Ethereal Agents)
        let slot_tiers = array![(GuardSlot::Delta, TroopTier::T3, TroopType::Paladin)].span();
        let tick_config: TickInterval = TickImpl::get_tick_interval(ref world);
        iMercenariesImpl::add(
            ref world, structure_id, vrf_seed, slot_tiers, troop_limit_config, troop_stamina_config, tick_config,
        );

        // Initialize mine state
        let bitcoin_mine_config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(
            world, selector!("bitcoin_mine_config"),
        );
        let current_phase = Self::_get_current_phase(ref world, bitcoin_mine_config);

        let mine_state = BitcoinMineState {
            mine_id: structure_id,
            production_level: 0, // Stopped until player activates
            work_accumulated: 0,
            work_last_claimed_phase: current_phase,
            satoshis_won: 0,
        };
        world.write_model(@mine_state);

        // Add to registry
        let mut registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
        registry.active_mine_ids.append(structure_id);
        world.write_model(@registry);

        return true;
    }

    fn _get_current_phase(ref world: WorldStorage, config: BitcoinMineConfig) -> u64 {
        let now = starknet::get_block_timestamp();
        now / config.phase_duration_seconds
    }
}
```

**Step 2: Register bitcoin_mine in systems/utils.cairo**

Add to `contracts/game/src/systems/utils.cairo`:

```cairo
pub mod bitcoin_mine;
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/utils/bitcoin_mine.cairo contracts/game/src/systems/utils.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine discovery utility

Implements lottery (1/50 chance) and creation with T3 Paladin defenders.
Only discoverable in Ethereal layer.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create Bitcoin Mine Systems Contract

**Files:**

- Create: `contracts/game/src/systems/bitcoin_mine/contracts.cairo`

**Step 1: Create the bitcoin mine systems contract**

Create `contracts/game/src/systems/bitcoin_mine/contracts.cairo`:

```cairo
use starknet::ContractAddress;
use crate::alias::ID;
use crate::models::bitcoin_mine::ProductionLevel;

#[starknet::interface]
pub trait IBitcoinMineSystems<T> {
    /// Set production level for a bitcoin mine (must own the mine)
    fn set_production_level(ref self: T, mine_id: ID, level: ProductionLevel);

    /// Claim work and update mine state for pending phases
    fn claim_work(ref self: T, mine_id: ID);

    /// Execute lottery for a completed phase (permissionless)
    fn execute_phase_lottery(ref self: T, phase_id: u64);

    /// Withdraw satoshis from mine to an army (only armies can carry satoshis)
    fn withdraw_satoshis(ref self: T, mine_id: ID, army_id: ID, amount: u128);

    /// View: Get mine's pending work
    fn get_pending_work(self: @T, mine_id: ID) -> u128;

    /// View: Get current phase ID
    fn get_current_phase(self: @T) -> u64;

    /// View: Get mine's contribution percentage for a phase
    fn get_mine_contribution(self: @T, mine_id: ID, phase_id: u64) -> u128;
}

#[dojo::contract]
pub mod bitcoin_mine_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::bitcoin_mine::{
        BitcoinMinePhaseWork, BitcoinMineRegistry, BitcoinMineState, BitcoinPhaseWork, ProductionLevel,
    };
    use crate::models::config::{BitcoinMineConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::events::{BitcoinMineProductionStory, BitcoinPhaseLotteryStory, Story, StoryEvent};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureCategory, StructureBaseStoreImpl, StructureOwnerStoreImpl};
    use crate::models::troop::ExplorerTroops;
    use crate::models::weight::Weight;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

    #[abi(embed_v0)]
    impl BitcoinMineSystemsImpl of super::IBitcoinMineSystems<ContractState> {
        fn set_production_level(ref self: ContractState, mine_id: ID, level: ProductionLevel) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let caller = starknet::get_caller_address();

            // Verify mine ownership
            let mine_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
            assert!(mine_owner == caller, "Only mine owner can set production level");

            // Verify it's a bitcoin mine
            let structure_base = StructureBaseStoreImpl::retrieve(ref world, mine_id);
            assert!(
                structure_base.category == StructureCategory::BitcoinMine.into(),
                "Structure is not a bitcoin mine"
            );

            // Claim pending work first
            Self::_claim_work_internal(ref world, mine_id);

            // Update production level
            let mut mine_state: BitcoinMineState = world.read_model(mine_id);
            mine_state.production_level = level.into();
            world.write_model(@mine_state);
        }

        fn claim_work(ref self: ContractState, mine_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            Self::_claim_work_internal(ref world, mine_id);
        }

        fn execute_phase_lottery(ref self: ContractState, phase_id: u64) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            assert!(config.enabled, "Bitcoin mine system is not enabled");

            let current_phase = Self::_get_current_phase(ref world, config);
            assert!(phase_id < current_phase, "Phase has not ended yet");

            // Check if lottery already executed
            let mut phase_work: BitcoinPhaseWork = world.read_model(phase_id);
            assert!(!phase_work.lottery_executed, "Lottery already executed for this phase");

            // No work = no lottery
            if phase_work.total_work == 0 {
                phase_work.lottery_executed = true;
                world.write_model(@phase_work);
                return;
            }

            // Get VRF for lottery
            let caller = starknet::get_caller_address();
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(caller, world);

            // Roll 0-10000 (basis points)
            let roll: u128 = rng_library_dispatcher.get_random_in_range(vrf_seed, 0, 10001);

            // Find winner based on cumulative contribution percentages
            let registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
            let mut cumulative_percentage: u128 = 0;
            let mut winner_mine_id: ID = 0;

            for mine_id in registry.active_mine_ids.span() {
                let mine_phase_work: BitcoinMinePhaseWork = world.read_model((phase_id, *mine_id));
                if mine_phase_work.work_contributed > 0 {
                    // Calculate this mine's percentage (basis points)
                    let contribution_percentage = (mine_phase_work.work_contributed * 10000)
                        / phase_work.total_work;
                    cumulative_percentage += contribution_percentage;

                    if roll <= cumulative_percentage {
                        winner_mine_id = *mine_id;
                        break;
                    }
                }
            }

            // Award satoshis to winner
            if winner_mine_id.is_non_zero() {
                let mut mine_state: BitcoinMineState = world.read_model(winner_mine_id);
                mine_state.satoshis_won += config.satoshis_per_phase;
                world.write_model(@mine_state);

                // Add satoshis to mine's inventory
                let satoshi_weight = config.satoshi_weight_grams;
                let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, winner_mine_id);
                let mut satoshi_resource = SingleResourceStoreImpl::retrieve(
                    ref world, winner_mine_id, ResourceTypes::SATOSHI, ref mine_weight, satoshi_weight, true,
                );
                satoshi_resource.add(config.satoshis_per_phase, ref mine_weight, satoshi_weight);
                satoshi_resource.store(ref world);
                mine_weight.store(ref world, winner_mine_id);

                // Emit event
                let winner_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, winner_mine_id);
                world
                    .emit_event(
                        @StoryEvent {
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(winner_owner),
                            entity_id: Option::Some(winner_mine_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::BitcoinPhaseLotteryStory(
                                BitcoinPhaseLotteryStory {
                                    phase_id,
                                    total_work: phase_work.total_work,
                                    winner_mine_id,
                                    winner_owner,
                                    satoshis_awarded: config.satoshis_per_phase,
                                    roll_value: roll,
                                },
                            ),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }

            // Mark lottery as executed
            phase_work.lottery_executed = true;
            world.write_model(@phase_work);
        }

        fn withdraw_satoshis(ref self: ContractState, mine_id: ID, army_id: ID, amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let caller = starknet::get_caller_address();

            // Verify mine ownership
            let mine_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
            assert!(mine_owner == caller, "Only mine owner can withdraw satoshis");

            // Verify army ownership and that it's an explorer (army)
            let army: ExplorerTroops = world.read_model(army_id);
            army.assert_caller_structure_or_agent_owner(ref world);

            // Transfer satoshis from mine to army
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            let satoshi_weight = config.satoshi_weight_grams;

            // Deduct from mine
            let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, mine_id);
            let mut mine_satoshi = SingleResourceStoreImpl::retrieve(
                ref world, mine_id, ResourceTypes::SATOSHI, ref mine_weight, satoshi_weight, true,
            );
            mine_satoshi.spend(amount, ref mine_weight, satoshi_weight);
            mine_satoshi.store(ref world);
            mine_weight.store(ref world, mine_id);

            // Add to army
            let mut army_weight: Weight = WeightStoreImpl::retrieve(ref world, army_id);
            let mut army_satoshi = SingleResourceStoreImpl::retrieve(
                ref world, army_id, ResourceTypes::SATOSHI, ref army_weight, satoshi_weight, true,
            );
            army_satoshi.add(amount, ref army_weight, satoshi_weight);
            army_satoshi.store(ref world);
            army_weight.store(ref world, army_id);
        }

        fn get_pending_work(self: @ContractState, mine_id: ID) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));

            let mine_state: BitcoinMineState = world.read_model(mine_id);
            if mine_state.production_level == 0 {
                return 0;
            }

            let current_phase = Self::_get_current_phase_view(@world, config);
            let phases_elapsed = current_phase - mine_state.work_last_claimed_phase;

            let work_per_phase = Self::_get_work_per_phase(mine_state.production_level, config);
            phases_elapsed.into() * work_per_phase
        }

        fn get_current_phase(self: @ContractState) -> u64 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            Self::_get_current_phase_view(@world, config)
        }

        fn get_mine_contribution(self: @ContractState, mine_id: ID, phase_id: u64) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());

            let phase_work: BitcoinPhaseWork = world.read_model(phase_id);
            if phase_work.total_work == 0 {
                return 0;
            }

            let mine_phase_work: BitcoinMinePhaseWork = world.read_model((phase_id, mine_id));
            (mine_phase_work.work_contributed * 10000) / phase_work.total_work
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _claim_work_internal(ref world: WorldStorage, mine_id: ID) {
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            let current_phase = Self::_get_current_phase(ref world, config);

            let mut mine_state: BitcoinMineState = world.read_model(mine_id);

            // Calculate work for elapsed phases
            if mine_state.production_level > 0 && current_phase > mine_state.work_last_claimed_phase {
                let work_per_phase = Self::_get_work_per_phase(mine_state.production_level, config);

                // Process each elapsed phase
                let mut phase_id = mine_state.work_last_claimed_phase + 1;
                while phase_id <= current_phase {
                    // Add work to phase total
                    let mut phase_work: BitcoinPhaseWork = world.read_model(phase_id);
                    phase_work.phase_id = phase_id;
                    phase_work.total_work += work_per_phase;
                    world.write_model(@phase_work);

                    // Track mine's contribution to this phase
                    let mut mine_phase_work: BitcoinMinePhaseWork = world.read_model((phase_id, mine_id));
                    mine_phase_work.phase_id = phase_id;
                    mine_phase_work.mine_id = mine_id;
                    mine_phase_work.work_contributed += work_per_phase;
                    world.write_model(@mine_phase_work);

                    // Burn labor from mine
                    let labor_cost = Self::_get_labor_cost_per_phase(mine_state.production_level, config);
                    let labor_weight = ResourceWeightImpl::grams(ref world, ResourceTypes::LABOR);
                    let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, mine_id);
                    let mut labor_resource = SingleResourceStoreImpl::retrieve(
                        ref world, mine_id, ResourceTypes::LABOR, ref mine_weight, labor_weight, true,
                    );

                    // Check if mine has enough labor
                    if labor_resource.balance() >= labor_cost {
                        labor_resource.spend(labor_cost, ref mine_weight, labor_weight);
                        labor_resource.store(ref world);
                        mine_weight.store(ref world, mine_id);

                        mine_state.work_accumulated += work_per_phase;
                    } else {
                        // Not enough labor - stop production
                        mine_state.production_level = 0;
                        break;
                    }

                    phase_id += 1;
                }

                mine_state.work_last_claimed_phase = current_phase;
                world.write_model(@mine_state);

                // Emit production event
                let mine_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
                world
                    .emit_event(
                        @StoryEvent {
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(mine_owner),
                            entity_id: Option::Some(mine_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::BitcoinMineProductionStory(
                                BitcoinMineProductionStory {
                                    mine_id,
                                    owner: mine_owner,
                                    production_level: mine_state.production_level,
                                    labor_consumed: Self::_get_labor_cost_per_phase(mine_state.production_level, config),
                                    work_produced: work_per_phase,
                                },
                            ),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }
        }

        fn _get_current_phase(ref world: WorldStorage, config: BitcoinMineConfig) -> u64 {
            let now = starknet::get_block_timestamp();
            now / config.phase_duration_seconds
        }

        fn _get_current_phase_view(world: @WorldStorage, config: BitcoinMineConfig) -> u64 {
            let now = starknet::get_block_timestamp();
            now / config.phase_duration_seconds
        }

        fn _get_work_per_phase(production_level: u8, config: BitcoinMineConfig) -> u128 {
            // Work per second = labor per second (1:1 ratio)
            // Work per phase = work_per_sec * phase_duration
            let work_per_sec: u128 = match production_level {
                0 => 0,
                1 => config.very_low_labor_per_sec.into(),
                2 => config.low_labor_per_sec.into(),
                3 => config.medium_labor_per_sec.into(),
                4 => config.high_labor_per_sec.into(),
                _ => config.very_high_labor_per_sec.into(),
            };
            work_per_sec * config.phase_duration_seconds.into() * RESOURCE_PRECISION
        }

        fn _get_labor_cost_per_phase(production_level: u8, config: BitcoinMineConfig) -> u128 {
            let labor_per_sec: u128 = match production_level {
                0 => 0,
                1 => config.very_low_labor_per_sec.into(),
                2 => config.low_labor_per_sec.into(),
                3 => config.medium_labor_per_sec.into(),
                4 => config.high_labor_per_sec.into(),
                _ => config.very_high_labor_per_sec.into(),
            };
            labor_per_sec * config.phase_duration_seconds.into() * RESOURCE_PRECISION
        }
    }
}
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds (may have warnings initially)

**Step 3: Commit**

```bash
git add contracts/game/src/systems/bitcoin_mine/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine systems contract

Implements set_production_level, claim_work, execute_phase_lottery,
withdraw_satoshis with POW-style phase-based lottery mechanics.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Register Bitcoin Mine Module in Systems

**Files:**

- Modify: `contracts/game/src/systems.cairo`

**Step 1: Add bitcoin_mine module**

Add to `contracts/game/src/systems.cairo`:

```cairo
pub mod bitcoin_mine {
    pub mod contracts;
    #[cfg(test)]
    mod tests;
}
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/systems.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): register bitcoin_mine module in systems

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Integrate Bitcoin Mine Discovery into Exploration

**Files:**

- Modify: `contracts/game/src/systems/combat/contracts/troop_movement.cairo`

**Step 1: Add bitcoin mine discovery in find_treasure**

In the `find_treasure` function in `troop_movement_util_systems`, add bitcoin mine discovery BEFORE camp discovery, but only for Ethereal layer (coord.alt == true):

```cairo
                    // perform lottery to discover bitcoin mine (Ethereal layer only)
                    if coord.alt {
                        let (bitcoin_mine_discovery_systems, _) = world.dns(@"bitcoin_mine_discovery_systems").unwrap();
                        let bitcoin_mine_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                            contract_address: bitcoin_mine_discovery_systems,
                        };
                        let (found_bitcoin_mine, _) = bitcoin_mine_discovery_systems
                            .find_treasure(
                                vrf_seed,
                                tile,
                                starknet::get_caller_address(),
                                map_config,
                                troop_limit_config,
                                troop_stamina_config,
                                current_tick,
                                season_mode_on,
                            );
                        if found_bitcoin_mine {
                            return (true, ExploreFind::BitcoinMine);
                        }
                    }
```

**Step 2: Add achievement progression for BitcoinMine discovery**

In `explorer_move`, add achievement case for BitcoinMine:

```cairo
                        ExploreFind::BitcoinMine => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::BITCOIN_MINE_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/combat/contracts/troop_movement.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): integrate bitcoin mine discovery into exploration

Bitcoin mines are only discoverable in Ethereal layer with 1/50 chance.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Add Bitcoin Mine Discovery Systems Contract

**Files:**

- Create: `contracts/game/src/systems/bitcoin_mine/discovery_systems.cairo`

**Step 1: Create discovery systems contract**

Create the discovery systems contract following the pattern of holysite_discovery_systems:

```cairo
use crate::alias::ID;
use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig};
use crate::models::events::ExploreFind;
use crate::models::map::Tile;

#[starknet::interface]
pub trait IBitcoinMineDiscoverySystems<T> {
    fn find_treasure(
        self: @T,
        vrf_seed: u256,
        tile: Tile,
        caller: starknet::ContractAddress,
        map_config: MapConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
        season_mode_on: bool,
    ) -> (bool, ExploreFind);
}

#[dojo::contract]
pub mod bitcoin_mine_discovery_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{BitcoinMineConfig, CombatConfigImpl, MapConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl};
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::models::position::Coord;
    use crate::systems::utils::bitcoin_mine::iBitcoinMineDiscoveryImpl;

    #[abi(embed_v0)]
    impl BitcoinMineDiscoverySystemsImpl of super::IBitcoinMineDiscoverySystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            let mut world = self.world(DEFAULT_NS());

            // Check if bitcoin mine system is enabled
            let bitcoin_mine_config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(
                world, selector!("bitcoin_mine_config"),
            );
            if !bitcoin_mine_config.enabled {
                return (false, ExploreFind::None);
            }

            // Bitcoin mines can only be in Ethereal (alt) layer
            let coord: Coord = tile.into();
            if !coord.alt {
                return (false, ExploreFind::None);
            }

            // Run lottery
            let won = iBitcoinMineDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if won {
                iBitcoinMineDiscoveryImpl::create(
                    ref world, coord, troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return (true, ExploreFind::BitcoinMine);
            }

            (false, ExploreFind::None)
        }
    }
}
```

**Step 2: Update bitcoin_mine module to include discovery_systems**

Update `contracts/game/src/systems/bitcoin_mine.cairo` or the module registration:

```cairo
pub mod bitcoin_mine {
    pub mod contracts;
    pub mod discovery_systems;
    #[cfg(test)]
    mod tests;
}
```

**Step 3: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add contracts/game/src/systems/bitcoin_mine/discovery_systems.cairo contracts/game/src/systems.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine discovery systems

Integrates with exploration to discover bitcoin mines in Ethereal layer.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Add Bitcoin Mine Config Setter

**Files:**

- Modify: `contracts/game/src/systems/config/contracts.cairo`

**Step 1: Add IBitcoinMineConfig trait**

Add the interface:

```cairo
#[starknet::interface]
pub trait IBitcoinMineConfig<T> {
    fn set_bitcoin_mine_config(
        ref self: T,
        enabled: bool,
        phase_duration_seconds: u64,
        satoshis_per_phase: u128,
        satoshi_weight_grams: u128,
        very_low_labor_per_sec: u16,
        low_labor_per_sec: u16,
        medium_labor_per_sec: u16,
        high_labor_per_sec: u16,
        very_high_labor_per_sec: u16,
    );
}
```

**Step 2: Implement IBitcoinMineConfig in config_systems**

```cairo
    #[abi(embed_v0)]
    impl BitcoinMineConfigImpl of super::IBitcoinMineConfig<ContractState> {
        fn set_bitcoin_mine_config(
            ref self: ContractState,
            enabled: bool,
            phase_duration_seconds: u64,
            satoshis_per_phase: u128,
            satoshi_weight_grams: u128,
            very_low_labor_per_sec: u16,
            low_labor_per_sec: u16,
            medium_labor_per_sec: u16,
            high_labor_per_sec: u16,
            very_high_labor_per_sec: u16,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            Self::assert_caller_is_admin(ref world);

            let config = BitcoinMineConfig {
                enabled,
                phase_duration_seconds,
                satoshis_per_phase,
                satoshi_weight_grams,
                very_low_labor_per_sec,
                low_labor_per_sec,
                medium_labor_per_sec,
                high_labor_per_sec,
                very_high_labor_per_sec,
            };
            WorldConfigUtilImpl::set_member(ref world, selector!("bitcoin_mine_config"), config);
        }
    }
```

**Step 3: Add BitcoinMineConfig import**

```cairo
use crate::models::config::BitcoinMineConfig;
```

**Step 4: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add contracts/game/src/systems/config/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): add bitcoin mine config setter to config systems

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Restrict Satoshi Transfer to Armies Only

**Files:**

- Modify: `contracts/game/src/systems/trade/contracts.cairo` (or relevant transfer system)

**Step 1: Add validation to prevent donkey transport of satoshis**

In the resource transfer validation, add a check:

```cairo
// Satoshis cannot be transported by donkeys - only armies can carry them
for (resource_type, _) in resources.span() {
    assert!(*resource_type != ResourceTypes::SATOSHI, "Satoshis cannot be transported by donkeys");
}
```

**Step 2: Run scarb build to verify**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add contracts/game/src/systems/trade/contracts.cairo
git commit -m "$(cat <<'EOF'
feat(contracts): restrict satoshi transport to armies only

Donkeys cannot transport satoshis - they must be carried by armies.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Create Bitcoin Mine System Tests

**Files:**

- Create: `contracts/game/src/systems/bitcoin_mine/tests.cairo`

**Step 1: Create the test file**

```cairo
#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::bitcoin_mine::{BitcoinMinePhaseWork, BitcoinMineState, BitcoinPhaseWork, ProductionLevel};
    use crate::models::config::{BitcoinMineConfig, SeasonConfig, WorldConfigUtilImpl};
    use crate::models::position::Coord;
    use crate::models::structure::{Structure, StructureBase, StructureCategory};
    use crate::systems::bitcoin_mine::contracts::{IBitcoinMineSystemsDispatcher, IBitcoinMineSystemsDispatcherTrait};

    const PHASE_DURATION: u64 = 600; // 10 minutes
    const SATOSHIS_PER_PHASE: u128 = 100_000_000_000; // 100 satoshis with precision

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig {
            enabled: true,
            phase_duration_seconds: PHASE_DURATION,
            satoshis_per_phase: SATOSHIS_PER_PHASE,
            satoshi_weight_grams: 1, // Very light
            very_low_labor_per_sec: 1,
            low_labor_per_sec: 2,
            medium_labor_per_sec: 3,
            high_labor_per_sec: 4,
            very_high_labor_per_sec: 5,
        }
    }

    fn get_active_season_config() -> SeasonConfig {
        SeasonConfig {
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 100000,
            end_grace_seconds: 3600,
            registration_grace_seconds: 3600,
            dev_mode_on: false,
        }
    }

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = get_default_bitcoin_mine_config();
        assert!(config.enabled, "Should be enabled");
        assert!(config.phase_duration_seconds == 600, "Phase should be 10 minutes");
        assert!(config.very_low_labor_per_sec == 1, "Very low should be 1");
        assert!(config.very_high_labor_per_sec == 5, "Very high should be 5");
    }

    #[test]
    fn test_work_calculation() {
        let config = get_default_bitcoin_mine_config();
        // Work per phase at medium level: 3 labor/sec * 600 sec = 1800 work
        let expected_work = 3_u128 * 600_u128 * RESOURCE_PRECISION;
        assert!(expected_work == 1800 * RESOURCE_PRECISION, "Work calculation should be correct");
    }

    #[test]
    fn test_production_level_conversion() {
        let level: ProductionLevel = ProductionLevel::Medium;
        let level_u8: u8 = level.into();
        assert!(level_u8 == 3, "Medium should be 3");

        let back: ProductionLevel = level_u8.into();
        assert!(back == ProductionLevel::Medium, "Should convert back to Medium");
    }
}
```

**Step 2: Run tests to verify**

Run: `cd contracts/game && sozo test -f test_bitcoin`
Expected: Tests pass

**Step 3: Commit**

```bash
git add contracts/game/src/systems/bitcoin_mine/tests.cairo
git commit -m "$(cat <<'EOF'
test(contracts): add bitcoin mine system unit tests

Add basic unit tests for config and work calculations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Run Full Contract Build and Tests

**Files:** None (verification only)

**Step 1: Format Cairo code**

Run: `cd contracts/game && scarb fmt`
Expected: Code is formatted

**Step 2: Build contracts**

Run: `cd contracts/game && scarb build`
Expected: Build succeeds with no errors

**Step 3: Run all tests**

Run: `cd contracts/game && sozo test`
Expected: All tests pass

**Step 4: Final commit if formatting changed anything**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(contracts): format code and fix any issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements the Bitcoin Mine system with:

1. **Resource Types** (Task 1): WORK (57) - weightless, non-transferrable; SATOSHI (58) - army-only transport
2. **Structure Category** (Tasks 2-4): BitcoinMine with T3 defender configuration
3. **Config** (Tasks 5-7): MapConfig probabilities (1/50), BitcoinMineConfig with production rates and phase settings
4. **Models** (Task 8): BitcoinPhaseWork, BitcoinMineState, BitcoinMinePhaseWork, BitcoinMineRegistry
5. **Events** (Task 9): BitcoinMineProductionStory, BitcoinPhaseLotteryStory
6. **Discovery** (Tasks 10, 13-14): Ethereal-layer-only discovery with 1/50 chance
7. **Systems** (Tasks 11-12): Production level setting, work claiming, phase lottery execution, satoshi withdrawal
8. **Config Setter** (Task 15): Admin config setter
9. **Transport Restriction** (Task 16): Satoshis cannot be transported by donkeys
10. **Tests** (Tasks 17-18): Unit tests and full verification

Key design decisions:

- **Ethereal-layer only**: Bitcoin mines discovered only when `coord.alt == true`
- **T3 defenders**: Matching Ethereal Agents pattern (Paladin T3)
- **Phase-based lottery**: Every 10 minutes, weighted random selection based on work contribution
- **Work = Labor**: 1:1 ratio where labor consumed equals work produced
- **Army-only transport**: Satoshis cannot be carried by donkeys, matching lore

---

## Design Revision: Distributed Claim Lottery

### Problems with Original Design

The original design had a single `execute_phase_lottery` function that anyone could call to determine the winner. This has several issues:

1. **Centralized execution**: One transaction determines the winner for everyone
2. **Gas burden on caller**: Whoever calls the lottery pays gas but may not benefit
3. **No urgency**: No incentive to participate quickly
4. **Potential griefing**: Callers could time their call strategically

### Revised Mechanism

#### Phase 1: Work Window (10 minutes)

- Players burn labor at their bitcoin mines during the open window
- Can keep burning labor as long as the 10-minute window is still open
- Labor burned = work contributed (1:1 ratio)
- Work contribution determines lottery odds for that phase

#### Phase 2: Claim Window (after work window closes)

- Once the 10-minute window closes, players can attempt to claim the reward
- **Each player calls their own `claim_reward(phase_id)` transaction**
- The contract runs a VRF lottery for that caller based on their percentage of total work
- If they win: they receive the satoshis immediately
- If they lose: nothing happens, they can't claim again for this phase
- **First to win gets the reward** - subsequent claims for that phase fail

#### Last Roller + Rollover

- Contract tracks how many participants have attempted to claim
- Contract knows the total participant count from the work window
- When the **last participant** calls claim:
  - If they win: normal payout
  - If they still don't win: **reward rolls over to the next open phase**
- Rollover continues for up to **6 phases** maximum
- If still unclaimed after 6 phases: **reward is burned** (nobody wins)

This creates interesting dynamics:
- Growing jackpots attract more participants
- More participants = higher chance someone wins before burnout
- Burning unclaimed rewards keeps satoshi supply scarce

### Why This Design Is Better

| Aspect | Old Design | New Design |
|--------|------------|------------|
| **Gas distribution** | Single caller pays all | Each claimant pays their own |
| **Incentive alignment** | Caller may not benefit | Claimant is trying to win |
| **Player engagement** | Passive waiting | Active claiming creates urgency |
| **Fairness** | Timing of single call matters | Everyone gets their own roll |
| **Jackpot potential** | Fixed per phase | Accumulates on no-winner phases |
| **Scarcity** | All rewards distributed | Unclaimed rewards burned |

### Implementation Changes Required

The current `execute_phase_lottery(phase_id)` needs to be replaced with:

```cairo
/// Player attempts to claim reward for a completed phase
/// - Checks caller contributed work to this phase
/// - Runs VRF lottery weighted by caller's work percentage
/// - If win: transfers satoshis to caller's mine
/// - If lose: marks caller as claimed (can't retry)
/// - If last claimer loses: rolls reward to next phase (up to 6x, then burned)
fn claim_phase_reward(ref self: T, mine_id: ID, phase_id: u64);
```

New state tracking needed:
- `phase_participant_count: u32` - total workers in phase
- `phase_claim_count: u32` - how many have attempted claim
- `phase_claimed_by_mine: bool` - has this mine claimed yet
- `phase_reward_claimed: bool` - has anyone won yet
- `phase_rollover_amount: u128` - accumulated from previous phases

---

## Open Design Question: Spire-Structure Collision

**Problem:** Spires are placed at fixed locations on the Ethereal layer. If a Bitcoin Mine (or other structure) is discovered at a tile that is later designated as a spire location, there's a collision.

**Constraints:**
- Spire locations expand dynamically as more realms settle (cannot pre-reserve)
- Destroying player structures is not acceptable

### Viable Solutions

**Option C: Structure Relocation (Displacement)**

When a spire needs to spawn, any existing structure at that location is moved to the nearest unoccupied tile. Owner retains the structure and all resources.

- **Pros:** Fair to players, no loss of investment
- **Cons:** Complex to implement, need to update tile occupancy for both old and new locations, may need to handle edge case of no available nearby tiles

**Option D: Spire Relocation (Alternative)**

If a structure exists at a spire's designated location, the spire spawns at the nearest valid unoccupied tile instead.

- **Pros:** Player investment fully protected, simpler than moving structures
- **Cons:** Spire placement becomes slightly unpredictable, players could strategically block spire locations

### Decision Needed

Which approach should be implemented?

- **Option C** prioritizes spire placement consistency
- **Option D** prioritizes simplicity and player experience

Either way, implementation requires:
1. Check for existing structure at spire spawn location
2. Find nearest unoccupied tile (ring search outward)
3. Update the appropriate entity's location and tile occupancy
