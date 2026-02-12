//! Troop Management Tests (snforge/dojo_snf_test)
//!
//! These tests use snforge with dojo_snf_test for testing troop management systems.

#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
    use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{CombatConfigImpl, SeasonConfig, TroopLimitConfig, WorldConfigUtilImpl};
    use crate::models::map::{Tile, TileTrait};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::resource::resource::ResourceImpl;
    use crate::models::structure::{
        StructureBaseStoreImpl, StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use crate::models::troop::{ExplorerTroops, GuardSlot, GuardTrait, TroopLimitTrait, TroopTier, TroopType};
    use crate::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
    };
    use crate::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait,
    };
    use crate::utils::testing::helpers::{
        MOCK_TICK_CONFIG, pre_explore_tile, setup_troop_management_world, spawn_guard_test_realm, tgrant_resources,
    };

    // Helper to get system dispatcher
    fn get_troop_management_dispatcher(
        ref world: dojo::world::WorldStorage,
    ) -> (starknet::ContractAddress, ITroopManagementSystemsDispatcher) {
        let (addr, _) = world.dns(@"troop_management_systems").unwrap();
        (addr, ITroopManagementSystemsDispatcher { contract_address: addr })
    }

    // Helper to get troop movement dispatcher
    fn get_troop_movement_dispatcher(
        ref world: dojo::world::WorldStorage,
    ) -> (starknet::ContractAddress, ITroopMovementSystemsDispatcher) {
        let (addr, _) = world.dns(@"troop_movement_systems").unwrap();
        (addr, ITroopMovementSystemsDispatcher { contract_address: addr })
    }

    // Helper to get opposite direction
    fn get_opposite_direction(direction: Direction) -> Direction {
        match direction {
            Direction::East => Direction::West,
            Direction::NorthEast => Direction::SouthWest,
            Direction::NorthWest => Direction::SouthEast,
            Direction::West => Direction::East,
            Direction::SouthWest => Direction::NorthEast,
            Direction::SouthEast => Direction::NorthWest,
        }
    }

    // ============================================================================
    // I. guard_add tests
    // ============================================================================

    /// @notice Tests adding troops to an empty guard slot successfully.
    /// @dev Verifies the happy path for `guard_add` when the slot is initially empty.
    /// Checks correct model updates (GuardTroops, StructureBase) and resource deduction.
    #[test]
    fn test_guard_add_success_empty_slot() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let knights_added_to_guard = 1 * RESOURCE_PRECISION;

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert!(initial_troops.count == 0, "Slot should be empty");

        // Act
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, knights_added_to_guard);
        stop_cheat_caller_address(system_addr);

        // Assert
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);

        assert!(final_troops.count == knights_added_to_guard, "Guard count mismatch");
        assert!(final_troops.category == category, "Guard category mismatch");
        assert!(final_troops.tier == tier, "Guard tier mismatch");

        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(
            final_structure_base.troop_guard_count == initial_structure_base.troop_guard_count + 1,
            "Base guard count mismatch",
        );

        let knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - knights_added_to_guard;
        assert!(
            knight_balance == expected_knight_balance,
            "Wrong knight balance. Expected: {}, Actual: {}",
            expected_knight_balance,
            knight_balance,
        );
    }

    /// @notice Tests adding troops to a guard slot that already contains troops of the same type
    /// and tier.
    /// @dev Verifies the happy path for `guard_add` when adding to an existing stack.
    /// Checks correct count increment, potential stamina update, StructureBase updates, and
    /// resource deduction.
    #[test]
    fn test_guard_add_success_existing_slot() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let first_add_amount = 1 * RESOURCE_PRECISION;
        let second_add_amount = 2 * RESOURCE_PRECISION;
        let total_added_amount = first_add_amount + second_add_amount;

        // Act 1: Add first batch
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, first_add_amount);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check state after first add
        let guards_after_first_add = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first_add, _) = guards_after_first_add.from_slot(slot);
        assert!(troops_after_first_add.count == first_add_amount, "Guard count after first add mismatch");
        assert!(troops_after_first_add.category == category, "Guard category after first add mismatch");
        assert!(troops_after_first_add.tier == tier, "Guard tier after first add mismatch");

        let structure_base_after_first_add = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_base_guard_count = structure_base_after_first_add.troop_guard_count;
        assert!(initial_base_guard_count == 1, "Base guard count after first add mismatch");

        let knight_balance_after_first_add = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance_after_first_add = starting_knight_t1_amount - first_add_amount;
        assert!(
            knight_balance_after_first_add == expected_knight_balance_after_first_add,
            "Wrong knight balance after first add",
        );

        // Act 2: Add second batch to the same slot
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, second_add_amount);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Check final state
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);

        assert!(final_troops.count == total_added_amount, "Final guard count mismatch");
        assert!(final_troops.category == category, "Final guard category mismatch");
        assert!(final_troops.tier == tier, "Final guard tier mismatch");

        // StructureBase troop_guard_count should NOT increase the second time
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(
            final_structure_base.troop_guard_count == initial_base_guard_count, "Base guard count should be unchanged",
        );

        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_final_knight_balance = starting_knight_t1_amount - total_added_amount;
        assert!(final_knight_balance == expected_final_knight_balance, "Wrong final knight balance");
    }

    /// @notice Tests that `guard_add` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_guard_add_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        // NOW, overwrite SeasonConfig to make it inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for the call
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount * 2)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Attempt guard_add with inactive season, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if the caller does not own the structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(...).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_guard_add_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources to the realm, though ownership check should happen first
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Call from `other_caller`, expecting panic
        start_cheat_caller_address(system_addr, other_caller);
        dispatcher.guard_add(realm_id, slot, category, tier, amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if the structure lacks sufficient resources for
    /// payment.
    /// @dev Required by the internal `iTroopImpl::make_payment` call.
    #[test]
    #[should_panic(expected: "Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 1000000000")]
    fn test_guard_add_revert_insufficient_resources() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        // Spawn realm without granting resources
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // DO NOT grant resources

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;

        // Act - Attempt to add troops without resources, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts when adding to an existing slot with a different
    /// troop type (category).
    /// @dev Required by the `assert!(troops.category == category ...)` check within the if block.
    #[test]
    #[should_panic(expected: "incorrect category or tier")]
    fn test_guard_add_revert_mismatched_type() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant enough resources for both types
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let starting_paladin_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount),
                (ResourceTypes::PALADIN_T1, starting_paladin_t1_amount),
            ]
                .span(),
        );

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;

        // Act 1: Add Knights
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, TroopType::Knight, tier, amount);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check knights are added
        let guards_after_first = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first, _) = guards_after_first.from_slot(slot);
        assert!(troops_after_first.category == TroopType::Knight, "Category should be Knight");

        // Act 2: Attempt to add Paladins to the same slot, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, TroopType::Paladin, tier, amount);
        stop_cheat_caller_address(system_addr);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts when adding to an existing slot with a different
    /// troop tier.
    /// @dev Required by the `assert!(... && troops.tier == tier)` check within the if block.
    #[test]
    #[should_panic(expected: "incorrect category or tier")]
    fn test_guard_add_revert_mismatched_tier() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant enough resources for both tiers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let starting_knight_t2_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount),
                (ResourceTypes::KNIGHT_T2, starting_knight_t2_amount),
            ]
                .span(),
        );

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let amount = 1 * RESOURCE_PRECISION;

        // Act 1: Add Knight T1
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, TroopTier::T1, amount);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check T1 knights are added
        let guards_after_first = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first, _) = guards_after_first.from_slot(slot);
        assert!(troops_after_first.tier == TroopTier::T1, "Tier should be T1");

        // Act 2: Attempt to add Knight T2 to the same slot, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, TroopTier::T2, amount);
        stop_cheat_caller_address(system_addr);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if adding troops would exceed troop limits.
    /// @dev Required by internal checks within `iGuardImpl::add`.
    #[test]
    #[should_panic(expected: "reached limit of structure guard troop count")]
    fn test_guard_add_revert_exceed_limit() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Get the limit from config
        let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        let max_troops_per_guard = troop_limit_config.max_army_size(1, TroopTier::T1).into() * RESOURCE_PRECISION;
        let amount_to_exceed = max_troops_per_guard + 1 * RESOURCE_PRECISION;

        // Grant enough resources for the large amount
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount_to_exceed * 2)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Attempt to add more troops than the limit, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, amount_to_exceed);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    // ============================================================================
    // II. guard_delete tests
    // ============================================================================

    /// @notice Tests deleting an existing, non-empty guard slot successfully.
    /// @dev Verifies the happy path for `guard_delete`. Checks model updates (GuardTroops,
    /// StructureBase).
    #[test]
    fn test_guard_delete_success() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount_to_add = 1 * RESOURCE_PRECISION;

        // Act 1: Add troops to the slot
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, amount_to_add);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Verify troops were added
        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(initial_structure_base.troop_guard_count == 1, "Guard count post-add mismatch");
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert!(initial_troops.count == amount_to_add, "Troop count post-add mismatch");

        // Act 2: Delete the troops from the slot
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_delete(realm_id, slot);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Verify troops were deleted
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(final_structure_base.troop_guard_count == 0, "Guard count post-delete mismatch");
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);
        assert!(final_troops.count == 0, "Troop count post-delete mismatch");
        assert!(final_troops.category == category, "Category post-delete mismatch");
        assert!(final_troops.tier == tier, "Tier post-delete mismatch");
    }

    /// @notice Tests attempting to delete an already empty guard slot.
    /// @dev Verifies that attempting to delete an empty slot throws an error.
    #[test]
    #[should_panic(expected: "guard_delete: No troops in specified slot")]
    fn test_guard_delete_empty_slot() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Charlie; // Use a different slot for clarity

        // Assert 1: Verify slot is initially empty
        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(initial_structure_base.troop_guard_count == 0, "Initial guard count should be 0");
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert!(initial_troops.count == 0, "Initial troop count should be 0");

        // Act: Delete the empty slot
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_delete(realm_id, slot);
        stop_cheat_caller_address(system_addr);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `guard_delete` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_guard_delete_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        // Overwrite SeasonConfig to make it inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        // No need to add troops, check should happen before slot logic

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let slot = GuardSlot::Delta;

        // Act - Attempt guard_delete with inactive season, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_delete(realm_id, slot);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_delete` reverts if the caller does not own the structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(...).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_guard_delete_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Add some troops to a slot first (as owner)
        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);
        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount)].span());
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.guard_add(realm_id, slot, category, tier, amount);
        stop_cheat_caller_address(system_addr);

        // Act - Call delete from `other_caller`, expecting panic
        start_cheat_caller_address(system_addr, other_caller);
        dispatcher.guard_delete(realm_id, slot);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    // ============================================================================
    // III. explorer_create tests
    // ============================================================================

    /// @notice Tests creating an explorer successfully.
    /// @dev Verifies the happy path for `explorer_create`. Checks ExplorerTroops model,
    /// StructureBase updates, StructureTroopExplorerStore updates, Tile occupation, and resource deduction.
    #[test]
    fn test_explorer_create_success() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(initial_explorers.len() == 0, "Initial explorer count should be 0");

        let structure_coord = Coord {
            alt: false, x: initial_structure_base.coord_x, y: initial_structure_base.coord_y,
        };
        let spawn_coord = structure_coord.neighbor(spawn_direction);
        let initial_tile_opt: TileOpt = world.read_model((spawn_coord.alt, spawn_coord.x, spawn_coord.y));
        let initial_spawn_tile: Tile = initial_tile_opt.into();
        assert!(initial_spawn_tile.not_occupied(), "Spawn tile should be initially free");

        // Act
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Assert
        assert!(explorer_id != 0, "Explorer ID should be non-zero");

        // Check ExplorerTroops model
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.explorer_id == explorer_id, "Explorer ID mismatch");
        assert!(explorer.owner == realm_id, "Explorer owner mismatch");
        assert!(explorer.coord == spawn_coord, "Explorer coord mismatch");
        assert!(explorer.troops.category == category, "Explorer category mismatch");
        assert!(explorer.troops.tier == tier, "Explorer tier mismatch");
        assert!(explorer.troops.count == amount, "Explorer count mismatch");

        // Check StructureBase updates
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(
            final_structure_base.troop_explorer_count == initial_structure_base.troop_explorer_count + 1,
            "Structure explorer count mismatch",
        );

        // Check StructureTroopExplorerStoreImpl updates
        let final_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(final_explorers.len() == 1, "Final explorer list length mismatch");
        assert!(*final_explorers.at(0) == explorer_id, "Explorer ID not in list");

        // Check Tile occupation
        let final_tile_opt: TileOpt = world.read_model((spawn_coord.alt, spawn_coord.x, spawn_coord.y));
        let final_spawn_tile: Tile = final_tile_opt.into();
        assert!(!final_spawn_tile.not_occupied(), "Spawn tile should be occupied");
        assert!(final_spawn_tile.occupier_id == explorer_id, "Spawn tile occupant ID mismatch");

        // Check resource deduction
        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - amount;
        assert!(
            final_knight_balance == expected_knight_balance,
            "Wrong knight balance. Expected: {}, Actual: {}",
            expected_knight_balance,
            final_knight_balance,
        );
    }

    /// @notice Tests that `explorer_create` reverts if the amount is zero.
    #[test]
    #[should_panic(expected: "amount must be greater than 0")]
    fn test_explorer_create_revert_zero_amount() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 0; // Zero amount
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer with zero amount, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the season is not active.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_explorer_create_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to add troops with inactive season
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, create_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the caller does not own the structure.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_explorer_create_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for the call
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer as non-owner
        start_cheat_caller_address(system_addr, other_caller);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the structure lacks sufficient resources.
    #[test]
    #[should_panic(expected: "Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 1000000000")]
    fn test_explorer_create_revert_insufficient_resources() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        // Spawn realm WITHOUT granting any resources
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer without resources, expecting panic
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the structure has reached its explorer limit.
    #[test]
    #[should_panic(expected: "reached limit of troops for your structure")]
    fn test_explorer_create_revert_structure_explorer_limit() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Set the structure's specific explorer limit to 1
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        structure_base.troop_max_explorer_count = 1;
        StructureBaseStoreImpl::store(ref structure_base, ref world, realm_id);

        // Grant enough resources to create *two* explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount * 2)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_1 = Direction::NorthEast;
        let spawn_direction_2 = Direction::East;

        // Act 1: Create the first explorer (should succeed)
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction_1);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check structure count is 1
        let structure_base_after_1 = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(structure_base_after_1.troop_explorer_count == 1, "Count should be 1");

        // Act 2: Attempt to create the second explorer (should panic)
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction_2);
        stop_cheat_caller_address(system_addr);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the global explorer limit per structure is reached.
    #[test]
    #[should_panic(expected: "reached limit of troops for your structure")]
    fn test_explorer_create_revert_global_explorer_limit() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Now, set structure explorer limit to 0 *after* realm creation
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        structure_base.troop_max_explorer_count = 0;
        StructureBaseStoreImpl::store(ref structure_base, ref world, realm_id);

        // Grant resources needed for the call
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer with 0 global limit
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the spawn tile is already occupied.
    #[test]
    #[should_panic(expected: "explorer spawn location is occupied")]
    fn test_explorer_create_revert_spawn_occupied() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Increase structure explorer limit to avoid hitting it first
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        structure_base.troop_max_explorer_count = 5;
        StructureBaseStoreImpl::store(ref structure_base, ref world, realm_id);

        // Grant resources needed for the call
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount * 2)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the first explorer to occupy the spawn tile
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt to create a second explorer at the same occupied spawn tile
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_create(realm_id, category, tier, amount, spawn_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    // ============================================================================
    // IV. explorer_add tests
    // ============================================================================

    /// @notice Tests adding troops to an existing explorer successfully.
    #[test]
    fn test_explorer_add_success() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources for creation and addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 2 * RESOURCE_PRECISION;
        let total_amount = create_amount + add_amount;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check initial state
        let initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(initial_explorer.troops.count == create_amount, "Initial count mismatch");

        let balance_after_create = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_balance_after_create = starting_knight_t1_amount - create_amount;
        assert!(balance_after_create == expected_balance_after_create, "Balance post-create mismatch");

        // Act 2: Add more troops
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Check final state
        let final_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(final_explorer.troops.count == total_amount, "Final count mismatch");

        // Check final resource deduction
        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - total_amount;
        assert!(final_knight_balance == expected_knight_balance, "Wrong final knight balance");
    }

    /// @notice Tests that `explorer_add` reverts if the amount is zero.
    #[test]
    #[should_panic(expected: "amount must be greater than 0")]
    fn test_explorer_add_revert_zero_amount() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 0; // Zero amount
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt to add zero troops
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the amount is not divisible by RESOURCE_PRECISION.
    #[test]
    #[should_panic(expected: "amount must be divisible by resource precision")]
    fn test_explorer_add_revert_invalid_precision() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation and attempt
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION + 1; // Invalid precision
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt to add troops with invalid precision
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the season is not active.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_explorer_add_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to add troops with inactive season
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, create_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the caller does not own the explorer's home structure.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_explorer_add_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation and addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (as owner)
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt to add troops from `other_caller`
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, other_caller);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the explorer is not adjacent to its home structure.
    #[test]
    #[should_panic(expected: "explorer not adjacent to home structure")]
    fn test_explorer_add_revert_not_adjacent_home() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation and attempted addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let wheat_amount: u128 = 100000000000000000;
        let fish_amount: u128 = 50000000000000000;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount), (ResourceTypes::WHEAT, wheat_amount),
                (ResourceTypes::FISH, fish_amount),
            ]
                .span(),
        );

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);
        let (movement_system_addr, movement_dispatcher) = get_troop_movement_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Set block timestamp so stamina can be initialized
        start_cheat_block_timestamp_global(MOCK_TICK_CONFIG().armies_tick_in_seconds);

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Pre-explore the tile we're moving to (needed for explore=false)
        let target_coord = realm_coord.neighbor(spawn_direction).neighbor(spawn_direction);
        pre_explore_tile(ref world, target_coord);

        // Move the explorer away from home
        let move_direction = array![spawn_direction].span();
        start_cheat_caller_address(movement_system_addr, realm_owner);
        movement_dispatcher.explorer_move(explorer_id, move_direction, false);
        stop_cheat_caller_address(movement_system_addr);

        // Assert: Verify the explorer moved
        let explorer_after_move: ExplorerTroops = world.read_model(explorer_id);
        let expected_coord = realm_coord.neighbor(spawn_direction).neighbor(spawn_direction);
        assert!(explorer_after_move.coord == expected_coord, "Explorer didn't move correctly");

        // Act 2: Attempt to add troops when not adjacent
        let incorrect_home_direction = Direction::NorthEast;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, incorrect_home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the structure lacks sufficient resources.
    #[test]
    #[should_panic(expected: "Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 2000000000")]
    fn test_explorer_add_revert_insufficient_resources() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 2 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Grant exactly enough resources to CREATE the explorer, but not enough to ADD more
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, create_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        // Act 1: Create the explorer (this should succeed)
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Verify the realm has 0 Knight T1 balance after creation
        let balance_after_create = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        assert!(balance_after_create == 0, "Balance should be zero after creation");

        // Act 2: Attempt to add more troops (this should fail due to insufficient resources)
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if adding troops would exceed the explorer's troop limit.
    #[test]
    #[should_panic(expected: "reached limit of explorers amount per army")]
    fn test_explorer_add_revert_exceed_limit() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Get the limit from config
        let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        let max_troops_per_explorer = troop_limit_config.max_army_size(1, TroopTier::T1).into() * RESOURCE_PRECISION;
        let create_amount = max_troops_per_explorer - 1 * RESOURCE_PRECISION; // Create just under the limit
        let add_amount = 2 * RESOURCE_PRECISION; // Amount that will exceed the limit
        let total_needed_resource = create_amount + add_amount;

        // Grant enough resources for creation and the attempt to add more
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, total_needed_resource)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer with an amount close to the limit
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Check initial state
        let initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(initial_explorer.troops.count == create_amount, "Initial count wrong");

        // Act 2: Attempt to add troops that exceed the limit, expecting panic
        let home_direction = get_opposite_direction(spawn_direction);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_add(explorer_id, add_amount, home_direction);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    // ============================================================================
    // V. explorer_delete tests
    // ============================================================================

    /// @notice Tests deleting an existing explorer successfully.
    #[test]
    fn test_explorer_delete_success() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources for creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Verify initial state
        let mut initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(initial_explorer.explorer_id == explorer_id, "Explorer ID wrong");
        assert!(initial_explorer.troops.count == create_amount, "Initial count wrong");

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(initial_structure_base.troop_explorer_count == 1, "Initial structure count wrong");
        let structure_coord = Coord {
            alt: false, x: initial_structure_base.coord_x, y: initial_structure_base.coord_y,
        };
        let spawn_coord = structure_coord.neighbor(spawn_direction);

        let initial_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(initial_explorers.len() == 1, "Initial explorer list len wrong");
        assert!(*initial_explorers.at(0) == explorer_id, "Initial explorer ID not in list");

        let initial_tile_opt2: TileOpt = world.read_model((spawn_coord.alt, spawn_coord.x, spawn_coord.y));
        let initial_spawn_tile: Tile = initial_tile_opt2.into();
        assert!(!initial_spawn_tile.not_occupied(), "Spawn tile should be occupied");
        assert!(initial_spawn_tile.occupier_id == explorer_id, "Spawn tile occupier wrong");

        // Act 2: Delete the explorer
        world.write_model_test(@initial_explorer);
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_delete(explorer_id);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Verify final state
        let final_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(final_explorer.owner == 0, "Final owner should be 0");
        assert!(final_explorer.troops.count == 0, "Final count should be 0");
        assert!(final_explorer.coord.x == 0, "Final coord x should be 0");
        assert!(final_explorer.coord.y == 0, "Final coord y should be 0");

        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert!(final_structure_base.troop_explorer_count == 0, "Final structure count wrong");

        let final_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert!(final_explorers.len() == 0, "Final explorer list len wrong");

        let final_tile_opt2: TileOpt = world.read_model((spawn_coord.alt, spawn_coord.x, spawn_coord.y));
        let final_spawn_tile: Tile = final_tile_opt2.into();
        assert!(final_spawn_tile.not_occupied(), "Spawn tile should be free");
        assert!(final_spawn_tile.occupier_id == 0, "Spawn tile occupier should be 0");
    }

    /// @notice Tests that `explorer_delete` reverts if the season is not active.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_explorer_delete_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (while season is active)
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to delete the explorer with inactive season
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_delete(explorer_id);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_delete` reverts if the caller does not own the explorer's home structure.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_explorer_delete_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (as owner)
        start_cheat_caller_address(system_addr, realm_owner);
        let explorer_id = dispatcher.explorer_create(realm_id, category, tier, create_amount, spawn_direction);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt to delete the explorer from `other_caller`
        start_cheat_caller_address(system_addr, other_caller);
        dispatcher.explorer_delete(explorer_id);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    // ============================================================================
    // VI. explorer_explorer_swap tests
    // ============================================================================

    /// @notice Tests swapping troops between two valid, adjacent explorers owned by the same structure.
    #[test]
    fn test_explorer_swap_success() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers and the swap
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act: Create the 'from' explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        stop_cheat_caller_address(system_addr);

        // Create the 'to' explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Verify initial states
        let initial_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let initial_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
        assert!(initial_from_explorer.troops.count == create_amount_from, "Initial From Count");
        assert!(initial_to_explorer.troops.count == create_amount_to, "Initial To Count");

        // Act 3: Perform the swap
        let swap_direction = Direction::East;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Verify final states
        let final_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let final_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);

        let expected_from_count = create_amount_from - swap_amount;
        let expected_to_count = create_amount_to + swap_amount;
        assert!(final_from_explorer.troops.count == expected_from_count, "Final From Count");
        assert!(final_to_explorer.troops.count == expected_to_count, "Final To Count");

        // Check stamina constraint
        let initial_from_stamina = initial_from_explorer.troops.stamina.amount;
        let final_to_stamina = final_to_explorer.troops.stamina.amount;
        assert!(final_to_stamina <= initial_from_stamina, "Stamina constraint");

        // Check knight balance at realm layer (should be unaffected by the swap)
        let final_knight_balance_realm1 = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let final_knight_balance_realm2 = ResourceImpl::read_balance(ref world, realm2_id, ResourceTypes::KNIGHT_T1);
        assert!(final_knight_balance_realm1 == starting_knight_t1_amount - create_amount_from, "Final Balance Realm 1");
        assert!(final_knight_balance_realm2 == starting_knight_t1_amount - create_amount_to, "Final Balance Realm 2");
    }

    /// @notice Tests swapping troops when the swap amount equals the source explorer's total troops, causing deletion.
    #[test]
    fn test_explorer_swap_success_delete_source() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers and the swap
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = create_amount_from; // Swap all troops from 'from'
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the 'from' explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        stop_cheat_caller_address(system_addr);

        // Act 2: Create the 'to' explorer
        start_cheat_caller_address(system_addr, realm_owner);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Assert 1: Verify initial states
        let initial_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let initial_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
        assert!(initial_from_explorer.troops.count == create_amount_from, "Initial From Count");
        assert!(initial_to_explorer.troops.count == create_amount_to, "Initial To Count");

        // Act 3: Perform the swap
        let swap_direction = Direction::East;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);

        // Assert 2: Verify final states
        let final_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let final_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);

        let expected_from_count = 0; // 'from' explorer should be deleted
        let expected_to_count = create_amount_to + swap_amount;
        assert!(final_from_explorer.troops.count == expected_from_count, "Final From Count");
        assert!(final_to_explorer.troops.count == expected_to_count, "Final To Count");

        // Check stamina constraint
        let initial_from_stamina = initial_from_explorer.troops.stamina.amount;
        let final_to_stamina = final_to_explorer.troops.stamina.amount;
        assert!(final_to_stamina <= initial_from_stamina, "Stamina constraint");
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the count is zero.
    #[test]
    #[should_panic(expected: "count must be greater than 0")]
    fn test_explorer_swap_revert_zero_amount() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 0; // Zero amount
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap with zero amount (expect panic)
        let swap_direction = Direction::East;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the season is not active.
    #[test]
    #[should_panic(expected: "The game starts in 0 hours 33 minutes, 20 seconds")]
    fn test_explorer_swap_revert_season_inactive() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 2 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 2 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers (while season is active)
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Make season inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
            dev_mode_on: false,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt the swap with inactive season (expect panic)
        let swap_direction = Direction::SouthEast;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the caller does not own the explorers' home structure.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_explorer_swap_revert_not_owner() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let other_caller = starknet::contract_address_const::<'other_caller'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers (as owner)
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        stop_cheat_caller_address(system_addr);

        start_cheat_caller_address(system_addr, other_caller);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap explorers from other_caller who only owns one of the explorers (expect panic)
        start_cheat_caller_address(system_addr, other_caller);
        let swap_direction = Direction::East;
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the explorers have different owners.
    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn test_explorer_swap_revert_different_owners() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner_1 = starknet::contract_address_const::<'realm_owner_1'>();
        let realm_owner_2 = starknet::contract_address_const::<'realm_owner_2'>();
        let realm_coord_1 = Coord { alt: false, x: 10, y: 10 };
        let realm_coord_2 = Coord { alt: false, x: 13, y: 10 };
        let realm_id_1 = spawn_guard_test_realm(ref world, 1, realm_owner_1, realm_coord_1);
        let realm_id_2 = spawn_guard_test_realm(ref world, 2, realm_owner_2, realm_coord_2);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id_1, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm_id_2, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers (as different owners)
        start_cheat_caller_address(system_addr, realm_owner_1);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id_1, category, tier, create_amount_from, spawn_direction_from);
        stop_cheat_caller_address(system_addr);
        start_cheat_caller_address(system_addr, realm_owner_2);
        let to_explorer_id = dispatcher
            .explorer_create(realm_id_2, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap between different owners (expect panic)
        start_cheat_caller_address(system_addr, realm_owner_1);
        let swap_direction = Direction::SouthEast;
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the explorers are not adjacent.
    #[test]
    #[should_panic(expected: "to explorer is not adjacent to source explorer")]
    fn test_explorer_swap_revert_not_adjacent() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 15, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::NorthEast;
        let spawn_direction_to = Direction::SouthEast;

        // Act 1: Create the explorers
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap between non-adjacent explorers (expect panic)
        let swap_direction = Direction::SouthEast;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the swap count exceeds the source explorer's troops.
    #[test]
    #[should_panic(expected: "insufficient troops in source explorer")]
    fn test_explorer_swap_revert_insufficient_troops() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 4 * RESOURCE_PRECISION; // Swap MORE than the source has
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap with insufficient troops (expect panic)
        let swap_direction = Direction::East;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the swap count is not divisible by RESOURCE_PRECISION.
    #[test]
    #[should_panic(expected: "count must be divisible by resource precision")]
    fn test_explorer_swap_revert_invalid_precision() {
        // Arrange
        let mut world = setup_troop_management_world();

        let realm_owner = starknet::contract_address_const::<'realm_owner'>();
        let realm_coord = Coord { alt: false, x: 10, y: 10 };
        let realm_id = spawn_guard_test_realm(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { alt: false, x: 13, y: 10 };
        let realm2_id = spawn_guard_test_realm(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (system_addr, dispatcher) = get_troop_management_dispatcher(ref world);

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION + 1; // Invalid precision
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West;

        // Act 1: Create the explorers
        start_cheat_caller_address(system_addr, realm_owner);
        let from_explorer_id = dispatcher
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = dispatcher
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);
        stop_cheat_caller_address(system_addr);

        // Act 2: Attempt the swap with invalid precision (expect panic)
        let swap_direction = Direction::East;
        start_cheat_caller_address(system_addr, realm_owner);
        dispatcher.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        stop_cheat_caller_address(system_addr);
        // Assert - Handled by should_panic
    }
}
