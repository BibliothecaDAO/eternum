#[system]
mod BuildLabor {
    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use eternum::components::config::WorldConfig;
    use eternum::components::realm::Realm;
    use eternum::components::realm::RealmTrait;
    use eternum::components::resources::Resource;
    use eternum::components::labor::Labor;
    use eternum::components::labor::LaborTrait;
    use eternum::components::config::LaborConf;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;
    use starknet::ContractAddress;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::constants::ResourceIds;
    use eternum::utils::convert::convert_u64_to_u128;
    use eternum::utils::convert::convert_u8_to_u128;
    use eternum::utils::unpack::unpack_resource_ids;

    use debug::PrintTrait;

    #[external]
    fn execute(realm_id: felt252, resource_id: felt252, labor_units: u128, multiplier: u128) {
        // assert owner of realm
        let player_id: ContractAddress = starknet::get_caller_address();
        let realm: Realm = commands::<Realm>::entity(realm_id.into());
        assert(realm.owner == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        assert(realm.has_resource(resource_id) == true, 'Resource is not on realm');

        // Get Config
        let labor_config: LaborConf = commands::<LaborConf>::entity(LABOR_CONFIG_ID.into());

        // transform timestamp from u64 to u128
        let ts: u128 = convert_u64_to_u128(starknet::get_block_timestamp());

        // get labor
        let maybe_labor = commands::<Labor>::try_entity((realm_id, (resource_id)).into());
        let labor = match maybe_labor {
            Option::Some(labor) => labor,
            Option::None(_) => Labor { balance: 0, last_harvest: ts, multiplier: 1,  },
        };

        // config
        let additionnal_labor = labor_units * labor_config.base_labor_units;

        // set new labor balance
        let new_labor_balance = labor.get_new_labor_balance(additionnal_labor, ts);

        // assert multiplier higher than 0
        assert(multiplier > 0, 'Multiplier cannot be zero');

        // if multiplier is bigger than 1, verify that it's either fish or wheat 
        // assert ressource_id is fish or wheat
        if multiplier > 1 {
            if resource_id == ResourceIds::FISH.into() {
                // assert that realm can have that many fishing villages
                let harbors: u128 = convert_u8_to_u128(realm.harbors);
                assert(harbors >= multiplier, 'Not enough harbors')
            } else {
                assert(resource_id == ResourceIds::WHEAT.into(), 'Resource id is not valid');
                // assert that realm can have that many farms
                let rivers: u128 = convert_u8_to_u128(realm.rivers);
                assert(rivers >= multiplier, 'Not enough rivers')
            }
        }

        let maybe_current_resource = commands::<Resource>::try_entity(
            (realm_id, (resource_id)).into()
        );

        // since we might harvest, check current resources
        let mut current_resource = match maybe_current_resource {
            Option::Some(current_resource) => {
                current_resource
            },
            Option::None(_) => {
                Resource { id: resource_id, balance: 0 }
            },
        };
        // if multiplier is different than previous multiplier, you need to harvest unharvested
        if multiplier != labor.multiplier { // get what has not been harvested and what will be harvested in the future
            let (labor_generated, is_complete, labor_unharvested) = labor.get_labor_generated(ts);
            let mut total_harvest = 0;
            if (is_complete == false) { // divide the unharvested resources by 4 and add them to the balance
                total_harvest = labor_generated + labor_unharvested / 4;
            } else {
                total_harvest = labor_generated;
            }
            let total_harvest_units = total_harvest
                / labor_config.base_labor_units; // get current resource
            // add these resources to balance
            commands::<Resource>::set_entity(
                (realm_id, (resource_id)).into(),
                (Resource {
                    id: current_resource.id,
                    balance: current_resource.balance
                        + (total_harvest_units
                            * labor.multiplier
                            * labor_config.base_resources_per_cycle)
                })
            );
        }

        // update the labor
        commands::set_entity(
            (realm_id, (resource_id)).into(),
            (Labor {
                balance: new_labor_balance,
                last_harvest: labor.last_harvest,
                multiplier: multiplier,
            }),
        );

        // pay for labor 
        let labor_cost_resources = commands::<LaborCR>::entity(resource_id.into());
        let labor_cost_resource_ids: Array<u256> = unpack_resource_ids(
            u256 {
                low: labor_cost_resources.resource_ids_packed_low,
                high: labor_cost_resources.resource_ids_packed_high
            },
            labor_cost_resources.resource_ids_count
        );
        let mut index = 0;

        loop {
            if index == labor_cost_resources.resource_ids_count {
                break ();
            }
            let labor_cost_resource_id = *labor_cost_resource_ids[index];
            let labor_cost_per_unit = commands::<LaborCV>::entity(
                (resource_id, (labor_cost_resource_id.low.into())).into()
            );
            let current_resource: Resource = commands::<Resource>::entity(
                (realm_id, (labor_cost_resource_id.low.into())).into()
            );
            let total_cost = labor_cost_per_unit.value * labor_units * multiplier;
            assert(current_resource.balance >= total_cost, 'Not enough resources');
            commands::<Resource>::set_entity(
                (realm_id, (labor_cost_resource_id.low.into())).into(),
                (Resource {
                    id: current_resource.id, balance: current_resource.balance - total_cost
                })
            );
            index += 1;
        };
    }
}


#[system]
mod HarvestLabor {
    use traits::Into;
    use array::ArrayTrait;
    use traits::TryInto;
    use debug::PrintTrait;
    use integer::u128_safe_divmod;

    use eternum::components::config::WorldConfig;
    use eternum::components::realm::Realm;
    use eternum::components::realm::RealmTrait;
    use eternum::components::resources::Resource;
    use eternum::components::resources::Vault;
    use eternum::components::labor::Labor;
    use eternum::components::labor::LaborTrait;
    use eternum::components::config::LaborConf;
    use starknet::ContractAddress;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::utils::convert::convert_u64_to_u128;
    use eternum::utils::convert::convert_u8_to_u128;
    use eternum::constants::ResourceIds;

    fn execute(realm_id: felt252, resource_id: felt252) {
        let player_id: ContractAddress = starknet::get_caller_address();
        let realm: Realm = commands::<Realm>::entity(realm_id.into());

        // Check owner of s_realm
        assert(realm.owner == player_id, 'Realm does not belong to player');

        // Check resource on Realm
        assert(realm.has_resource(resource_id) == true, 'Resource is not on realm');

        // Get Config
        let labor_config: LaborConf = commands::<LaborConf>::entity(LABOR_CONFIG_ID.into());

        let maybe_labor = commands::<Labor>::try_entity((realm_id, (resource_id)).into());
        let labor = match maybe_labor {
            Option::Some(labor) => labor,
            Option::None(_) => Labor { balance: 0, last_harvest: 0, multiplier: 1,  }
        };
        let maybe_resource = commands::<Resource>::try_entity((realm_id, (resource_id)).into());
        let resource = match maybe_resource {
            Option::Some(resource) => resource,
            Option::None(_) => Resource { id: resource_id, balance: 0,  }
        };

        // transform timestamp from u64 to u128
        let ts: u128 = convert_u64_to_u128(starknet::get_block_timestamp());

        // generated labor
        let (labor_generated, _, _) = labor.get_labor_generated(ts);

        // assert base labor units not zero
        assert(labor_config.base_labor_units != 0, 'Base labor units cannot be zero');

        // labor units and part units
        let mut labor_units_generated = labor_generated / labor_config.base_labor_units;
        let rest = labor_generated % labor_config.base_labor_units;

        // remove the vault
        // get vault for that resource
        // let is_not_fish = ;
        // let is_not_wheat = ;
        let maybe_vault = commands::<Vault>::try_entity((realm_id, (resource_id)).into());
        let vault = match maybe_vault {
            Option::Some(vault) => {
                vault
            },
            Option::None(_) => {
                Vault { balance: 0 }
            },
        };
        if resource_id != ResourceIds::FISH.into()
            & resource_id != ResourceIds::WHEAT.into() {
                // remove 25% to the vault
                let vault_units_generated = (labor_units_generated * labor_config.vault_percentage)
                    / 1000;
                labor_units_generated = labor_units_generated - vault_units_generated;

                // the balance in the vault is in cycles so need to multiply by base resource per cycle
                // update the vault
                commands::set_entity(
                    (realm_id, (resource_id)).into(),
                    (Vault { balance: vault.balance + vault_units_generated }, )
                );
            }

        // update the labor and resources
        commands::set_entity(
            (realm_id, (resource_id)).into(),
            (
                Resource {
                    id: resource_id,
                    balance: resource.balance
                        + labor_units_generated * labor_config.base_resources_per_cycle
                    }, Labor {
                    balance: labor.balance + rest, last_harvest: ts, multiplier: labor.multiplier, 
                }
            )
        );
    }
}
// TODO: cannot use Pillage yet because of cairo error :
// #13661->#13662: Got 'Unknown ap change' error while moving [79]
// wait for it to be solved
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
//     use eternum::components::config::LaborConf;
//     use starknet::ContractAddress;
//     // todo need better way to store resources
//     use eternum::constants::WORLD_CONFIG_ID;
//     use eternum::constants::LABOR_CONFIG_ID;
//     use eternum::utils::convert::convert_u64_to_u128;
//     use eternum::utils::unpack::unpack_resource_ids;
//     use integer::u128_safe_divmod;
//     // 2. check ressources on realm
//     // 3. get_raidable => 25% of vault balance for each resource, as base labor units (86400 / 12)

//     #[external]
//     fn execute(realm_id: felt252, attacker: ContractAddress) {
//         // get all resources that are raidable
//         let pillaged_realm = commands::<Realm>::entity(realm_id.into());
//         let resource_ids: Array<u256> = unpack_resource_ids(
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

mod tests {
    // components
    use eternum::components::labor::LaborComponent;
    use eternum::components::realm::RealmComponent;
    use eternum::components::config::LaborConfComponent;
    use eternum::components::config::LaborCVComponent;
    use eternum::components::config::LaborCRComponent;
    use eternum::components::resources::ResourceComponent;
    use eternum::components::resources::VaultComponent;
    use eternum::components::realm::Realm;
    use eternum::components::config::LaborConf;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    // systems
    use eternum::systems::labor::BuildLaborSystem;
    use eternum::systems::labor::HarvestLaborSystem;
    use eternum::systems::config::labor_config::CreateLaborConfSystem;
    use eternum::systems::config::labor_config::CreateLaborCRSystem;
    use eternum::systems::config::labor_config::CreateLaborCVSystem;

    use eternum::constants::LABOR_CONFIG_ID;

    use core::traits::Into;
    use core::result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use traits::TryInto;
    use debug::PrintTrait;

    use starknet::syscalls::deploy_syscall;
    use starknet::class_hash::Felt252TryIntoClassHash;
    use starknet::ClassHash;

    use dojo_core::world::World;
    use dojo_core::executor::Executor;
    use dojo_core::interfaces::IExecutorDispatcher;
    use dojo_core::interfaces::IExecutorDispatcherTrait;
    use dojo_core::interfaces::IWorldDispatcher;
    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::storage::query::Query;
    use dojo_core::test_utils::spawn_test_world;

    // // miniting function, only for testing 
    #[system]
    mod MintResources {
        use traits::Into;
        use array::ArrayTrait;
        use eternum::components::resources::Resource;
        #[external]
        fn execute(realm_id: felt252, resource_id: felt252, amount: u128) {
            let maybe_resource = commands::<Resource>::try_entity((realm_id, (resource_id)).into());
            let resource = match maybe_resource {
                Option::Some(resource) => resource,
                Option::None(_) => Resource { id: resource_id, balance: 0 },
            };

            commands::set_entity(
                (realm_id, (resource_id)).into(),
                (Resource { id: resource_id, balance: resource.balance + amount,  }, )
            );
        }
    }

    #[system]
    mod CreateRealm {
        use eternum::components::realm::Realm;
        use traits::Into;
        use debug::PrintTrait;

        fn execute(realm_id: felt252) {
            let owner = starknet::get_caller_address();
            commands::<Realm>::set_entity(
                realm_id.into(),
                (Realm {
                    realm_id: realm_id, // OG Realm Id
                    owner: owner,
                    resource_ids_hash: 0, // hash of ids
                    // packed resource ids of realm
                    resource_ids_packed_low: 1,
                    resource_ids_packed_high: 0,
                    // resource_ids_packed: 0.into(), // bug in dojo with u256
                    resource_ids_count: 1,
                    cities: 1_u8,
                    harbors: 1_u8,
                    rivers: 1_u8,
                    regions: 1_u8,
                    // TODO: resources
                    wonder: 1_u8, // TODO: maybe its own component?
                    order: 1_u8, // TODO: use consts for orders, somewhere    
                })
            );
        }
    }
    #[test]
    #[available_gas(300000000000)]
    fn test_build_labor_non_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfComponent::TEST_CLASS_HASH);
        components.append(LaborCVComponent::TEST_CLASS_HASH);
        components.append(LaborCRComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLaborSystem::TEST_CLASS_HASH);
        systems.append(HarvestLaborSystem::TEST_CLASS_HASH);
        systems.append(CreateRealmSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborConfSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCRSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCVSystem::TEST_CLASS_HASH);
        systems.append(MintResourcesSystem::TEST_CLASS_HASH);

        let world = spawn_test_world(components, systems);

        /// CREATE ENTITIES ///
        // set realm entity
        let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
        create_realm_calldata.append(1);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());
        // set labor configuration entity
        let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_conf_calldata.append(7200);
        create_labor_conf_calldata.append(250);
        create_labor_conf_calldata.append(21000000000000000000);
        world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());

        let mut creat_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(515);
        creat_labor_cr_calldata.append(2);
        world.execute('CreateLaborCR'.into(), creat_labor_cr_calldata.span());

        // cost in resource 2 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(2);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // cost in resource 3 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(3);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // mint 100000 resource id 2 for realm id 1;
        let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(2);
        mint_resources_calldata.append(100000);
        world.execute('MintResources'.into(), mint_resources_calldata.span());

        // mint 100000 resource id 3 for realm id 1;
        let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(3);
        mint_resources_calldata.append(100000);
        world.execute('MintResources'.into(), mint_resources_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(10000);

        // call build labor system
        let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
        build_labor_calldata.append(1);
        build_labor_calldata.append(1);
        build_labor_calldata.append(20);
        // multiplier
        build_labor_calldata.append(1);
        world.execute('BuildLabor'.into(), build_labor_calldata.span());
        // assert resource is right amount
        let resource = world.entity('Resource'.into(), (1, (2)).into(), 0_u8, 0_usize);
        assert(*resource[0] == 2, 'failed resource id');
        assert(*resource[1] == 80000, 'failed resource amount');

        let resource = world.entity('Resource'.into(), (1, (3)).into(), 0_u8, 0_usize);
        assert(*resource[0] == 3, 'failed resource id');
        assert(*resource[1] == 80000, 'failed resource amount');

        // assert labor is right amount
        let labor = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
        // timestamp + labor_per_unit * labor_units
        assert(*labor[0] == 10000 + 7200 * 20, 'labor balance is wrong');
        assert(*labor[1] == 10000, 'labor last harvest is wrong');
        assert(*labor[2] == 1, 'multiplier is wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_harvest_labor_non_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfComponent::TEST_CLASS_HASH);
        components.append(LaborCVComponent::TEST_CLASS_HASH);
        components.append(LaborCRComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLaborSystem::TEST_CLASS_HASH);
        systems.append(HarvestLaborSystem::TEST_CLASS_HASH);
        systems.append(CreateRealmSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborConfSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCRSystem::TEST_CLASS_HASH);
        systems.append(CreateLaborCVSystem::TEST_CLASS_HASH);
        systems.append(MintResourcesSystem::TEST_CLASS_HASH);

        let world = spawn_test_world(components, systems);

        /// CREATE ENTITIES ///
        // set realm entity
        let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
        create_realm_calldata.append(1);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());
        // set labor configuration entity
        let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_conf_calldata.append(7200);
        create_labor_conf_calldata.append(250);
        create_labor_conf_calldata.append(21000000000000000000);
        world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());

        let mut creat_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(1);
        creat_labor_cr_calldata.append(1);
        world.execute('CreateLaborCR'.into(), creat_labor_cr_calldata.span());

        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // mint 100000 resource id 1 for realm id 1;
        let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(1);
        mint_resources_calldata.append(100000);
        world.execute('MintResources'.into(), mint_resources_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(1000);

        // call build labor system
        let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
        build_labor_calldata.append(1);
        build_labor_calldata.append(1);
        build_labor_calldata.append(20);
        // multiplier
        build_labor_calldata.append(1);
        world.execute('BuildLabor'.into(), build_labor_calldata.span());

        // set block timestamp in order to harvest labor
        // initial ts = 0
        starknet::testing::set_block_timestamp(40000);

        // call build labor system
        let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
        // realm_id
        harvest_labor_calldata.append(1);
        // resource_id
        harvest_labor_calldata.append(1);
        world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

        // get labor after harvest 
        let labor_after_harvest = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
        // labor after harvest = current labor balance + rest from division by 72000
        assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
        assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

        let last_harvest = 1000_u128;
        let current_ts = 40000_u128;
        let labor_per_unit = 7200_u128;
        let base_resources_per_cycle = 21000000000000000000_u128;
        let vault_percentage = 250; // on base 1000
        let resource_balance_before_harvest = 80000_u128;

        // because current_ts < balance
        let generated_labor = current_ts - last_harvest;

        // generated units
        let mut generated_units = generated_labor / labor_per_unit;
        // vault units
        let vault_units = generated_units * vault_percentage / 1000;
        generated_units -= vault_units;

        let generated_resources = generated_units * base_resources_per_cycle;

        // verify resource is right amount
        let resource = world.entity('Resource'.into(), (1, (1)).into(), 0_u8, 0_usize);
        assert(
            *resource[1] == (resource_balance_before_harvest + generated_resources).into(),
            'failed resource amount'
        );

        // verify vault balance 
        let vault = world.entity('Vault'.into(), (1, (1)).into(), 0_u8, 0_usize);
        assert(*vault[0] == 1, 'failed vault balance');
    }
}
