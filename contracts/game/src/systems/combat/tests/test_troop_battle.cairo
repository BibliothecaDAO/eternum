//! Combat Battle Tests (snforge/dojo_snf_test)
//!
//! These tests use snforge with dojo_snf_test for testing combat systems.

#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::position::{Coord, Direction};
    use crate::models::structure::{StructureBase, StructureBaseStoreImpl, StructureTroopExplorerStoreImpl};
    use crate::models::troop::{ExplorerTroops, GuardSlot, TroopTier, TroopType, Troops};
    use crate::systems::combat::contracts::troop_battle::{
        ITroopBattleSystemsDispatcher, ITroopBattleSystemsDispatcherTrait,
    };
    use crate::utils::testing::snf_helpers::{
        MOCK_TROOP_LIMIT_CONFIG, snf_attack_explorer_vs_explorer, snf_attack_explorer_vs_guard,
        snf_attack_guard_vs_explorer, snf_get_combat_systems, snf_get_explorer, snf_setup_explorer_battle,
        snf_setup_guard_battle, snf_spawn_combat_world, snf_spawn_world_minimal,
    };

    // ========================================================================
    // Basic World Tests
    // ========================================================================

    #[test]
    fn test_world_spawns() {
        let world = snf_spawn_world_minimal();
        assert!(world.dispatcher.contract_address.is_non_zero(), "World should exist");
    }

    #[test]
    fn test_explorer_can_be_created() {
        let mut world = snf_spawn_world_minimal();

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
        let mut world = snf_spawn_combat_world();
        let systems = snf_get_combat_systems(ref world);

        assert!(systems.troop_management.is_non_zero(), "Troop management system should be deployed");
        assert!(systems.troop_movement.is_non_zero(), "Troop movement system should be deployed");
        assert!(systems.troop_battle.is_non_zero(), "Troop battle system should be deployed");
    }

    #[test]
    fn test_library_can_be_found() {
        let world = snf_spawn_combat_world();

        let result = world.dns(@"structure_creation_library_v0_1_8");
        assert!(result.is_some(), "structure_creation_library_v0_1_8 should be found");

        let (_addr, class_hash) = result.unwrap();
        assert!(class_hash.is_non_zero(), "Library class_hash should be non-zero");
    }

    // ========================================================================
    // Explorer vs Explorer Battle Tests
    // ========================================================================

    #[test]
    fn test_explorer_vs_explorer_one_dies() {
        // Setup battle: Crossbowman T2 vs Paladin T3 (T3 wins)
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
            TroopType::Crossbowman, TroopTier::T2, TroopType::Paladin, TroopTier::T3,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;

        // Attack
        snf_attack_explorer_vs_explorer(
            ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West,
        );

        // Verify battle results
        let first = snf_get_explorer(ref world, first_explorer.explorer_id);
        let second = snf_get_explorer(ref world, second_explorer.explorer_id);

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
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;

        // Attack
        snf_attack_explorer_vs_explorer(
            ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West,
        );

        // Verify both survived with damage
        let first = snf_get_explorer(ref world, first_explorer.explorer_id);
        let second = snf_get_explorer(ref world, second_explorer.explorer_id);

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
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
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
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with wrong direction (not adjacent in that direction)
        let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

        start_cheat_caller_address(systems.troop_battle, second_explorer.owner);
        dispatcher
            .attack_explorer_vs_explorer(
                second_explorer.explorer_id, first_explorer.explorer_id, Direction::NorthEast, array![].span(),
            );
        stop_cheat_caller_address(systems.troop_battle);
    }

    #[test]
    #[should_panic(expected: "aggressor has no troops")]
    fn test_explorer_vs_explorer__fails_aggressor_dead() {
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the attacker's troops
        let mut attacker: ExplorerTroops = world.read_model(second_explorer.explorer_id);
        attacker.troops.count = 0;
        world.write_model_test(@attacker);

        // Try to attack with dead explorer
        snf_attack_explorer_vs_explorer(
            ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West,
        );
    }

    #[test]
    #[should_panic(expected: "defender has no troops")]
    fn test_explorer_vs_explorer__fails_defender_dead() {
        let (mut world, systems, first_explorer, second_explorer) = snf_setup_explorer_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the defender's troops
        let mut defender: ExplorerTroops = world.read_model(first_explorer.explorer_id);
        defender.troops.count = 0;
        world.write_model_test(@defender);

        // Try to attack dead defender
        snf_attack_explorer_vs_explorer(
            ref world, systems, second_explorer, first_explorer.explorer_id, Direction::West,
        );
    }

    // ========================================================================
    // Explorer vs Guard Battle Tests
    // ========================================================================

    #[test]
    fn test_explorer_vs_guard_battle() {
        // Setup: Explorer T3 vs Guard T1 (Explorer should win)
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Paladin, TroopTier::T3,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;

        // Attack
        snf_attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::West);

        // Verify battle results
        let explorer_after = snf_get_explorer(ref world, explorer.explorer_id);
        assert!(explorer_after.troops.count < troop_amount, "Explorer should have taken damage");
        assert!(explorer_after.troops.count > 0, "Explorer T3 should survive vs Guard T1");
    }

    #[test]
    #[should_panic(expected: ('Not Owner',))]
    fn test_explorer_vs_guard__fails_not_owner() {
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
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
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the attacker's troops
        let mut attacker: ExplorerTroops = world.read_model(explorer.explorer_id);
        attacker.troops.count = 0;
        world.write_model_test(@attacker);

        // Try to attack with dead explorer
        snf_attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::West);
    }

    #[test]
    #[should_panic(expected: "explorer is not adjacent to structure")]
    fn test_explorer_vs_guard__fails_not_adjacent() {
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with wrong direction (not adjacent)
        snf_attack_explorer_vs_guard(ref world, systems, explorer, realm.entity_id, Direction::NorthEast);
    }

    // ========================================================================
    // Guard vs Explorer Battle Tests
    // ========================================================================

    #[test]
    fn test_guard_vs_explorer_battle() {
        // Setup: Guard T3 vs Explorer T1 (Guard should win)
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Paladin, TroopTier::T3, TroopType::Knight, TroopTier::T1,
        );

        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;

        // Attack
        snf_attack_guard_vs_explorer(
            ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::East,
        );

        // Verify battle results
        let explorer_after = snf_get_explorer(ref world, explorer.explorer_id);
        assert!(explorer_after.troops.count < troop_amount, "Explorer should have taken damage");
    }

    #[test]
    #[should_panic(expected: ('Not Owner',))]
    fn test_guard_vs_explorer__fails_not_owner() {
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
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
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with an empty guard slot (Alpha instead of Delta)
        snf_attack_guard_vs_explorer(
            ref world, systems, realm, GuardSlot::Alpha, explorer.explorer_id, Direction::East,
        );
    }

    #[test]
    #[should_panic(expected: "defender has no troops")]
    fn test_guard_vs_explorer__fails_defender_has_no_troops() {
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Kill the defender's troops
        let mut defender: ExplorerTroops = world.read_model(explorer.explorer_id);
        defender.troops.count = 0;
        world.write_model_test(@defender);

        // Try to attack dead defender
        snf_attack_guard_vs_explorer(
            ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::East,
        );
    }

    #[test]
    #[should_panic(expected: "structure is not adjacent to explorer")]
    fn test_guard_vs_explorer__fails_not_adjacent() {
        let (mut world, systems, realm, explorer) = snf_setup_guard_battle(
            TroopType::Knight, TroopTier::T1, TroopType::Knight, TroopTier::T1,
        );

        // Try to attack with wrong direction (not adjacent)
        snf_attack_guard_vs_explorer(
            ref world, systems, realm, GuardSlot::Delta, explorer.explorer_id, Direction::NorthEast,
        );
    }
}
