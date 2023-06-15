// TODO: should we create a system to increase/decrease balance?
// #[system]
// mod IncreaseBalance {
//     use traits::Into;
//     use array::ArrayTrait;

//     use eternum::components::resources::Resource;

//     // could be id of a player, of the realm, of a vault
//     fn execute(owner_id: felt252, resource_type: u8, amount: u128) {
//         let maybe_resource = commands::<Resource>::try_entity((owner_id, (resource_type)).into());

//         let mut resource_balance = 0;
//         match maybe_resource {
//             Option::Some(resource) => {
//                 resource_balance = resource.balance;
//             },
//             Option::None(_) => {},
//         }
//         commands::<Resource>::set_entity(
//             (owner_id, (resource_type)).into(),
//             (Resource { resource_type, balance: resource_balance + amount }),
//         )
//     }
// }

// #[system]
// mod DecreaseBalance {
//     use traits::Into;
//     use array::ArrayTrait;

//     use eternum::components::resources::Resource;

//     // could be id of a player, of the realm, of a vault
//     fn execute(owner_id: felt252, resource_type: felt252, amount: u128) {
//         let maybe_resource = commands::<Resource>::try_entity((owner_id, (resource_type)).into());

//         let mut resource_balance = 0;
//         match maybe_resource {
//             Option::Some(resource) => {
//                 resource_balance = resource.balance;
//             },
//             Option::None(_) => {},
//         }
//         assert(resource_balance >= amount, 'Insufficient balance');
//         commands::<Resource>::set_entity(
//             (owner_id, (resource_type)).into(),
//             (Resource { resource_type, balance: resource_balance - amount }),
//         )
//     }
// }


