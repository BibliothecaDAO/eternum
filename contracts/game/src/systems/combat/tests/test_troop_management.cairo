//! Troop Management Tests (snforge/dojo_snf_test)
//!
//! These tests use snforge with dojo_snf_test for testing troop management systems.

#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};

    use crate::constants::{RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{CombatConfigImpl, SeasonConfig, TroopLimitConfig, WorldConfigUtilImpl};
    use crate::models::position::{Coord, Direction};
    use crate::models::resource::resource::ResourceImpl;
    use crate::models::structure::{StructureBaseStoreImpl, StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl};
    use crate::models::troop::{ExplorerTroops, GuardSlot, GuardTrait, TroopTier, TroopType};
    use crate::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
    };

    use crate::utils::testing::snf_helpers::{
        snf_setup_troop_management_world, tgrant_resources, tspawn_realm_with_resources, tspawn_simple_realm,
    };

    // Helper to get system dispatcher
    fn get_troop_management_dispatcher(ref world: dojo::world::WorldStorage) -> (starknet::ContractAddress, ITroopManagementSystemsDispatcher) {
        let (addr, _) = world.dns(@"troop_management_systems").unwrap();
        (addr, ITroopManagementSystemsDispatcher { contract_address: addr })
    }

    // Tests will be added in Task 4 and Task 5...
}
