#[system]
mod BuildLabor {
    use traits::Into;
    use box::BoxTrait;
    use eternum::components::labor::{Labor, LaborTrait};

    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::realm::{Realm, RealmTrait};
    use eternum::components::resources::Resource;

    use eternum::components::config::{LaborConfig, LaborCostResources, LaborCostAmount};
    use starknet::ContractAddress;
    use eternum::constants::{LABOR_CONFIG_ID, ResourceTypes};
    use eternum::utils::unpack::unpack_resource_types;

    use dojo::world::Context;

    fn execute(ctx: Context, realm_id: u128, resource_type: u8, labor_units: u64, multiplier: u64) {
        // assert owner of realm
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

        let ts = starknet::get_block_timestamp();

        // get labor
        let resource_query = (realm_id, resource_type);

        // TODO: Discuss
        let maybe_labor = get!(ctx.world, resource_query, Labor);
        let labor = match maybe_labor.balance.into() {
            0 => Labor {
                entity_id: realm_id,
                resource_type: resource_type,
                balance: ts,
                last_harvest: ts,
                multiplier: 1,
            },
            _ => maybe_labor,
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

        let maybe_current_resource = get!(ctx.world, resource_query, Resource);

        let mut current_resource = match maybe_current_resource.balance.into() {
            0 => Resource { entity_id: realm_id, resource_type, balance: 0 },
            _ => maybe_current_resource,
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
            let _ = set!(
                ctx.world, Resource {
                    entity_id: realm_id,
                    resource_type: current_resource.resource_type,
                    balance: current_resource.balance
                        + (total_harvest_units.into()
                            * labor.multiplier.into()
                            * labor_config.base_food_per_cycle)
                }
            );

            // if unharvested has been harvested, remove it from the labor balance
            new_labor_balance = new_labor_balance - labor_unharvested;
            // if unharvested has been harvested, update last_harvest
            new_last_harvest = ts;
        }

        // update the labor
        let _ = set!(
            ctx.world, Labor {
                entity_id: realm_id,
                resource_type: current_resource.resource_type,
                balance: new_labor_balance,
                last_harvest: new_last_harvest,
                multiplier: multiplier
            }
        );

        // pay for labor 
        let labor_cost_resources = get!(ctx.world, resource_type, LaborCostResources);
        let labor_cost_resource_types: Span<u8> = unpack_resource_types(
            labor_cost_resources.resource_types_packed, labor_cost_resources.resource_types_count
        );
        let mut index = 0_usize;

        loop {
            if index == labor_cost_resources.resource_types_count.into() {
                break ();
            }
            let labor_cost_resource_type = *labor_cost_resource_types[index];
            let labor_cost_per_unit = get!(
                ctx.world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
            );
            let current_resource: Resource = get!(
                ctx.world, (realm_id, labor_cost_resource_type).into(), Resource
            );
            let total_cost = labor_cost_per_unit.value * labor_units.into() * multiplier.into();
            assert(current_resource.balance >= total_cost, 'Not enough resources');
            set!(
                ctx.world, Resource {
                    entity_id: realm_id,
                    resource_type: current_resource.resource_type,
                    balance: current_resource.balance - total_cost
                }
            );
            index += 1;
        };
        return ();
    }
}



mod tests {
    use eternum::constants::ResourceTypes;
    use eternum::components::resources::Resource;
    use eternum::components::labor::Labor;
    use eternum::components::position::Position;

    use eternum::utils::testing::spawn_eternum;

    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;
    
    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};


    #[test]
    #[available_gas(300000000000)]
    fn test_build_labor_non_food() {
        let world = spawn_eternum();

        // set realm entity
        let position = Position { x: 1, y: 1, entity_id: 1_u128};
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(@0x20309, ref create_realm_calldata); // resource_types_packed // 2,3,9 // stone, coal, gold
        Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
        Serde::serialize(@5, ref create_realm_calldata); // cities
        Serde::serialize(@5, ref create_realm_calldata); // harbors
        Serde::serialize(@5, ref create_realm_calldata); // rivers
        Serde::serialize(@5, ref create_realm_calldata); // regions
        Serde::serialize(@1, ref create_realm_calldata); // wonder
        Serde::serialize(@1, ref create_realm_calldata); // order
        Serde::serialize(@position, ref create_realm_calldata); // position
       let result = world.execute('CreateRealm', create_realm_calldata);
       let realm_entity_id = *result[0];

        // set labor configuration entity
        let mut create_labor_conf_calldata = array![];

        Serde::serialize(@7200, ref create_labor_conf_calldata); // base_labor_units
        Serde::serialize(@250, ref create_labor_conf_calldata); // base_resources_per_cycle
        Serde::serialize(@21_000_000_000_000_000_000, ref create_labor_conf_calldata); // base_food_per_cycle
        world.execute('SetLaborConfig', create_labor_conf_calldata); 


        let mut create_labor_cr_calldata = array![];
        Serde::serialize(@ResourceTypes::GOLD, ref create_labor_cr_calldata); // resource_type_labor
        Serde::serialize(@0x203, ref create_labor_cr_calldata); // resource_types_packed // 2,3 // stone and coal
        Serde::serialize(@2, ref create_labor_cr_calldata); // resource_types_count // stone and coal
        world.execute('SetLaborCostResources', create_labor_cr_calldata);

        // cost for gold in coal
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@ResourceTypes::GOLD, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::COAL, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // cost for gold in stone
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@ResourceTypes::GOLD, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::STONE, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // mint 100_000 coal for the realm;
        let mut mint_coal_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_coal_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::COAL, ref mint_coal_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_coal_calldata); // amount
        world.execute('MintResources', mint_coal_calldata);

        // mint 100_000 stone for the realm;
        let mut mint_stone_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_stone_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::STONE, ref mint_stone_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_stone_calldata); // amount
        world.execute('MintResources', mint_stone_calldata);

        // set block timestamp in order to harvest labor
        // initial ts = 0
        let ts = 10_000;
        starknet::testing::set_block_timestamp(ts);

        // build labor for gold
        let mut build_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
        Serde::serialize(@ResourceTypes::GOLD, ref build_labor_calldata); // resource_type
        Serde::serialize(@20, ref build_labor_calldata); // labor_units
        Serde::serialize(@1, ref build_labor_calldata); // multiplier
        world.execute('BuildLabor', build_labor_calldata);

        // assert resources are the right amount
        let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
        assert(coal_resource.balance == 80_000, 'failed resource amount');


        let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
        assert(stone_resource.balance == 80_000, 'failed resource amount');

        // assert labor is right amount
        let gold_labor = get!(world, (realm_entity_id, ResourceTypes::GOLD), Labor);
        assert(gold_labor.balance == ts + (7_200 * 20), 'wrong gold labor balance');
        assert(gold_labor.last_harvest == ts, 'wrong gold labor last harvest');
        assert(gold_labor.multiplier == 1, 'wrong gold multiplier');

    }



    #[test]
    #[available_gas(300000000000)]
    fn test_build_labor_food() {
        let world = spawn_eternum();

        // set realm entity
        let position = Position { x: 1, y: 1, entity_id: 1_u128};
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(@1, ref create_realm_calldata); // resource_types_packed // doesn't matter since wheat is food
        Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
        Serde::serialize(@5, ref create_realm_calldata); // cities
        Serde::serialize(@5, ref create_realm_calldata); // harbors
        Serde::serialize(@5, ref create_realm_calldata); // rivers
        Serde::serialize(@5, ref create_realm_calldata); // regions
        Serde::serialize(@1, ref create_realm_calldata); // wonder
        Serde::serialize(@1, ref create_realm_calldata); // order
        Serde::serialize(@position, ref create_realm_calldata); // position
       let result = world.execute('CreateRealm', create_realm_calldata);
       let realm_entity_id = *result[0];

        // set labor configuration entity
        let mut create_labor_conf_calldata = array![];

        Serde::serialize(@7200, ref create_labor_conf_calldata); // base_labor_units
        Serde::serialize(@250, ref create_labor_conf_calldata); // base_resources_per_cycle
        Serde::serialize(@21_000_000_000_000_000_000, ref create_labor_conf_calldata); // base_food_per_cycle
        world.execute('SetLaborConfig', create_labor_conf_calldata); 


        let mut create_labor_cr_calldata = array![];
        Serde::serialize(@ResourceTypes::WHEAT, ref create_labor_cr_calldata); // resource_type_labor
        Serde::serialize(@0x203, ref create_labor_cr_calldata); // resource_types_packed // 2,3 // stone and coal
        Serde::serialize(@2, ref create_labor_cr_calldata); // resource_types_count // stone and coal
        world.execute('SetLaborCostResources', create_labor_cr_calldata);

        // cost for wheat in coal
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@ResourceTypes::WHEAT, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::COAL, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // cost for wheat in stone
        let mut create_labor_cv_calldata = array![];
        Serde::serialize(@ResourceTypes::WHEAT, ref create_labor_cv_calldata); // resource_type_labor
        Serde::serialize(@ResourceTypes::STONE, ref create_labor_cv_calldata); // resource_type_cost
        Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
        world.execute('SetLaborCostAmount', create_labor_cv_calldata);

        // mint 100_000 coal for the realm;
        let mut mint_coal_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_coal_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::COAL, ref mint_coal_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_coal_calldata); // amount
        world.execute('MintResources', mint_coal_calldata);

        // mint 100_000 stone for the realm;
        let mut mint_stone_calldata = array![];
        Serde::serialize(@realm_entity_id, ref mint_stone_calldata); // realm entity id
        Serde::serialize(@ResourceTypes::STONE, ref mint_stone_calldata); // resource_type
        Serde::serialize(@100_000, ref mint_stone_calldata); // amount
        world.execute('MintResources', mint_stone_calldata);

        // set block timestamp in order to harvest labor
        // initial ts = 0
        let ts = 10_000;
        starknet::testing::set_block_timestamp(ts);

        // build labor for wheat
        let mut build_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
        Serde::serialize(@ResourceTypes::WHEAT, ref build_labor_calldata); // resource_type
        Serde::serialize(@20, ref build_labor_calldata); // labor_units
        Serde::serialize(@1, ref build_labor_calldata); // multiplier
        world.execute('BuildLabor', build_labor_calldata);


        // assert resources are the right amount
        let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
        assert(coal_resource.balance == 80_000, 'failed resource amount');


        let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
        assert(stone_resource.balance == 80_000, 'failed resource amount');

        // assert labor is right amount
        let wheat_labor = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Labor);

        assert(wheat_labor.balance == ts + (7_200 * 20), 'wrong wheat labor balance');
        assert(wheat_labor.last_harvest == ts, 'wrong wheat labor last harvest');
        assert(wheat_labor.multiplier == 1, 'wrong wheat multiplier');

        //------------------------------------------
        //
        // Test harvest when multiplier is different
        //
        //------------------------------------------

        // set block timestamp in order to harvest labor
        starknet::testing::set_block_timestamp(20_000);

        // build labor again but with different multiplier
        // call build labor system
        let mut build_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
        Serde::serialize(@ResourceTypes::WHEAT, ref build_labor_calldata); // resource_type
        Serde::serialize(@20, ref build_labor_calldata); // labor_units
        Serde::serialize(@2, ref build_labor_calldata); // multiplier
        world.execute('BuildLabor', build_labor_calldata);

        // assert resource is right amount
        let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
        assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
        assert(coal_resource.balance == 80_000 - (20_000 * 2), 'failed resource amount');

        let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
        assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
        assert(stone_resource.balance == 80_000 - (20_000 * 2), 'failed resource amount');


        // check food
        let (wheat_resource, wheat_labor) = get!(world, (realm_entity_id, ResourceTypes::WHEAT), (Resource, Labor));
        assert(wheat_resource.resource_type == ResourceTypes::WHEAT, 'failed resource type');
        // left to harvest = 134_000 / 4 = 33_500
        assert(wheat_resource.balance == ((10000_u128 + 33500_u128) / 7200_u128) * 21000000000000000000_u128, 'failed wheat resource amount');

        // timestamp + labor_per_unit * labor_units
        // 154000 is previous balance
        // 7200 * 20 is added balance
        // 154000 - 20000 is unharvested balance
        assert(wheat_labor.balance == 154000 + 7200 * 20 - (154000 - 20000), 'wrong wheat labor balance');
        assert(wheat_labor.last_harvest == 20_000, 'wrong wheat labor last harvest');
        assert(wheat_labor.multiplier == 2, 'wrong wheat multiplier');
    }
}


