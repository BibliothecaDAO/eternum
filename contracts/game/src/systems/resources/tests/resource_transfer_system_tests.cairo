// mod resource_transfer_system_tests {
//     use core::num::traits::Bounded;

//     use core::traits::Into;
//     use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
//     use dojo::world::{WorldStorage, WorldStorageTrait};
//     use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
//     use crate::alias::ID;
//     use crate::constants::DONKEY_ENTITY_TYPE;

//     use crate::constants::ResourceTypes;
//     use crate::constants::WORLD_CONFIG_ID;
//     use crate::models::config::WeightConfig;
//     use crate::models::config::{CapacityCategory, CapacityConfig};
//     use crate::models::owner::{EntityOwner, Owner};
//     use crate::models::position::Position;
//     use crate::models::quantity::Quantity;
//     use crate::models::resource::resource::{Resource, ResourceAllowance};

//     use crate::systems::config::contracts::{IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
//     config_systems};

//     use crate::systems::resources::contracts::resource_systems::{
//         IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait, resource_systems,
//     };

//     use crate::utils::testing::{config::set_capacity_config, systems::deploy_system, world::spawn_eternum};
//     use starknet::contract_address_const;

//     fn setup() -> (WorldStorage, IResourceSystemsDispatcher) {
//         let mut world = spawn_eternum();

//         let config_systems_address = deploy_system(ref world, "config_systems");

//         set_capacity_config(config_systems_address);

//         // set weight configuration for stone
//         IWeightConfigDispatcher { contract_address: config_systems_address }
//             .set_resource_weight_config(ResourceTypes::STONE.into(), 200);

//         // set weight configuration for gold
//         IWeightConfigDispatcher { contract_address: config_systems_address }
//             .set_resource_weight_config(ResourceTypes::WOOD.into(), 200);

//         // set donkey config
//         world.write_model_test(@CapacityConfig { category: CapacityCategory::Donkey, weight_gram: 1_000_000 });

//         let resource_systems_address = deploy_system(ref world, "resource_systems");

//         let resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: resource_systems_address };

//         (world, resource_systems_dispatcher)
//     }

//     fn make_owner_and_receiver(ref world: WorldStorage, sender_entity_id: ID, receiver_entity_id: ID) {
//         let sender_entity_position = Position { x: 100_000, y: 200_000, entity_id: sender_entity_id.into() };

//         world.write_model_test(@sender_entity_position);
//         world
//             .write_model_test(
//                 @Owner { address: contract_address_const::<'owner_entity'>(), entity_id: sender_entity_id.into() },
//             );
//         world
//             .write_model_test(
//                 @EntityOwner { entity_id: sender_entity_id.into(), entity_owner_id: sender_entity_id.into() },
//             );
//         world
//             .write_model_test(
//                 @Resource { entity_id: sender_entity_id.into(), resource_type: ResourceTypes::STONE, balance: 1000 },
//             );
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: sender_entity_id.into(), resource_type: ResourceTypes::DONKEY, balance: 1_000_000_000,
//                 },
//             );
//         world
//             .write_model_test(
//                 @CapacityCategory { entity_id: sender_entity_id.into(), category: CapacityCategory::Structure },
//             );
//         world
//             .write_model_test(
//                 @Resource { entity_id: sender_entity_id.into(), resource_type: ResourceTypes::WOOD, balance: 1000 },
//             );

//         let receiver_entity_position: Position = Position {
//             x: 200_000, y: 100_000, entity_id: receiver_entity_id.into(),
//         };
//         world.write_model_test(@receiver_entity_position);
//         world
//             .write_model_test(
//                 @CapacityCategory { entity_id: receiver_entity_id.into(), category: CapacityCategory::Structure },
//             );
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: receiver_entity_id.into(), resource_type: ResourceTypes::DONKEY, balance:
//                     1_000_000_000,
//                 },
//             );

//         // call world.dispatcher.uuid() to ensure next id isn't 0
//         world.dispatcher.uuid();
//     }

//     ////////////////////////////
//     // Test transfer
//     ////////////////////////////

//     #[test]
//     #[available_gas(30000000000000)]
//     fn resources_test_transfer() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let sender_entity_id: ID = 11;
//         let receiver_entity_id: ID = 12;
//         make_owner_and_receiver(ref world, sender_entity_id, receiver_entity_id);

//         // transfer resources
//         starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

//         resource_systems_dispatcher
//             .send(
//                 sender_entity_id.into(),
//                 receiver_entity_id.into(),
//                 array![(ResourceTypes::STONE, 400), (ResourceTypes::WOOD, 700)].span(),
//             );

//         // verify sender's resource balances
//         let sender_entity_resource_stone: Resource = world.read_model((sender_entity_id, ResourceTypes::STONE));
//         let sender_entity_resource_wood: Resource = world.read_model((sender_entity_id, ResourceTypes::WOOD));
//         assert(sender_entity_resource_stone.balance == 600, 'stone balance mismatch');
//         assert(sender_entity_resource_wood.balance == 300, 'wood balance mismatch');
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     #[should_panic(
//         expected: (
//             "not enough resources, Resource (entity id: 11, resource type: DONKEY, balance: 1). deduction: 1000",
//             'ENTRYPOINT_FAILED',
//         ),
//     )]
//     fn resources_test_transfer__not_enough_donkey() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let sender_entity_id = 11;
//         let receiver_entity_id = 12;
//         make_owner_and_receiver(ref world, sender_entity_id, receiver_entity_id);

//         // set sender's donkey balance to 1
//         world
//             .write_model_test(
//                 @Resource { entity_id: sender_entity_id.into(), resource_type: ResourceTypes::DONKEY, balance: 1 },
//             );

//         // set receiving entity capacity, and weight config
//         world
//             .write_model_test(
//                 @WeightConfig {
//                     config_id: WORLD_CONFIG_ID,
//                     weight_config_id: ResourceTypes::STONE.into(),
//                     entity_type: ResourceTypes::STONE.into(),
//                     weight_gram: 10,
//                 },
//             );
//         world
//             .write_model_test(
//                 @WeightConfig {
//                     config_id: WORLD_CONFIG_ID,
//                     weight_config_id: ResourceTypes::WOOD.into(),
//                     entity_type: ResourceTypes::WOOD.into(),
//                     weight_gram: 10,
//                 },
//             );

//         world.write_model_test(@CapacityConfig { category: CapacityCategory::Donkey, weight_gram: 11_000 });

//         // transfer resources
//         starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

//         // should fail because sender does not have enough donkey
//         resource_systems_dispatcher
//             .send(
//                 sender_entity_id.into(),
//                 receiver_entity_id.into(),
//                 array![(ResourceTypes::STONE, 400), (ResourceTypes::WOOD, 700)].span(),
//             );
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn resources_test_transfer__not_owner() {
//         let (_, resource_systems_dispatcher) = setup();

//         // transfer resources
//         starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

//         resource_systems_dispatcher.send(1, 2, array![(ResourceTypes::STONE, 400), (ResourceTypes::WOOD,
//         700)].span());
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     #[should_panic(
//         expected: (
//             "not enough resources, Resource (entity id: 11, resource type: STONE, balance: 1000). deduction: 7700",
//             'ENTRYPOINT_FAILED',
//         ),
//     )]
//     fn resources_test_transfer__insufficient_balance() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let sender_entity_id = 11;
//         let receiver_entity_id = 12;
//         make_owner_and_receiver(ref world, sender_entity_id, receiver_entity_id);

//         // transfer resources
//         starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());

//         resource_systems_dispatcher
//             .send(
//                 sender_entity_id.into(),
//                 receiver_entity_id.into(),
//                 array![(ResourceTypes::STONE, 7700), // more than balance
//                 (ResourceTypes::WOOD, 700)].span(),
//             );
//     }

//     ////////////////////////////
//     // Test transfer_from
//     ////////////////////////////

//     #[test]
//     #[available_gas(30000000000000)]
//     fn resources_test_transfer_from() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let owner_entity_id = 11;
//         let receiver_entity_id = 12;
//         let approved_entity_id = receiver_entity_id;
//         make_owner_and_receiver(ref world, owner_entity_id, receiver_entity_id);

//         world
//             .write_model_test(
//                 @Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into()
//                 },
//             );
//         world
//             .write_model_test(
//                 @EntityOwner { entity_id: approved_entity_id.into(), entity_owner_id: approved_entity_id.into() },
//             );

//         // owner approves approved
//         starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());
//         resource_systems_dispatcher
//             .approve(
//                 owner_entity_id.into(),
//                 approved_entity_id.into(),
//                 array![(ResourceTypes::STONE, 600), (ResourceTypes::WOOD, 800)].span(),
//             );

//         // approved entity transfers resources
//         starknet::testing::set_contract_address(contract_address_const::<'approved_entity'>());

//         resource_systems_dispatcher
//             .pickup(
//                 receiver_entity_id.into(),
//                 owner_entity_id.into(),
//                 array![(ResourceTypes::STONE, 400), (ResourceTypes::WOOD, 700)].span(),
//             );

//         // check approval balance
//         let approved_entity_stone_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::STONE));
//         let approved_entity_wood_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::WOOD));

//         assert(approved_entity_stone_allowance.amount == 200, 'stone allowance mismatch');
//         assert(approved_entity_wood_allowance.amount == 100, 'wood allowance mismatch');

//         // verify sender's resource balances
//         let owner_entity_resource_stone: Resource = world.read_model((owner_entity_id, ResourceTypes::STONE));
//         let owner_entity_resource_wood: Resource = world.read_model((owner_entity_id, ResourceTypes::WOOD));
//         assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
//         assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     fn resources_test_transfer_from__with_infinite_approval() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let owner_entity_id = 11;
//         let receiver_entity_id = 12;
//         let approved_entity_id = receiver_entity_id;

//         make_owner_and_receiver(ref world, owner_entity_id, receiver_entity_id);

//         world
//             .write_model_test(
//                 @Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into()
//                 },
//             );
//         world
//             .write_model_test(
//                 @EntityOwner { entity_id: approved_entity_id.into(), entity_owner_id: approved_entity_id.into() },
//             );
//         // owner approves approved
//         starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());
//         resource_systems_dispatcher
//             .approve(
//                 owner_entity_id.into(),
//                 approved_entity_id.into(),
//                 array![(ResourceTypes::STONE, Bounded::MAX), (ResourceTypes::WOOD, Bounded::MAX)].span(),
//             );

//         // approved entity transfers resources
//         starknet::testing::set_contract_address(contract_address_const::<'approved_entity'>());

//         resource_systems_dispatcher
//             .pickup(
//                 receiver_entity_id.into(),
//                 owner_entity_id.into(),
//                 array![(ResourceTypes::STONE, 400), (ResourceTypes::WOOD, 700)].span(),
//             );

//         // check approval balance
//         let approved_entity_stone_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::STONE));
//         let approved_entity_wood_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::WOOD));
//         assert(approved_entity_stone_allowance.amount == Bounded::MAX, 'stone allowance mismatch');
//         assert(approved_entity_wood_allowance.amount == Bounded::MAX, 'wood allowance mismatch');

//         // verify owner's resource balances
//         let owner_entity_resource_stone: Resource = world.read_model((owner_entity_id, ResourceTypes::STONE));
//         let owner_entity_resource_wood: Resource = world.read_model((owner_entity_id, ResourceTypes::WOOD));
//         assert(owner_entity_resource_stone.balance == 600, 'stone balance mismatch');
//         assert(owner_entity_resource_wood.balance == 300, 'wood balance mismatch');
//     }
// }
