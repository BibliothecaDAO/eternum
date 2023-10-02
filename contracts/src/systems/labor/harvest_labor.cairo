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
            ctx.world,
            Resource {
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
                ctx.world,
                Labor {
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
                ctx.world,
                Labor {
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


#[cfg(test)]
mod tests {
    use eternum::constants::ResourceTypes;
    use eternum::components::resources::Resource;
    use eternum::components::labor::Labor;
    use eternum::components::position::Position;
    use eternum::systems::labor::utils::get_labor_resource_type;

    // testing
    use eternum::utils::testing::spawn_eternum;

    use traits::{Into, TryInto};
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


    #[test]
    #[available_gas(3000000000)]
    fn test_harvest_labor_non_food() {
        let world = spawn_eternum();

        let player_address = starknet::get_caller_address();

        let resource_type = ResourceTypes::GOLD;

        // set realm entity
        let position = Position { x: 1, y: 1, entity_id: 1_u128 };
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(
            @0x209, ref create_realm_calldata
        ); // resource_types_packed // 2,9 // stone and gold
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
        let base_labor_units = 7200;
        let base_resources_per_cycle = 250;
        let base_food_per_cycle = 21_000_000_000_000_000_000;
        Serde::serialize(@base_labor_units, ref create_labor_conf_calldata);
        Serde::serialize(@base_resources_per_cycle, ref create_labor_conf_calldata);
        Serde::serialize(@base_food_per_cycle, ref create_labor_conf_calldata);
        world.execute('SetLaborConfig', create_labor_conf_calldata);

        // set initial block timestamp
        let last_harvest_ts = 1000;
        starknet::testing::set_block_timestamp(last_harvest_ts);

        let labor_resource_type = get_labor_resource_type(resource_type);

        // switch to executor to set storage directly
        starknet::testing::set_contract_address(world.executor());
        set!(
            world,
            Resource {
                entity_id: realm_entity_id.try_into().unwrap(),
                resource_type: labor_resource_type,
                balance: 40
            }
        );
        starknet::testing::set_contract_address(player_address);

        // build labor for gold
        let mut build_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
        Serde::serialize(@20, ref build_labor_calldata); // labor_units
        Serde::serialize(@1, ref build_labor_calldata); // multiplier
        world.execute('BuildLabor', build_labor_calldata);

        // update block timestamp to harvest labor
        let current_harvest_ts = 40_000;
        starknet::testing::set_block_timestamp(current_harvest_ts);

        // call harvest labor system
        let mut harvest_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref harvest_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref harvest_labor_calldata); // resource_type
        world.execute('HarvestLabor', harvest_labor_calldata);

        let (gold_labor_after_harvest, gold_resource_after_harvest) = get!(
            world, (realm_entity_id, resource_type), (Labor, Resource)
        );
        // get labor after harvest = current labor balance + remainder from division by 7200
        assert(gold_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
        assert(gold_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

        let last_harvest_ts: u128 = last_harvest_ts.into();
        let current_harvest_ts: u128 = current_harvest_ts.into();
        let labor_per_unit: u128 = base_labor_units.try_into().unwrap();
        let base_resources_per_cycle: u128 = base_resources_per_cycle.try_into().unwrap();

        let generated_labor = current_harvest_ts
            - last_harvest_ts; // because current_harvest_ts < balance
        let mut generated_units = generated_labor / labor_per_unit;
        let generated_resources = generated_units * base_resources_per_cycle;

        // verify resource is right amount
        assert(
            gold_resource_after_harvest.balance == generated_resources, 'failed resource amount'
        );
    }


    #[test]
    #[available_gas(3000000000)]
    fn test_harvest_labor_food() {
        let world = spawn_eternum();

        let player_address = starknet::get_caller_address();

        let resource_type = ResourceTypes::WHEAT;

        // set realm entity
        let position = Position { x: 1, y: 1, entity_id: 1_u128 };
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(
            @1, ref create_realm_calldata
        ); // resource_types_packed // immaterial since wheat is food
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
        let base_labor_units = 7200;
        let base_resources_per_cycle = 250;
        let base_food_per_cycle = 21_000_000_000_000_000_000;
        Serde::serialize(@base_labor_units, ref create_labor_conf_calldata);
        Serde::serialize(@base_resources_per_cycle, ref create_labor_conf_calldata);
        Serde::serialize(@base_food_per_cycle, ref create_labor_conf_calldata);
        world.execute('SetLaborConfig', create_labor_conf_calldata);

        // set initial block timestamp
        let last_harvest_ts = 1000;
        starknet::testing::set_block_timestamp(last_harvest_ts);

        let labor_resource_type = get_labor_resource_type(resource_type);

        // switch to executor to set storage directly
        starknet::testing::set_contract_address(world.executor());
        set!(
            world,
            Resource {
                entity_id: realm_entity_id.try_into().unwrap(),
                resource_type: labor_resource_type,
                balance: 40
            }
        );
        starknet::testing::set_contract_address(player_address);

        // build labor for wheat
        let mut build_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
        Serde::serialize(@20, ref build_labor_calldata); // labor_units
        Serde::serialize(@1, ref build_labor_calldata); // multiplier
        world.execute('BuildLabor', build_labor_calldata);

        // update block timestamp to harvest labor
        let current_harvest_ts = 40_000;
        starknet::testing::set_block_timestamp(current_harvest_ts);

        // call build labor system
        let mut harvest_labor_calldata = array![];
        Serde::serialize(@realm_entity_id, ref harvest_labor_calldata); // realm_id
        Serde::serialize(@resource_type, ref harvest_labor_calldata); // resource_type
        world.execute('HarvestLabor', harvest_labor_calldata);

        let (wheat_labor_after_harvest, wheat_resource_after_harvest) = get!(
            world, (realm_entity_id, resource_type), (Labor, Resource)
        );
        // get labor after harvest = current labor balance + remainder from division by 7200
        assert(wheat_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
        assert(wheat_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

        let last_harvest_ts: u128 = last_harvest_ts.into();
        let current_harvest_ts: u128 = current_harvest_ts.into();
        let labor_per_unit: u128 = base_labor_units.try_into().unwrap();
        let base_food_per_cycle: u128 = base_food_per_cycle.try_into().unwrap();

        let generated_labor = current_harvest_ts
            - last_harvest_ts; // because current_harvest_ts < balance
        let mut generated_units = generated_labor / labor_per_unit;
        let generated_resources = generated_units * base_food_per_cycle;

        // verify resource is right amount
        assert(
            wheat_resource_after_harvest.balance == generated_resources, 'failed resource amount'
        );
    }
}

