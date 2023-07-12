// TODO: should we create a system to increase/decrease balance?
// #[system]
// mod IncreaseBalance {
//     use traits::Into;
//     use array::ArrayTrait;

//     use eternum::components::resources::Resource;

//     // could be id of a player, of the realm, of a vault
//     fn execute(ctx: Context, owner_id: felt252, resource_type: u8, amount: u128) {
//         let maybe_resource = try_get !(ctx.world, (owner_id, (resource_type)).into(), Resource);

//         let mut resource_balance = 0;
//         match maybe_resource {
//             Option::Some(resource) => {
//                 resource_balance = resource.balance;
//             },
//             Option::None(_) => {},
//         }
//         set !(
//             ctx.world,
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
//     fn execute(ctx: Context, owner_id: felt252, resource_type: felt252, amount: u128) {
//         let maybe_resource = try_get !(ctx.world, (owner_id, (resource_type)).into(), Resource);

//         let mut resource_balance = 0;
//         match maybe_resource {
//             Option::Some(resource) => {
//                 resource_balance = resource.balance;
//             },
//             Option::None(_) => {},
//         }
//         assert(resource_balance >= amount, 'Insufficient balance');
//         set !(
//             ctx.world,
//             (owner_id, (resource_type)).into(),
//             (Resource { resource_type, balance: resource_balance - amount }),
//         )
//     }
// }


