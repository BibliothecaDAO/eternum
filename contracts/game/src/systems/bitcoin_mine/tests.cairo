#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use snforge_std::{
        start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::bitcoin_mine::{BitcoinMinePhaseLabor, BitcoinPhaseLabor};
    use crate::models::config::{
        BitcoinMineConfig, CapacityConfig, SeasonConfig, StructureCapacityConfig, TickConfig, WeightConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::stamina::Stamina;
    use crate::models::structure::{Structure, StructureBase, StructureCategory, StructureMetadata};
    use crate::models::troop::{GuardTroops, TroopTier, TroopType, Troops};
    use crate::models::weight::Weight;
    use crate::systems::bitcoin_mine::contracts::{IBitcoinMineSystemsDispatcher, IBitcoinMineSystemsDispatcherTrait};

    // ============================================================================
    // Constants
    // ============================================================================

    const PHASE_DURATION: u64 = 600; // 10 minutes
    const PRIZE_PER_PHASE: u128 = 1_000_000_000_000_000_000; // 1 SATOSHI in precision
    const MIN_LABOR: u128 = 100_000_000_000_000_000_000; // 100 labor
    const LABOR_AMOUNT: u128 = 500_000_000_000_000_000_000; // 500 labor

    // ============================================================================
    // Config Helpers
    // ============================================================================

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig { enabled: true, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: MIN_LABOR }
    }

    fn get_active_season_config() -> SeasonConfig {
        SeasonConfig {
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 100000, // Far future
            end_grace_seconds: 3600,
            registration_grace_seconds: 3600,
            dev_mode_on: false,
        }
    }

    fn get_tick_config() -> TickConfig {
        TickConfig {
            armies_tick_in_seconds: 60, delivery_tick_in_seconds: 60, bitcoin_phase_in_seconds: PHASE_DURATION,
        }
    }

    fn get_capacity_config() -> CapacityConfig {
        CapacityConfig {
            structure_capacity: 1000000000000000,
            troop_capacity: 100000000,
            donkey_capacity: 10000000,
            storehouse_boost_capacity: 10000,
        }
    }

    fn get_structure_capacity_config() -> StructureCapacityConfig {
        StructureCapacityConfig {
            realm_capacity: 1000000000000000,
            village_capacity: 1000000000000000,
            hyperstructure_capacity: 1000000000000000,
            fragment_mine_capacity: 1000000000000000,
            bank_structure_capacity: 1000000000000000,
            holysite_capacity: 1000000000000000,
            camp_capacity: 1000000000000000,
            bitcoin_mine_capacity: 1000000000000000,
        }
    }

    // ============================================================================
    // Test World Setup
    // ============================================================================

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // Core config
                TestResource::Model("WorldConfig"), TestResource::Model("WeightConfig"),
                // Structure models
                TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
                // Resource models
                TestResource::Model("Resource"), // Bitcoin mine models
                TestResource::Model("BitcoinPhaseLabor"),
                TestResource::Model("BitcoinMinePhaseLabor"), // RNG model (needed for VRF)
                TestResource::Model("RNG"),
                // Events
                TestResource::Event("StoryEvent"), // Contract
                TestResource::Contract("bitcoin_mine_systems"),
                // Libraries
                TestResource::Library(("rng_library", "0_1_9")),
            ]
                .span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"bitcoin_mine_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn setup_world() -> WorldStorage {
        // Set chain_id for VRF bypass in tests
        start_cheat_chain_id_global('SN_TEST');

        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        world.dispatcher.uuid();

        // Set up bitcoin mine config
        let bitcoin_config = get_default_bitcoin_mine_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("bitcoin_mine_config"), bitcoin_config);

        // Active season (started, not ended)
        let season_config = get_active_season_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);

        // Tick config for phase timing
        let tick_config = get_tick_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);

        // Capacity configs
        WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), get_capacity_config());
        WorldConfigUtilImpl::set_member(
            ref world, selector!("structure_capacity_config"), get_structure_capacity_config(),
        );

        // Set weight config for labor and satoshi (both weightless for simplicity)
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::LABOR, weight_gram: 0 });
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::SATOSHI, weight_gram: 0 });

        world
    }

    fn get_dispatcher(ref world: WorldStorage) -> (ContractAddress, IBitcoinMineSystemsDispatcher) {
        let (addr, _) = world.dns(@"bitcoin_mine_systems").unwrap();
        (addr, IBitcoinMineSystemsDispatcher { contract_address: addr })
    }

    // ============================================================================
    // Structure Helpers
    // ============================================================================

    fn spawn_bitcoin_mine(ref world: WorldStorage, owner: ContractAddress, coord_x: u32, coord_y: u32) -> ID {
        let structure_id = world.dispatcher.uuid();

        let default_troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            battle_cooldown_end: 0,
            boosts: Default::default(),
        };

        let structure = Structure {
            entity_id: structure_id,
            owner: owner,
            base: StructureBase {
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: 4,
                troop_max_explorer_count: 20,
                created_at: starknet::get_block_timestamp().try_into().unwrap(),
                category: StructureCategory::BitcoinMine.into(),
                coord_x: coord_x,
                coord_y: coord_y,
                level: 1,
            },
            troop_guards: GuardTroops {
                delta: default_troops,
                charlie: default_troops,
                bravo: default_troops,
                alpha: default_troops,
                delta_destroyed_tick: 0,
                charlie_destroyed_tick: 0,
                bravo_destroyed_tick: 0,
                alpha_destroyed_tick: 0,
            },
            troop_explorers: array![].span(),
            resources_packed: 0,
            metadata: StructureMetadata {
                realm_id: 0, order: 0, has_wonder: false, villages_count: 0, village_realm: 0,
            },
            category: StructureCategory::BitcoinMine.into(),
        };
        world.write_model_test(@structure);

        // Initialize resources and weight for the structure
        ResourceImpl::initialize(ref world, structure_id);
        let structure_weight = Weight { capacity: 1000000000000000 * RESOURCE_PRECISION, weight: 0 };
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);

        structure_id
    }

    fn spawn_realm(ref world: WorldStorage, owner: ContractAddress) -> ID {
        let structure_id = world.dispatcher.uuid();

        let default_troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            battle_cooldown_end: 0,
            boosts: Default::default(),
        };

        let structure = Structure {
            entity_id: structure_id,
            owner: owner,
            base: StructureBase {
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: 4,
                troop_max_explorer_count: 20,
                created_at: starknet::get_block_timestamp().try_into().unwrap(),
                category: StructureCategory::Realm.into(),
                coord_x: 200,
                coord_y: 200,
                level: 1,
            },
            troop_guards: GuardTroops {
                delta: default_troops,
                charlie: default_troops,
                bravo: default_troops,
                alpha: default_troops,
                delta_destroyed_tick: 0,
                charlie_destroyed_tick: 0,
                bravo_destroyed_tick: 0,
                alpha_destroyed_tick: 0,
            },
            troop_explorers: array![].span(),
            resources_packed: 0,
            metadata: StructureMetadata {
                realm_id: 1, order: 1, has_wonder: false, villages_count: 0, village_realm: 0,
            },
            category: StructureCategory::Realm.into(),
        };
        world.write_model_test(@structure);

        ResourceImpl::initialize(ref world, structure_id);
        let structure_weight = Weight { capacity: 1000000000000000 * RESOURCE_PRECISION, weight: 0 };
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);

        structure_id
    }

    fn grant_labor(ref world: WorldStorage, structure_id: ID, amount: u128) {
        let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let labor_weight_grams = ResourceWeightImpl::grams(ref world, ResourceTypes::LABOR);
        let mut labor = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::LABOR, ref structure_weight, labor_weight_grams, true,
        );
        labor.add(amount, ref structure_weight, labor_weight_grams);
        labor.store(ref world);
        structure_weight.store(ref world, structure_id);
    }

    fn get_labor_balance(ref world: WorldStorage, structure_id: ID) -> u128 {
        ResourceImpl::read_balance(ref world, structure_id, ResourceTypes::LABOR)
    }

    fn get_satoshi_balance(ref world: WorldStorage, structure_id: ID) -> u128 {
        ResourceImpl::read_balance(ref world, structure_id, ResourceTypes::SATOSHI)
    }

    // ============================================================================
    // contribute_labor Tests
    // ============================================================================

    #[test]
    fn test_contribute_labor_success() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        // Grant labor to the mine
        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        // Set time to phase 2
        start_cheat_block_timestamp_global(1200); // Phase 2

        // Contribute labor to phase 2
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        // Verify phase labor state
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);
        assert!(phase_labor.total_labor == MIN_LABOR, "Total labor should match");
        assert!(phase_labor.participant_count == 1, "Should have 1 participant");
        assert!(phase_labor.prize_pool == PRIZE_PER_PHASE, "Prize pool should be initialized");

        // Verify mine phase labor state
        let mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((2, mine_id));
        assert!(mine_phase_labor.labor_contributed == MIN_LABOR, "Mine labor should match");
        assert!(!mine_phase_labor.claimed, "Should not be claimed yet");

        // Verify labor was deducted from mine
        let remaining_labor = get_labor_balance(ref world, mine_id);
        assert!(remaining_labor == LABOR_AMOUNT - MIN_LABOR, "Labor should be deducted");
    }

    #[test]
    fn test_contribute_labor_multiple_contributions() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT * 3);

        start_cheat_block_timestamp_global(1200);

        // First contribution
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);

        // Second contribution from same mine
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR * 2);
        stop_cheat_caller_address(system_addr);

        // Verify total labor accumulated
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);
        assert!(phase_labor.total_labor == MIN_LABOR * 3, "Total labor should accumulate");
        assert!(phase_labor.participant_count == 1, "Still only 1 participant");

        let mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((2, mine_id));
        assert!(mine_phase_labor.labor_contributed == MIN_LABOR * 3, "Mine labor should accumulate");
    }

    #[test]
    fn test_contribute_labor_multiple_participants() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner1 = starknet::contract_address_const::<'owner1'>();
        let owner2 = starknet::contract_address_const::<'owner2'>();

        let mine1 = spawn_bitcoin_mine(ref world, owner1, 100, 100);
        let mine2 = spawn_bitcoin_mine(ref world, owner2, 200, 200);

        grant_labor(ref world, mine1, LABOR_AMOUNT);
        grant_labor(ref world, mine2, LABOR_AMOUNT);

        start_cheat_block_timestamp_global(1200);

        // Both mines contribute
        start_cheat_caller_address(system_addr, owner1);
        dispatcher.contribute_labor(mine1, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, owner2);
        dispatcher.contribute_labor(mine2, 2, MIN_LABOR * 2);
        stop_cheat_caller_address(system_addr);

        // Verify phase labor
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);
        assert!(phase_labor.total_labor == MIN_LABOR * 3, "Total labor from both");
        assert!(phase_labor.participant_count == 2, "Should have 2 participants");
    }

    #[test]
    fn test_contribute_labor_to_future_phase() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        // At phase 2, contribute to phase 10 (8 phases ahead)
        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 10, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        // Verify contribution to future phase
        let phase_labor: BitcoinPhaseLabor = world.read_model(10);
        assert!(phase_labor.total_labor == MIN_LABOR, "Future phase should have labor");
        assert!(phase_labor.participant_count == 1, "Should have 1 participant");
    }

    #[test]
    #[should_panic]
    fn test_contribute_labor_not_owner_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let attacker = starknet::contract_address_const::<'attacker'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200);

        // Attacker tries to contribute from someone else's mine
        start_cheat_caller_address(system_addr, attacker);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Structure is not a bitcoin mine")]
    fn test_contribute_labor_wrong_structure_type_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'owner'>();
        let realm_id = spawn_realm(ref world, owner);

        grant_labor(ref world, realm_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200);

        // Try to contribute from a realm (not a bitcoin mine)
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(realm_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Cannot contribute to past phase")]
    fn test_contribute_labor_past_phase_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        // At phase 5, try to contribute to phase 2
        start_cheat_block_timestamp_global(3000); // Phase 5

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Cannot contribute to phase more than 30 phases in the future")]
    fn test_contribute_labor_too_far_future_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200); // Phase 2

        // Try to contribute to phase 33 (31 phases ahead, exceeds MAX_FUTURE_PHASES=30)
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 33, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Contribution window has closed")]
    fn test_contribute_labor_window_closed_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        // Phase 2 ends at (2+1)*600-1 = 1799
        // Set time to exactly at the end
        start_cheat_block_timestamp_global(1799);

        // Try to contribute to phase 2 when window just closed
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Not enough labor")]
    fn test_contribute_labor_insufficient_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        // Grant less labor than we'll try to contribute
        grant_labor(ref world, mine_id, MIN_LABOR / 2);
        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Labor below minimum contribution")]
    fn test_contribute_labor_below_minimum_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200);

        // Try to contribute less than minimum
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR - 1);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Phase ID must be greater than 0")]
    fn test_contribute_labor_phase_zero_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200);

        // Try to contribute to phase 0
        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 0, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Bitcoin mine system is not enabled")]
    fn test_contribute_labor_system_disabled_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        // Disable the system
        let disabled_config = BitcoinMineConfig {
            enabled: false, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: MIN_LABOR,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("bitcoin_mine_config"), disabled_config);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);
        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);
    }

    // ============================================================================
    // claim_phase_reward Tests
    // ============================================================================

    #[test]
    fn test_claim_phase_reward_winner_found() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        // Contribute during phase 2
        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        // Move time to after phase 2 ends (phase 3 or later)
        start_cheat_block_timestamp_global(1800); // Phase 3

        // Claim rewards (permissionless)
        let claimer = starknet::contract_address_const::<'claimer'>();
        start_cheat_caller_address(system_addr, claimer);
        dispatcher.claim_phase_reward(2, array![mine_id]);
        stop_cheat_caller_address(system_addr);

        // Check phase state - with 100% contribution, should win
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);
        assert!(phase_labor.claim_count == 1, "Should have 1 claim");

        // Check mine phase labor - should be claimed
        let mine_phase_labor: BitcoinMinePhaseLabor = world.read_model((2, mine_id));
        assert!(mine_phase_labor.claimed, "Mine should be marked as claimed");

        // If winner, reward_receiver_phase should be set to self
        // and SATOSHI should be minted at the mine
        if phase_labor.reward_receiver_phase == 2 {
            let satoshi_balance = get_satoshi_balance(ref world, mine_id);
            assert!(satoshi_balance == PRIZE_PER_PHASE, "Winner should receive prize");
        }
    }

    #[test]
    fn test_claim_phase_reward_multiple_participants() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner1 = starknet::contract_address_const::<'owner1'>();
        let owner2 = starknet::contract_address_const::<'owner2'>();
        let owner3 = starknet::contract_address_const::<'owner3'>();

        let mine1 = spawn_bitcoin_mine(ref world, owner1, 100, 100);
        let mine2 = spawn_bitcoin_mine(ref world, owner2, 200, 200);
        let mine3 = spawn_bitcoin_mine(ref world, owner3, 300, 300);

        grant_labor(ref world, mine1, LABOR_AMOUNT);
        grant_labor(ref world, mine2, LABOR_AMOUNT);
        grant_labor(ref world, mine3, LABOR_AMOUNT);

        start_cheat_block_timestamp_global(1200);

        // All contribute to phase 2
        start_cheat_caller_address(system_addr, owner1);
        dispatcher.contribute_labor(mine1, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, owner2);
        dispatcher.contribute_labor(mine2, 2, MIN_LABOR * 2);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, owner3);
        dispatcher.contribute_labor(mine3, 2, MIN_LABOR * 3);
        stop_cheat_caller_address(system_addr);

        // Move to after phase 2
        start_cheat_block_timestamp_global(1800);

        // Claim for all mines
        let claimer = starknet::contract_address_const::<'claimer'>();
        start_cheat_caller_address(system_addr, claimer);
        dispatcher.claim_phase_reward(2, array![mine1, mine2, mine3]);
        stop_cheat_caller_address(system_addr);

        // Check phase state
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);

        // First mine is always processed
        let mine1_phase: BitcoinMinePhaseLabor = world.read_model((2, mine1));
        assert!(mine1_phase.claimed, "Mine 1 should be claimed");

        // The claim_count should be at least 1 (and at most 3)
        assert!(phase_labor.claim_count >= 1, "At least 1 mine should be claimed");
        assert!(phase_labor.claim_count <= 3, "At most 3 mines should be claimed");

        // Check total SATOSHI distributed
        let satoshi1 = get_satoshi_balance(ref world, mine1);
        let satoshi2 = get_satoshi_balance(ref world, mine2);
        let satoshi3 = get_satoshi_balance(ref world, mine3);
        let total_satoshi = satoshi1 + satoshi2 + satoshi3;

        // If winner found, exactly one mine should have the prize
        // If no winner (all processed), prize should have rolled over (total = 0)
        if phase_labor.reward_receiver_phase == 2 {
            // Winner found in this phase
            assert!(total_satoshi == PRIZE_PER_PHASE, "Winner should receive full prize");
        } else {
            // No winner - prize rolled over or burned
            assert!(total_satoshi == 0, "No SATOSHI should be distributed if no winner");
        }
    }

    #[test]
    #[should_panic(expected: "Phase has no participants")]
    fn test_claim_phase_reward_no_participants_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        // Don't contribute anything, just try to claim
        start_cheat_block_timestamp_global(1800);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.claim_phase_reward(2, array![mine_id]);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Contribution window has not closed yet")]
    fn test_claim_phase_reward_window_open_fails() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);

        // Try to claim while phase 2 is still open (window closes at 1799)
        dispatcher.claim_phase_reward(2, array![mine_id]);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_claim_phase_reward_skip_already_claimed() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'mine_owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        start_cheat_block_timestamp_global(1800);

        // First claim
        start_cheat_caller_address(system_addr, owner);
        dispatcher.claim_phase_reward(2, array![mine_id]);

        // Second claim should not panic - just skip already claimed mines
        dispatcher.claim_phase_reward(2, array![mine_id]);
        stop_cheat_caller_address(system_addr);

        // Claim count should still be 1
        let phase_labor: BitcoinPhaseLabor = world.read_model(2);
        assert!(phase_labor.claim_count == 1, "Claim count should be 1");
    }

    #[test]
    fn test_claim_phase_reward_skip_no_contribution() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner1 = starknet::contract_address_const::<'owner1'>();
        let owner2 = starknet::contract_address_const::<'owner2'>();

        let mine1 = spawn_bitcoin_mine(ref world, owner1, 100, 100);
        let mine2 = spawn_bitcoin_mine(ref world, owner2, 200, 200);

        grant_labor(ref world, mine1, LABOR_AMOUNT);
        // Don't grant labor to mine2

        start_cheat_block_timestamp_global(1200);

        // Only mine1 contributes
        start_cheat_caller_address(system_addr, owner1);
        dispatcher.contribute_labor(mine1, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        start_cheat_block_timestamp_global(1800);

        // Claim with both mines - mine2 should be skipped
        start_cheat_caller_address(system_addr, owner1);
        dispatcher.claim_phase_reward(2, array![mine1, mine2]);
        stop_cheat_caller_address(system_addr);

        // Only mine1 should be marked as claimed
        let mine1_phase: BitcoinMinePhaseLabor = world.read_model((2, mine1));
        let mine2_phase: BitcoinMinePhaseLabor = world.read_model((2, mine2));
        assert!(mine1_phase.claimed, "Mine 1 should be claimed");
        assert!(!mine2_phase.claimed, "Mine 2 should not be claimed");
    }

    // ============================================================================
    // get_current_phase Tests
    // ============================================================================

    #[test]
    fn test_get_current_phase() {
        let mut world = setup_world();
        let (_, dispatcher) = get_dispatcher(ref world);

        // Phase = timestamp / bitcoin_phase_in_seconds
        start_cheat_block_timestamp_global(0);
        assert!(dispatcher.get_current_phase() == 0, "Phase 0 at t=0");

        start_cheat_block_timestamp_global(599);
        assert!(dispatcher.get_current_phase() == 0, "Phase 0 at t=599");

        start_cheat_block_timestamp_global(600);
        assert!(dispatcher.get_current_phase() == 1, "Phase 1 at t=600");

        start_cheat_block_timestamp_global(1200);
        assert!(dispatcher.get_current_phase() == 2, "Phase 2 at t=1200");

        start_cheat_block_timestamp_global(6000);
        assert!(dispatcher.get_current_phase() == 10, "Phase 10 at t=6000");
    }

    // ============================================================================
    // get_mine_contribution Tests
    // ============================================================================

    #[test]
    fn test_get_mine_contribution() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner1 = starknet::contract_address_const::<'owner1'>();
        let owner2 = starknet::contract_address_const::<'owner2'>();

        let mine1 = spawn_bitcoin_mine(ref world, owner1, 100, 100);
        let mine2 = spawn_bitcoin_mine(ref world, owner2, 200, 200);

        grant_labor(ref world, mine1, LABOR_AMOUNT * 2);
        grant_labor(ref world, mine2, LABOR_AMOUNT * 2);

        start_cheat_block_timestamp_global(1200);

        // Mine1 contributes 300, Mine2 contributes 700 = total 1000
        // Mine1 should have 30% (3000 bps), Mine2 should have 70% (7000 bps)
        start_cheat_caller_address(system_addr, owner1);
        dispatcher.contribute_labor(mine1, 2, MIN_LABOR * 3); // 300
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, owner2);
        dispatcher.contribute_labor(mine2, 2, MIN_LABOR * 7); // 700
        stop_cheat_caller_address(system_addr);

        // Check contribution percentages
        let mine1_pct = dispatcher.get_mine_contribution(mine1, 2);
        let mine2_pct = dispatcher.get_mine_contribution(mine2, 2);

        assert!(mine1_pct == 3000, "Mine1 should have 30% (3000 bps)");
        assert!(mine2_pct == 7000, "Mine2 should have 70% (7000 bps)");
    }

    #[test]
    fn test_get_mine_contribution_no_labor() {
        let mut world = setup_world();
        let (_, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        // No contributions made
        let contribution = dispatcher.get_mine_contribution(mine_id, 2);
        assert!(contribution == 0, "Should be 0 with no contributions");
    }

    #[test]
    fn test_get_mine_contribution_single_contributor_100_percent() {
        let mut world = setup_world();
        let (system_addr, dispatcher) = get_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'owner'>();
        let mine_id = spawn_bitcoin_mine(ref world, owner, 100, 100);

        grant_labor(ref world, mine_id, LABOR_AMOUNT);

        start_cheat_block_timestamp_global(1200);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.contribute_labor(mine_id, 2, MIN_LABOR);
        stop_cheat_caller_address(system_addr);

        let contribution = dispatcher.get_mine_contribution(mine_id, 2);
        assert!(contribution == 10000, "Single contributor should have 100% (10000 bps)");
    }
}
