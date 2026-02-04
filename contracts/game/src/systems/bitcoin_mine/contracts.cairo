use crate::alias::ID;
use crate::models::bitcoin_mine::ProductionLevel;

#[starknet::interface]
pub trait IBitcoinMineSystems<T> {
    /// Set production level for a bitcoin mine (must own the mine)
    fn set_production_level(ref self: T, mine_id: ID, level: ProductionLevel);

    /// Contribute labor to a phase (initializes phase if first contributor)
    fn contribute_labor(ref self: T, mine_id: ID, labor_amount: u128);

    /// Process claims for multiple mines in a phase (permissionless)
    fn claim_phase_reward(ref self: T, phase_id: u64, mine_ids: Array<ID>);

    /// View: Get mine's pending work
    fn get_pending_work(self: @T, mine_id: ID) -> u128;

    /// View: Get current phase ID
    fn get_current_phase(self: @T) -> u64;

    /// View: Get mine's contribution percentage for a phase
    fn get_mine_contribution(self: @T, mine_id: ID, phase_id: u64) -> u128;
}

#[dojo::contract]
pub mod bitcoin_mine_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, MAX_ROLLOVER_PHASES, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::bitcoin_mine::{
        BitcoinMinePhaseWork, BitcoinMineRegistry, BitcoinMineState, BitcoinPhaseWork, ProductionLevel,
    };
    use crate::models::config::{BitcoinMineConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::events::{BitcoinMineProductionStory, BitcoinPhaseLotteryStory, Story, StoryEvent};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl};
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
                structure_base.category == StructureCategory::BitcoinMine.into(), "Structure is not a bitcoin mine",
            );

            // Update production level
            let mut mine_state: BitcoinMineState = world.read_model(mine_id);
            mine_state.production_level = level.into();
            world.write_model(@mine_state);
        }

        fn contribute_labor(ref self: ContractState, mine_id: ID, labor_amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            assert!(config.enabled, "Bitcoin mine system is not enabled");

            let caller = starknet::get_caller_address();

            // Verify mine ownership
            let mine_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
            assert!(mine_owner == caller, "Only mine owner can contribute labor");

            // Verify it's a bitcoin mine
            let structure_base = StructureBaseStoreImpl::retrieve(ref world, mine_id);
            assert!(
                structure_base.category == StructureCategory::BitcoinMine.into(), "Structure is not a bitcoin mine",
            );

            // Get registry to determine current phase
            let mut registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
            let next_phase_id = registry.current_phase + 1;

            // Read current phase work
            let mut phase_work: BitcoinPhaseWork = world.read_model(next_phase_id);

            // Initialize phase if this is the first contribution
            let now = starknet::get_block_timestamp();
            if phase_work.phase_end_time == 0 {
                // Validate: phase_id == 1 OR previous phase has ended
                if next_phase_id > 1 {
                    let prev_phase: BitcoinPhaseWork = world.read_model(registry.current_phase);
                    assert!(now >= prev_phase.phase_end_time, "Previous phase has not ended yet");
                }

                // Calculate rollover from previous phase if unclaimed
                let mut rollover: u128 = 0;
                if next_phase_id > 1 {
                    let prev_phase: BitcoinPhaseWork = world.read_model(registry.current_phase);
                    if !prev_phase.reward_claimed && prev_phase.prize_pool > 0 {
                        // Check if within rollover limit
                        let rollover_count = next_phase_id - prev_phase.prize_origin_phase;
                        if rollover_count < MAX_ROLLOVER_PHASES {
                            rollover = prev_phase.prize_pool;
                            phase_work.prize_origin_phase = prev_phase.prize_origin_phase;
                        }
                        // If rollover_count >= MAX_ROLLOVER_PHASES, prize is burned (rollover stays 0)
                    }
                }

                // Initialize phase
                phase_work.phase_id = next_phase_id;
                phase_work.phase_end_time = now + config.phase_duration_seconds;
                phase_work.prize_pool = config.prize_per_phase + rollover;
                if phase_work.prize_origin_phase == 0 {
                    phase_work.prize_origin_phase = next_phase_id;
                }

                // Update registry
                registry.current_phase = next_phase_id;
                world.write_model(@registry);
            } else {
                // Ensure work window is still open
                assert!(now < phase_work.phase_end_time, "Work window has closed");
            }

            // Burn labor from mine
            let labor_weight = ResourceWeightImpl::grams(ref world, ResourceTypes::LABOR);
            let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, mine_id);
            let mut labor_resource = SingleResourceStoreImpl::retrieve(
                ref world, mine_id, ResourceTypes::LABOR, ref mine_weight, labor_weight, true,
            );
            assert!(labor_resource.balance >= labor_amount, "Not enough labor");
            labor_resource.spend(labor_amount, ref mine_weight, labor_weight);
            labor_resource.store(ref world);
            mine_weight.store(ref world, mine_id);

            // Add work to phase (1:1 labor to work ratio)
            let work_amount = labor_amount;
            phase_work.total_work += work_amount;

            // Track mine's contribution
            let mut mine_phase_work: BitcoinMinePhaseWork = world.read_model((next_phase_id, mine_id));
            let is_first_contribution = mine_phase_work.work_contributed == 0;
            mine_phase_work.phase_id = next_phase_id;
            mine_phase_work.mine_id = mine_id;
            mine_phase_work.work_contributed += work_amount;
            world.write_model(@mine_phase_work);

            // Increment participant count if first contribution
            if is_first_contribution {
                phase_work.participant_count += 1;
            }
            world.write_model(@phase_work);

            // Update mine state
            let mut mine_state: BitcoinMineState = world.read_model(mine_id);
            mine_state.work_accumulated += work_amount;
            mine_state.work_last_claimed_phase = next_phase_id;
            world.write_model(@mine_state);

            // Emit production event
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
                                labor_consumed: labor_amount,
                                work_produced: work_amount,
                            },
                        ),
                        timestamp: now,
                    },
                );
        }

        fn claim_phase_reward(ref self: ContractState, phase_id: u64, mine_ids: Array<ID>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            assert!(config.enabled, "Bitcoin mine system is not enabled");

            // Read phase work
            let mut phase_work: BitcoinPhaseWork = world.read_model(phase_id);

            // Validate phase was initialized
            assert!(phase_work.phase_end_time > 0, "Phase was not initialized");

            // Validate work window has closed
            let now = starknet::get_block_timestamp();
            assert!(now >= phase_work.phase_end_time, "Work window has not closed yet");

            // Already claimed - nothing to do
            if phase_work.reward_claimed {
                return;
            }

            // No work = no reward
            if phase_work.total_work == 0 {
                phase_work.reward_claimed = true;
                world.write_model(@phase_work);
                return;
            }

            // Get VRF for lottery
            let caller = starknet::get_caller_address();
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(caller, world);

            // Process each mine in the array
            let mut mine_index: u32 = 0;
            let mine_ids_span = mine_ids.span();
            while mine_index < mine_ids_span.len() {
                let mine_id = *mine_ids_span.at(mine_index);

                // Read mine's phase work
                let mut mine_phase_work: BitcoinMinePhaseWork = world.read_model((phase_id, mine_id));

                // Skip if no work contributed or already claimed
                if mine_phase_work.work_contributed == 0 || mine_phase_work.claimed {
                    mine_index += 1;
                    continue;
                }

                // Mark as claimed
                mine_phase_work.claimed = true;
                world.write_model(@mine_phase_work);
                phase_work.claim_count += 1;

                // Calculate win probability (basis points)
                let win_probability = (mine_phase_work.work_contributed * 10000) / phase_work.total_work;

                // Generate random roll for this mine
                let mine_vrf_seed = vrf_seed + mine_index.into();
                let roll: u128 = rng_library_dispatcher.get_random_in_range(mine_vrf_seed, 0, 10001);

                // Check if this mine wins
                if roll <= win_probability {
                    // Winner found!
                    phase_work.reward_claimed = true;
                    world.write_model(@phase_work);

                    // Update mine state
                    let mut mine_state: BitcoinMineState = world.read_model(mine_id);
                    mine_state.prizes_won += phase_work.prize_pool;
                    world.write_model(@mine_state);

                    // Mint SATOSHI at the winning mine (owner can transport via donkeys)
                    let winner_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
                    let satoshi_weight = ResourceWeightImpl::grams(ref world, ResourceTypes::SATOSHI);
                    let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, mine_id);
                    let mut satoshi_resource = SingleResourceStoreImpl::retrieve(
                        ref world, mine_id, ResourceTypes::SATOSHI, ref mine_weight, satoshi_weight, true,
                    );
                    satoshi_resource.add(phase_work.prize_pool, ref mine_weight, satoshi_weight);
                    satoshi_resource.store(ref world);
                    mine_weight.store(ref world, mine_id);

                    // Emit event
                    world
                        .emit_event(
                            @StoryEvent {
                                id: world.dispatcher.uuid(),
                                owner: Option::Some(winner_owner),
                                entity_id: Option::Some(mine_id),
                                tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                                story: Story::BitcoinPhaseLotteryStory(
                                    BitcoinPhaseLotteryStory {
                                        phase_id,
                                        total_work: phase_work.total_work,
                                        winner_mine_id: mine_id,
                                        winner_owner,
                                        prize_awarded: phase_work.prize_pool,
                                        roll_value: roll,
                                    },
                                ),
                                timestamp: now,
                            },
                        );

                    return; // Stop processing - winner found
                }

                mine_index += 1;
            }

            // Update phase work with new claim count
            world.write_model(@phase_work);
            // If all participants have claimed and no winner, prize rolls over to next phase
        // (handled in contribute_labor when initializing next phase)
        }

        fn get_pending_work(self: @ContractState, mine_id: ID) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let mine_state: BitcoinMineState = world.read_model(mine_id);
            mine_state.work_accumulated
        }

        fn get_current_phase(self: @ContractState) -> u64 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
            registry.current_phase
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
}
