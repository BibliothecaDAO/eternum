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
    use crate::models::structure::{StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl};
    use crate::models::troop::ExplorerTroops;
    use crate::models::weight::Weight;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::utils::troop::iExplorerImpl;

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
                structure_base.category == StructureCategory::BitcoinMine.into(), "Structure is not a bitcoin mine",
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
                    let contribution_percentage = (mine_phase_work.work_contributed * 10000) / phase_work.total_work;
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
                ref world, army_id, ResourceTypes::SATOSHI, ref army_weight, satoshi_weight, false,
            );
            army_satoshi.add(amount, ref army_weight, satoshi_weight);
            army_satoshi.store(ref world);
            army_weight.store(ref world, army_id);
        }

        fn get_pending_work(self: @ContractState, mine_id: ID) -> u128 {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));

            let mine_state: BitcoinMineState = world.read_model(mine_id);
            if mine_state.production_level == 0 {
                return 0;
            }

            let current_phase = Self::_get_current_phase(ref world, config);
            let phases_elapsed = current_phase - mine_state.work_last_claimed_phase;

            let work_per_phase = Self::_get_work_per_phase(mine_state.production_level, config);
            phases_elapsed.into() * work_per_phase
        }

        fn get_current_phase(self: @ContractState) -> u64 {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            Self::_get_current_phase(ref world, config)
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
                    if labor_resource.balance >= labor_cost {
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
                                    labor_consumed: Self::_get_labor_cost_per_phase(
                                        mine_state.production_level, config,
                                    ),
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
