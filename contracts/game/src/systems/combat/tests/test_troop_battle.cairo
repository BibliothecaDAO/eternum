// #[cfg(test)]
// mod tests {
//     use core::num::traits::zero::Zero;
//     use dojo::model::{ModelStorage, ModelStorageTest};
//     use dojo::world::{WorldStorageTrait};
//     use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};
//     use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
//     use crate::models::config::{WorldConfigUtilImpl};
//     use crate::models::map::{TileImpl};
//     use crate::models::position::{Coord, CoordTrait, Direction, OccupiedBy, Occupier};
//     use crate::models::resource::resource::{SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl};
//     use crate::models::structure::{
//         Structure, StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureImpl,
//         StructureTroopExplorerStoreImpl,
//     };
//     use crate::models::troop::{ExplorerTroops, GuardImpl, GuardSlot, TroopTier, TroopType, Troops};
//     use crate::models::{
//         config::{m_ProductionConfig, m_WeightConfig, m_WorldConfig}, map::{m_Tile}, position::{m_Occupier},
//         realm::{m_Realm}, resource::production::building::{m_Building, m_StructureBuildings},
//         resource::resource::{m_Resource}, structure::{m_Structure}, troop::{m_ExplorerTroops},
//     };
//     use crate::systems::combat::contracts::troop_battle::{
//         ITroopBattleSystemsDispatcher, ITroopBattleSystemsDispatcherTrait, troop_battle_systems,
//     };
//     use crate::systems::combat::contracts::troop_management::{
//         ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
//     };
//     use crate::systems::combat::contracts::troop_movement::{
//         ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait, troop_movement_systems,
//     };
//     use crate::utils::testing::helpers::{
//         MOCK_CAPACITY_CONFIG, MOCK_MAP_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_DAMAGE_CONFIG, MOCK_TROOP_LIMIT_CONFIG,
//         MOCK_TROOP_STAMINA_CONFIG, MOCK_WEIGHT_CONFIG, tgrant_resources, tspawn_simple_realm, tspawn_world,
//         tstore_capacity_config, tstore_map_config, tstore_tick_config, tstore_troop_damage_config,
//         tstore_troop_limit_config, tstore_troop_stamina_config, tstore_weight_config,
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
//                 TestResource::Contract(troop_movement_systems::TEST_CLASS_HASH),
//                 TestResource::Contract(troop_battle_systems::TEST_CLASS_HASH),
//             ]
//                 .span(),
//         };

//         ndef
//     }

//     fn contract_defs() -> Span<ContractDef> {
//         [
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_battle_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
//         ]
//             .span()
//     }

//     #[test]
//     fn test_explorer_vs_explorer_one_dies() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_coord = first_realm_coord.neighbor(troop_spawn_direction);
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, Direction::West);

//         // ensure second realm explorer troop count is higher than first realm explorer troop count
//         let first_realm_explorer: ExplorerTroops = world.read_model(first_realm_explorer_id);
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count > first_realm_explorer.troops.count);

//         // ensure second realm explorer Occupier model is still occupied by second realm explorer
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer.coord);
//         assert!(second_realm_explorer_occupier.occupier == OccupiedBy::Explorer(second_realm_explorer_id));

//         // ensure first realm explorer is dead
//         assert!(first_realm_explorer.troops.count.is_zero());

//         // ensure first realm structure explorers list is empty
//         let mut first_realm_structure_explorers_list: Span<u32> = StructureTroopExplorerStoreImpl::retrieve(
//             ref world, first_realm_entity_id,
//         )
//             .into();
//         assert!(first_realm_structure_explorers_list.is_empty());

//         // ensure first realm structure base troop explorer count is zero
//         let mut first_realm_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(
//             ref world, first_realm_entity_id,
//         );
//         assert!(first_realm_structure_base.troop_explorer_count.is_zero());

//         // ensure occupier model of first realm explorer tile is deleted
//         let first_realm_explorer_tile_occupier: Occupier = world.read_model(first_realm_explorer_coord);
//         assert!(first_realm_explorer_tile_occupier.occupier == OccupiedBy::None);
//     }

//     #[test]
//     fn test_explorer_vs_explorer_both_live() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_coord = first_realm_coord.neighbor(troop_spawn_direction);
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, Direction::West);

//         // ensure second realm explorer troop count is higher than first realm explorer troop count
//         let first_realm_explorer: ExplorerTroops = world.read_model(first_realm_explorer_id);
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count > first_realm_explorer.troops.count);

//         // ensure second realm explorer Occupier model is still occupied by second realm explorer
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer.coord);
//         assert!(second_realm_explorer_occupier.occupier == OccupiedBy::Explorer(second_realm_explorer_id));

//         // ensure first realm explorer is not dead
//         assert!(first_realm_explorer.troops.count.is_non_zero());

//         // ensure occupier model of first realm explorer tile is still occupied by first realm explorer
//         let first_realm_explorer_tile_occupier: Occupier = world.read_model(first_realm_explorer_coord);
//         assert!(first_realm_explorer_tile_occupier.occupier == OccupiedBy::Explorer(first_realm_explorer_id));
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_explorer__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         // set caller to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, Direction::West);
//     }

//     #[test]
//     #[should_panic(expected: ("explorers are not adjacent", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_explorer__fails_not_adjacent() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };

//         let wrong_direction = Direction::NorthEast;
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, wrong_direction);
//     }

//     #[test]
//     #[should_panic(expected: ("aggressor has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_explorer__fails_aggressor_dead() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // destroy second realm (aggressor) explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         second_realm_explorer.troops.count = 0;
//         world.write_model_test(@second_realm_explorer);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, Direction::West);
//     }

//     #[test]
//     #[should_panic(expected: ("defender has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_explorer__fails_defender_dead() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE EXPLORER FOR FIRST REALM  ///////////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::East;
//         let first_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 first_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER MOVES TO MEET FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // destroy first realm (defender) explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut first_realm_explorer: ExplorerTroops = world.read_model(first_realm_explorer_id);
//         first_realm_explorer.troops.count = 0;
//         world.write_model_test(@first_realm_explorer);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM EXPLORER  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_explorer_vs_explorer(second_realm_explorer_id, first_realm_explorer_id, Direction::West);
//     }

//     #[test]
//     fn test_explorer_vs_guard_and_guard_dies() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         Direction::West);

//         // ensure second realm explorer troop count is higher than first realm explorer troop count
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         let first_realm_guard_troops: Troops = first_realm_structure.troop_guards.delta;
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count > first_realm_guard_troops.count);

//         // ensure second realm explorer Occupier model is still occupied by second realm explorer
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer.coord);
//         assert!(second_realm_explorer_occupier.occupier == OccupiedBy::Explorer(second_realm_explorer_id));

//         // ensure first realm guard is dead
//         assert!(first_realm_guard_troops.count.is_zero());

//         // ensure first realm structure troop guard count is zero
//         assert!(first_realm_structure.base.troop_guard_count.is_zero());

//         // ensure first realm structure was claimed by second realm owner
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         assert_eq!(first_realm_structure.owner, second_realm_owner);
//     }

//     #[test]
//     fn test_explorer_vs_guard_and_explorer_dies() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
//         tgrant_resources(
//             ref world, second_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Paladin, TroopTier::T3, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         let second_realm_explorer_coord = second_realm_explorer.coord;

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         Direction::West);

//         // ensure second realm explorer troop count is less than first realm explorer troop count
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         let first_realm_guard_troops: Troops = first_realm_structure.troop_guards.delta;
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count < first_realm_guard_troops.count);

//         // ensure second realm explorer Occupier model is deleted
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer_coord);
//         assert_eq!(second_realm_explorer_occupier.occupier, OccupiedBy::None);

//         // ensure first realm guard is alive
//         assert_gt!(first_realm_guard_troops.count, 0);

//         // ensure first realm structure troop guard count is non-zero
//         assert_gt!(first_realm_structure.base.troop_guard_count, 0);
//     }

//     #[test]
//     fn test_explorer_vs_guard_claim_structure_if_guards_has_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount * 2)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ///////  To spice things up, ALSO CREATE CHARLIE GUARD ///////////
//         ///////  IT SHOULD NOT AFFECT THE TEST RESULTS  //////////////////
//         ///////  CHARLIE GUARD SHOULD BE IGNORED  ////////////////////////
//         //////////////////////////////////////////////////////////////////
//         // allow up to 2 guard troops
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         first_realm_structure.base.troop_max_guard_count = 2;
//         world.write_model_test(@first_realm_structure);

//         // add charlie guard
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Charlie, TroopType::Crossbowman, TroopTier::T2,
//             troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // set first realm guard troop count to 0
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         first_realm_structure.troop_guards.delta.count = 0;
//         world.write_model(@first_realm_structure);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         Direction::West);

//         // ensure owner of first realm structure is second realm owner
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         assert_eq!(first_realm_structure.owner, second_realm_owner);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_guard__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
//         tgrant_resources(
//             ref world, second_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Paladin, TroopTier::T3, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         // set caller to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         Direction::West);
//     }

//     #[test]
//     #[should_panic(expected: ("aggressor has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_guard__fails_aggressor_has_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // set second realm explorer troop count to 0
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         second_realm_explorer.troops.count = 0;
//         world.write_model(@second_realm_explorer);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         Direction::West);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer is not adjacent to structure", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_vs_guard__fails_not_adjacent() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// SECOND REALM EXPLORER ATTACKS FIRST REALM GUARD ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };

//         // set the wrong direction
//         let wrong_direction = Direction::NorthEast;
//         troop_battle_systems.attack_explorer_vs_guard(second_realm_explorer_id, first_realm_entity_id,
//         wrong_direction);
//     }

//     #[test]
//     fn test_guard_vs_explorer_and_guard_dies() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, Direction::East,
//             );

//         // ensure second realm explorer troop count is higher than first realm explorer troop count
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         let first_realm_guard_troops: Troops = first_realm_structure.troop_guards.delta;
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count > first_realm_guard_troops.count);

//         // ensure second realm explorer Occupier model is still occupied by second realm explorer
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer.coord);
//         assert!(second_realm_explorer_occupier.occupier == OccupiedBy::Explorer(second_realm_explorer_id));

//         // ensure first realm guard is dead
//         assert!(first_realm_guard_troops.count.is_zero());

//         // ensure first realm structure troop guard count is zero
//         assert!(first_realm_structure.base.troop_guard_count.is_zero());

//         // ensure first realm structure was claimed by second realm owner
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         assert_eq!(first_realm_structure.owner, second_realm_owner);
//     }

//     #[test]
//     fn test_guard_vs_explorer_and_explorer_dies() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
//         tgrant_resources(
//             ref world, second_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Paladin, TroopTier::T3, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         let second_realm_explorer_coord = second_realm_explorer.coord;

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, Direction::East,
//             );

//         // ensure second realm explorer troop count is less than first realm explorer troop count
//         let first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         let first_realm_guard_troops: Troops = first_realm_structure.troop_guards.delta;
//         let second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         assert!(second_realm_explorer.troops.count < first_realm_guard_troops.count);

//         // ensure second realm explorer Occupier model is deleted
//         let second_realm_explorer_occupier: Occupier = world.read_model(second_realm_explorer_coord);
//         assert_eq!(second_realm_explorer_occupier.occupier, OccupiedBy::None);

//         // ensure first realm guard is alive
//         assert_gt!(first_realm_guard_troops.count, 0);

//         // ensure first realm structure troop guard count is non-zero
//         assert_gt!(first_realm_structure.base.troop_guard_count, 0);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_guard_vs_explorer__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(ref world, first_realm_entity_id, array![(ResourceTypes::PALADIN_T3, troop_amount)].span());
//         tgrant_resources(
//             ref world, second_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Paladin, TroopTier::T3, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Crossbowman, TroopTier::T2, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         // set caller to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, Direction::East,
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("guard slot is dead", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_vs_explorer__fails_when_guard_slot_has_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // set first realm guard troop count to 0
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut first_realm_structure: Structure = world.read_model(first_realm_entity_id);
//         first_realm_structure.troop_guards.delta.count = 0;
//         world.write_model(@first_realm_structure);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, Direction::West,
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("defender has no troops", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_vs_explorer__fails_defender_has_no_troops() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         // set second realm explorer troop count to 0
//         starknet::testing::set_contract_address(Zero::zero());
//         let mut second_realm_explorer: ExplorerTroops = world.read_model(second_realm_explorer_id);
//         second_realm_explorer.troops.count = 0;
//         world.write_model(@second_realm_explorer);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, Direction::East,
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("structure is not adjacent to explorer", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_vs_explorer__fails_not_adjacent() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };

//         // set the wrong direction
//         let wrong_direction = Direction::NorthEast;
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Delta, second_realm_explorer_id, wrong_direction,
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("slot can't be selected", 'ENTRYPOINT_FAILED'))]
//     fn test_guard_vs_explorer__fails_not_functional_slot() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let (troop_battle_system_addr, _) = world.dns(@"troop_battle_systems").unwrap();

//         ////////////////  CREATE 1st REALM  ////////////////
//         ////////////////////////////////////////////////////

//         let first_realm_owner = starknet::contract_address_const::<'first_realm_owner'>();
//         let first_realm_coord = Coord { x: 80, y: 80 };
//         let first_realm_entity_id = tspawn_simple_realm(ref world, 1, first_realm_owner, first_realm_coord);

//         ////////////////  CREATE 2nd REALM  ////////////////
//         ////////////////////////////////////////////////////
//         let directions_from_first_realm_to_second_realm = array![
//             Direction::East, Direction::East, Direction::East, Direction::East,
//         ]
//             .span();
//         let second_realm_owner = starknet::contract_address_const::<'second_realm_owner'>();
//         let mut second_realm_coord = first_realm_coord;
//         for direction in directions_from_first_realm_to_second_realm {
//             second_realm_coord = second_realm_coord.neighbor(*direction);
//         };
//         let second_realm_entity_id = tspawn_simple_realm(ref world, 2, second_realm_owner, second_realm_coord);

//         ////////////  GRANT RESOURCES TO BOTH REALMS  /////////////
//         ////////////////////////////////////////////////////////////
//         // grant troop resources to the structures to be able to create troops
//         // first realm gets crossbowmen t2
//         // second realm gets paladins t3
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;
//         tgrant_resources(
//             ref world, first_realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span(),
//         );
//         tgrant_resources(ref world, second_realm_entity_id, array![(ResourceTypes::PALADIN_T3,
//         troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         ////////////////  CREATE DELTA GUARD FOR FIRST REALM  ///////////
//         /////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         troop_management_systems
//             .guard_add(first_realm_entity_id, GuardSlot::Delta, TroopType::Crossbowman, TroopTier::T2, troop_amount);

//         ////////////  CREATE EXPLORER FOR SECOND REALM  ///////////
//         ///////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::West;
//         let second_realm_explorer_id = troop_management_systems
//             .explorer_create(
//                 second_realm_entity_id, TroopType::Paladin, TroopTier::T3, troop_amount, troop_spawn_direction,
//             );

//         ///////  GRANT FOOD RESOURCES TO SECOND REALM EXPLORER ///////
//         //////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             second_realm_explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         //// SECOND REALM EXPLORER GOES ADJACENT TO FIRST REALM  ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(second_realm_owner);
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::West].span();
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);
//         troop_movement_systems.explorer_move(second_realm_explorer_id, troop_movement_directions, true);

//         //// FIRST REALM GUARD ATTACKS SECOND REALM EXPLORER ////
//         ///////////////////////////////////////////////////////////////////
//         starknet::testing::set_contract_address(first_realm_owner);
//         // grant enough time before attacking to have enough stamina
//         starknet::testing::set_block_timestamp(current_tick * 5);
//         let troop_battle_systems = ITroopBattleSystemsDispatcher { contract_address: troop_battle_system_addr };

//         // set the wrong direction
//         troop_battle_systems
//             .attack_guard_vs_explorer(
//                 first_realm_entity_id, GuardSlot::Charlie, second_realm_explorer_id, Direction::East,
//             );
//     }
// }
