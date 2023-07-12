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

    use dojo::world::Context;

    #[external]
    fn execute(ctx: Context, realm_id: u128, resource_type: u8, labor_units: u64, multiplier: u64) {
        // assert owner of realm
        let player_id: ContractAddress = starknet::get_tx_info().unbox().account_contract_address;
        let (realm, owner) = get !(ctx.world, realm_id.into(), (Realm, Owner));
        assert(owner.address == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        let realm_has_resource = realm.has_resource(resource_type);
        let is_food = (resource_type == ResourceTypes::FISH)
            | (resource_type == ResourceTypes::WHEAT);
        if realm_has_resource == false {
            assert(is_food == true, 'Resource is not on realm');
        }

        // Get Config
        let labor_config: LaborConfig = get !(ctx.world, LABOR_CONFIG_ID.into(), LaborConfig);

        let ts = starknet::get_block_timestamp();

        // get labor
        let resource_query: Query = (realm_id, resource_type).into();
        let maybe_labor = try_get !(ctx.world, resource_query, Labor);
        let labor = match maybe_labor {
            Option::Some(labor) => labor,
            Option::None(_) => Labor { balance: ts, last_harvest: ts, multiplier: 1,  },
        };

        // config
        let additional_labor = labor_units * labor_config.base_labor_units;

        // set new labor balance
        let mut new_labor_balance = labor.balance + additional_labor;
        let mut new_last_harvest = labor.last_harvest;

        // assert multiplier higher than 0
        assert(multiplier > 0, 'Multiplier cannot be zero');

        // if multiplier is bigger than 1, verify that it's either fish or wheat 
        // assert ressource_id is fish or wheat
        if multiplier > 1 {
            if resource_type == ResourceTypes::FISH {
                // assert that realm can have that many fishing villages
                let harbors: u64 = realm.harbors.into();
                assert(harbors >= multiplier, 'Not enough harbors')
            } else {
                assert(resource_type == ResourceTypes::WHEAT, 'Resource id is not valid');
                // assert that realm can have that many farms
                let rivers: u64 = realm.rivers.into();
                assert(rivers >= multiplier, 'Not enough rivers')
            }
        }

        let maybe_current_resource = try_get !(ctx.world, resource_query, Resource);

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
            set !(
                ctx.world,
                resource_query,
                (Resource {
                    resource_type: current_resource.resource_type,
                    balance: current_resource.balance
                        + (total_harvest_units.into()
                            * labor.multiplier.into()
                            * labor_config.base_food_per_cycle)
                })
            );

            // if unharvested has been harvested, remove it from the labor balance
            new_labor_balance = new_labor_balance - labor_unharvested;
            // if unharvested has been harvested, update last_harvest
            new_last_harvest = ts;
        }

        // update the labor
        set !(
            ctx.world,
            resource_query,
            (Labor { balance: new_labor_balance, last_harvest: new_last_harvest, multiplier,  }),
        );

        // pay for labor 
        let labor_cost_resources = get !(ctx.world, resource_type.into(), LaborCostResources);
        let labor_cost_resource_types: Span<u8> = unpack_resource_types(
            labor_cost_resources.resource_types_packed, labor_cost_resources.resource_types_count
        );
        let mut index = 0_usize;

        loop {
            if index == labor_cost_resources.resource_types_count.into() {
                break ();
            }
            let labor_cost_resource_type = *labor_cost_resource_types[index];
            let labor_cost_per_unit = get !(
                ctx.world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
            );
            let current_resource: Resource = get !(
                ctx.world, (realm_id, labor_cost_resource_type).into(), Resource
            );
            let total_cost = labor_cost_per_unit.value * labor_units.into() * multiplier.into();
            assert(current_resource.balance >= total_cost, 'Not enough resources');
            set !(
                ctx.world,
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
// TODO: test when withdraw gas is solved
// // TODO: remove everything related to vault
// mod tests {
//     // constants
//     use eternum::constants::ResourceTypes;

//     // testing utils
//     use eternum::utils::testing::spawn_test_world_without_init;
//     use core::traits::Into;
//     use core::result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;

//     use starknet::syscalls::deploy_syscall;

//     use dojo::interfaces::IWorldDispatcherTrait;
//     use dojo::auth::systems::{Route, RouteTrait};
//     use dojo::storage::query::{
//         Query, TupleSize2IntoQuery, LiteralIntoQuery, TupleSize3IntoQuery
//     };

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_build_labor_non_food() {
//         let world = spawn_test_world_without_init();

//         /// CREATE ENTITIES ///
//         // set realm entity
//         let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(starknet::get_caller_address().into());
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         // position
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         world.execute('CreateRealm'.into(), create_realm_calldata.span());
//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_conf_calldata.append(7200);
//         create_labor_conf_calldata.append(250);
//         create_labor_conf_calldata.append(21000000000000000000);
//         world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

//         let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cr_calldata.append(1);
//         create_labor_cr_calldata.append(515);
//         create_labor_cr_calldata.append(2);
//         world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

//         // cost in resource 2 for resource 1
//         let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cv_calldata.append(1);
//         create_labor_cv_calldata.append(2);
//         create_labor_cv_calldata.append(1000);
//         world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//         // cost in resource 3 for resource 1
//         let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cv_calldata.append(1);
//         create_labor_cv_calldata.append(3);
//         create_labor_cv_calldata.append(1000);
//         world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//         // mint 100000 resource id 2 for realm id 1;
//         let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(2);
//         mint_resources_calldata.append(100000);
//         world.execute('MintResources'.into(), mint_resources_calldata.span());

//         // mint 100000 resource id 3 for realm id 1;
//         let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(3);
//         mint_resources_calldata.append(100000);
//         world.execute('MintResources'.into(), mint_resources_calldata.span());

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         starknet::testing::set_block_timestamp(10000);

//         // call build labor system
//         let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
//         build_labor_calldata.append(1);
//         build_labor_calldata.append(1);
//         build_labor_calldata.append(20);
//         // multiplier
//         build_labor_calldata.append(1);
//         world.execute('BuildLabor'.into(), build_labor_calldata.span());
//         // assert resource is right amount
//         let resource = world.entity('Resource'.into(), (1, 2).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 2, 'failed resource id');
//         assert(*resource[1] == 80000, 'failed resource amount');

//         let resource = world.entity('Resource'.into(), (1, 3).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 3, 'failed resource id');
//         assert(*resource[1] == 80000, 'failed resource amount');

//         // assert labor is right amount
//         let labor = world.entity('Labor'.into(), (1, 1).into(), 0_u8, 0_usize);
//         // timestamp + labor_per_unit * labor_units
//         assert(*labor[0] == 10000 + 7200 * 20, 'labor balance is wrong');
//         assert(*labor[1] == 10000, 'labor last harvest is wrong');
//         assert(*labor[2] == 1, 'multiplier is wrong');
//     }
//     #[test]
//     #[available_gas(300000000000)]
//     fn test_build_labor_food() {
//         let world = spawn_test_world_without_init();

//         /// CREATE ENTITIES ///
//         // set realm entity
//         let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(starknet::get_caller_address().into());
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         // position
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         world.execute('CreateRealm'.into(), create_realm_calldata.span());

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
//         // 
//         // base_labor_units
//         create_labor_conf_calldata.append(7200);
//         // vault percentage
//         create_labor_conf_calldata.append(250);
//         // base_resources_per_cycle
//         create_labor_conf_calldata.append(21000000000000000000);
//         world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

//         let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cr_calldata.append(ResourceTypes::WHEAT.into());
//         create_labor_cr_calldata.append(515);
//         create_labor_cr_calldata.append(2);
//         world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

//         // cost in resource 2 for resource 1
//         let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cv_calldata.append(ResourceTypes::WHEAT.into());
//         create_labor_cv_calldata.append(2);
//         create_labor_cv_calldata.append(1000);
//         world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//         // cost in resource 3 for resource 1
//         let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cv_calldata.append(ResourceTypes::WHEAT.into());
//         create_labor_cv_calldata.append(3);
//         create_labor_cv_calldata.append(1000);
//         world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//         // mint 100000 resource id 2 for realm id 1;
//         let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(2);
//         mint_resources_calldata.append(100000);
//         world.execute('MintResources'.into(), mint_resources_calldata.span());

//         // mint 100000 resource id 3 for realm id 1;
//         let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(3);
//         mint_resources_calldata.append(100000);
//         world.execute('MintResources'.into(), mint_resources_calldata.span());

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         starknet::testing::set_block_timestamp(10000);

//         // call build labor system
//         let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
//         build_labor_calldata.append(1);
//         build_labor_calldata.append(ResourceTypes::WHEAT.into());
//         build_labor_calldata.append(20);
//         // multiplier
//         build_labor_calldata.append(1);
//         world.execute('BuildLabor'.into(), build_labor_calldata.span());

//         // assert resource is right amount
//         let resource = world.entity('Resource'.into(), (1, 2).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 2, 'failed resource id');
//         assert(*resource[1] == 80000, 'failed resource amount');

//         let resource = world.entity('Resource'.into(), (1, 3).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 3, 'failed resource id');
//         assert(*resource[1] == 80000, 'failed resource amount');

//         // assert labor is right amount
//         let wheat_felt: felt252 = ResourceTypes::WHEAT.into();
//         let wheat_query: Query = (1, wheat_felt).into();
//         let labor = world.entity('Labor'.into(), wheat_query, 0_u8, 0_usize);
//         // timestamp + labor_per_unit * labor_units
//         assert(*labor[0] == 10000 + 7200 * 20, 'labor balance is wrong');
//         assert(*labor[1] == 10000, 'labor last harvest is wrong');
//         assert(*labor[2] == 1, 'multiplier is wrong');

//         // set block timestamp in order to harvest labor
//         starknet::testing::set_block_timestamp(20000);

//         // build labor again but with different multiplier
//         // call build labor system
//         let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
//         build_labor_calldata.append(1);
//         build_labor_calldata.append(ResourceTypes::WHEAT.into());
//         build_labor_calldata.append(20);
//         // multiplier
//         build_labor_calldata.append(2);
//         world.execute('BuildLabor'.into(), build_labor_calldata.span());

//         // assert resource is right amount
//         let resource = world.entity('Resource'.into(), (1, 2).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 2, 'failed resource id');
//         // 80000 - (20000 * 2)
//         assert(*resource[1] == 80000 - (20000 * 2), 'failed resource amount');

//         let resource = world.entity('Resource'.into(), (1, 3).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 3, 'failed resource id');
//         // 80000 - (20000 * 2)
//         assert(*resource[1] == 80000 - (20000 * 2), 'failed resource amount');

//         // check food
//         let resource = world.entity('Resource'.into(), wheat_query, 0_u8, 0_usize);
//         assert(*resource[0] == ResourceTypes::WHEAT.into(), 'failed resource id');
//         // left to harvest = 134 000 / 4 = 33 500
//         let food_harvested = ((10000_u128 + 33500_u128) / 7200_u128) * 21000000000000000000_u128;
//         assert(*resource[1] == food_harvested.into(), 'failed food amount');

//         // assert labor is right amount
//         let labor = world.entity('Labor'.into(), wheat_query, 0_u8, 0_usize);

//         // timestamp + labor_per_unit * labor_units
//         // 154000 is previous balance
//         // 7200 * 20 is added balance
//         // 154000 - 20000 is unharvested balance
//         assert(*labor[0] == 154000 + 7200 * 20 - (154000 - 20000), 'labor balance is wrong');
//         assert(*labor[1] == 20000, 'labor last harvest is wrong');
//         assert(*labor[2] == 2, 'multiplier is wrong');
//     }
// }


