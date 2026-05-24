//! Combat Battle Tests (snforge/dojo_snf_test)
//!
//! These tests use snforge with dojo_snf_test for testing combat systems.

#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
    use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{VictoryPointsGrantConfig, WorldConfigUtilImpl};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::models::map::{Tile, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::resource::resource::ResourceImpl;
    use crate::models::structure::{
        Structure, StructureBase, StructureBaseStoreImpl, StructureCategory, StructureMetadata, StructureOwnerStoreImpl,
        StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use crate::models::troop::{
        ExplorerTroops, GuardSlot, GuardTrait, GuardTroops, TroopLimitTrait, TroopTier, TroopType, Troops,
    };
    use crate::models::weight::Weight;
    use crate::systems::combat::contracts::troop_battle::{
        ITroopBattleSystemsDispatcher, ITroopBattleSystemsDispatcherTrait,
    };
    use crate::utils::testing::helpers::{
        MOCK_TICK_CONFIG, MOCK_TROOP_LIMIT_CONFIG, RealmTestContext, attack_explorer_vs_explorer,
        attack_explorer_vs_guard, attack_guard_vs_explorer, create_explorer, get_combat_systems, get_explorer,
        setup_battle_world, setup_explorer_battle, setup_guard_battle, spawn_combat_world, spawn_test_realm,
        spawn_world_minimal, tgrant_resources,
    };

    fn empty_troops() -> Troops {
        Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Default::default(),
            boosts: Default::default(),
            battle_cooldown_end: 0,
        }
    }

    fn empty_guards() -> GuardTroops {
        let troops = empty_troops();
        GuardTroops {
            delta: troops,
            charlie: troops,
            bravo: troops,
            alpha: troops,
            delta_destroyed_tick: 0,
            charlie_destroyed_tick: 0,
            bravo_destroyed_tick: 0,
            alpha_destroyed_tick: 0,
        }
    }

    fn spawn_test_structure(
        ref world: WorldStorage, owner: starknet::ContractAddress, category: StructureCategory, coord: Coord,
    ) -> u32 {
        let structure_id = world.dispatcher.uuid();
        let guard_count = if category == StructureCategory::Hyperstructure {
            4
        } else {
            1
        };
        let structure = Structure {
            entity_id: structure_id,
            owner,
            base: StructureBase {
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: guard_count,
                troop_max_explorer_count: 0,
                created_at: starknet::get_block_timestamp().try_into().unwrap(),
                category: category.into(),
                coord_x: coord.x,
                coord_y: coord.y,
                level: 3,
                starting_troops_granted: false,
            },
            troop_guards: empty_guards(),
            troop_explorers: array![].span(),
            resources_packed: 0,
            metadata: StructureMetadata {
                realm_id: 0, order: 0, has_wonder: false, villages_count: 0, village_realm: 0,
            },
            category: category.into(),
        };
        world.write_model_test(@structure);

        ResourceImpl::initialize(ref world, structure_id);
        let structure_capacity: u128 = 1000000000000000 * RESOURCE_PRECISION;
        ResourceImpl::write_weight(ref world, structure_id, Weight { capacity: structure_capacity, weight: 0 });

        let tile = Tile {
            alt: coord.alt,
            col: coord.x,
            row: coord.y,
            biome: 1,
            occupier_id: structure_id,
            occupier_type: match category {
                StructureCategory::Hyperstructure => TileOccupier::HyperstructureLevel1.into(),
                _ => TileOccupier::FragmentMine.into(),
            },
            occupier_is_structure: true,
            reward_extracted: false,
        };
        let tile_opt: TileOpt = tile.into();
        world.write_model_test(@tile_opt);

        structure_id
    }

    fn seed_delta_guard(ref world: WorldStorage, structure_id: u32, category: TroopType, tier: TroopTier, count: u128) {
        let mut guards = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
        let mut base = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        let mut troops = empty_troops();
        troops.category = category;
        troops.tier = tier;
        troops.count = count;
        guards.to_slot(GuardSlot::Delta, troops, 0);
        base.troop_guard_count = 1;
        StructureTroopGuardStoreImpl::store(ref guards, ref world, structure_id);
        StructureBaseStoreImpl::store(ref base, ref world, structure_id);
    }

    // ========================================================================
    // Basic World Tests
    // ========================================================================

    #[test]
    fn test_world_spawns() {
        let world = spawn_world_minimal();
        assert!(world.dispatcher.contract_address.is_non_zero(), "World should exist");
    }

    #[test]
    fn test_explorer_can_be_created() {
        let mut world = spawn_world_minimal();

        let explorer_id: u32 = 1;
        let owner_id: u32 = 100;
        let explorer = ExplorerTroops {
            explorer_id,
            owner: owner_id,
            coord: Coord { alt: false, x: 10, y: 10 },
            troops: Troops {
                category: TroopType::Crossbowman,
                tier: TroopTier::T2,
                count: 1000 * RESOURCE_PRECISION,
                stamina: Default::default(),
                boosts: Default::default(),
                battle_cooldown_end: 0,
            },
        };
        world.write_model_test(@explorer);

        let read_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(read_explorer.owner == owner_id, "Explorer should have correct owner");
        assert!(read_explorer.troops.count == 1000 * RESOURCE_PRECISION, "Explorer should have correct troop count");
    }

    #[test]
    fn test_systems_can_be_deployed() {
        let mut world = spawn_combat_world();
        let systems = get_combat_systems(ref world);

        assert!(systems.troop_management.is_non_zero(), "Troop management system should be deployed");
        assert!(systems.troop_movement.is_non_zero(), "Troop movement system should be deployed");
        assert!(systems.troop_battle.is_non_zero(), "Troop battle system should be deployed");
    }

    #[test]
    fn test_library_can_be_found() {
        let world = spawn_combat_world();

        let result = world.dns(@"structure_creation_library_v0_1_17");
        assert!(result.is_some(), "structure_creation_library_v0_1_17 should be found");

        let (_addr, class_hash) = result.unwrap();
        assert!(class_hash.is_non_zero(), "Library class_hash should be non-zero");
    }

    // ========================================================================
    // Explorer vs Explorer Battle Tests
    // ========================================================================

    #[test]
    fn test_explorer_vs_explorer_one_dies() {
        // Setup battle: Crossbowman T2 vs Paladin T3 (T3 wins)
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Crossbowman, TroopTier::T2, TroopType::Paladin, TroopTier::T3,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

        // Attack
        attack_explorer_vs_explorer(ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West);

        // Verify battle results
        let first = get_explorer(ref world, first_explorer.explorer_id);
        let second = get_explorer(ref world, second_explorer.explorer_id);

        assert!(first.troops.count < troop_amount, "First explorer should have taken damage");
        assert!(second.troops.count < troop_amount, "Second explorer should have taken damage");
        assert!(second.troops.count > first.troops.count, "Paladin T3 should win vs Crossbowman T2");

        // If loser died, verify cleanup
        if first.troops.count.is_zero() {
            let explorers_list: Span<u32> = StructureTroopExplorerStoreImpl::retrieve(
                ref world, first_explorer.realm_id,
            );
            assert!(explorers_list.is_empty(), "Dead explorer should be removed from structure");

            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, first_explorer.realm_id);
            assert!(structure_base.troop_explorer_count.is_zero(), "Structure explorer count should be 0");
        }
    }

    #[test]
    fn test_explorer_vs_explorer_both_live() {
        // Setup battle: Knight T1 vs Knight T1 (same tier = both survive)
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

        // Attack
        attack_explorer_vs_explorer(ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West);

        // Verify both survived with damage
        let first = get_explorer(ref world, first_explorer.explorer_id);
        let second = get_explorer(ref world, second_explorer.explorer_id);

        assert!(first.troops.count < troop_amount, "First explorer should have taken damage");
        assert!(second.troops.count < troop_amount, "Second explorer should have taken damage");
        assert!(first.troops.count > 0, "First explorer should survive");
        assert!(second.troops.count > 0, "Second explorer should survive");
    }

    // ========================================================================
    // Explorer vs Explorer Failure Tests
    // ========================================================================

    #[test]
    #[should_panic(expected: ('Not Owner',))]
    fn test_explorer_vs_explorer__fails_not_owner() {
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with an unknown address (not the owner)
        let unknown_address = starknet::contract_address_const::<'unknown'>();
        let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

        start_cheat_caller_address(systems.troop_battle, unknown_address);
        dispatcher
            .attack_explorer_vs_explorer(
                second_explorer.explorer_id, first_explorer.explorer_id, Direction::West, array![].span(),
            );
        stop_cheat_caller_address(systems.troop_battle);
    }

    #[test]
    #[should_panic(expected: "explorers are not adjacent")]
    fn test_explorer_vs_explorer__fails_not_adjacent() {
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Move second explorer's coord to be non-adjacent to first explorer
        let mut explorer: ExplorerTroops = world.read_model(second_explorer.explorer_id);
        explorer.coord = explorer.coord.neighbor_after_distance(Direction::NorthEast, 5);
        world.write_model_test(@explorer);

        let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

        start_cheat_caller_address(systems.troop_battle, second_explorer.owner);
        dispatcher
            .attack_explorer_vs_explorer(
                second_explorer.explorer_id, first_explorer.explorer_id, Direction::West, array![].span(),
            );
        stop_cheat_caller_address(systems.troop_battle);
    }

    #[test]
    #[should_panic(expected: "aggressor has no troops")]
    fn test_explorer_vs_explorer__fails_aggressor_dead() {
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the attacker's troops
        let mut attacker: ExplorerTroops = world.read_model(second_explorer.explorer_id);
        attacker.troops.count = 0;
        world.write_model_test(@attacker);

        // Try to attack with dead explorer
        attack_explorer_vs_explorer(ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West);
    }

    #[test]
    #[should_panic(expected: "defender has no troops")]
    fn test_explorer_vs_explorer__fails_defender_dead() {
        let (mut world, systems, first_explorer, second_explorer) = setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the defender's troops
        let mut defender: ExplorerTroops = world.read_model(first_explorer.explorer_id);
        defender.troops.count = 0;
        world.write_model_test(@defender);

        // Try to attack dead defender
        attack_explorer_vs_explorer(ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West);
    }

    // ========================================================================
    // Explorer vs Guard Battle Tests
    // ========================================================================

    #[test]
    fn test_explorer_vs_guard_battle() {
        // Setup: Explorer T3 vs Guard T1 (Explorer should win)
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Paladin, TroopTier::T3,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

        // Attack
        attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::West);

        // Verify battle results
        let explorer_after = get_explorer(ref world, explorer.explorer_id);
        assert!(explorer_after.troops.count < troop_amount, "Explorer should have taken damage");
        assert!(explorer_after.troops.count > 0, "Explorer T3 should survive vs Guard T1");
    }

    #[test]
    #[should_panic(expected: ('Not Owner',))]
    fn test_explorer_vs_guard__fails_not_owner() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with an unknown address (not the owner)
        let unknown_address = starknet::contract_address_const::<'unknown'>();
        let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

        start_cheat_caller_address(systems.troop_battle, unknown_address);
        dispatcher.attack_explorer_vs_guard(explorer.explorer_id, realm.entity_id, Direction::West);
        stop_cheat_caller_address(systems.troop_battle);
    }

    #[test]
    #[should_panic(expected: "aggressor has no troops")]
    fn test_explorer_vs_guard__fails_aggressor_has_no_troops() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the attacker's troops
        let mut attacker: ExplorerTroops = world.read_model(explorer.explorer_id);
        attacker.troops.count = 0;
        world.write_model_test(@attacker);

        // Try to attack with dead explorer
        attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::West);
    }

    #[test]
    #[should_panic(expected: "explorer is not adjacent to structure")]
    fn test_explorer_vs_guard__fails_not_adjacent() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Move explorer's coord to be non-adjacent to the structure
        // Structure (realm) is at (80, 80), explorer is at (81, 80)
        // Move explorer to (85, 80) which is NOT adjacent to (80, 80)
        let mut explorer_troops: ExplorerTroops = world.read_model(explorer.explorer_id);
        explorer_troops.coord = explorer_troops.coord.neighbor_after_distance(Direction::NorthEast, 5);
        world.write_model_test(@explorer_troops);

        attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::West);
    }

    #[test]
    fn test_hyperstructure_capture_garrisons_all_surviving_explorer_troops() {
        let (mut world, systems) = setup_battle_world();
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let owner = starknet::contract_address_const::<'hyper_capture_owner'>();
        let realm_id = spawn_test_realm(ref world, 1, owner, Coord { alt: false, x: 80, y: 80 });
        let hyperstructure_id = spawn_test_structure(
            ref world, Zero::zero(), StructureCategory::Hyperstructure, Coord { alt: false, x: 82, y: 80 },
        );
        let troop_amount = 1_000 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
        let explorer = create_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: realm_id, owner, coord: Coord { alt: false, x: 80, y: 80 } },
            TroopType::Paladin,
            TroopTier::T3,
            troop_amount,
            Direction::East,
        );

        attack_explorer_vs_guard(ref world, systems, explorer, hyperstructure_id, Direction::East);

        let guards = StructureTroopGuardStoreImpl::retrieve(ref world, hyperstructure_id);
        let (delta, _) = guards.from_slot(GuardSlot::Delta);
        assert!(delta.count == troop_amount, "Delta guard should receive every surviving troop");
        assert!(delta.category == TroopType::Paladin, "Delta guard category mismatch");
        assert!(delta.tier == TroopTier::T3, "Delta guard tier mismatch");

        let hyperstructure_base = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
        assert!(hyperstructure_base.troop_guard_count == 1, "Hyperstructure should have one guard slot filled");

        let source_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(source_explorers.is_empty(), "Explorer should be removed from source structure");

        let explorer_tile_opt: TileOpt = world.read_model((false, 81, 80));
        let explorer_tile: Tile = explorer_tile_opt.into();
        assert!(explorer_tile.occupier_id == 0, "Explorer tile should be empty after garrison transfer");
    }

    #[test]
    fn test_hyperstructure_recapture_auto_garrisons_new_owner() {
        let (mut world, systems) = setup_battle_world();
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let previous_owner = starknet::contract_address_const::<'previous_hyper_owner'>();
        let new_owner = starknet::contract_address_const::<'new_hyper_owner'>();
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("victory_points_grant_config"),
            VictoryPointsGrantConfig {
                hyp_points_per_second: 0,
                claim_hyperstructure_points: 500,
                claim_otherstructure_points: 0,
                explore_tiles_points: 0,
                relic_open_points: 0,
            },
        );
        let realm_id = spawn_test_realm(ref world, 1, new_owner, Coord { alt: false, x: 80, y: 80 });
        let hyperstructure_id = spawn_test_structure(
            ref world, previous_owner, StructureCategory::Hyperstructure, Coord { alt: false, x: 82, y: 80 },
        );
        let troop_amount = 1_000 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
        let explorer = create_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: realm_id, owner: new_owner, coord: Coord { alt: false, x: 80, y: 80 } },
            TroopType::Paladin,
            TroopTier::T3,
            troop_amount,
            Direction::East,
        );

        attack_explorer_vs_guard(ref world, systems, explorer, hyperstructure_id, Direction::East);

        let player_points: PlayerRegisteredPoints = world.read_model(new_owner);
        assert!(player_points.registered_points == 0, "Recapture should not grant bandit capture points");
        let hyperstructure_owner = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
        assert!(hyperstructure_owner == new_owner, "Hyperstructure owner should change on recapture");
        let guards = StructureTroopGuardStoreImpl::retrieve(ref world, hyperstructure_id);
        let (delta, _) = guards.from_slot(GuardSlot::Delta);
        assert!(delta.count == troop_amount, "Recaptured hyperstructure should receive surviving troops");
    }

    #[test]
    fn test_hyperstructure_guard_loss_auto_garrisons_surviving_defender() {
        let (mut world, systems) = setup_battle_world();
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let previous_owner = starknet::contract_address_const::<'guard_loss_hyper_owner'>();
        let new_owner = starknet::contract_address_const::<'guard_loss_explorer_owner'>();
        let realm_id = spawn_test_realm(ref world, 1, new_owner, Coord { alt: false, x: 80, y: 80 });
        let hyperstructure_coord = Coord { alt: false, x: 82, y: 80 };
        let hyperstructure_id = spawn_test_structure(
            ref world, previous_owner, StructureCategory::Hyperstructure, hyperstructure_coord,
        );
        seed_delta_guard(ref world, hyperstructure_id, TroopType::Knight, TroopTier::T1, 100 * RESOURCE_PRECISION);
        let troop_amount = 1_000 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
        let explorer = create_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: realm_id, owner: new_owner, coord: Coord { alt: false, x: 80, y: 80 } },
            TroopType::Paladin,
            TroopTier::T3,
            troop_amount,
            Direction::East,
        );

        attack_guard_vs_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: hyperstructure_id, owner: previous_owner, coord: hyperstructure_coord },
            GuardSlot::Delta,
            explorer.explorer_id,
            Direction::West,
        );

        let hyperstructure_owner = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
        assert!(hyperstructure_owner == new_owner, "Hyperstructure owner should change when guard loses");
        let guards = StructureTroopGuardStoreImpl::retrieve(ref world, hyperstructure_id);
        let (delta, _) = guards.from_slot(GuardSlot::Delta);
        assert!(delta.count.is_non_zero(), "Surviving defender should become the Delta guard");
        assert!(delta.category == TroopType::Paladin, "Delta guard category should come from surviving defender");
        assert!(delta.tier == TroopTier::T3, "Delta guard tier should come from surviving defender");
    }

    #[test]
    fn test_hyperstructure_capture_moves_explorer_cargo_to_structure() {
        let (mut world, systems) = setup_battle_world();
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let owner = starknet::contract_address_const::<'cargo_hyper_owner'>();
        let realm_id = spawn_test_realm(ref world, 1, owner, Coord { alt: false, x: 80, y: 80 });
        let hyperstructure_id = spawn_test_structure(
            ref world, Zero::zero(), StructureCategory::Hyperstructure, Coord { alt: false, x: 82, y: 80 },
        );
        let troop_amount = 1_000 * RESOURCE_PRECISION;
        let cargo_amount = 25 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
        let explorer = create_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: realm_id, owner, coord: Coord { alt: false, x: 80, y: 80 } },
            TroopType::Paladin,
            TroopTier::T3,
            troop_amount,
            Direction::East,
        );
        tgrant_resources(ref world, explorer.explorer_id, array![(ResourceTypes::WHEAT, cargo_amount)].span());

        attack_explorer_vs_guard(ref world, systems, explorer, hyperstructure_id, Direction::East);

        let hyperstructure_wheat = ResourceImpl::read_balance(ref world, hyperstructure_id, ResourceTypes::WHEAT);
        assert!(hyperstructure_wheat == cargo_amount, "Explorer cargo should move into captured hyperstructure");
    }

    #[test]
    fn test_non_hyperstructure_capture_does_not_auto_garrison() {
        let (mut world, systems) = setup_battle_world();
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);
        let owner = starknet::contract_address_const::<'mine_capture_owner'>();
        let realm_id = spawn_test_realm(ref world, 1, owner, Coord { alt: false, x: 80, y: 80 });
        let mine_id = spawn_test_structure(
            ref world, Zero::zero(), StructureCategory::FragmentMine, Coord { alt: false, x: 82, y: 80 },
        );
        let troop_amount = 1_000 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
        let explorer = create_explorer(
            ref world,
            systems,
            RealmTestContext { entity_id: realm_id, owner, coord: Coord { alt: false, x: 80, y: 80 } },
            TroopType::Paladin,
            TroopTier::T3,
            troop_amount,
            Direction::East,
        );

        attack_explorer_vs_guard(ref world, systems, explorer, mine_id, Direction::East);

        let guards = StructureTroopGuardStoreImpl::retrieve(ref world, mine_id);
        let (delta, _) = guards.from_slot(GuardSlot::Delta);
        assert!(delta.count == 0, "Non-hyperstructure captures should not auto-garrison");
        let source_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(source_explorers.len() == 1, "Explorer should remain after non-hyperstructure capture");
    }

    // ========================================================================
    // Guard vs Explorer Battle Tests
    // ========================================================================

    #[test]
    fn test_guard_vs_explorer_battle() {
        // Setup: Guard T3 vs Explorer T1 (Guard should win)
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Paladin, TroopTier::T3, TroopType::Knight, TroopTier::T1,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

        // Attack
        attack_guard_vs_explorer(ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::East);

        // Verify battle results
        let explorer_after = get_explorer(ref world, explorer.explorer_id);
        assert!(explorer_after.troops.count < troop_amount, "Explorer should have taken damage");
    }

    #[test]
    #[should_panic(expected: ('Not Owner',))]
    fn test_guard_vs_explorer__fails_not_owner() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with an unknown address (not the owner)
        let unknown_address = starknet::contract_address_const::<'unknown'>();
        let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

        start_cheat_caller_address(systems.troop_battle, unknown_address);
        dispatcher.attack_guard_vs_explorer(realm.entity_id, GuardSlot::Delta, explorer.explorer_id, Direction::East);
        stop_cheat_caller_address(systems.troop_battle);
    }

    #[test]
    #[should_panic(expected: "slot can't be selected")]
    fn test_guard_vs_explorer__fails_guard_slot_not_selectable() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with an empty guard slot (Alpha instead of Delta)
        attack_guard_vs_explorer(ref world, systems, realm, GuardSlot::Alpha, explorer.explorer_id, Direction::East);
    }

    #[test]
    #[should_panic(expected: "defender has no troops")]
    fn test_guard_vs_explorer__fails_defender_has_no_troops() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the defender's troops
        let mut defender: ExplorerTroops = world.read_model(explorer.explorer_id);
        defender.troops.count = 0;
        world.write_model_test(@defender);

        // Try to attack dead defender
        attack_guard_vs_explorer(ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::East);
    }

    #[test]
    #[should_panic(expected: "structure is not adjacent to explorer")]
    fn test_guard_vs_explorer__fails_not_adjacent() {
        let (mut world, systems, realm, explorer) = setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Move explorer's coord to be non-adjacent to the structure
        // Structure (realm) is at (80, 80), explorer is at (81, 80)
        // Move explorer to (85, 80) which is NOT adjacent to (80, 80)
        let mut explorer_troops: ExplorerTroops = world.read_model(explorer.explorer_id);
        explorer_troops.coord = explorer_troops.coord.neighbor_after_distance(Direction::NorthEast, 5);
        world.write_model_test(@explorer_troops);

        attack_guard_vs_explorer(ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::East);
    }
}
