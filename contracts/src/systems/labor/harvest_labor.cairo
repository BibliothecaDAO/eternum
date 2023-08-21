#[system]
mod HarvestLabor {
    use starknet::ContractAddress;

    use traits::{Into, TryInto};
    use array::ArrayTrait;
    use box::BoxTrait;

    use eternum::components::config::WorldConfig;
    use eternum::components::owner::Owner;
    use eternum::components::realm::{Realm, RealmTrait};
    use eternum::components::resources::{Resource, Vault};
    use eternum::components::labor::{Labor, LaborTrait};
    use eternum::components::config::LaborConfig;
    use eternum::constants::{LABOR_CONFIG_ID, WORLD_CONFIG_ID, ResourceTypes};
    use eternum::alias::ID;

    use dojo::world::Context;

    fn execute(ctx: Context, realm_id: u128, resource_type: u8) {
        let player_id: ContractAddress = ctx.origin;
        let (realm, owner) = get!(ctx.world, realm_id, (Realm, Owner));

        assert(owner.address == player_id, 'Realm does not belong to player');

        // check that resource is on realm
        let realm_has_resource = realm.has_resource(resource_type);
        let is_food = (resource_type == ResourceTypes::FISH)
            | (resource_type == ResourceTypes::WHEAT);
        if realm_has_resource == false {
            assert(is_food == true, 'Resource is not on realm');
        }

        // Get Config
        let labor_config: LaborConfig = get!(ctx.world, LABOR_CONFIG_ID, LaborConfig);

        // get production per cycle
        let mut base_production_per_cycle: u128 = labor_config.base_resources_per_cycle;
        if (is_food) {
            base_production_per_cycle = labor_config.base_food_per_cycle;
        }

        let resource_query = (realm_id, resource_type);
        // if no labor, panic
        let labor = get!(ctx.world, resource_query, Labor);

        // TODO: Discuss
        let maybe_resource = get!(ctx.world, resource_query, Resource);
        let mut resource = match maybe_resource.balance.into() {
            0 => Resource { entity_id: realm_id, resource_type, balance: 0 },
            _ => maybe_resource,
        };

        // transform timestamp from u64 to u128
        let ts = starknet::get_block_timestamp();

        // generated labor
        // TODO: don't retrive labor_unharvested
        let (labor_generated, is_complete, labor_unharvested) = labor.get_labor_generated(ts);

        // assert base labor units not zero
        assert(labor_config.base_labor_units != 0, 'Base labor units cannot be zero');

        // labor units and part units
        let labor_units_generated = labor_generated / labor_config.base_labor_units;

        // assert that at least some labor has been generated
        assert(labor_units_generated != 0, 'Wait end of harvest cycle');

        // remainder is what is left from division by base labor units
        let remainder = labor_generated % labor_config.base_labor_units;

        // update resources with multiplier
        let _ = set!(
            ctx.world, Resource {
                entity_id: realm_id,
                resource_type: resource_type,
                balance: resource.balance
                    + (labor_units_generated.into()
                        * base_production_per_cycle
                        * labor.multiplier.into()),
            }
        );

        // if is complete, balance should be set to current ts
        // remove the 
        if (is_complete) {
            let _ = set!(
                ctx.world, Labor {
                    entity_id: realm_id,
                    resource_type: resource_type,
                    balance: ts + remainder,
                    last_harvest: ts,
                    multiplier: labor.multiplier,
                }
            );
        } else {
            // if not complete, then remove what was not harvested (unharvested + remainder) 
            // from last harvest
            let _ = set!(
                ctx.world, Labor {
                    entity_id: realm_id,
                    resource_type: resource_type,
                    balance: labor.balance + remainder,
                    last_harvest: ts,
                    multiplier: labor.multiplier,
                }
            );
        }
        return ();
    }
}
// // TODO: test when withdraw gas is solved
// // TODO: remove everything related to vault
// mod tests {
//     // constants
//     use eternum::constants::ResourceTypes;

//     use core::traits::Into;
//     use core::result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;

//     use starknet::syscalls::deploy_syscall;

//     // testing utils
//     use eternum::utils::testing::spawn_test_world_without_init;

//     use dojo::interfaces::IWorldDispatcherTrait;
//     use dojo::auth::systems::{Route, RouteTrait};
//     use dojo::storage::query::{
//         Query, TupleSize2IntoQuery, LiteralIntoQuery, TupleSize3IntoQuery
//     };

//     // #[test]
//     // // need higher gas limit because of new auth system
//     // #[available_gas(3000000000)]
//     // fn test_harvest_labor_non_food() {
//     //     let world = spawn_test_world_without_init();

//     //     /// CREATE ENTITIES ///
//     //     // set realm entity
//     //     let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
//     //     create_realm_calldata.append(1);
//     //     create_realm_calldata.append(starknet::get_caller_address().into());
//     //     create_realm_calldata.append(1);
//     //     create_realm_calldata.append(1);
//     //     create_realm_calldata.append(5);
//     //     create_realm_calldata.append(5);
//     //     create_realm_calldata.append(5);
//     //     create_realm_calldata.append(5);
//     //     create_realm_calldata.append(1);
//     //     create_realm_calldata.append(1);
//     //     world.execute('CreateRealm'.into(), create_realm_calldata.span());

//     //     // set labor configuration entity
//     //     let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
//     //     create_labor_conf_calldata.append(7200);
//     //     create_labor_conf_calldata.append(250);
//     //     create_labor_conf_calldata.append(21000000000000000000);
//     //     world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

//     //     let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
//     //     create_labor_cr_calldata.append(1);
//     //     create_labor_cr_calldata.append(1);
//     //     create_labor_cr_calldata.append(1);
//     //     world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

//     //     let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//     //     create_labor_cv_calldata.append(1);
//     //     create_labor_cv_calldata.append(1);
//     //     create_labor_cv_calldata.append(1000);
//     //     world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//     //     // mint 100000 resource id 1 for realm id 1;
//     //     let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//     //     mint_resources_calldata.append(1);
//     //     mint_resources_calldata.append(1);
//     //     mint_resources_calldata.append(100000);
//     //     world.execute('MintResources'.into(), mint_resources_calldata.span());

//     //     // set block timestamp in order to harvest labor
//     //     // initial ts = 0
//     //     starknet::testing::set_block_timestamp(1000);

//     //     // call build labor system
//     //     let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
//     //     build_labor_calldata.append(1);
//     //     build_labor_calldata.append(1);
//     //     build_labor_calldata.append(20);
//     //     // multiplier
//     //     build_labor_calldata.append(1);
//     //     world.execute('BuildLabor'.into(), build_labor_calldata.span());

//     //     // set block timestamp in order to harvest labor
//     //     // initial ts = 0
//     //     starknet::testing::set_block_timestamp(40000);

//     //     // call build labor system
//     //     let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
//     //     // realm_id
//     //     harvest_labor_calldata.append(1);
//     //     // resource_type
//     //     harvest_labor_calldata.append(1);
//     //     world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

//     //     // get labor after harvest 
//     //     let labor_after_harvest = world.entity('Labor'.into(), (1, (1)).into(), 0_u8, 0_usize);
//     //     // labor after harvest = current labor balance + rest from division by 72000
//     //     assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
//     //     assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

//     //     let last_harvest = 1000_u128;
//     //     let current_ts = 40000_u128;
//     //     let labor_per_unit = 7200_u128;
//     //     let base_resources_per_cycle = 21000000000000000000_u128;
//     //     let vault_percentage = 250; // on base 1000
//     //     let resource_balance_before_harvest = 80000_u128;

//     //     // because current_ts < balance
//     //     let generated_labor = current_ts - last_harvest;

//     //     // generated units
//     //     let mut generated_units = generated_labor / labor_per_unit;
//     //     // vault units
//     //     let vault_units = generated_units * vault_percentage / 1000;
//     //     generated_units -= vault_units;

//     //     let generated_resources = generated_units * base_resources_per_cycle;

//     //     // verify resource is right amount
//     //     let resource = world.entity('Resource'.into(), (1, (1)).into(), 0_u8, 0_usize);
//     //     assert(
//     //         *resource[1] == (resource_balance_before_harvest + generated_resources).into(),
//     //         'failed resource amount'
//     //     );

//     //     // verify vault balance 
//     //     let vault = world.entity('Vault'.into(), (1, (1)).into(), 0_u8, 0_usize);
//     //     assert(*vault[0] == 1, 'failed vault balance');
//     // }

//     #[test]
//     #[available_gas(3000000000)]
//     fn test_harvest_labor_food() {
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
//         world.execute('CreateRealm'.into(), create_realm_calldata.span());

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_conf_calldata.append(7200);
//         create_labor_conf_calldata.append(250);
//         create_labor_conf_calldata.append(21000000000000000000);
//         world.execute('SetLaborConfig'.into(), create_labor_conf_calldata.span());

//         let mut create_labor_cr_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cr_calldata.append(ResourceTypes::WHEAT.into());
//         create_labor_cr_calldata.append(1);
//         create_labor_cr_calldata.append(1);
//         world.execute('SetLaborCostResources'.into(), create_labor_cr_calldata.span());

//         let mut create_labor_cv_calldata = array::ArrayTrait::<felt252>::new();
//         create_labor_cv_calldata.append(ResourceTypes::WHEAT.into());
//         create_labor_cv_calldata.append(1);
//         create_labor_cv_calldata.append(1000);
//         world.execute('SetLaborCostAmount'.into(), create_labor_cv_calldata.span());

//         // mint 100000 resource id 1 for realm id 1;
//         let mut mint_resources_calldata = array::ArrayTrait::<felt252>::new();
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(1);
//         mint_resources_calldata.append(100000);
//         world.execute('MintResources'.into(), mint_resources_calldata.span());

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         starknet::testing::set_block_timestamp(1000);

//         // call build labor system
//         let mut build_labor_calldata = array::ArrayTrait::<felt252>::new();
//         build_labor_calldata.append(1);
//         build_labor_calldata.append(ResourceTypes::WHEAT.into());
//         build_labor_calldata.append(20);
//         // multiplier
//         build_labor_calldata.append(1);
//         world.execute('BuildLabor'.into(), build_labor_calldata.span());

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         starknet::testing::set_block_timestamp(40000);

//         // call build labor system
//         let mut harvest_labor_calldata = array::ArrayTrait::<felt252>::new();
//         // realm_id
//         harvest_labor_calldata.append(1);
//         // resource_type
//         harvest_labor_calldata.append(ResourceTypes::WHEAT.into());
//         world.execute('HarvestLabor'.into(), harvest_labor_calldata.span());

//         let wheat_felt: felt252 = ResourceTypes::WHEAT.into();
//         let wheat_query: Query = (1, wheat_felt).into();
//         // get labor after harvest 
//         let labor_after_harvest = world.entity('Labor'.into(), wheat_query, 0_u8, 0_usize);
//         // labor after harvest = current labor balance + rest from division by 72000
//         assert(*labor_after_harvest[0] == 145000 + 3000, 'wrong labor balance');
//         assert(*labor_after_harvest[1] == 40000, 'wrong last harvest');

//         let last_harvest = 1000_u128;
//         let current_ts = 40000_u128;
//         let labor_per_unit = 7200_u128;
//         let base_resources_per_cycle = 21000000000000000000_u128;

//         // because current_ts < balance
//         let generated_labor = current_ts - last_harvest;

//         // generated units
//         let mut generated_units = generated_labor / labor_per_unit;

//         let generated_resources = generated_units * base_resources_per_cycle;

//         // verify resource is right amount
//         let resource = world.entity('Resource'.into(), wheat_query, 0_u8, 0_usize);
//         assert(*resource[1] == generated_resources.into(), 'failed resource amount');
//     }
// }


