#[system]
mod BuildLabor {
    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use box::BoxTrait;

    use eternum::components::config::WorldConfig;
    use eternum::components::owner::Owner;
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
        // let player_id: ContractAddress = starknet::get_caller_address();
        let player_id: ContractAddress = starknet::get_tx_info().unbox().account_contract_address;
        let (realm, owner) = commands::<Realm, Owner>::entity(realm_id.into());
        // TODO: do that when starknet::testing::set_account_contract_address works in test
        // assert(owner.address == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        let realm_has_resource = realm.has_resource(resource_id);
        let is_food = resource_id == ResourceIds::FISH.into()
            | resource_id == ResourceIds::WHEAT.into();
        if realm_has_resource == false {
            assert(is_food == true, 'Resource is not on realm');
        }

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
        let mut new_labor_balance = labor.get_new_labor_balance(additionnal_labor, ts);
        let mut new_last_harvest = labor.last_harvest;

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
        if multiplier != labor.multiplier {
            // get what has not been harvested and what will be harvested in the future
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

            // if unharvested has been harvested, remove it from the labor balance
            new_labor_balance -= labor_unharvested;
            // if unharvested has been harvested, update last_harvest
            new_last_harvest = ts;
        }

        // update the labor
        commands::set_entity(
            (realm_id, (resource_id)).into(),
            (Labor {
                balance: new_labor_balance, last_harvest: new_last_harvest, multiplier: multiplier, 
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

mod tests {
    // components
    use eternum::components::labor::LaborComponent;
    use eternum::components::realm::RealmComponent;
    use eternum::components::config::LaborConfComponent;
    use eternum::components::config::LaborCVComponent;
    use eternum::components::config::LaborCRComponent;
    use eternum::components::owner::OwnerComponent;
    use eternum::components::resources::ResourceComponent;
    use eternum::components::resources::VaultComponent;
    use eternum::components::realm::Realm;
    use eternum::components::config::LaborConf;
    use eternum::components::config::LaborCR;
    use eternum::components::config::LaborCV;

    // systems
    use eternum::systems::labor::build_labor::BuildLaborSystem;
    use eternum::systems::labor::harvest_labor::HarvestLaborSystem;
    use eternum::systems::config::labor_config::CreateLaborConfSystem;
    use eternum::systems::config::labor_config::CreateLaborCRSystem;
    use eternum::systems::config::labor_config::CreateLaborCVSystem;
    use eternum::systems::test::MintResourcesSystem;
    use eternum::systems::test::CreateRealmSystem;

    // constants
    use eternum::constants::LABOR_CONFIG_ID;
    use eternum::constants::ResourceIds;

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

    use array::ArrayTCloneImpl;
    use clone::Clone;
    use starknet::contract_address::ContractAddressIntoFelt252;

    use dojo_core::serde::SpanSerde;

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
        components.append(OwnerComponent::TEST_CLASS_HASH);

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
        create_realm_calldata.append(starknet::get_caller_address().into());
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(1);
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
    #[available_gas(300000000000)]
    fn test_build_labor_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfComponent::TEST_CLASS_HASH);
        components.append(LaborCVComponent::TEST_CLASS_HASH);
        components.append(LaborCRComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);

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
        create_realm_calldata.append(starknet::get_caller_address().into());
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(5);
        create_realm_calldata.append(1);
        create_realm_calldata.append(1);
        world.execute('CreateRealm'.into(), create_realm_calldata.span());

        // set labor configuration entity
        let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
        // 
        // base_labor_units
        create_labor_conf_calldata.append(7200);
        // vault percentage
        create_labor_conf_calldata.append(250);
        // base_resources_per_cycle
        create_labor_conf_calldata.append(21000000000000000000);
        world.execute('CreateLaborConf'.into(), create_labor_conf_calldata.span());

        let mut creat_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        creat_labor_cr_calldata.append(ResourceIds::WHEAT.into());
        creat_labor_cr_calldata.append(515);
        creat_labor_cr_calldata.append(2);
        world.execute('CreateLaborCR'.into(), creat_labor_cr_calldata.span());

        // cost in resource 2 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(ResourceIds::WHEAT.into());
        create_labor_cv_calldata.append(2);
        create_labor_cv_calldata.append(1000);
        world.execute('CreateLaborCV'.into(), create_labor_cv_calldata.span());

        // cost in resource 3 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(ResourceIds::WHEAT.into());
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
        build_labor_calldata.append(ResourceIds::WHEAT.into());
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
        let labor = world.entity(
            'Labor'.into(), (1, (ResourceIds::WHEAT.into())).into(), 0_u8, 0_usize
        );
        // timestamp + labor_per_unit * labor_units
        assert(*labor[0] == 10000 + 7200 * 20, 'labor balance is wrong');
        assert(*labor[1] == 10000, 'labor last harvest is wrong');
        assert(*labor[2] == 1, 'multiplier is wrong');

        // set block timestamp in order to harvest labor
        starknet::testing::set_block_timestamp(20000);

        // build labor again but with different multiplier
        // call build labor system
        let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
        build_labor_calldata.append(1);
        build_labor_calldata.append(ResourceIds::WHEAT.into());
        build_labor_calldata.append(20);
        // multiplier
        build_labor_calldata.append(2);
        world.execute('BuildLabor'.into(), build_labor_calldata.span());

        // assert resource is right amount
        let resource = world.entity('Resource'.into(), (1, (2)).into(), 0_u8, 0_usize);
        assert(*resource[0] == 2, 'failed resource id');
        // 80000 - (20000 * 2)
        assert(*resource[1] == 80000 - (20000 * 2), 'failed resource amount');

        let resource = world.entity('Resource'.into(), (1, (3)).into(), 0_u8, 0_usize);
        assert(*resource[0] == 3, 'failed resource id');
        // 80000 - (20000 * 2)
        assert(*resource[1] == 80000 - (20000 * 2), 'failed resource amount');

        // check food
        let resource = world.entity(
            'Resource'.into(), (1, (ResourceIds::WHEAT.into())).into(), 0_u8, 0_usize
        );
        assert(*resource[0] == ResourceIds::WHEAT.into(), 'failed resource id');
        // left to harvest = 134 000 / 4 = 33 500
        let food_harvested = ((10000_u128 + 33500_u128) / 7200_u128) * 21000000000000000000_u128;
        assert(*resource[1] == food_harvested.into(), 'failed food amount');

        // assert labor is right amount
        let labor = world.entity(
            'Labor'.into(), (1, (ResourceIds::WHEAT.into())).into(), 0_u8, 0_usize
        );

        // timestamp + labor_per_unit * labor_units
        // 154000 is previous balance
        // 7200 * 20 is added balance
        // 154000 - 20000 is unharvested balance
        assert(*labor[0] == 154000 + 7200 * 20 - (154000 - 20000), 'labor balance is wrong');
        assert(*labor[1] == 20000, 'labor last harvest is wrong');
        assert(*labor[2] == 2, 'multiplier is wrong');
    }
}
