#[cfg(test)]
mod tests {
    use dojo::model::ModelStorageTest;
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
    use crate::models::config::{
        ArtificerConfig, CapacityConfig, SeasonConfig, StructureCapacityConfig, WeightConfig, WorldConfigUtilImpl,
    };
    use crate::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceStoreImpl, SingleResourceTrait, WeightStoreImpl,
    };
    use crate::models::stamina::Stamina;
    use crate::models::structure::{Structure, StructureBase, StructureCategory, StructureMetadata};
    use crate::models::troop::{GuardTroops, TroopTier, TroopType, Troops};
    use crate::models::weight::Weight;
    use crate::systems::artificer::contracts::{IArtificerSystemsDispatcher, IArtificerSystemsDispatcherTrait};

    // ============================================================================
    // Test Constants
    // ============================================================================

    // Human-readable cost (50,000 research)
    const RESEARCH_COST_FOR_RELIC_RAW: u128 = 50_000;
    // Config value includes precision (this is what gets stored in config)
    const RESEARCH_COST_FOR_RELIC: u128 = RESEARCH_COST_FOR_RELIC_RAW * RESOURCE_PRECISION;

    // ============================================================================
    // Test Setup
    // ============================================================================

    fn get_default_artificer_config() -> ArtificerConfig {
        ArtificerConfig { research_cost_for_relic: RESEARCH_COST_FOR_RELIC }
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

    fn get_ended_season_config() -> SeasonConfig {
        SeasonConfig {
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 500, // Already ended
            end_grace_seconds: 3600,
            registration_grace_seconds: 3600,
            dev_mode_on: false,
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
        }
    }

    fn namespace_def_artificer() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // Core config
                TestResource::Model("WorldConfig"), TestResource::Model("WeightConfig"),
                // Structure models
                TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
                // Resource models
                TestResource::Model("Resource"), // RNG model (needed for VRF)
                TestResource::Model("RNG"),
                // Events
                TestResource::Event("BurnResearchForRelicEvent"), // Contract
                TestResource::Contract("artificer_systems"), // Libraries
                TestResource::Library(("rng_library", "0_1_9")),
            ]
                .span(),
        }
    }

    fn contract_defs_artificer() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"artificer_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn setup_artificer_world() -> WorldStorage {
        // Set chain_id for VRF bypass in tests
        start_cheat_chain_id_global('SN_TEST');

        let mut world = spawn_test_world([namespace_def_artificer()].span());
        world.sync_perms_and_inits(contract_defs_artificer());
        world.dispatcher.uuid();

        // Set up configs
        let artificer_config = get_default_artificer_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("artificer_config"), artificer_config);

        // Active season (started, not ended)
        let season_config = get_active_season_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);

        // Capacity configs
        WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), get_capacity_config());
        WorldConfigUtilImpl::set_member(
            ref world, selector!("structure_capacity_config"), get_structure_capacity_config(),
        );

        // Set weight config for research (weightless)
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::RESEARCH, weight_gram: 0 });

        world
    }

    fn get_artificer_dispatcher(ref world: WorldStorage) -> (ContractAddress, IArtificerSystemsDispatcher) {
        let (addr, _) = world.dns(@"artificer_systems").unwrap();
        (addr, IArtificerSystemsDispatcher { contract_address: addr })
    }

    fn spawn_test_realm(ref world: WorldStorage, owner: ContractAddress) -> ID {
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
                coord_x: 100,
                coord_y: 100,
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

        // Initialize resources and weight for the structure
        ResourceImpl::initialize(ref world, structure_id);
        let structure_weight = Weight { capacity: 1000000000000000 * RESOURCE_PRECISION, weight: 0 };
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);

        structure_id
    }

    fn spawn_test_hyperstructure(ref world: WorldStorage, owner: ContractAddress) -> ID {
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
                category: StructureCategory::Hyperstructure.into(),
                coord_x: 300,
                coord_y: 300,
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
            category: StructureCategory::Hyperstructure.into(),
        };
        world.write_model_test(@structure);

        structure_id
    }

    fn grant_research(ref world: WorldStorage, structure_id: ID, amount: u128) {
        let mut structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let research_weight_grams = ResourceWeightImpl::grams(ref world, ResourceTypes::RESEARCH);
        let mut research = SingleResourceStoreImpl::retrieve(
            ref world, structure_id, ResourceTypes::RESEARCH, ref structure_weight, research_weight_grams, true,
        );
        research.add(amount, ref structure_weight, research_weight_grams);
        research.store(ref world);
        structure_weight.store(ref world, structure_id);
    }

    fn get_research_balance(ref world: WorldStorage, structure_id: ID) -> u128 {
        ResourceImpl::read_balance(ref world, structure_id, ResourceTypes::RESEARCH)
    }

    fn get_total_relic_balance(ref world: WorldStorage, structure_id: ID) -> u128 {
        use crate::constants::{RELICS_RESOURCE_END_ID, RELICS_RESOURCE_START_ID};
        let mut total: u128 = 0;
        for relic_id in RELICS_RESOURCE_START_ID..RELICS_RESOURCE_END_ID + 1 {
            total += ResourceImpl::read_balance(ref world, structure_id, relic_id);
        }
        total
    }

    // ============================================================================
    // Success Tests
    // ============================================================================

    #[test]
    fn test_burn_research_for_relic_success() {
        let mut world = setup_artificer_world();
        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = spawn_test_realm(ref world, owner);

        // Grant exact amount needed
        grant_research(ref world, realm_id, RESEARCH_COST_FOR_RELIC);

        // Record initial balances
        let initial_research = get_research_balance(ref world, realm_id);
        let initial_relics = get_total_relic_balance(ref world, realm_id);

        assert!(initial_research == RESEARCH_COST_FOR_RELIC, "initial research incorrect");
        assert!(initial_relics == 0, "should have no relics initially");

        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(realm_id);
        stop_cheat_caller_address(system_addr);

        // Verify research was burned
        let final_research = get_research_balance(ref world, realm_id);
        assert!(final_research == 0, "research should be burned");

        // Verify a relic was granted (exactly 1 relic with RESOURCE_PRECISION amount)
        let final_relics = get_total_relic_balance(ref world, realm_id);
        assert!(final_relics == RESOURCE_PRECISION, "should have received exactly 1 relic");
    }

    // ============================================================================
    // Failure Tests
    // ============================================================================

    #[test]
    #[should_panic(expected: "structure is not a realm or village")]
    fn test_burn_research_for_relic_hyperstructure_fails() {
        let mut world = setup_artificer_world();
        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'hyper_owner'>();
        let hyper_id = spawn_test_hyperstructure(ref world, owner);

        let research_amount = RESEARCH_COST_FOR_RELIC;
        grant_research(ref world, hyper_id, research_amount);

        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(hyper_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Insufficient Balance: RESEARCH")]
    fn test_burn_research_for_relic_insufficient_research_fails() {
        let mut world = setup_artificer_world();
        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = spawn_test_realm(ref world, owner);

        // Grant less than needed (1 unit short)
        let research_amount = RESEARCH_COST_FOR_RELIC - 1;
        grant_research(ref world, realm_id, research_amount);

        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(realm_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Insufficient Balance: RESEARCH")]
    fn test_burn_research_for_relic_zero_research_fails() {
        let mut world = setup_artificer_world();
        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = spawn_test_realm(ref world, owner);

        // Don't grant any research
        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(realm_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "The game starts in")]
    fn test_burn_research_for_relic_season_not_started_fails() {
        let mut world = setup_artificer_world();
        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = spawn_test_realm(ref world, owner);

        let research_amount = RESEARCH_COST_FOR_RELIC;
        grant_research(ref world, realm_id, research_amount);

        // Set timestamp before season start (season starts at 100)
        start_cheat_block_timestamp_global(50);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(realm_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Season is over")]
    fn test_burn_research_for_relic_season_ended_fails() {
        let mut world = setup_artificer_world();

        // Override with ended season config
        let ended_season_config = get_ended_season_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), ended_season_config);

        let (system_addr, dispatcher) = get_artificer_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_id = spawn_test_realm(ref world, owner);

        let research_amount = RESEARCH_COST_FOR_RELIC;
        grant_research(ref world, realm_id, research_amount);

        // Set timestamp after season end (season ends at 500)
        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, owner);
        dispatcher.burn_research_for_relic(realm_id);
        stop_cheat_caller_address(system_addr);
    }
}
