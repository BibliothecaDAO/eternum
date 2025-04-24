// #[cfg(test)]
// mod tests {
//     use core::num::traits::zero::Zero;
//     use dojo::model::{ModelStorage, ModelStorageTest};
//     use dojo::world::{WorldStorageTrait};
//     use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};
//     use s1_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
//     use s1_eternum::models::config::{WorldConfigUtilImpl};
//     use s1_eternum::models::position::{Coord, CoordTrait, Direction, OccupiedImpl, Occupier};
//     use s1_eternum::models::resource::resource::{SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl};
//     use s1_eternum::models::structure::{Structure, StructureImpl};
//     use s1_eternum::models::troop::{ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, TroopTier, TroopType, Troops};
//     use s1_eternum::models::weight::{Weight};
//     use s1_eternum::models::{
//         config::{m_ProductionConfig, m_WeightConfig, m_WorldConfig}, map::{m_Tile}, position::{m_Occupier},
//         realm::{m_Realm}, resource::production::building::{m_Building, m_StructureBuildings},
//         resource::resource::{m_Resource}, structure::{m_Structure}, troop::{m_ExplorerTroops},
//     };
//     use s1_eternum::systems::combat::contracts::troop_management::{
//         ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
//     };
//     use s1_eternum::utils::testing::helpers::{
//         MOCK_CAPACITY_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_DAMAGE_CONFIG, MOCK_TROOP_LIMIT_CONFIG,
//         MOCK_TROOP_STAMINA_CONFIG, MOCK_WEIGHT_CONFIG, tgrant_resources, tspawn_simple_realm, tspawn_world,
//         tstore_capacity_config, tstore_tick_config, tstore_troop_damage_config, tstore_troop_limit_config,
//         tstore_troop_stamina_config, tstore_weight_config,
//     };

//     fn namespace_def() -> NamespaceDef {
//         let ndef = NamespaceDef {
//             namespace: DEFAULT_NS_STR(),
//             resources: [
//                 // world config
//                 TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
//                 TestResource::Model(m_WeightConfig::TEST_CLASS_HASH),
//                 TestResource::Model(m_ProductionConfig::TEST_CLASS_HASH),
//                 // structure, realm and buildings
//                 TestResource::Model(m_Structure::TEST_CLASS_HASH),
//                 TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
//                 TestResource::Model(m_Realm::TEST_CLASS_HASH), TestResource::Model(m_Occupier::TEST_CLASS_HASH),
//                 TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
//                 TestResource::Model(m_Resource::TEST_CLASS_HASH),
//                 // other models
//                 TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
//                 // contracts
//                 TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
//             ]
//                 .span(),
//         };

//         ndef
//     }

//     fn contract_defs() -> Span<ContractDef> {
//         [
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span())
//         ]
//             .span()
//     }

//     #[test]
//     fn test_guard_add_essentials() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount);

//         // ensure explorer was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 1);

//         // ensure troop resource was deducted from the structure
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_knight_resource.balance, 0);

//         // ensure troop stamina was set
//         let delta_guard: Troops = structure.troop_guards.delta;
//         assert_eq!(delta_guard.stamina.amount, 0);
//         assert_eq!(delta_guard.stamina.updated_tick, current_tick);

//         // ensure delta troop is set correctly
//         assert_eq!(delta_guard.category, TroopType::Knight);
//         assert_eq!(delta_guard.tier, TroopTier::T1);
//         assert_eq!(delta_guard.count, troop_amount);
//         assert_eq!(structure.troop_guards.delta_destroyed_tick.into(), 0);

//         // ensure other guards are not affected
//         let mut charlie_guard: Troops = structure.troop_guards.charlie;
//         assert_eq!(charlie_guard.stamina.amount, 0);
//         assert_eq!(charlie_guard.stamina.updated_tick, 0);
//         assert_eq!(charlie_guard.count, 0);
//         assert_eq!(structure.troop_guards.charlie_destroyed_tick.into(), 0);

//         let mut bravo_guard: Troops = structure.troop_guards.bravo;
//         assert_eq!(bravo_guard.stamina.amount, 0);
//         assert_eq!(bravo_guard.stamina.updated_tick, 0);
//         assert_eq!(bravo_guard.count, 0);
//         assert_eq!(structure.troop_guards.bravo_destroyed_tick.into(), 0);

//         let mut alpha_guard: Troops = structure.troop_guards.alpha;
//         assert_eq!(alpha_guard.stamina.amount, 0);
//         assert_eq!(alpha_guard.stamina.updated_tick, 0);
//         assert_eq!(alpha_guard.count, 0);
//         assert_eq!(structure.troop_guards.alpha_destroyed_tick.into(), 0);
//     }

//     #[test]
//     fn test_guard_add_multiple_times() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         ////////////// Create Delta Guard //////////////

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ////////////// Go to next tick //////////////
//         let next_tick = current_tick + MOCK_TICK_CONFIG().armies_tick_in_seconds.into();
//         starknet::testing::set_block_timestamp(next_tick);

//         ////////////// ADD DELTA GUARD AGAIN //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);
//     }

//     #[test]
//     fn test_guard_add_after_ressurection_delay() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         ////////////// Create Delta Guard //////////////

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         ////////////// simulate troop defeat //////////////
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         let mut structure_guards: GuardTroops = structure.troop_guards;
//         let (mut delta_troops, _): (Troops, u32) = structure_guards.from_slot(GuardSlot::Delta);
//         delta_troops.count = 0;
//         // set troops destroyed tick to current tick to simulate defeat
//         structure_guards.to_slot(GuardSlot::Delta, delta_troops, current_tick);
//         structure.base.troop_guard_count = structure.base.troop_guard_count - 1;
//         world.write_model_test(@structure);

//         // ////////////// PASS ENOUGH TIME TO RESURRECT THE GUARD //////////////
//         let next_tick = current_tick
//             + (MOCK_TROOP_LIMIT_CONFIG().guard_resurrection_delay.into() *
//             MOCK_TICK_CONFIG().armies_tick_in_seconds);
//         starknet::testing::set_block_timestamp(next_tick);

//         ////////////// ADD DELTA GUARD AGAIN //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_guard_add__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set caller address to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("you need to wait for the delay from troop defeat to be over", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_add__fails_ressurection_delay() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         ////////////// Create Delta Guard //////////////
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         ////////////// simulate troop defeat //////////////
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         let mut structure_guards: GuardTroops = structure.troop_guards;
//         let (mut delta_troops, _): (Troops, u32) = structure_guards.from_slot(GuardSlot::Delta);
//         delta_troops.count = 0;
//         // set troops destroyed tick to current tick to simulate defeat
//         structure_guards.to_slot(GuardSlot::Delta, delta_troops, current_tick);
//         structure.base.troop_guard_count = structure.base.troop_guard_count - 1;
//         structure.troop_guards = structure_guards;
//         world.write_model_test(@structure);

//         ////////////// ADD DELTA GUARD AGAIN //////////////
//         // try to add the same troop again
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("incorrect category or tier", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_add__fails_incorrect_category() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span(),
//         );

//         ////////////// Create Delta Guard //////////////

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         ////////////// ADD DELTA GUARD AGAIN WITH INCORRECT CATEGORY //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T1, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("incorrect category or tier", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_add__fails_incorrect_tier() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T2, troop_amount)].span(),
//         );

//         ////////////// Create Delta Guard //////////////

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         ////////////// ADD DELTA GUARD AGAIN WITH INCORRECT CATEGORY //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T2, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("reached limit of guards per structure", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_add__fails_max_guard_count() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         ////////////// Create Delta Guard //////////////

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         ////////////// Create Charlie Guard //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Charlie, TroopType::Knight, TroopTier::T1, troop_amount / 2);
//     }

//     #[test]
//     fn test_guard_add_then_delete_then_add_another_type() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span(),
//         );

//         ////////////// Create Crossbowman Delta Guard //////////////
//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T1, troop_amount);

//         // ensure crossbowman guard was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 1);

//         // ensure troop resource was deducted from the structure
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_crossbowman_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T1, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_crossbowman_resource.balance, 0);

//         ////////////// Delete Crossbowman Delta Guard //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_delete(realm_entity_id, GuardSlot::Delta);

//         // ensure crossbowman guard was deleted from the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 0);

//         ////////////// Create Knight Delta Guard //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount);

//         // ensure knight guard was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 1);

//         // ensure troop stamina was set
//         let delta_guard: Troops = structure.troop_guards.delta;
//         assert_eq!(delta_guard.stamina.amount, 0);
//         assert_eq!(delta_guard.stamina.updated_tick, current_tick);

//         // ensure delta troop is set correctly
//         assert_eq!(delta_guard.category, TroopType::Knight);
//         assert_eq!(delta_guard.tier, TroopTier::T1);
//         assert_eq!(delta_guard.count, troop_amount);
//         assert_eq!(structure.troop_guards.delta_destroyed_tick.into(), 0);

//         // ensure other guards are not affected
//         let mut charlie_guard: Troops = structure.troop_guards.charlie;
//         assert_eq!(charlie_guard.stamina.amount, 0);
//         assert_eq!(charlie_guard.stamina.updated_tick, 0);
//         assert_eq!(charlie_guard.count, 0);
//         assert_eq!(structure.troop_guards.charlie_destroyed_tick.into(), 0);

//         let mut bravo_guard: Troops = structure.troop_guards.bravo;
//         assert_eq!(bravo_guard.stamina.amount, 0);
//         assert_eq!(bravo_guard.stamina.updated_tick, 0);
//         assert_eq!(bravo_guard.count, 0);
//         assert_eq!(structure.troop_guards.bravo_destroyed_tick.into(), 0);

//         let mut alpha_guard: Troops = structure.troop_guards.alpha;
//         assert_eq!(alpha_guard.stamina.amount, 0);
//         assert_eq!(alpha_guard.stamina.updated_tick, 0);
//         assert_eq!(alpha_guard.count, 0);
//         assert_eq!(structure.troop_guards.alpha_destroyed_tick.into(), 0);
//     }

//     #[test]
//     fn test_guard_delete() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span());

//         ////////////// Create Crossbowman Delta Guard //////////////
//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T1, troop_amount);

//         ////////////// Delete Crossbowman Delta Guard //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_delete(realm_entity_id, GuardSlot::Delta);

//         // ensure crossbowman guard was deleted from the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 0);

//         // ensure  guard was deleted
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.base.troop_guard_count, 0);

//         // ensure troop stamina was set to 0
//         let delta_guard: Troops = structure.troop_guards.delta;
//         assert_eq!(delta_guard.stamina.amount, 0);
//         // note: stamina updated tick must be set to 0 else it might be exploited
//         // e.g if we don't set it to 0, and the guard is deleted, then after x ticks,
//         // the guard will be probably be resurrected with max stamina
//         assert_eq!(delta_guard.stamina.updated_tick, 0);

//         // ensure delta troop is set correctly
//         assert_eq!(delta_guard.count, 0);
//         assert_eq!(structure.troop_guards.delta_destroyed_tick.into(), 0);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_guard_delete__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span());

//         ////////////// Create Crossbowman Delta Guard //////////////
//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         // set current tick
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T1, troop_amount);

//         // set caller address to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unkown'>());

//         ////////////// Delete Crossbowman Delta Guard //////////////
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_delete(realm_entity_id, GuardSlot::Delta);
//     }

//     #[test]
//     fn test_explorer_create_essentials() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // ensure explorer was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.troop_explorers.len(), 1);
//         assert_eq!(structure.troop_explorers.at(0), @explorer_id);

//         // ensure troop resource was deducted from the structure
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_knight_resource.balance, 0);

//         // ensure troop stamina was set
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into());
//         assert_eq!(explorer.troops.stamina.updated_tick, 1);

//         // ensure troop coord is a neighbor of the structure
//         assert_eq!(explorer.coord, realm_coord.neighbor(troop_spawn_direction));

//         // ensure explorer is owned by the structure
//         assert_eq!(explorer.owner, realm_entity_id);

//         // ensure troop is set correctly
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);
//         assert_eq!(explorer.troops.count, troop_amount);

//         // ensure troop capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         assert_eq!(explorer_weight.capacity, MOCK_CAPACITY_CONFIG().troop_capacity.into() * troop_amount.into());
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_create__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         starknet::testing::set_block_timestamp(1);
//         let troop_spawn_direction = Direction::NorthWest;

//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
//     }

//     #[test]
//     #[should_panic(
//         expected: ("Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 500000000000000", 'ENTRYPOINT_FAILED'),
//     )]
//     fn test_explorer_create__fails_insufficient_balance() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant no troop resources
//         tgrant_resources(ref world, realm_entity_id, array![].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);
//         let troop_spawn_direction = Direction::NorthWest;

//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer spawn location is occupied", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_create__fails_occupied() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant resources to the structure
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);
//         let troop_spawn_direction = Direction::NorthWest;

//         // create two explorers at the same location
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
//     }

//     #[test]
//     fn test_explorer_create_knight_tiers() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T2),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T3),
//             ]
//                 .span(),
//         );
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();

//         let knight_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let knight_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let knight_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![
//                 (ResourceTypes::KNIGHT_T1, knight_t1_amount),
//                 (ResourceTypes::KNIGHT_T2, knight_t2_amount),
//                 (ResourceTypes::KNIGHT_T3, knight_t3_amount),
//             ]
//                 .span(),
//         );

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // allow structure have up to 3 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 3;
//         world.write_model_test(@structure);

//         // create T1 Knights
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let t1_knight_entity_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, knight_t1_amount,
//             Direction::NorthWest);

//         // create T2 Knights
//         let t2_knight_entity_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T2, knight_t2_amount,
//             Direction::NorthEast);

//         // create T3 Knights
//         let t3_knight_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id,
//                 TroopType::Knight,
//                 TroopTier::T3,
//                 knight_t3_amount - (1 * RESOURCE_PRECISION),
//                 Direction::SouthWest,
//             );

//         // ensure explorer was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.troop_explorers.len(), 3);
//         assert_eq!(structure.troop_explorers.at(0), @t1_knight_entity_id);
//         assert_eq!(structure.troop_explorers.at(1), @t2_knight_entity_id);
//         assert_eq!(structure.troop_explorers.at(2), @t3_knight_entity_id);

//         // ensure troop resource was deducted from the structure
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
//         );
//         let mut t2_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T2, ref structure_weight, 100, true,
//         );
//         let mut t3_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T3, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_knight_resource.balance, 0);
//         assert_eq!(t2_knight_resource.balance, 0);
//         assert_eq!(t3_knight_resource.balance, 1 * RESOURCE_PRECISION);

//         // ensure troop is set correctly
//         let t1_knight: ExplorerTroops = world.read_model(t1_knight_entity_id);
//         assert_eq!(t1_knight.troops.category, TroopType::Knight);
//         assert_eq!(t1_knight.troops.tier, TroopTier::T1);
//         assert_eq!(t1_knight.troops.count, knight_t1_amount);

//         let t2_knight: ExplorerTroops = world.read_model(t2_knight_entity_id);
//         assert_eq!(t2_knight.troops.category, TroopType::Knight);
//         assert_eq!(t2_knight.troops.tier, TroopTier::T2);
//         assert_eq!(t2_knight.troops.count, knight_t2_amount);

//         let t3_knight: ExplorerTroops = world.read_model(t3_knight_entity_id);
//         assert_eq!(t3_knight.troops.category, TroopType::Knight);
//         assert_eq!(t3_knight.troops.tier, TroopTier::T3);
//         assert_eq!(t3_knight.troops.count, knight_t3_amount - (1 * RESOURCE_PRECISION));
//     }

//     #[test]
//     fn test_explorer_create_crossbowman_tiers() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T3),
//             ]
//                 .span(),
//         );
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();

//         let crossbowman_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let crossbowman_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let crossbowman_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

//         // grant troop resources
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![
//                 (ResourceTypes::CROSSBOWMAN_T1, crossbowman_t1_amount),
//                 (ResourceTypes::CROSSBOWMAN_T2, crossbowman_t2_amount),
//                 (ResourceTypes::CROSSBOWMAN_T3, crossbowman_t3_amount),
//             ]
//                 .span(),
//         );

//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // allow structure have up to 3 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 3;
//         world.write_model_test(@structure);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };

//         // create troops of each tier
//         let t1_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Crossbowman, TroopTier::T1, crossbowman_t1_amount, Direction::NorthWest,
//             );
//         let t2_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Crossbowman, TroopTier::T2, crossbowman_t2_amount, Direction::NorthEast,
//             );
//         let t3_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id,
//                 TroopType::Crossbowman,
//                 TroopTier::T3,
//                 crossbowman_t3_amount - (1 * RESOURCE_PRECISION),
//                 Direction::SouthWest,
//             );

//         // verify explorers
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.troop_explorers.len(), 3);
//         assert_eq!(structure.troop_explorers.at(0), @t1_entity_id);
//         assert_eq!(structure.troop_explorers.at(1), @t2_entity_id);
//         assert_eq!(structure.troop_explorers.at(2), @t3_entity_id);

//         // verify resources were spent
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T1, ref structure_weight, 100, true,
//         );
//         let mut t2_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T2, ref structure_weight, 100, true,
//         );
//         let mut t3_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T3, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_resource.balance, 0);
//         assert_eq!(t2_resource.balance, 0);
//         assert_eq!(t3_resource.balance, 1 * RESOURCE_PRECISION);

//         // ensure troop is set correctly
//         let t1_crossbowman: ExplorerTroops = world.read_model(t1_entity_id);
//         assert_eq!(t1_crossbowman.troops.category, TroopType::Crossbowman);
//         assert_eq!(t1_crossbowman.troops.tier, TroopTier::T1);
//         assert_eq!(t1_crossbowman.troops.count, crossbowman_t1_amount);

//         let t2_crossbowman: ExplorerTroops = world.read_model(t2_entity_id);
//         assert_eq!(t2_crossbowman.troops.category, TroopType::Crossbowman);
//         assert_eq!(t2_crossbowman.troops.tier, TroopTier::T2);
//         assert_eq!(t2_crossbowman.troops.count, crossbowman_t2_amount);

//         let t3_crossbowman: ExplorerTroops = world.read_model(t3_entity_id);
//         assert_eq!(t3_crossbowman.troops.category, TroopType::Crossbowman);
//         assert_eq!(t3_crossbowman.troops.tier, TroopTier::T3);
//         assert_eq!(t3_crossbowman.troops.count, crossbowman_t3_amount - (1 * RESOURCE_PRECISION));
//     }

//     #[test]
//     fn test_explorer_create_paladin_tiers() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T2),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T3),
//             ]
//                 .span(),
//         );
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();

//         let paladin_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let paladin_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
//         let paladin_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

//         // grant troop resources
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![
//                 (ResourceTypes::PALADIN_T1, paladin_t1_amount),
//                 (ResourceTypes::PALADIN_T2, paladin_t2_amount),
//                 (ResourceTypes::PALADIN_T3, paladin_t3_amount),
//             ]
//                 .span(),
//         );

//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // allow structure have up to 3 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 3;
//         world.write_model_test(@structure);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };

//         // create troops of each tier
//         let t1_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Paladin, TroopTier::T1, paladin_t1_amount, Direction::NorthWest,
//             );
//         let t2_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Paladin, TroopTier::T2, paladin_t2_amount, Direction::NorthEast,
//             );
//         let t3_entity_id = troop_systems
//             .explorer_create(
//                 realm_entity_id,
//                 TroopType::Paladin,
//                 TroopTier::T3,
//                 paladin_t3_amount - (1 * RESOURCE_PRECISION),
//                 Direction::SouthWest,
//             );

//         // verify explorers
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.troop_explorers.len(), 3);
//         assert_eq!(structure.troop_explorers.at(0), @t1_entity_id);
//         assert_eq!(structure.troop_explorers.at(1), @t2_entity_id);
//         assert_eq!(structure.troop_explorers.at(2), @t3_entity_id);

//         // verify resources were spent
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::PALADIN_T1, ref structure_weight, 100, true,
//         );
//         let mut t2_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::PALADIN_T2, ref structure_weight, 100, true,
//         );
//         let mut t3_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::PALADIN_T3, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_resource.balance, 0);
//         assert_eq!(t2_resource.balance, 0);
//         assert_eq!(t3_resource.balance, 1 * RESOURCE_PRECISION);

//         // ensure troop is set correctly
//         let t1_paladin: ExplorerTroops = world.read_model(t1_entity_id);
//         assert_eq!(t1_paladin.troops.category, TroopType::Paladin);
//         assert_eq!(t1_paladin.troops.tier, TroopTier::T1);
//         assert_eq!(t1_paladin.troops.count, paladin_t1_amount);

//         let t2_paladin: ExplorerTroops = world.read_model(t2_entity_id);
//         assert_eq!(t2_paladin.troops.category, TroopType::Paladin);
//         assert_eq!(t2_paladin.troops.tier, TroopTier::T2);
//         assert_eq!(t2_paladin.troops.count, paladin_t2_amount);

//         let t3_paladin: ExplorerTroops = world.read_model(t3_entity_id);
//         assert_eq!(t3_paladin.troops.category, TroopType::Paladin);
//         assert_eq!(t3_paladin.troops.tier, TroopTier::T3);
//         assert_eq!(t3_paladin.troops.count, paladin_t3_amount - (1 * RESOURCE_PRECISION));
//     }

//     #[test]
//     fn test_explorer_add_essentials() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant 2x troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create explorer 1
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // add troops to explorer 1
//         let structure_direction = Direction::SouthEast;
//         troop_systems.explorer_add(explorer_id, troop_amount, structure_direction);

//         // ensure explorer was added to the structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert_eq!(structure.troop_explorers.len(), 1);
//         assert_eq!(structure.troop_explorers.at(0), @explorer_id);

//         // ensure troop resource was deducted from the structure
//         let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
//         let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
//             ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
//         );
//         assert_eq!(t1_knight_resource.balance, 0);

//         // ensure troop stamina was set correctly
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into());
//         assert_eq!(explorer.troops.stamina.updated_tick, 1);

//         // ensure troop coord is a neighbor of the structure
//         assert_eq!(explorer.coord, realm_coord.neighbor(troop_spawn_direction));

//         // ensure explorer is owned by the structure
//         assert_eq!(explorer.owner, realm_entity_id);

//         // ensure troop is set correctly
//         assert_eq!(explorer.troops.count, troop_amount * 2);
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);

//         // ensure troop capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         assert_eq!(
//             explorer_weight.capacity.into(), MOCK_CAPACITY_CONFIG().troop_capacity.into() * troop_amount.into() * 2,
//         );
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_add__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant 2x troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create explorer 1
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // set an unknown caller address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());

//         // set structure direction
//         let structure_direction = Direction::SouthEast;
//         troop_systems.explorer_add(explorer_id, troop_amount, structure_direction);
//     }

//     #[test]
//     #[should_panic(
//         expected: ("Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 100000000000000", 'ENTRYPOINT_FAILED'),
//     )]
//     fn test_explorer_add__fails_insufficient_balance() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // don't grant any resources to the structure
//         tgrant_resources(ref world, realm_entity_id, array![].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create explorer 1
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // set structure direction
//         let structure_direction = Direction::SouthEast;
//         troop_systems.explorer_add(explorer_id, troop_amount, structure_direction);
//     }

//     #[test]
//     fn test_explorer_delete() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant troop resources to the structure
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create explorer
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // kill all troops (required for deletion)
//         let mut explorer: ExplorerTroops = world.read_model(explorer_id);
//         explorer.troops.count = 0;
//         world.write_model_test(@explorer);

//         // delete explorer
//         troop_systems.explorer_delete(explorer_id);

//         // verify explorer was removed from structure
//         let structure: Structure = world.read_model(realm_entity_id);
//         assert!(structure.troop_explorers.len() == 0, "explorer not removed from structure");

//         // verify occupier was cleared
//         let spawn_coord = realm_coord.neighbor(troop_spawn_direction);
//         let occupier: Occupier = world.read_model((spawn_coord.x, spawn_coord.y));
//         assert!(occupier.not_occupied(), "occupier not cleared");

//         // verify explorer model was deleted
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert!(explorer.owner == Zero::zero(), "explorer model was not deleted");
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_delete__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant troop resources to the structure
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // create explorer as owner
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // kill all troops (required for deletion)
//         let mut explorer: ExplorerTroops = world.read_model(explorer_id);
//         explorer.troops.count = 0;
//         world.write_model_test(@explorer);

//         // try to delete explorer as non-owner
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'not_owner'>());
//         troop_systems.explorer_delete(explorer_id);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer unit is alive", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_delete__fails_troops_alive() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant troop resources to the structure
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create explorer
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // try to delete explorer while troops are still alive
//         troop_systems.explorer_delete(explorer_id);
//     }

//     #[test]
//     fn test_explorer_swap_essentials() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant troop resources to the structure
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount + troop_2_initial_amount)].span(),
//         );

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);
//         starknet::testing::set_block_timestamp(1);

//         // create source explorer
//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);

//         // reduce source explorer stamina by half
//         let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
//         assert!(from_explorer.troops.stamina.amount.is_non_zero(), "source explorer stamina should not be zero");
//         from_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount / 2;
//         assert!(from_explorer.troops.stamina.amount.is_non_zero(), "source explorer stamina should still not be
//         zero");
//         world.write_model_test(@from_explorer);

//         // get source explorer weight before swap
//         let from_explorer_weight_before: Weight = WeightStoreImpl::retrieve(ref world, from_explorer_id);

//         // create target explorer (with no troops)
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );
//         let to_explorer_weight_before: Weight = WeightStoreImpl::retrieve(ref world, to_explorer_id);
//         // swap troops between explorers
//         let swap_amount = 20_000 * RESOURCE_PRECISION;
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, swap_amount);

//         // verify source explorer troops were reduced
//         let from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
//         assert_eq!(from_explorer.troops.count, troop_amount - swap_amount, "incorrect source explorer troop count");

//         // verify target explorer received troops
//         let to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
//         assert_eq!(
//             to_explorer.troops.count, swap_amount + troop_2_initial_amount, "incorrect target explorer troop count",
//         );

//         // verify stamina was properly transferred
//         assert_eq!(
//             to_explorer.troops.stamina.amount, from_explorer.troops.stamina.amount, "stamina mismatch after swap",
//         );

//         // ensure the capacity of source explorer was reduced
//         let from_explorer_weight_after: Weight = WeightStoreImpl::retrieve(ref world, from_explorer_id);
//         assert!(
//             from_explorer_weight_after.capacity < from_explorer_weight_before.capacity,
//             "source explorer capacity was not reduced",
//         );

//         // ensure the capacity of target explorer was increased
//         let to_explorer_weight_after: Weight = WeightStoreImpl::retrieve(ref world, to_explorer_id);
//         assert!(
//             to_explorer_weight_after.capacity > to_explorer_weight_before.capacity,
//             "target explorer capacity was not increased",
//         );
//     }

//     #[test]
//     fn test_explorer_swap_deletes_if_from_explorer_count_is_zero() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs with low troop limit
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION; // More than the limit when combined
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // setup
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T1,
//             troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // swap out all troops from from_explorer
//         starknet::testing::set_contract_address(owner);
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount);

//         // check that from_explorer is deleted
//         let from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
//         assert!(from_explorer.owner.is_zero(), "from_explorer should have been deleted");
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant resources and create explorers as owner
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount + troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // try to swap as non-owner
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'not_owner'>());
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("from explorer and to explorer have different tiers", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_wrong_tier() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant resources and create explorers as owner
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T2,
//             troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T2, troop_2_initial_amount, Direction::NorthEast,
//             );

//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("from explorer and to explorer have different categories", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_wrong_category() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant resources and create explorers as owner
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::CROSSBOWMAN_T1, troop_2_initial_amount)]
//                 .span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Crossbowman, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("insufficient troops in source explorer", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_insufficient_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant resources and setup
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // try to swap more troops than available
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount * 2);
//     }

//     #[test]
//     #[should_panic(expected: ("to explorer has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_target_has_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // grant resources and setup
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         // create target explorer with troops
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // update troop count of target explorer
//         let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
//         to_explorer.troops.count = 0;
//         world.write_model_test(@to_explorer);

//         // try to swap to an explorer that already has no troops
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount / 2);
//     }

//     #[test]
//     #[should_panic(expected: ("count must be greater than 0", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_zero_count() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // setup
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount + troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // try to swap zero troops
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, 0);
//     }

//     #[test]
//     #[should_panic(expected: ("count must be divisible by resource precision", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_not_divisible_by_precision() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // setup
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount + troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // try to swap zero troops
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, RESOURCE_PRECISION -
//         1);
//     }

//     #[test]
//     #[should_panic(expected: ("to explorer is not at the target coordinate", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_invalid_direction() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // setup
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T1,
//             troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // try to swap with incorrect direction (explorers not adjacent)
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::SouthEast, troop_amount /
//         2);
//     }

//     #[test]
//     #[should_panic(expected: ("reached limit of explorers amount per army", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_swap__fails_exceeds_max_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs with low troop limit
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION; // More than the limit when combined
//         let troop_2_initial_amount: u128 = 50_000 * RESOURCE_PRECISION;

//         // allow structure have up to 2 explorers
//         let mut structure: Structure = world.read_model(realm_entity_id);
//         structure.base.troop_max_explorer_count = 2;
//         world.write_model_test(@structure);

//         // setup
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T1,
//             troop_2_initial_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let troop_systems = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr };
//         let from_explorer_id = troop_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);
//         let to_explorer_id = troop_systems
//             .explorer_create(
//                 realm_entity_id, TroopType::Knight, TroopTier::T1, troop_2_initial_amount, Direction::NorthEast,
//             );

//         // Set very low troop limit
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut low_troop_limit = MOCK_TROOP_LIMIT_CONFIG();
//         low_troop_limit.explorer_guard_max_troop_count = 1; // Set very low limit
//         tstore_troop_limit_config(ref world, low_troop_limit);

//         // try to swap amount that would exceed max troop limit
//         starknet::testing::set_contract_address(owner);
//         troop_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, Direction::East, troop_amount);
//     }

//     #[test]
//     fn test_explorer_guard_swap_partial() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = 30_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);

//         // ensure explorer has correct count
//         let new_explorer_amount = (troop_amount / 2) - swap_amount;
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.count, new_explorer_amount, "explorer count mismatch");
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);

//         // ensure guard has correct count
//         let new_guard_amount = (troop_amount / 2) + swap_amount;
//         let structure: Structure = world.read_model(realm_entity_id);
//         let guard_troops: Troops = structure.troop_guards.delta;
//         assert_eq!(guard_troops.count, new_guard_amount, "guard count mismatch");
//         assert_eq!(guard_troops.category, TroopType::Knight);
//         assert_eq!(guard_troops.tier, TroopTier::T1);

//         // ensure explorer stamina is correct
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // ensure guard stamina is has been reduced to that of the explorer
//         assert_eq!(guard_troops.stamina.amount, explorer.troops.stamina.amount, "stamina mismatch");

//         // ensure explorer capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let explorer_capacity: u128 = new_explorer_amount * MOCK_CAPACITY_CONFIG().troop_capacity.into();
//         assert_eq!(explorer_weight.capacity, explorer_capacity, "explorer capacity is not correct");
//     }

//     #[test]
//     fn test_explorer_guard_swap_full() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = 50_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);

//         // ensure explorer has correct count
//         let new_explorer_amount = 0;
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.count, new_explorer_amount);
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);

//         // ensure guard has correct count
//         let new_guard_amount = troop_amount;
//         let structure: Structure = world.read_model(realm_entity_id);
//         let guard_troops: Troops = structure.troop_guards.delta;
//         assert_eq!(guard_troops.count, new_guard_amount);
//         assert_eq!(guard_troops.category, TroopType::Knight);
//         assert_eq!(guard_troops.tier, TroopTier::T1);

//         // ensure explorer stamina is correct
//         assert_eq!(explorer.troops.stamina.amount, 0);

//         // ensure guard stamina is has been reduced to that of the explorer before death
//         assert_eq!(guard_troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into());

//         // ensure explorer capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let explorer_capacity: u128 = new_explorer_amount * MOCK_CAPACITY_CONFIG().troop_capacity.into();
//         assert_eq!(explorer_weight.capacity, explorer_capacity);
//     }

//     #[test]
//     fn test_explorer_guard_swap_no_guards() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());

//         // create explorer two ticks in the future
//         let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller to owner
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());
//         assert_eq!(explorer.troops.category, TroopType::Paladin);
//         assert_eq!(explorer.troops.tier, TroopTier::T3);

//         // perform swap
//         let swap_amount = 20_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);

//         // ensure explorer has correct count
//         let new_explorer_amount = troop_amount - swap_amount;
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.count, new_explorer_amount);
//         assert_eq!(explorer.troops.category, TroopType::Paladin);
//         assert_eq!(explorer.troops.tier, TroopTier::T3);

//         // ensure guard has correct count
//         let new_guard_amount = swap_amount;
//         let structure: Structure = world.read_model(realm_entity_id);
//         let guard_troops: Troops = structure.troop_guards.delta;
//         assert_eq!(guard_troops.count, new_guard_amount);
//         assert_eq!(guard_troops.category, TroopType::Paladin);
//         assert_eq!(guard_troops.tier, TroopTier::T3);

//         // ensure explorer stamina is correct
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into());

//         // ensure guard stamina is has no stamina
//         assert_eq!(guard_troops.stamina.amount, 0);

//         // ensure explorer capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let explorer_capacity: u128 = new_explorer_amount * MOCK_CAPACITY_CONFIG().troop_capacity.into();
//         assert_eq!(explorer_weight.capacity, explorer_capacity);
//     }

//     #[test]
//     #[should_panic(expected: ("from explorer and structure guard have different categories", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_guard_swap__fails_different_categories() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(
//                 realm_entity_id, TroopType::Crossbowman, TroopTier::T1, troop_amount / 2, Direction::NorthWest,
//             );

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = 50_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("from explorer and structure guard have different tiers", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_guard_swap__fails_different_tiers() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T2, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T2, troop_amount / 2,
//             Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = 50_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer is not adjacent to structure", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_guard_swap__fails_not_adjacent() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount);

//         // create explorer in wrong direction
//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthWest);

//         // attempt swap with incorrect direction
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::NorthWest, GuardSlot::Delta, troop_amount);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_guard_swap__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // set unknown caller
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());

//         // perform swap
//         let swap_amount = 50_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);
//     }

//     // essentially ensure iGuardImpl::add is called
//     #[test]
//     #[should_panic(expected: ("reached limit of structure guard troop count", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_guard_swap__fails_reached_guard_troops_limit() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 2
//             * MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into()
//             * RESOURCE_PRECISION;

//         // grant resources
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         starknet::testing::set_contract_address(owner);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // create explorer two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_guard_swap(explorer_id, realm_entity_id, Direction::SouthEast, GuardSlot::Delta, swap_amount);
//     }

//     #[test]
//     fn test_guard_explorer_swap_partial() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = 30_000 * RESOURCE_PRECISION;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthWest, swap_amount);

//         // ensure explorer has correct count
//         let new_explorer_amount = (troop_amount / 2) + swap_amount;
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.count, new_explorer_amount, "explorer count mismatch");
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);

//         // ensure guard has correct count
//         let new_guard_amount = (troop_amount / 2) - swap_amount;
//         let structure: Structure = world.read_model(realm_entity_id);
//         let guard_troops: Troops = structure.troop_guards.delta;
//         assert_eq!(guard_troops.count, new_guard_amount, "guard count mismatch");
//         assert_eq!(guard_troops.category, TroopType::Knight);
//         assert_eq!(guard_troops.tier, TroopTier::T1);

//         // ensure guard stamina is has been reduced to that of the explorer
//         assert_eq!(guard_troops.stamina.amount, explorer.troops.stamina.amount, "stamina mismatch");

//         // ensure explorer stamina is correct
//         assert_eq!(explorer.troops.stamina.amount, 0);

//         // ensure explorer capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let explorer_capacity: u128 = new_explorer_amount * MOCK_CAPACITY_CONFIG().troop_capacity.into();
//         assert_eq!(explorer_weight.capacity, explorer_capacity, "explorer capacity is not correct");
//     }

//     #[test]
//     fn test_guard_explorer_swap_full() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthWest);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthWest, swap_amount);

//         // ensure explorer has correct count
//         let new_explorer_amount = (troop_amount / 2) + swap_amount;
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.count, new_explorer_amount, "explorer count mismatch");
//         assert_eq!(explorer.troops.category, TroopType::Knight);
//         assert_eq!(explorer.troops.tier, TroopTier::T1);

//         // ensure guard has correct count
//         let new_guard_amount = 0;
//         let structure: Structure = world.read_model(realm_entity_id);
//         let guard_troops: Troops = structure.troop_guards.delta;
//         assert_eq!(guard_troops.count, new_guard_amount, "guard count mismatch");

//         // ensure guard stamina is has been reduced to that of the explorer
//         assert_eq!(guard_troops.stamina.amount, explorer.troops.stamina.amount, "stamina mismatch");

//         // ensure explorer stamina is correct
//         assert_eq!(explorer.troops.stamina.amount, 0);

//         // ensure explorer capacity is correct
//         let explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let explorer_capacity: u128 = new_explorer_amount * MOCK_CAPACITY_CONFIG().troop_capacity.into();
//         assert_eq!(explorer_weight.capacity, explorer_capacity, "explorer capacity is not correct");
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // set unknown caller
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("structure is not adjacent to explorer", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_not_adjacent() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthWest, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("structure guard is dead", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_structure_guard_dead() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // // create guard two ticks in the future
//         // current_tick = current_tick * 2;
//         // starknet::testing::set_block_timestamp(current_tick);
//         // ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//         //     .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_explorer_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = 100_000 * RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // note: we expect this to be impossible anyway because dead explorer owner would
//         // have been set to 0

//         // set explorer troop count to 0
//         let mut explorer: ExplorerTroops = world.read_model(explorer_id);
//         explorer.troops.count = 0;
//         world.write_model_test(@explorer);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("reached limit of explorer troop count", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_explorer_reached_limit() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount * 2)].span());
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, Direction::NorthEast);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T1, troop_amount);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer and structure guard have different categories", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_different_categories() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::CROSSBOWMAN_T1, troop_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T1, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer and structure guard have different tiers", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_explorer_swap__fails_different_tiers() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set configs
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_weight_config(ref world, array![MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)].span());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // setup structure guard
//         tgrant_resources(
//             ref world,
//             realm_entity_id,
//             array![(ResourceTypes::KNIGHT_T1, troop_amount), (ResourceTypes::KNIGHT_T2, troop_amount)].span(),
//         );
//         starknet::testing::set_contract_address(owner);

//         let explorer_id = ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount / 2,
//             Direction::NorthEast);

//         // create guard two ticks in the future
//         current_tick = current_tick * 2;
//         starknet::testing::set_block_timestamp(current_tick);
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_add(realm_entity_id, GuardSlot::Delta, TroopType::Knight, TroopTier::T2, troop_amount / 2);

//         // ensure explorer has correct stamina
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_gain_per_tick.into());

//         // perform swap
//         let swap_amount = troop_amount / 2;
//         ITroopManagementSystemsDispatcher { contract_address: troop_management_system_addr }
//             .guard_explorer_swap(realm_entity_id, GuardSlot::Delta, explorer_id, Direction::NorthEast, swap_amount);
//     }
// }
