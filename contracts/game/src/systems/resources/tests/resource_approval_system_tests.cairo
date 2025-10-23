// mod resource_approval_system_tests {
//     use core::num::traits::Bounded;

//     use core::traits::Into;
//     use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
//     use dojo::world::{WorldStorage, WorldStorageTrait};
//     use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
//     use crate::alias::ID;

//     use crate::constants::ResourceTypes;
//     use crate::constants::WORLD_CONFIG_ID;
//     use crate::models::config::WeightConfig;
//     use crate::models::owner::{EntityOwner, Owner};
//     use crate::models::position::Position;
//     use crate::models::quantity::Quantity;
//     use crate::models::resource::resource::{Resource, ResourceAllowance};

//     use crate::systems::resources::contracts::resource_systems::{
//         IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait, resource_systems,
//     };

//     use crate::utils::testing::{systems::deploy_system, world::spawn_eternum};
//     use starknet::contract_address_const;

//     fn setup() -> (WorldStorage, IResourceSystemsDispatcher) {
//         let mut world = spawn_eternum();

//         let resource_systems_address = deploy_system(ref world, "resource_systems");

//         let resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: resource_systems_address };

//         (world, resource_systems_dispatcher)
//     }

//     fn make_owner_and_receiver(ref world: WorldStorage, owner_entity_id: ID, receiver_entity_id: ID) {
//         let owner_entity_position = Position { x: 100_000, y: 200_000, entity_id: owner_entity_id.into() };

//         world.write_model_test(@owner_entity_position);
//         world
//             .write_model_test(
//                 @Owner { address: contract_address_const::<'owner_entity'>(), entity_id: owner_entity_id.into() },
//             );
//         world
//             .write_model_test(
//                 @EntityOwner { entity_id: owner_entity_id.into(), entity_owner_id: owner_entity_id.into() },
//             );
//         world
//             .write_model_test(
//                 @Resource { entity_id: owner_entity_id.into(), resource_type: ResourceTypes::STONE, balance: 1000 },
//             );
//         world
//             .write_model_test(
//                 @Resource { entity_id: owner_entity_id.into(), resource_type: ResourceTypes::WOOD, balance: 1000 },
//             );

//         let receiver_entity_position = Position { x: 100_000, y: 200_000, entity_id: receiver_entity_id.into() };
//         world.write_model_test(@receiver_entity_position);
//         world
//             .write_model_test(
//                 @Resource { entity_id: receiver_entity_id.into(), resource_type: ResourceTypes::STONE, balance: 1000
//                 },
//             );
//         world
//             .write_model_test(
//                 @Resource { entity_id: receiver_entity_id.into(), resource_type: ResourceTypes::WOOD, balance: 1000
//                 },
//             );
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     fn resources_test_approve() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let owner_entity_id: ID = 11;
//         let receiver_entity_id: ID = 12;
//         make_owner_and_receiver(ref world, owner_entity_id, receiver_entity_id);

//         let approved_entity_id: ID = 13;

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

//         // check approval balance
//         let approved_entity_stone_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::STONE));
//         let approved_entity_wood_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::WOOD));
//         assert(approved_entity_stone_allowance.amount == 600, 'stone allowance mismatch');
//         assert(approved_entity_wood_allowance.amount == 800, 'wood allowance mismatch');
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     fn resources_test_approve__infinite_approval() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let owner_entity_id: ID = 11;
//         let receiver_entity_id: ID = 12;
//         make_owner_and_receiver(ref world, owner_entity_id, receiver_entity_id);

//         let approved_entity_id: ID = 13;
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

//         // check approval balance
//         let approved_entity_stone_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::STONE));
//         let approved_entity_wood_allowance: ResourceAllowance = world
//             .read_model((owner_entity_id, approved_entity_id, ResourceTypes::WOOD));
//         assert(approved_entity_stone_allowance.amount == Bounded::MAX, 'stone allowance mismatch');
//         assert(approved_entity_wood_allowance.amount == Bounded::MAX, 'wood allowance mismatch');
//     }

//     #[test]
//     #[available_gas(30000000000000)]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn resources_test_approve__not_owner() {
//         let (mut world, resource_systems_dispatcher) = setup();

//         let owner_entity_id: ID = 11;
//         let receiver_entity_id: ID = 12;
//         make_owner_and_receiver(ref world, owner_entity_id, receiver_entity_id);

//         let approved_entity_id: ID = 13;

//         world
//             .write_model_test(
//                 @Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into()
//                 },
//             );

//         // some unknown entity calls approve
//         starknet::testing::set_contract_address(contract_address_const::<'unknown_entity'>());
//         resource_systems_dispatcher
//             .approve(
//                 owner_entity_id.into(),
//                 approved_entity_id.into(),
//                 array![(ResourceTypes::STONE, 600), (ResourceTypes::WOOD, 800)].span(),
//             );
//     }
// }
