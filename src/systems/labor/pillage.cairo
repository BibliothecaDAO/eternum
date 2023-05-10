// TODO: cannot use Pillage yet because of cairo error :
// #13661->#13662: Got 'Unknown ap change' error while moving [79]
// wait for it to be solved
// TODO in next milestone
// #[system]
// mod Pillage {
//     use traits::Into;
//     use array::ArrayTrait;

//     use eternum::components::config::WorldConfig;
//     use eternum::components::realm::Realm;
//     use eternum::components::realm::RealmTrait;
//     use eternum::components::resources::Resource;
//     use eternum::components::resources::Vault;
//     use eternum::components::labor::Labor;
//     use eternum::components::labor::LaborTrait;
//     use eternum::components::config::LaborConfig;
//     use starknet::ContractAddress;
//     // todo need better way to store resources
//     use eternum::constants::WORLD_CONFIG_ID;
//     use eternum::constants::LABOR_CONFIG_ID;
//     use eternum::utils::unpack::unpack_resource_ids;
//     use integer::u128_safe_divmod;
//     // 2. check ressources on realm
//     // 3. get_raidable => 25% of vault balance for each resource, as base labor units (86400 / 12)

//     #[external]
//     fn execute(realm_id: felt252, attacker: ContractAddress) {
//         // get all resources that are raidable
//         let pillaged_realm = commands::<Realm>::entity(realm_id.into());
//         let resource_ids: Span<u256> = unpack_resource_ids(
//             pillaged_realm.resource_ids_packed, pillaged_realm.resource_ids_count
//         );
//         let resource_ids_count = pillaged_realm.resource_ids_count;

//         //TODO: check if caller can pillage

//         let mut index = 0_usize;
//         // commands:: not working in loops for now
//         // loop {
//         if index == resource_ids_count { // break ();
//         }
//         // get 25% of the resource id in the vault
//         let resource_id: felt252 = (*resource_ids[index]).low.into();
//         let maybe_vault = commands::<Vault>::try_entity((realm_id, (resource_id)).into());
//         match maybe_vault {
//             Option::Some(vault) => {
//                 let mut pillaged_amount = vault.balance / 4;
//                 // only pillage if enough in the vault
//                 if pillaged_amount < vault.balance {
//                     // if not enough take all
//                     pillaged_amount = vault.balance;
//                 }
//                 commands::set_entity(
//                     (realm_id, (resource_id)).into(),
//                     (Vault { balance: vault.balance - pillaged_amount }),
//                 );
//                 let attacker_resources = commands::<Resource>::entity(
//                     (attacker.into(), (resource_id)).into()
//                 ); // add these resources to the pillager
//                 commands::set_entity(
//                     (attacker.into(), (resource_id)).into(),
//                     (Resource {
//                         id: resource_id, balance: attacker_resources.balance + (pillaged_amount * labor_config.base_resources_per_cycle)
//                     }),
//                 );
//             },
//             Option::None(_) => {},
//         }
//         index += 1_usize;
//     // }
//     }
// }


