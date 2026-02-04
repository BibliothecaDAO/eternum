use crate::alias::ID;

#[starknet::interface]
pub trait IBitcoinMineSystems<T> {
    /// Contribute labor to a phase (initializes phase if first contributor)
    /// Players can contribute to future phases by specifying target_phase_id
    fn contribute_labor(ref self: T, mine_id: ID, target_phase_id: u64, labor_amount: u128);

    /// Process claims for multiple mines in a phase (permissionless)
    fn claim_phase_reward(ref self: T, phase_id: u64, mine_ids: Array<ID>);

    /// View: Get current phase ID
    fn get_current_phase(self: @T) -> u64;

    /// View: Get mine's contribution percentage for a phase (basis points)
    fn get_mine_contribution(self: @T, mine_id: ID, phase_id: u64) -> u128;
}

#[dojo::contract]
pub mod bitcoin_mine_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, MAX_FUTURE_PHASES, MAX_ROLLOVER_PHASES, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::bitcoin_mine::{BitcoinMinePhaseLabor, BitcoinMineRegistry, BitcoinMineState, BitcoinPhaseLabor};
    use crate::models::config::{BitcoinMineConfig, SeasonConfigImpl, TickConfig, WorldConfigUtilImpl};
    use crate::models::events::{BitcoinMineProductionStory, BitcoinPhaseLotteryStory, Story, StoryEvent};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl};
    use crate::models::weight::Weight;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

    #[abi(embed_v0)]
    impl BitcoinMineSystemsImpl of super::IBitcoinMineSystems<ContractState> {
        fn contribute_labor(ref self: ContractState, mine_id: ID, target_phase_id: u64, labor_amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let config: BitcoinMineConfig = WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"));
            assert!(config.enabled, "Bitcoin mine system is not enabled");

            let tick_config: TickConfig = WorldConfigUtilImpl::get_member(world, selector!("tick_config"));
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

            // Validate target_phase_id is valid (must be > 0 and >= current_phase + 1 for future contributions)
            assert!(target_phase_id > 0, "Phase ID must be greater than 0");
            assert!(target_phase_id > registry.current_phase, "Cannot contribute to past or current phase");
            assert!(
                target_phase_id <= registry.current_phase + MAX_FUTURE_PHASES,
                "Cannot contribute to phase more than 30 phases in the future",
            );

            // Read target phase labor
            let mut phase_labor: BitcoinPhaseLabor = world.read_model(target_phase_id);

            let now = starknet::get_block_timestamp();

            // Handle phase initialization for the "next" phase (current_phase + 1)
            if target_phase_id == registry.current_phase + 1 && phase_labor.phase_end_time == 0 {
                // Validate: phase_id == 1 OR previous phase has ended
                if target_phase_id > 1 {
                    let prev_phase: BitcoinPhaseLabor = world.read_model(registry.current_phase);
                    assert!(now >= prev_phase.phase_end_time, "Previous phase has not ended yet");
                }

                // Calculate rollover from previous phase if unclaimed
                let mut rollover: u128 = 0;
                if target_phase_id > 1 {
                    let prev_phase: BitcoinPhaseLabor = world.read_model(registry.current_phase);
                    if !prev_phase.reward_claimed && prev_phase.prize_pool > 0 {
                        // Check if within rollover limit
                        let rollover_count = target_phase_id - prev_phase.prize_origin_phase;
                        if rollover_count < MAX_ROLLOVER_PHASES {
                            rollover = prev_phase.prize_pool;
                            phase_labor.prize_origin_phase = prev_phase.prize_origin_phase;
                        }
                        // If rollover_count >= MAX_ROLLOVER_PHASES, prize is burned (rollover stays 0)
                    }
                }

                // Initialize phase
                phase_labor.phase_id = target_phase_id;
                phase_labor.phase_end_time = now + tick_config.bitcoin_phase_in_seconds;
                phase_labor.prize_pool = config.prize_per_phase + rollover;
                if phase_labor.prize_origin_phase == 0 {
                    phase_labor.prize_origin_phase = target_phase_id;
                }

                // Update registry
                registry.current_phase = target_phase_id;
                world.write_model(@registry);
            } else if phase_labor.phase_end_time == 0 {
                // Future phase (beyond current_phase + 1) - initialize without rollover
                // Prize rollover only happens when phases are sequential
                phase_labor.phase_id = target_phase_id;
                phase_labor.phase_end_time = now + tick_config.bitcoin_phase_in_seconds;
                phase_labor.prize_pool = config.prize_per_phase;
                phase_labor.prize_origin_phase = target_phase_id;
            } else {
                // Phase already initialized - ensure contribution window is still open
                assert!(now < phase_labor.phase_end_time, "Contribution window has closed");
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

            // Add labor to phase
            phase_labor.total_labor += labor_amount;

            // Track mine's contribution
            let mut mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((target_phase_id, mine_id));
            let is_first_contribution = mine_phase_labor.labor_contributed == 0;
            mine_phase_labor.phase_id = target_phase_id;
            mine_phase_labor.mine_id = mine_id;
            mine_phase_labor.labor_contributed += labor_amount;
            world.write_model(@mine_phase_labor);

            // Increment participant count if first contribution
            if is_first_contribution {
                phase_labor.participant_count += 1;
            }
            world.write_model(@phase_labor);

            // Update mine state
            let mut mine_state: BitcoinMineState = world.read_model(mine_id);
            mine_state.labor_deposited += labor_amount;
            mine_state.last_contributed_phase = target_phase_id;
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
                                mine_id, owner: mine_owner, phase_id: target_phase_id, labor_deposited: labor_amount,
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

            // Read phase labor
            let mut phase_labor: BitcoinPhaseLabor = world.read_model(phase_id);

            // Validate phase was initialized
            assert!(phase_labor.phase_end_time > 0, "Phase was not initialized");

            // Validate contribution window has closed
            let now = starknet::get_block_timestamp();
            assert!(now >= phase_labor.phase_end_time, "Contribution window has not closed yet");

            // Already claimed - nothing to do
            if phase_labor.reward_claimed {
                return;
            }

            // No labor = no reward
            if phase_labor.total_labor == 0 {
                phase_labor.reward_claimed = true;
                world.write_model(@phase_labor);
                return;
            }

            // If phase ends after season end_at (and end_at > 0), burn the prize - no reward given
            if season_config.end_at > 0 && phase_labor.phase_end_time > season_config.end_at {
                phase_labor.reward_claimed = true;
                world.write_model(@phase_labor);
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

                // Read mine's phase labor
                let mut mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((phase_id, mine_id));

                // Skip if no labor contributed or already claimed
                if mine_phase_labor.labor_contributed == 0 || mine_phase_labor.claimed {
                    mine_index += 1;
                    continue;
                }

                // Mark as claimed
                mine_phase_labor.claimed = true;
                world.write_model(@mine_phase_labor);
                phase_labor.claim_count += 1;

                // Calculate win probability (basis points)
                let win_probability = (mine_phase_labor.labor_contributed * 10000) / phase_labor.total_labor;

                // Generate random roll for this mine
                let mine_vrf_seed = vrf_seed + mine_index.into();
                let roll: u128 = rng_library_dispatcher.get_random_in_range(mine_vrf_seed, 0, 10001);

                // Check if this mine wins
                if roll <= win_probability {
                    // Winner found!
                    phase_labor.reward_claimed = true;
                    world.write_model(@phase_labor);

                    // Update mine state
                    let mut mine_state: BitcoinMineState = world.read_model(mine_id);
                    mine_state.prizes_won += phase_labor.prize_pool;
                    world.write_model(@mine_state);

                    // Mint SATOSHI at the winning mine (owner can transport via donkeys)
                    let winner_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, mine_id);
                    let satoshi_weight = ResourceWeightImpl::grams(ref world, ResourceTypes::SATOSHI);
                    let mut mine_weight: Weight = WeightStoreImpl::retrieve(ref world, mine_id);
                    let mut satoshi_resource = SingleResourceStoreImpl::retrieve(
                        ref world, mine_id, ResourceTypes::SATOSHI, ref mine_weight, satoshi_weight, true,
                    );
                    satoshi_resource.add(phase_labor.prize_pool, ref mine_weight, satoshi_weight);
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
                                        total_labor: phase_labor.total_labor,
                                        winner_mine_id: mine_id,
                                        winner_owner,
                                        prize_awarded: phase_labor.prize_pool,
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

            // Update phase labor with new claim count
            world.write_model(@phase_labor);
            // If all participants have claimed and no winner, prize rolls over to next phase
        // (handled in contribute_labor when initializing next phase)
        }

        fn get_current_phase(self: @ContractState) -> u64 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let registry: BitcoinMineRegistry = world.read_model(WORLD_CONFIG_ID);
            registry.current_phase
        }

        fn get_mine_contribution(self: @ContractState, mine_id: ID, phase_id: u64) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());

            let phase_labor: BitcoinPhaseLabor = world.read_model(phase_id);
            if phase_labor.total_labor == 0 {
                return 0;
            }

            let mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((phase_id, mine_id));
            (mine_phase_labor.labor_contributed * 10000) / phase_labor.total_labor
        }
    }
}
