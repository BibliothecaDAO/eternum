#[system]
mod BuildLabor {
    use traits::Into;
    use box::BoxTrait;

    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::realm::{Realm, RealmTrait};
    use eternum::components::resources::Resource;
    use eternum::components::labor::{Labor, LaborTrait};
    use eternum::components::config::{LaborConfig, LaborCostResources, LaborCostAmount};
    use starknet::ContractAddress;
    use eternum::constants::{LABOR_CONFIG_ID, ResourceTypes};
    use eternum::utils::unpack::unpack_resource_types;

    #[external]
    fn execute(realm_id: ID, resource_type: u8, labor_units: u128, multiplier: u128) {
        // assert owner of realm
        let player_id: ContractAddress = starknet::get_tx_info().unbox().account_contract_address;
        let (realm, owner) = commands::<Realm, Owner>::entity(realm_id.into());
        // TODO: do that when starknet::testing::set_account_contract_address works in test
        // assert(owner.address == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        let realm_has_resource = realm.has_resource(resource_type);
        let is_food = resource_type == ResourceTypes::FISH | resource_type == ResourceTypes::WHEAT;
        if realm_has_resource == false {
            assert(is_food == true, 'Resource is not on realm');
        }

        // Get Config
        let labor_config: LaborConfig = commands::<LaborConfig>::entity(LABOR_CONFIG_ID.into());

        // transform timestamp from u64 to u128
        let ts: u128 = starknet::get_block_timestamp().into();

        // get labor
        let resource_query: Query = (realm_id, resource_type).into();
        let maybe_labor = commands::<Labor>::try_entity(resource_query);
        let labor = match maybe_labor {
            Option::Some(labor) => labor,
            Option::None(_) => Labor { balance: 0, last_harvest: ts, multiplier: 1,  },
        };

        // config
        let additional_labor = labor_units * labor_config.base_labor_units;

        // set new labor balance
        let mut new_labor_balance = labor.get_new_labor_balance(additional_labor, ts);
        let mut new_last_harvest = labor.last_harvest;

        // assert multiplier higher than 0
        assert(multiplier > 0, 'Multiplier cannot be zero');

        // if multiplier is bigger than 1, verify that it's either fish or wheat 
        // assert ressource_id is fish or wheat
        if multiplier > 1 {
            if resource_type == ResourceTypes::FISH {
                // assert that realm can have that many fishing villages
                let harbors: u128 = realm.harbors.into();
                assert(harbors >= multiplier, 'Not enough harbors')
            } else {
                assert(resource_type == ResourceTypes::WHEAT, 'Resource id is not valid');
                // assert that realm can have that many farms
                let rivers: u128 = realm.rivers.into();
                assert(rivers >= multiplier, 'Not enough rivers')
            }
        }

        let maybe_current_resource = commands::<Resource>::try_entity(resource_query);

        // since we might harvest, check current resources
        let mut current_resource = match maybe_current_resource {
            Option::Some(current_resource) => {
                current_resource
            },
            Option::None(_) => {
                Resource { resource_type, balance: 0 }
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
                resource_query,
                (Resource {
                    resource_type: current_resource.resource_type,
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
            resource_query,
            (Labor { balance: new_labor_balance, last_harvest: new_last_harvest, multiplier,  }),
        );

        // pay for labor 
        let labor_cost_resources = commands::<LaborCostResources>::entity(resource_type.into());
        let labor_cost_resource_types: Span<u8> = unpack_resource_types(
            labor_cost_resources.resource_types_packed, labor_cost_resources.resource_types_count
        );
        let mut index = 0_usize;

        loop {
            if index == labor_cost_resources.resource_types_count.into() {
                break ();
            }
            let labor_cost_resource_type = *labor_cost_resource_types[index];
            let labor_cost_per_unit = commands::<LaborCostAmount>::entity(
                (resource_type, labor_cost_resource_type).into()
            );
            let current_resource: Resource = commands::<Resource>::entity(
                (realm_id, labor_cost_resource_type).into()
            );
            let total_cost = labor_cost_per_unit.value * labor_units * multiplier;
            assert(current_resource.balance >= total_cost, 'Not enough resources');
            commands::<Resource>::set_entity(
                (realm_id, labor_cost_resource_type).into(),
                (Resource {
                    resource_type: current_resource.resource_type,
                    balance: current_resource.balance - total_cost
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
    use eternum::components::config::LaborConfigComponent;
    use eternum::components::config::LaborCostAmountComponent;
    use eternum::components::config::LaborCostResourcesComponent;
    use eternum::components::owner::OwnerComponent;
    use eternum::components::resources::ResourceComponent;
    use eternum::components::resources::VaultComponent;
    use eternum::components::realm::Realm;
    use eternum::components::config::LaborConfig;
    use eternum::components::config::LaborCostResources;
    use eternum::components::config::LaborCostAmount;

    // systems
    use eternum::systems::labor::build_labor::BuildLabor;
    use eternum::systems::config::labor_config::SetLaborConfig;
    use eternum::systems::config::labor_config::SetLaborCostResources;
    use eternum::systems::config::labor_config::SetLaborCostAmount;
    use eternum::systems::test::MintResources;
    use eternum::systems::test::CreateRealm;

    // constants
    use eternum::constants::ResourceTypes;

    use core::traits::Into;
    use core::result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;

    use starknet::syscalls::deploy_syscall;

    use dojo_core::interfaces::IWorldDispatcherTrait;
    use dojo_core::storage::query::Query;
    use dojo_core::test_utils::spawn_test_world;
    use dojo_core::auth::systems::{Route, RouteTrait};

    #[test]
    #[available_gas(300000000000)]
    fn test_build_labor_non_food() {
        /// REGISTER COMPONENTS ///
        let mut components = array::ArrayTrait::<felt252>::new();
        components.append(LaborComponent::TEST_CLASS_HASH);
        components.append(RealmComponent::TEST_CLASS_HASH);
        components.append(LaborConfigComponent::TEST_CLASS_HASH);
        components.append(LaborCostAmountComponent::TEST_CLASS_HASH);
        components.append(LaborCostResourcesComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLabor::TEST_CLASS_HASH);
        systems.append(CreateRealm::TEST_CLASS_HASH);
        systems.append(SetLaborConfig::TEST_CLASS_HASH);
        systems.append(SetLaborCostResources::TEST_CLASS_HASH);
        systems.append(SetLaborCostAmount::TEST_CLASS_HASH);
        systems.append(MintResources::TEST_CLASS_HASH);

        let mut routes = array::ArrayTrait::new();
        // CreateRealm
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Owner'.into(), ));
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Realm'.into(), ));
        // SetLaborConfig
        routes
            .append(
                RouteTrait::new('SetLaborConfig'.into(), 'Tester'.into(), 'LaborConfig'.into(), )
            );
        // SetLaborCostResources
        routes
            .append(
                RouteTrait::new(
                    'SetLaborCostResources'.into(), 'Tester'.into(), 'LaborCostResources'.into(), 
                )
            );
        // SetLaborCostAmount
        routes
            .append(
                RouteTrait::new(
                    'SetLaborCostAmount'.into(), 'Tester'.into(), 'LaborCostAmount'.into(), 
                )
            );
        // MintResources
        routes
            .append(RouteTrait::new('MintResources'.into(), 'Tester'.into(), 'Resource'.into(), ));
        // BuildLabor
        routes.append(RouteTrait::new('BuildLabor'.into(), 'Tester'.into(), 'Resource'.into(), ));
        routes.append(RouteTrait::new('BuildLabor'.into(), 'Tester'.into(), 'Labor'.into(), ));

        let world = spawn_test_world(components, systems, routes);

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
        world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

        let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cr_calldata.append(1);
        create_labor_cr_calldata.append(515);
        create_labor_cr_calldata.append(2);
        world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

        // cost in resource 2 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(2);
        create_labor_cv_calldata.append(1000);
        world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

        // cost in resource 3 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(1);
        create_labor_cv_calldata.append(3);
        create_labor_cv_calldata.append(1000);
        world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

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
        components.append(LaborConfigComponent::TEST_CLASS_HASH);
        components.append(LaborCostAmountComponent::TEST_CLASS_HASH);
        components.append(LaborCostResourcesComponent::TEST_CLASS_HASH);
        components.append(ResourceComponent::TEST_CLASS_HASH);
        components.append(VaultComponent::TEST_CLASS_HASH);
        components.append(OwnerComponent::TEST_CLASS_HASH);

        /// REGISTER SYSTEMS ///
        let mut systems = array::ArrayTrait::<felt252>::new();
        systems.append(BuildLabor::TEST_CLASS_HASH);
        systems.append(CreateRealm::TEST_CLASS_HASH);
        systems.append(SetLaborConfig::TEST_CLASS_HASH);
        systems.append(SetLaborCostResources::TEST_CLASS_HASH);
        systems.append(SetLaborCostAmount::TEST_CLASS_HASH);
        systems.append(MintResources::TEST_CLASS_HASH);

        let mut routes = array::ArrayTrait::new();
        // CreateRealm
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Owner'.into(), ));
        routes.append(RouteTrait::new('CreateRealm'.into(), 'Tester'.into(), 'Realm'.into(), ));
        // SetLaborConfig
        routes
            .append(
                RouteTrait::new('SetLaborConfig'.into(), 'Tester'.into(), 'LaborConfig'.into(), )
            );
        // SetLaborCostResources
        routes
            .append(
                RouteTrait::new(
                    'SetLaborCostResources'.into(), 'Tester'.into(), 'LaborCostResources'.into(), 
                )
            );
        // SetLaborCostAmount
        routes
            .append(
                RouteTrait::new(
                    'SetLaborCostAmount'.into(), 'Tester'.into(), 'LaborCostAmount'.into(), 
                )
            );
        // MintResources
        routes
            .append(RouteTrait::new('MintResources'.into(), 'Tester'.into(), 'Resource'.into(), ));
        // BuildLabor
        routes.append(RouteTrait::new('BuildLabor'.into(), 'Tester'.into(), 'Resource'.into(), ));
        routes.append(RouteTrait::new('BuildLabor'.into(), 'Tester'.into(), 'Labor'.into(), ));
        let world = spawn_test_world(components, systems, routes);

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
        world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

        let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cr_calldata.append(ResourceTypes::WHEAT.into());
        create_labor_cr_calldata.append(515);
        create_labor_cr_calldata.append(2);
        world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

        // cost in resource 2 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(ResourceTypes::WHEAT.into());
        create_labor_cv_calldata.append(2);
        create_labor_cv_calldata.append(1000);
        world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

        // cost in resource 3 for resource 1
        let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
        create_labor_cv_calldata.append(ResourceTypes::WHEAT.into());
        create_labor_cv_calldata.append(3);
        create_labor_cv_calldata.append(1000);
        world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

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
        build_labor_calldata.append(ResourceTypes::WHEAT.into());
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
        let wheat_felt: felt252 = ResourceTypes::WHEAT.into();
        let wheat_query: Query = (1, wheat_felt).into();
        let labor = world.entity('Labor'.into(), wheat_query, 0_u8, 0_usize);
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
        build_labor_calldata.append(ResourceTypes::WHEAT.into());
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
        let resource = world.entity('Resource'.into(), wheat_query, 0_u8, 0_usize);
        assert(*resource[0] == ResourceTypes::WHEAT.into(), 'failed resource id');
        // left to harvest = 134 000 / 4 = 33 500
        let food_harvested = ((10000_u128 + 33500_u128) / 7200_u128) * 21000000000000000000_u128;
        assert(*resource[1] == food_harvested.into(), 'failed food amount');

        // assert labor is right amount
        let labor = world.entity('Labor'.into(), wheat_query, 0_u8, 0_usize);

        // timestamp + labor_per_unit * labor_units
        // 154000 is previous balance
        // 7200 * 20 is added balance
        // 154000 - 20000 is unharvested balance
        assert(*labor[0] == 154000 + 7200 * 20 - (154000 - 20000), 'labor balance is wrong');
        assert(*labor[1] == 20000, 'labor last harvest is wrong');
        assert(*labor[2] == 2, 'multiplier is wrong');
    }
}
