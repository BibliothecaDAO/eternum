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
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, WORLD_CONFIG_ID};
    use crate::models::config::{FaithConfig, SeasonConfig, WorldConfigUtilImpl};
    use crate::models::faith::{
        FaithfulStructure, PlayerTotalFaithPoints, WonderFaith, WonderFaithBlacklist, WonderFaithWinner,
    };
    use crate::models::position::Coord;
    use crate::models::stamina::Stamina;
    use crate::models::structure::{Structure, StructureBase, StructureCategory, StructureMetadata, Wonder};
    use crate::models::troop::{GuardTroops, TroopBoosts, TroopTier, TroopType, Troops};
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};

    // ============================================================================
    // Test Setup
    // ============================================================================

    fn get_default_faith_config() -> FaithConfig {
        FaithConfig {
            enabled: true,
            wonder_base_fp_per_sec: 50,
            holy_site_fp_per_sec: 50,
            realm_fp_per_sec: 10,
            village_fp_per_sec: 1,
            owner_share_percent: 3000 // 30%
        }
    }

    fn get_active_season_config() -> SeasonConfig {
        SeasonConfig {
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 0, // Not ended
            end_grace_seconds: 3600,
            registration_grace_seconds: 3600,
            dev_mode_on: false,
        }
    }

    fn namespace_def_faith() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // Core config
                TestResource::Model("WorldConfig"), // Structure models
                TestResource::Model("Structure"),
                TestResource::Model("StructureOwnerStats"), TestResource::Model("Wonder"),
                // Faith models
                TestResource::Model("WonderFaith"), TestResource::Model("FaithfulStructure"),
                TestResource::Model("PlayerTotalFaithPoints"), TestResource::Model("WonderFaithWinner"),
                TestResource::Model("WonderFaithBlacklist"), // Events
                TestResource::Event("StoryEvent"),
                // Contract
                TestResource::Contract("faith_systems"),
            ]
                .span(),
        }
    }

    fn contract_defs_faith() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"faith_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn setup_faith_world() -> WorldStorage {
        let mut world = spawn_test_world([namespace_def_faith()].span());
        world.sync_perms_and_inits(contract_defs_faith());
        world.dispatcher.uuid();

        // Set up configs
        let faith_config = get_default_faith_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("faith_config"), faith_config);

        // Active season (started, not ended)
        let season_config = get_active_season_config();
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);

        world
    }

    fn get_faith_dispatcher(ref world: WorldStorage) -> (ContractAddress, IFaithSystemsDispatcher) {
        let (addr, _) = world.dns(@"faith_systems").unwrap();
        (addr, IFaithSystemsDispatcher { contract_address: addr })
    }

    fn spawn_test_wonder(ref world: WorldStorage, owner: ContractAddress, coord: Coord) -> ID {
        let structure_id = world.dispatcher.uuid();

        let default_troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            battle_cooldown_end: 0,
            boosts: Default::default(),
        };

        // Wonders don't have their own StructureCategory - they're Realms with a Wonder model entry
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
                coord_x: coord.x,
                coord_y: coord.y,
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
                realm_id: 0, order: 1, has_wonder: true, villages_count: 0, village_realm: 0,
            },
            category: StructureCategory::Realm.into(),
        };
        world.write_model_test(@structure);

        // Create Wonder model - this is what makes the structure a "wonder"
        let wonder = Wonder { structure_id: structure_id, coord: coord, realm_id: 1 };
        world.write_model_test(@wonder);

        structure_id
    }

    fn spawn_test_realm(ref world: WorldStorage, owner: ContractAddress, coord: Coord) -> ID {
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
                coord_x: coord.x,
                coord_y: coord.y,
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

        structure_id
    }

    fn spawn_test_village(ref world: WorldStorage, owner: ContractAddress, coord: Coord) -> ID {
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
                category: StructureCategory::Village.into(),
                coord_x: coord.x,
                coord_y: coord.y,
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
                realm_id: 0, order: 1, has_wonder: false, villages_count: 0, village_realm: 0,
            },
            category: StructureCategory::Village.into(),
        };
        world.write_model_test(@structure);

        structure_id
    }

    // ============================================================================
    // Unit Tests - FP Rate Calculations
    // ============================================================================

    #[test]
    fn test_faith_config_structure() {
        let config = get_default_faith_config();
        assert!(config.enabled, "Faith should be enabled");
        assert!(config.wonder_base_fp_per_sec == 50, "Wonder base FP should be 50");
        assert!(config.owner_share_percent == 3000, "Owner share should be 30%");
    }

    #[test]
    fn test_fp_rate_calculation_wonder() {
        // 30% of 50 = 15 to owner
        let to_owner: u16 = (50_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 50 - to_owner;
        assert!(to_owner == 15, "Owner should get 15 FP/sec");
        assert!(to_pledger == 35, "Pledger should get 35 FP/sec");
    }

    #[test]
    fn test_fp_rate_calculation_realm() {
        // 30% of 10 = 3 to owner
        let to_owner: u16 = (10_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 10 - to_owner;
        assert!(to_owner == 3, "Owner should get 3 FP/sec");
        assert!(to_pledger == 7, "Pledger should get 7 FP/sec");
    }

    #[test]
    fn test_fp_rate_calculation_village() {
        // 30% of 1 = 0 to owner (integer division)
        let to_owner: u16 = (1_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 1 - to_owner;
        assert!(to_owner == 0, "Owner should get 0 FP/sec (integer division)");
        assert!(to_pledger == 1, "Pledger should get 1 FP/sec");
    }

    #[test]
    fn test_points_accumulation_over_time() {
        let fp_per_sec: u16 = 50;
        let time_elapsed: u64 = 3600; // 1 hour
        let expected_points: u128 = fp_per_sec.into() * time_elapsed.into();
        assert!(expected_points == 180000, "Should accumulate 180000 FP in 1 hour");
    }

    // ============================================================================
    // Integration Tests - Pledge Faith
    // ============================================================================

    #[test]
    fn test_wonder_self_pledge_success() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, coord);

        // Set block timestamp
        start_cheat_block_timestamp_global(1000);

        // Wonder owner pledges wonder to itself
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify WonderFaith state
        let wonder_faith: WonderFaith = world.read_model(wonder_id);
        assert!(wonder_faith.num_structures_pledged == 1, "Should have 1 structure pledged");
        assert!(wonder_faith.claim_per_sec == 50, "Should have 50 FP/sec (15+35)");
        assert!(wonder_faith.last_recorded_owner == wonder_owner, "Should record owner");

        // Verify FaithfulStructure state
        let faithful: FaithfulStructure = world.read_model(wonder_id);
        assert!(faithful.wonder_id == wonder_id, "Should be faithful to itself");
        assert!(faithful.fp_to_wonder_owner_per_sec == 15, "Owner share should be 15");
        assert!(faithful.fp_to_struct_owner_per_sec == 35, "Pledger share should be 35");
    }

    #[test]
    fn test_realm_pledge_to_wonder_success() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // First, wonder owner must self-pledge to activate
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Realm owner pledges realm to wonder
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify WonderFaith state
        let wonder_faith: WonderFaith = world.read_model(wonder_id);
        assert!(wonder_faith.num_structures_pledged == 2, "Should have 2 structures pledged");
        // Wonder: 50 (15+35), Realm: 10 (3+7) = 60 total
        assert!(wonder_faith.claim_per_sec == 60, "Should have 60 FP/sec total");

        // Verify realm's faithful structure
        let faithful: FaithfulStructure = world.read_model(realm_id);
        assert!(faithful.wonder_id == wonder_id, "Realm should be faithful to wonder");
        assert!(faithful.fp_to_wonder_owner_per_sec == 3, "Owner share should be 3");
        assert!(faithful.fp_to_struct_owner_per_sec == 7, "Pledger share should be 7");

        // Verify player rates
        let wonder_owner_fp: PlayerTotalFaithPoints = world.read_model(wonder_owner);
        // Wonder self-pledge gives 15 as owner, realm pledge gives 3 as owner = 18
        assert!(wonder_owner_fp.points_per_sec_as_owner == 18, "Wonder owner should earn 18 FP/sec as owner");

        let realm_owner_fp: PlayerTotalFaithPoints = world.read_model(realm_owner);
        assert!(realm_owner_fp.points_per_sec_as_pledger == 7, "Realm owner should earn 7 FP/sec as pledger");
    }

    #[test]
    #[should_panic(expected: "Only wonder owner can self-pledge")]
    fn test_self_pledge_by_non_owner_fails() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let attacker = starknet::contract_address_const::<'attacker'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        start_cheat_block_timestamp_global(1000);

        // Attacker tries to self-pledge wonder
        start_cheat_caller_address(system_addr, attacker);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_pledge_structure_not_owned_fails() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let attacker = starknet::contract_address_const::<'attacker'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Attacker tries to pledge someone else's realm
        start_cheat_caller_address(system_addr, attacker);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Invalid wonder")]
    fn test_pledge_to_invalid_wonder_fails() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 20, y: 20 };
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Try to pledge to a non-existent wonder (ID 999)
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, 999);
        stop_cheat_caller_address(system_addr);
    }

    // ============================================================================
    // Integration Tests - Blacklist
    // ============================================================================

    #[test]
    #[should_panic(expected: "Structure is blacklisted")]
    fn test_blacklisted_structure_cannot_pledge() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);

        // Blacklist the realm
        let realm_id_felt: felt252 = realm_id.into();
        dispatcher.blacklist(wonder_id, realm_id_felt);
        stop_cheat_caller_address(system_addr);

        // Realm owner tries to pledge blacklisted realm
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Address is blacklisted")]
    fn test_blacklisted_address_cannot_pledge() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);

        // Blacklist the realm owner's address
        let owner_felt: felt252 = realm_owner.into();
        dispatcher.blacklist(wonder_id, owner_felt);
        stop_cheat_caller_address(system_addr);

        // Realm owner tries to pledge
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_unblacklist_allows_pledge() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges and blacklists realm
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        let realm_id_felt: felt252 = realm_id.into();
        dispatcher.blacklist(wonder_id, realm_id_felt);

        // Unblacklist the realm
        dispatcher.unblacklist(wonder_id, realm_id_felt);
        stop_cheat_caller_address(system_addr);

        // Realm owner can now pledge
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify pledge succeeded
        let faithful: FaithfulStructure = world.read_model(realm_id);
        assert!(faithful.wonder_id == wonder_id, "Realm should be faithful after unblacklist");
    }

    #[test]
    #[should_panic(expected: "Only wonder owner can blacklist")]
    fn test_non_owner_cannot_blacklist() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let attacker = starknet::contract_address_const::<'attacker'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        start_cheat_block_timestamp_global(1000);

        // Attacker tries to blacklist
        start_cheat_caller_address(system_addr, attacker);
        dispatcher.blacklist(wonder_id, 123);
        stop_cheat_caller_address(system_addr);
    }

    // ============================================================================
    // Integration Tests - Remove Faith
    // ============================================================================

    #[test]
    fn test_structure_owner_can_remove_own_faith() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Setup pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);

        // Realm owner removes their own faith
        dispatcher.remove_faith(realm_id);
        stop_cheat_caller_address(system_addr);

        // Verify removal
        let faithful: FaithfulStructure = world.read_model(realm_id);
        assert!(faithful.wonder_id == 0, "Realm should no longer be faithful");

        let wonder_faith: WonderFaith = world.read_model(wonder_id);
        assert!(wonder_faith.num_structures_pledged == 1, "Only wonder self-pledge should remain");
        assert!(wonder_faith.claim_per_sec == 50, "Only wonder FP rate should remain");
    }

    #[test]
    fn test_wonder_owner_can_remove_pledged_structure() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Setup pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Wonder owner removes the realm's faith
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.remove_faith(realm_id);
        stop_cheat_caller_address(system_addr);

        // Verify removal
        let faithful: FaithfulStructure = world.read_model(realm_id);
        assert!(faithful.wonder_id == 0, "Realm should no longer be faithful");
    }

    #[test]
    #[should_panic(expected: "Only structure owner or wonder owner can remove")]
    fn test_unauthorized_cannot_remove_faith() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let attacker = starknet::contract_address_const::<'attacker'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Setup pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Attacker tries to remove
        start_cheat_caller_address(system_addr, attacker);
        dispatcher.remove_faith(realm_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Cannot remove self while others are pledged")]
    fn test_wonder_cannot_remove_self_while_others_pledged() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Setup pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Wonder owner tries to remove self-pledge while realm is still pledged
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.remove_faith(wonder_id);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_wonder_can_remove_self_when_alone() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);

        // Wonder removes self-pledge (should succeed since no others are pledged)
        dispatcher.remove_faith(wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify removal
        let faithful: FaithfulStructure = world.read_model(wonder_id);
        assert!(faithful.wonder_id == 0, "Wonder should no longer be self-faithful");

        let wonder_faith: WonderFaith = world.read_model(wonder_id);
        assert!(wonder_faith.num_structures_pledged == 0, "No structures should be pledged");
        assert!(wonder_faith.claim_per_sec == 0, "FP rate should be 0");
    }

    // ============================================================================
    // Integration Tests - Double Pledge / Re-pledge
    // ============================================================================

    #[test]
    fn test_structure_can_switch_wonders() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder1_owner = starknet::contract_address_const::<'wonder1_owner'>();
        let wonder2_owner = starknet::contract_address_const::<'wonder2_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder1_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder2_coord = Coord { alt: false, x: 30, y: 30 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder1_id = spawn_test_wonder(ref world, wonder1_owner, wonder1_coord);
        let wonder2_id = spawn_test_wonder(ref world, wonder2_owner, wonder2_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Both wonders self-pledge
        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.pledge_faith(wonder1_id, wonder1_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, wonder2_owner);
        dispatcher.pledge_faith(wonder2_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Realm pledges to wonder1
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder1_id);
        stop_cheat_caller_address(system_addr);

        // Verify initial state
        let wonder1_faith: WonderFaith = world.read_model(wonder1_id);
        assert!(wonder1_faith.num_structures_pledged == 2, "Wonder1 should have 2 pledges");

        // Realm switches to wonder2 (automatic removal from wonder1)
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Verify switch
        let wonder1_faith_after: WonderFaith = world.read_model(wonder1_id);
        assert!(wonder1_faith_after.num_structures_pledged == 1, "Wonder1 should have only self-pledge");

        let wonder2_faith: WonderFaith = world.read_model(wonder2_id);
        assert!(wonder2_faith.num_structures_pledged == 2, "Wonder2 should have self + realm");

        let faithful: FaithfulStructure = world.read_model(realm_id);
        assert!(faithful.wonder_id == wonder2_id, "Realm should be faithful to wonder2");
    }

    // ============================================================================
    // Integration Tests - Wonder Submission
    // ============================================================================

    #[test]
    fn test_wonder_can_submit_to_another_wonder_when_empty() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder1_owner = starknet::contract_address_const::<'wonder1_owner'>();
        let wonder2_owner = starknet::contract_address_const::<'wonder2_owner'>();

        let wonder1_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder2_coord = Coord { alt: false, x: 30, y: 30 };

        let wonder1_id = spawn_test_wonder(ref world, wonder1_owner, wonder1_coord);
        let wonder2_id = spawn_test_wonder(ref world, wonder2_owner, wonder2_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder2 self-pledges (target)
        start_cheat_caller_address(system_addr, wonder2_owner);
        dispatcher.pledge_faith(wonder2_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Wonder1 submits to Wonder2 (wonder1 never self-pledged, so num_structures_pledged == 0)
        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.pledge_faith(wonder1_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Verify submission
        let faithful: FaithfulStructure = world.read_model(wonder1_id);
        assert!(faithful.wonder_id == wonder2_id, "Wonder1 should be faithful to Wonder2");

        let wonder2_faith: WonderFaith = world.read_model(wonder2_id);
        // Wonder2 self-pledge (50) + Wonder1 submission (50) = 100
        assert!(wonder2_faith.claim_per_sec == 100, "Wonder2 should have 100 FP/sec");
    }

    #[test]
    #[should_panic(expected: "Cannot submit wonder with active pledges")]
    fn test_wonder_cannot_submit_with_active_pledges() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder1_owner = starknet::contract_address_const::<'wonder1_owner'>();
        let wonder2_owner = starknet::contract_address_const::<'wonder2_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder1_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder2_coord = Coord { alt: false, x: 30, y: 30 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder1_id = spawn_test_wonder(ref world, wonder1_owner, wonder1_coord);
        let wonder2_id = spawn_test_wonder(ref world, wonder2_owner, wonder2_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Both wonders self-pledge
        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.pledge_faith(wonder1_id, wonder1_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, wonder2_owner);
        dispatcher.pledge_faith(wonder2_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Realm pledges to wonder1
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder1_id);
        stop_cheat_caller_address(system_addr);

        // Wonder1 has active pledges (self + realm), cannot submit to wonder2
        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.pledge_faith(wonder1_id, wonder2_id);
        stop_cheat_caller_address(system_addr);
    }

    // ============================================================================
    // Integration Tests - Points Accumulation
    // ============================================================================

    #[test]
    fn test_points_accumulate_over_time() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        // Start at time 1000
        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Advance time by 100 seconds
        start_cheat_block_timestamp_global(1100);

        // Claim points
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.claim_faith_points(wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify accumulated points
        let wonder_faith: WonderFaith = world.read_model(wonder_id);
        // 50 FP/sec * 100 seconds = 5000 FP
        assert!(wonder_faith.claimed_points == 5000, "Should have 5000 claimed points");

        // Verify player points
        let player_fp: PlayerTotalFaithPoints = world.read_model(wonder_owner);
        // Both owner share (15) and pledger share (35) go to same person = 50 * 100 = 5000
        // But player rates are tracked separately
        assert!(player_fp.points_per_sec_as_owner == 15, "Should have 15 FP/sec as owner");
        assert!(player_fp.points_per_sec_as_pledger == 35, "Should have 35 FP/sec as pledger");
    }

    #[test]
    fn test_get_pending_faith_points() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Advance time by 100 seconds
        start_cheat_block_timestamp_global(1100);

        // Check pending points (without claiming)
        let pending = dispatcher.get_pending_faith_points(wonder_owner);
        // 50 FP/sec * 100 seconds = 5000 FP
        assert!(pending == 5000, "Should have 5000 pending points");
    }

    #[test]
    fn test_get_wonder_fp_rate() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let realm_owner = starknet::contract_address_const::<'realm_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Initially no pledges
        let rate0 = dispatcher.get_wonder_fp_rate(wonder_id);
        assert!(rate0 == 0, "Should have 0 FP/sec initially");

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        let rate1 = dispatcher.get_wonder_fp_rate(wonder_id);
        assert!(rate1 == 50, "Should have 50 FP/sec after self-pledge");

        // Realm pledges
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        let rate2 = dispatcher.get_wonder_fp_rate(wonder_id);
        assert!(rate2 == 60, "Should have 60 FP/sec after realm pledge");
    }

    // ============================================================================
    // Integration Tests - Leaderboard
    // ============================================================================

    #[test]
    fn test_leaderboard_updates_correctly() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder1_owner = starknet::contract_address_const::<'wonder1_owner'>();
        let wonder2_owner = starknet::contract_address_const::<'wonder2_owner'>();

        let wonder1_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder2_coord = Coord { alt: false, x: 30, y: 30 };

        let wonder1_id = spawn_test_wonder(ref world, wonder1_owner, wonder1_coord);
        let wonder2_id = spawn_test_wonder(ref world, wonder2_owner, wonder2_coord);

        start_cheat_block_timestamp_global(1000);

        // Both wonders self-pledge
        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.pledge_faith(wonder1_id, wonder1_id);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, wonder2_owner);
        dispatcher.pledge_faith(wonder2_id, wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Advance time and claim for wonder1
        start_cheat_block_timestamp_global(2000);

        start_cheat_caller_address(system_addr, wonder1_owner);
        dispatcher.claim_faith_points(wonder1_id);
        stop_cheat_caller_address(system_addr);

        // Wonder1 should be leader: 50 * 1000 = 50000
        let winner: WonderFaithWinner = world.read_model(WORLD_CONFIG_ID);
        assert!(winner.wonder_id == wonder1_id, "Wonder1 should be leader");
        assert!(winner.claimed_points == 50000, "Leader should have 50000 points");

        // Advance more time and claim for wonder2
        start_cheat_block_timestamp_global(4000);

        start_cheat_caller_address(system_addr, wonder2_owner);
        dispatcher.claim_faith_points(wonder2_id);
        stop_cheat_caller_address(system_addr);

        // Wonder2: 50 * 3000 = 150000 > Wonder1's 50000
        let winner_after: WonderFaithWinner = world.read_model(WORLD_CONFIG_ID);
        assert!(winner_after.wonder_id == wonder2_id, "Wonder2 should now be leader");
        assert!(winner_after.claimed_points == 150000, "Leader should have 150000 points");
    }

    // ============================================================================
    // Edge Cases - Same Owner Pledge
    // ============================================================================

    #[test]
    fn test_same_owner_pledges_realm_to_own_wonder() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let owner = starknet::contract_address_const::<'owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, owner, wonder_coord);
        let realm_id = spawn_test_realm(ref world, owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Owner self-pledges wonder
        start_cheat_caller_address(system_addr, owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);

        // Same owner pledges their realm to their wonder
        dispatcher.pledge_faith(realm_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify player rates - owner gets BOTH sides
        let player_fp: PlayerTotalFaithPoints = world.read_model(owner);
        // From wonder self-pledge: 15 owner + 35 pledger
        // From realm pledge: 3 owner + 7 pledger
        // Total owner: 15 + 3 = 18
        // Total pledger: 35 + 7 = 42
        assert!(player_fp.points_per_sec_as_owner == 18, "Should have 18 FP/sec as owner");
        assert!(player_fp.points_per_sec_as_pledger == 42, "Should have 42 FP/sec as pledger");

        // Advance time and verify points
        start_cheat_block_timestamp_global(1100);
        let pending = dispatcher.get_pending_faith_points(owner);
        // (18 + 42) * 100 = 6000
        assert!(pending == 6000, "Should have 6000 pending points");
    }

    // ============================================================================
    // Edge Cases - Village Pledging
    // ============================================================================

    #[test]
    fn test_village_pledge_integer_division() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let village_owner = starknet::contract_address_const::<'village_owner'>();

        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let village_coord = Coord { alt: false, x: 20, y: 20 };

        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);
        let village_id = spawn_test_village(ref world, village_owner, village_coord);

        start_cheat_block_timestamp_global(1000);

        // Wonder self-pledges
        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Village pledges
        start_cheat_caller_address(system_addr, village_owner);
        dispatcher.pledge_faith(village_id, wonder_id);
        stop_cheat_caller_address(system_addr);

        // Verify village's FP rates (30% of 1 = 0 due to integer division)
        let faithful: FaithfulStructure = world.read_model(village_id);
        assert!(faithful.fp_to_wonder_owner_per_sec == 0, "Village owner share should be 0 (integer division)");
        assert!(faithful.fp_to_struct_owner_per_sec == 1, "Village pledger share should be 1");

        // Wonder owner's rate should NOT increase from village owner share (it's 0)
        let wonder_owner_fp: PlayerTotalFaithPoints = world.read_model(wonder_owner);
        assert!(
            wonder_owner_fp.points_per_sec_as_owner == 15, "Wonder owner should still have 15 from self-pledge only",
        );
    }

    // ============================================================================
    // Edge Cases - Structure Not Faithful
    // ============================================================================

    #[test]
    #[should_panic(expected: "Structure not faithful to any wonder")]
    fn test_remove_faith_when_not_faithful() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 20, y: 20 };
        let realm_id = spawn_test_realm(ref world, realm_owner, realm_coord);

        start_cheat_block_timestamp_global(1000);

        // Try to remove faith when realm is not faithful
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.remove_faith(realm_id);
        stop_cheat_caller_address(system_addr);
    }

    // ============================================================================
    // Edge Cases - Faith System Disabled
    // ============================================================================

    #[test]
    #[should_panic(expected: "Faith system is not enabled")]
    fn test_pledge_when_faith_disabled() {
        let mut world = setup_faith_world();
        let (system_addr, dispatcher) = get_faith_dispatcher(ref world);

        // Disable faith system
        let disabled_config = FaithConfig {
            enabled: false,
            wonder_base_fp_per_sec: 50,
            holy_site_fp_per_sec: 50,
            realm_fp_per_sec: 10,
            village_fp_per_sec: 1,
            owner_share_percent: 3000,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("faith_config"), disabled_config);

        let wonder_owner = starknet::contract_address_const::<'wonder_owner'>();
        let wonder_coord = Coord { alt: false, x: 10, y: 10 };
        let wonder_id = spawn_test_wonder(ref world, wonder_owner, wonder_coord);

        start_cheat_block_timestamp_global(1000);

        start_cheat_caller_address(system_addr, wonder_owner);
        dispatcher.pledge_faith(wonder_id, wonder_id);
        stop_cheat_caller_address(system_addr);
    }
}
