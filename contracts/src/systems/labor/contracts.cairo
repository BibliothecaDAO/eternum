
#[system]
mod labor_systems {

    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    use eternum::models::owner::Owner;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::position::{Position, PositionTrait};
    use eternum::models::resources::Resource;
    use eternum::models::labor::{Labor, LaborTrait};
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};
    use eternum::models::config::{WorldConfig, LaborConfig, LaborCostResources, LaborCostAmount};

    use eternum::systems::labor::utils::{assert_harvestable_resource, get_labor_resource_type};
    use eternum::constants::{LABOR_CONFIG_ID,WORLD_CONFIG_ID, ResourceTypes};
    use eternum::utils::unpack::unpack_resource_types;

    use starknet::ContractAddress;

    use eternum::systems::labor::interface::ILabor;
    
    
    #[external(v0)]
    impl LaborImpl of ILabor<ContractState> {
        fn build(
                self: @ContractState, 
                world: IWorldDispatcher, 
                realm_id: u128, 
                resource_type: u8, 
                labor_units: u64, 
                multiplier: u64
            ) {
                // assert owner of realm
                let player_id: ContractAddress = starknet::get_caller_address();
                let (realm, owner) = get!(world, realm_id, (Realm, Owner));
                assert(owner.address == player_id, 'Realm does not belong to player');

                // check that resource is on realm
                let realm_has_resource = realm.has_resource(resource_type);
                let is_food = (resource_type == ResourceTypes::FISH)
                    | (resource_type == ResourceTypes::WHEAT);
                if realm_has_resource == false {
                    assert(is_food == true, 'Resource is not on realm');
                }

                // Get Config
                let labor_config: LaborConfig = get!(world, LABOR_CONFIG_ID, LaborConfig);

                let ts = starknet::get_block_timestamp();

                // get labor
                let resource_query = (realm_id, resource_type);

                let maybe_labor = get!(world, resource_query, Labor);
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

                let mut new_labor = labor.compute_new_labor(additional_labor, ts, multiplier);

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

                let maybe_current_resource = get!(world, resource_query, Resource);

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
                    set!(
                        world,
                        Resource {
                            entity_id: realm_id,
                            resource_type: current_resource.resource_type,
                            balance: current_resource.balance
                                + (total_harvest_units.into()
                                    * labor.multiplier.into()
                                    * labor_config.base_food_per_cycle)
                        }
                    );
                    new_labor.harvest_unharvested(labor_unharvested, ts)
                }

                // update the labor
                set!(world,(new_labor));

                let labor_resource_type = get_labor_resource_type(resource_type);

                // pay for labor 
                let labor_resources = get!(world, (realm_id, labor_resource_type), Resource);
                assert(
                    labor_resources.balance >= labor_units.into() * multiplier.into(),
                    'Not enough labor resources'
                );

                set!(
                    world,
                    Resource {
                        entity_id: realm_id,
                        resource_type: labor_resource_type,
                        balance: labor_resources.balance - labor_units.into() * multiplier.into()
                    }
                );
            }




            fn harvest(self: @ContractState, world: IWorldDispatcher, realm_id: u128, resource_type: u8) {
                let player_id: ContractAddress = starknet::get_caller_address();
                let (realm, owner) = get!(world, realm_id, (Realm, Owner));

                assert(owner.address == player_id, 'Realm does not belong to player');

                // check that resource is on realm
                let realm_has_resource = realm.has_resource(resource_type);
                let is_food = (resource_type == ResourceTypes::FISH)
                    | (resource_type == ResourceTypes::WHEAT);
                if realm_has_resource == false {
                    assert(is_food == true, 'Resource is not on realm');
                }

                // Get Config
                let labor_config: LaborConfig = get!(world, LABOR_CONFIG_ID, LaborConfig);

                // get production per cycle
                let mut base_production_per_cycle: u128 = labor_config.base_resources_per_cycle;
                if (is_food) {
                    base_production_per_cycle = labor_config.base_food_per_cycle;
                }

                let resource_query = (realm_id, resource_type);
                // if no labor, panic
                let labor = get!(world, resource_query, Labor);

                // TODO: Discuss
                let maybe_resource = get!(world, resource_query, Resource);
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
                set!(
                    world,
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
                    set!(
                        world,
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
                    set!(
                        world,
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




            fn purchase(
                self: @ContractState, 
                world: IWorldDispatcher, 
                entity_id: u128, 
                resource_type: u8, 
                labor_units: u128
            ) {
                // assert owner of realm
                let player_id: ContractAddress = starknet::get_caller_address();
                let (owner, position) = get!(world, entity_id, (Owner, Position));
                assert(owner.address == player_id, 'Realm does not belong to player');

                assert_harvestable_resource(resource_type);

                // Get Config
                let labor_config: LaborConfig = get!(world, LABOR_CONFIG_ID, LaborConfig);

                // pay for labor 
                let labor_cost_resources = get!(world, resource_type, LaborCostResources);
                let labor_cost_resource_types: Span<u8> = unpack_resource_types(
                    labor_cost_resources.resource_types_packed, labor_cost_resources.resource_types_count
                );

                let zone = position.get_zone();
                let mut labor_auction = get!(world, zone, (LaborAuction));
                assert(labor_auction.per_time_unit != 0, 'Labor auction not found');

                let mut labor_units_remaining = labor_units;
                let mut total_costs: Felt252Dict<u128> = Default::default();

                let mut labor_cost_multiplier = labor_auction.get_price();

                loop {
                    if labor_units_remaining == 0 {
                        break;
                    }

                    let mut index = 0_usize;

                    loop {
                        if index == labor_cost_resources.resource_types_count.into() {
                            break ();
                        }
                        let labor_cost_resource_type = *labor_cost_resource_types[index];
                        let labor_cost_per_unit = get!(
                            world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
                        );

                        let cost_fixed = FixedTrait::new_unscaled(labor_cost_per_unit.value, false)
                            * labor_cost_multiplier.into();
                        let cost: u128 = cost_fixed.try_into().unwrap();

                        let total_cost = total_costs.get(labor_cost_resource_type.into());
                        total_costs.insert(labor_cost_resource_type.into(), total_cost + cost);

                        index += 1;
                    };

                    labor_auction.sell();
                    if (labor_auction.sold) % labor_auction.price_update_interval == 0 {
                        labor_cost_multiplier = labor_auction.get_price();
                    };
                    labor_units_remaining -= 1;
                };

                let mut index = 0_usize;
                loop {
                    if index == labor_cost_resources.resource_types_count.into() {
                        break ();
                    }

                    let labor_cost_resource_type = *labor_cost_resource_types[index];
                    let total_cost = total_costs.get(labor_cost_resource_type.into());

                    let current_resource: Resource = get!(
                        world, (entity_id, labor_cost_resource_type).into(), Resource
                    );

                    assert(current_resource.balance >= total_cost, 'Not enough resources');
                    set!(
                        world,
                        Resource {
                            entity_id,
                            resource_type: labor_cost_resource_type,
                            balance: current_resource.balance - total_cost
                        }
                    );

                    index += 1;
                };

                set!(world, (labor_auction));

                let labor_resource_type: u8 = get_labor_resource_type(resource_type);

                // increment new labor resource in entity balance
                let labor_resource = get!(world, (entity_id, labor_resource_type), Resource);

                set!(
                    world,
                    Resource {
                        entity_id,
                        resource_type: labor_resource.resource_type,
                        balance: labor_resource.balance + labor_units
                    }
                );

                return ();
            }
    }

    
}


// #[cfg(test)]
// mod labor_build_tests {
//     use eternum::constants::ResourceTypes;
//     use eternum::models::resources::Resource;
//     use eternum::models::labor::Labor;
//     use eternum::models::position::Position;
//     use eternum::systems::labor::utils::get_labor_resource_type;

//     use eternum::utils::testing::spawn_eternum;

//     use traits::Into;
//     use result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use serde::Serde;

//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

//     fn setup() -> (IWorldDispatcher, felt252) {
//         let world = spawn_eternum();

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array![];

//         Serde::serialize(@7200, ref create_labor_conf_calldata); // base_labor_units
//         Serde::serialize(@250, ref create_labor_conf_calldata); // base_resources_per_cycle
//         Serde::serialize(
//             @21_000_000_000_000_000_000, ref create_labor_conf_calldata
//         ); // base_food_per_cycle
//         world.execute('SetLaborConfig', create_labor_conf_calldata);

//         // set realm entity
//         // x needs to be > 470200 to get zone
//         let position = Position { x: 500200, y: 1, entity_id: 1_u128 };
//         let mut create_realm_calldata = Default::default();

//         Serde::serialize(@1, ref create_realm_calldata); // realm id
//         Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
//         Serde::serialize(
//             @0x20309, ref create_realm_calldata
//         ); // resource_types_packed // 2,3,9 // stone, coal, gold
//         Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
//         Serde::serialize(@5, ref create_realm_calldata); // cities
//         Serde::serialize(@5, ref create_realm_calldata); // harbors
//         Serde::serialize(@5, ref create_realm_calldata); // rivers
//         Serde::serialize(@5, ref create_realm_calldata); // regions
//         Serde::serialize(@1, ref create_realm_calldata); // wonder
//         Serde::serialize(@1, ref create_realm_calldata); // order
//         Serde::serialize(@position, ref create_realm_calldata); // position
//         let result = world.execute('CreateRealm', create_realm_calldata);
//         let realm_entity_id = *result[0];

//         (world, realm_entity_id)
//     }

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_build_labor_non_food() {
//         let (world, realm_entity_id) = setup();

//         let player_address = starknet::get_caller_address();

//         let resource_type = ResourceTypes::GOLD;

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         let ts = 10_000;
//         starknet::testing::set_block_timestamp(ts);

//         let labor_resource_type = get_labor_resource_type(resource_type);

//         // switch to executor to set storage directly
//         starknet::testing::set_contract_address(world.executor());
//         set!(
//             world,
//             Resource {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type: labor_resource_type,
//                 balance: 40
//             }
//         );
//         starknet::testing::set_contract_address(player_address);

//         // build labor for gold
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@1, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);

//         // assert labor is right amount
//         let gold_labor = get!(world, (realm_entity_id, resource_type), Labor);
//         assert(gold_labor.balance == ts + (7_200 * 20), 'wrong gold labor balance');
//         assert(gold_labor.last_harvest == ts, 'wrong gold labor last harvest');
//         assert(gold_labor.multiplier == 1, 'wrong gold multiplier');

//         let gold_resource_type = get!(world, (realm_entity_id, labor_resource_type), Resource);
//         assert(gold_resource_type.balance == 20, 'wrong labor resource');
//     }


//     #[test]
//     #[available_gas(300000000000)]
//     fn test_build_labor_food() {
//         let (world, realm_entity_id) = setup();

//         let caller_address = starknet::get_caller_address();
//         let resource_type = ResourceTypes::WHEAT;

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         let ts = 10_000;
//         starknet::testing::set_block_timestamp(ts);

//         let labor_resource_type = get_labor_resource_type(resource_type);

//         // switch to executor to set storage directly
//         starknet::testing::set_contract_address(world.executor());
//         set!(
//             world,
//             Resource {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type: labor_resource_type,
//                 balance: 100
//             }
//         );
//         starknet::testing::set_contract_address(caller_address);

//         // build labor for wheat
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@1, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);

//         // assert labor is right amount
//         let wheat_labor = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Labor);

//         assert(wheat_labor.balance == ts + (7_200 * 20), 'wrong wheat labor balance');
//         assert(wheat_labor.last_harvest == ts, 'wrong wheat labor last harvest');
//         assert(wheat_labor.multiplier == 1, 'wrong wheat multiplier');

//         let labor_resource = get!(world, (realm_entity_id, labor_resource_type), Resource);

//         assert(labor_resource.balance == 80, 'wrong labor resource');

//         //------------------------------------------
//         //
//         // Test harvest when multiplier is different
//         //
//         //------------------------------------------

//         // set block timestamp in order to harvest labor
//         starknet::testing::set_block_timestamp(20_000);

//         // build labor again but with different multiplier
//         // call build labor system
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@ResourceTypes::WHEAT, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@2, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);

//         let labor_resource = get!(world, (realm_entity_id, labor_resource_type), Resource);

//         assert(labor_resource.balance == 40, 'wrong labor resource');

//         // check food
//         let (wheat_resource, wheat_labor) = get!(
//             world, (realm_entity_id, ResourceTypes::WHEAT), (Resource, Labor)
//         );
//         assert(wheat_resource.resource_type == ResourceTypes::WHEAT, 'failed resource type');
//         // left to harvest = 134_000 / 4 = 33_500
//         assert(
//             wheat_resource.balance == ((10000_u128 + 33500_u128) / 7200_u128)
//                 * 21000000000000000000_u128,
//             'failed wheat resource amount'
//         );

//         // timestamp + labor_per_unit * labor_units
//         // 154000 is previous balance
//         // 7200 * 20 is added balance
//         // 154000 - 20000 is unharvested balance
//         assert(
//             wheat_labor.balance == 154000 + 7200 * 20 - (154000 - 20000),
//             'wrong wheat labor balance'
//         );
//         assert(wheat_labor.last_harvest == 20_000, 'wrong wheat labor last harvest');
//         assert(wheat_labor.multiplier == 2, 'wrong wheat multiplier');
//     }


//     #[test]
//     #[available_gas(300000000000)]
//     fn test_build_labor_after_completed() {
//         let (world, realm_entity_id) = setup();

//         let caller_address = starknet::get_caller_address();

//         let resource_type = ResourceTypes::GOLD;

//         // set block timestamp in order to harvest labor
//         // initial ts = 0
//         let ts = 10_000;
//         starknet::testing::set_block_timestamp(ts);

//         let labor_resource_type = get_labor_resource_type(resource_type);

//         // switch to executor to set storage directly
//         starknet::testing::set_contract_address(world.executor());
//         set!(
//             world,
//             Resource {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type: labor_resource_type,
//                 balance: 40
//             }
//         );
//         set!(
//             world,
//             Labor {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type,
//                 balance: 9_000,
//                 last_harvest: 1_000,
//                 multiplier: 1,
//             }
//         );
//         starknet::testing::set_contract_address(caller_address);

//         // build labor for gold
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@1, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);


//         // // assert labor is right amount
//         let gold_labor = get!(world, (realm_entity_id, resource_type), Labor);
//         assert(gold_labor.balance == ts + (7_200 * 20), 'wrong gold labor balance');
//         assert(gold_labor.last_harvest == 2_000, 'wrong gold labor last harvest');
//         assert(gold_labor.multiplier == 1, 'wrong gold multiplier');

//         let gold_resource_type = get!(world, (realm_entity_id, labor_resource_type), Resource);
//         assert(gold_resource_type.balance == 20, 'wrong labor resource');
//     }
// }




// #[cfg(test)]
// mod labor_harvest_tests {
//     use eternum::constants::ResourceTypes;
//     use eternum::models::resources::Resource;
//     use eternum::models::labor::Labor;
//     use eternum::models::position::Position;
//     use eternum::systems::labor::utils::get_labor_resource_type;

//     // testing
//     use eternum::utils::testing::spawn_eternum;

//     use traits::{Into, TryInto};
//     use result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use serde::Serde;

//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


//     #[test]
//     #[available_gas(3000000000)]
//     fn test_harvest_labor_non_food() {
//         let world = spawn_eternum();

//         let player_address = starknet::get_caller_address();

//         let resource_type = ResourceTypes::GOLD;

//         // set realm entity
//         let position = Position { x: 1, y: 1, entity_id: 1_u128 };
//         let mut create_realm_calldata = Default::default();

//         Serde::serialize(@1, ref create_realm_calldata); // realm id
//         Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
//         Serde::serialize(
//             @0x209, ref create_realm_calldata
//         ); // resource_types_packed // 2,9 // stone and gold
//         Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
//         Serde::serialize(@5, ref create_realm_calldata); // cities
//         Serde::serialize(@5, ref create_realm_calldata); // harbors
//         Serde::serialize(@5, ref create_realm_calldata); // rivers
//         Serde::serialize(@5, ref create_realm_calldata); // regions
//         Serde::serialize(@1, ref create_realm_calldata); // wonder
//         Serde::serialize(@1, ref create_realm_calldata); // order
//         Serde::serialize(@position, ref create_realm_calldata); // position
//         let result = world.execute('CreateRealm', create_realm_calldata);
//         let realm_entity_id = *result[0];

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array![];
//         let base_labor_units = 7200;
//         let base_resources_per_cycle = 250;
//         let base_food_per_cycle = 21_000_000_000_000_000_000;
//         Serde::serialize(@base_labor_units, ref create_labor_conf_calldata);
//         Serde::serialize(@base_resources_per_cycle, ref create_labor_conf_calldata);
//         Serde::serialize(@base_food_per_cycle, ref create_labor_conf_calldata);
//         world.execute('SetLaborConfig', create_labor_conf_calldata);

//         // set initial block timestamp
//         let last_harvest_ts = 1000;
//         starknet::testing::set_block_timestamp(last_harvest_ts);

//         let labor_resource_type = get_labor_resource_type(resource_type);

//         // switch to executor to set storage directly
//         starknet::testing::set_contract_address(world.executor());
//         set!(
//             world,
//             Resource {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type: labor_resource_type,
//                 balance: 40
//             }
//         );
//         starknet::testing::set_contract_address(player_address);

//         // build labor for gold
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@1, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);

//         // update block timestamp to harvest labor
//         let current_harvest_ts = 40_000;
//         starknet::testing::set_block_timestamp(current_harvest_ts);

//         // call harvest labor system
//         let mut harvest_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref harvest_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref harvest_labor_calldata); // resource_type
//         world.execute('HarvestLabor', harvest_labor_calldata);

//         let (gold_labor_after_harvest, gold_resource_after_harvest) = get!(
//             world, (realm_entity_id, resource_type), (Labor, Resource)
//         );
//         // get labor after harvest = current labor balance + remainder from division by 7200
//         assert(gold_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
//         assert(gold_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

//         let last_harvest_ts: u128 = last_harvest_ts.into();
//         let current_harvest_ts: u128 = current_harvest_ts.into();
//         let labor_per_unit: u128 = base_labor_units.try_into().unwrap();
//         let base_resources_per_cycle: u128 = base_resources_per_cycle.try_into().unwrap();

//         let generated_labor = current_harvest_ts
//             - last_harvest_ts; // because current_harvest_ts < balance
//         let mut generated_units = generated_labor / labor_per_unit;
//         let generated_resources = generated_units * base_resources_per_cycle;

//         // verify resource is right amount
//         assert(
//             gold_resource_after_harvest.balance == generated_resources, 'failed resource amount'
//         );
//     }


//     #[test]
//     #[available_gas(3000000000)]
//     fn test_harvest_labor_food() {
//         let world = spawn_eternum();

//         let player_address = starknet::get_caller_address();

//         let resource_type = ResourceTypes::WHEAT;

//         // set realm entity
//         let position = Position { x: 1, y: 1, entity_id: 1_u128 };
//         let mut create_realm_calldata = Default::default();

//         Serde::serialize(@1, ref create_realm_calldata); // realm id
//         Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
//         Serde::serialize(
//             @1, ref create_realm_calldata
//         ); // resource_types_packed // immaterial since wheat is food
//         Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
//         Serde::serialize(@5, ref create_realm_calldata); // cities
//         Serde::serialize(@5, ref create_realm_calldata); // harbors
//         Serde::serialize(@5, ref create_realm_calldata); // rivers
//         Serde::serialize(@5, ref create_realm_calldata); // regions
//         Serde::serialize(@1, ref create_realm_calldata); // wonder
//         Serde::serialize(@1, ref create_realm_calldata); // order
//         Serde::serialize(@position, ref create_realm_calldata); // position
//         let result = world.execute('CreateRealm', create_realm_calldata);
//         let realm_entity_id = *result[0];

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array![];
//         let base_labor_units = 7200;
//         let base_resources_per_cycle = 250;
//         let base_food_per_cycle = 21_000_000_000_000_000_000;
//         Serde::serialize(@base_labor_units, ref create_labor_conf_calldata);
//         Serde::serialize(@base_resources_per_cycle, ref create_labor_conf_calldata);
//         Serde::serialize(@base_food_per_cycle, ref create_labor_conf_calldata);
//         world.execute('SetLaborConfig', create_labor_conf_calldata);

//         // set initial block timestamp
//         let last_harvest_ts = 1000;
//         starknet::testing::set_block_timestamp(last_harvest_ts);

//         let labor_resource_type = get_labor_resource_type(resource_type);

//         // switch to executor to set storage directly
//         starknet::testing::set_contract_address(world.executor());
//         set!(
//             world,
//             Resource {
//                 entity_id: realm_entity_id.try_into().unwrap(),
//                 resource_type: labor_resource_type,
//                 balance: 40
//             }
//         );
//         starknet::testing::set_contract_address(player_address);

//         // build labor for wheat
//         let mut build_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref build_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref build_labor_calldata); // resource_type
//         Serde::serialize(@20, ref build_labor_calldata); // labor_units
//         Serde::serialize(@1, ref build_labor_calldata); // multiplier
//         world.execute('BuildLabor', build_labor_calldata);

//         // update block timestamp to harvest labor
//         let current_harvest_ts = 40_000;
//         starknet::testing::set_block_timestamp(current_harvest_ts);

//         // call build labor system
//         let mut harvest_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref harvest_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref harvest_labor_calldata); // resource_type
//         world.execute('HarvestLabor', harvest_labor_calldata);

//         let (wheat_labor_after_harvest, wheat_resource_after_harvest) = get!(
//             world, (realm_entity_id, resource_type), (Labor, Resource)
//         );
//         // get labor after harvest = current labor balance + remainder from division by 7200
//         assert(wheat_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
//         assert(wheat_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

//         let last_harvest_ts: u128 = last_harvest_ts.into();
//         let current_harvest_ts: u128 = current_harvest_ts.into();
//         let labor_per_unit: u128 = base_labor_units.try_into().unwrap();
//         let base_food_per_cycle: u128 = base_food_per_cycle.try_into().unwrap();

//         let generated_labor = current_harvest_ts
//             - last_harvest_ts; // because current_harvest_ts < balance
//         let mut generated_units = generated_labor / labor_per_unit;
//         let generated_resources = generated_units * base_food_per_cycle;

//         // verify resource is right amount
//         assert(
//             wheat_resource_after_harvest.balance == generated_resources, 'failed resource amount'
//         );
//     }
// }

// #[cfg(test)]
// mod labor_purchase_tests {
//     use eternum::constants::ResourceTypes;
//     use eternum::models::resources::Resource;
//     use eternum::models::labor::Labor;
//     use eternum::models::position::Position;
//     use eternum::systems::labor_auction::create_labor_auction::CreateLaborAuction;
//     use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};

//     // testing
//     use eternum::utils::testing::spawn_eternum;
//     use debug::PrintTrait;

//     use traits::Into;
//     use result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use serde::Serde;

//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

//     const _0_1: u128 = 1844674407370955161; // 0.1

//     fn setup(resource_type: u8) -> (IWorldDispatcher, felt252) {
//         let world = spawn_eternum();

//         let mut create_labor_auction_calldata = array![];
//         Serde::serialize(@_0_1, ref create_labor_auction_calldata); // decay
//         Serde::serialize(@50, ref create_labor_auction_calldata); // unit per time
//         Serde::serialize(@10, ref create_labor_auction_calldata); // interval per price change
//         world.execute('CreateLaborAuction', create_labor_auction_calldata);

//         // set realm entity
//         // x needs to be > 470200 to get zone
//         let position = Position { x: 500200, y: 1, entity_id: 1_u128 };
//         let mut create_realm_calldata = Default::default();

//         Serde::serialize(@1, ref create_realm_calldata); // realm id
//         Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
//         Serde::serialize(
//             @0x20309, ref create_realm_calldata
//         ); // resource_types_packed // 2,3,9 // stone, coal, gold
//         Serde::serialize(@3, ref create_realm_calldata); // resource_types_count
//         Serde::serialize(@5, ref create_realm_calldata); // cities
//         Serde::serialize(@5, ref create_realm_calldata); // harbors
//         Serde::serialize(@5, ref create_realm_calldata); // rivers
//         Serde::serialize(@5, ref create_realm_calldata); // regions
//         Serde::serialize(@1, ref create_realm_calldata); // wonder
//         Serde::serialize(@1, ref create_realm_calldata); // order
//         Serde::serialize(@position, ref create_realm_calldata); // position
//         let result = world.execute('CreateRealm', create_realm_calldata);
//         let realm_entity_id = *result[0];

//         // set labor configuration entity
//         let mut create_labor_conf_calldata = array![];

//         Serde::serialize(@7200, ref create_labor_conf_calldata); // base_labor_units
//         Serde::serialize(@250, ref create_labor_conf_calldata); // base_resources_per_cycle
//         Serde::serialize(
//             @21_000_000_000_000_000_000, ref create_labor_conf_calldata
//         ); // base_food_per_cycle
//         world.execute('SetLaborConfig', create_labor_conf_calldata);

//         let mut create_labor_cr_calldata = array![];
//         Serde::serialize(@resource_type, ref create_labor_cr_calldata); // resource_type_labor
//         Serde::serialize(
//             @0x203, ref create_labor_cr_calldata
//         ); // resource_types_packed // 2,3 // stone and coal
//         Serde::serialize(
//             @2, ref create_labor_cr_calldata
//         ); // resource_types_count // stone and coal
//         world.execute('SetLaborCostResources', create_labor_cr_calldata);

//         // cost for gold in coal
//         let mut create_labor_cv_calldata = array![];
//         Serde::serialize(@resource_type, ref create_labor_cv_calldata); // resource_type_labor
//         Serde::serialize(@ResourceTypes::COAL, ref create_labor_cv_calldata); // resource_type_cost
//         Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
//         world.execute('SetLaborCostAmount', create_labor_cv_calldata);

//         // cost for gold in stone
//         let mut create_labor_cv_calldata = array![];
//         Serde::serialize(@resource_type, ref create_labor_cv_calldata); // resource_type_labor
//         Serde::serialize(@ResourceTypes::STONE, ref create_labor_cv_calldata); // resource_type_cost
//         Serde::serialize(@1_000, ref create_labor_cv_calldata); // resource_type_value
//         world.execute('SetLaborCostAmount', create_labor_cv_calldata);

//         // mint 100_000 coal for the realm;
//         let mut mint_coal_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref mint_coal_calldata); // realm entity id
//         Serde::serialize(@ResourceTypes::COAL, ref mint_coal_calldata); // resource_type
//         Serde::serialize(@100_000, ref mint_coal_calldata); // amount
//         world.execute('MintResources', mint_coal_calldata);

//         // mint 100_000 stone for the realm;
//         let mut mint_stone_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref mint_stone_calldata); // realm entity id
//         Serde::serialize(@ResourceTypes::STONE, ref mint_stone_calldata); // resource_type
//         Serde::serialize(@100_000, ref mint_stone_calldata); // amount
//         world.execute('MintResources', mint_stone_calldata);

//         (world, realm_entity_id)
//     }

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_purchase_labor_non_food() {
//         let resource_type = ResourceTypes::GOLD;

//         let (world, realm_entity_id) = setup(resource_type);

//         // purchase labor
//         let mut purchase_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref purchase_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref purchase_labor_calldata); // resource_type
//         Serde::serialize(@20, ref purchase_labor_calldata); // labor_units
//         world.execute('PurchaseLabor', purchase_labor_calldata);

//         // assert resources are the right amount
//         let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
//         coal_resource.balance.print();
//         assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
//         assert(coal_resource.balance == 79_790, 'failed resource amount');

//         let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
//         assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
//         assert(stone_resource.balance == 79_790, 'failed resource amount');

//         // assert labor resource is right amount
//         let gold_labor_resource = get!(world, (realm_entity_id, resource_type + 28), Resource);
//         assert(gold_labor_resource.balance == 20, 'wrong labor resource balance');

//         let labor_auction = get!(world, 1, LaborAuction);
//         assert(labor_auction.sold == 20, 'wrong labor auction sold');
//     }

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_purchase_labor_food() {
//         let resource_type = ResourceTypes::FISH;
//         let (world, realm_entity_id) = setup(resource_type);

//         // purchase labor 
//         let mut purchase_labor_calldata = array![];
//         Serde::serialize(@realm_entity_id, ref purchase_labor_calldata); // realm_id
//         Serde::serialize(@resource_type, ref purchase_labor_calldata); // resource_type
//         Serde::serialize(@20, ref purchase_labor_calldata); // labor_units
//         world.execute('PurchaseLabor', purchase_labor_calldata);

//         // assert resources are the right amount
//         let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
//         assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
//         assert(coal_resource.balance == 79_790, 'failed resource amount');

//         let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
//         assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
//         assert(stone_resource.balance == 79_790, 'failed resource amount');

//         // assert labor resource is right amount
//         let fish_labor_resource = get!(world, (realm_entity_id, resource_type - 3), Resource);
//         assert(fish_labor_resource.balance == 20, 'wrong labor resource balance');

//         let labor_auction = get!(world, 1, LaborAuction);
//         assert(labor_auction.sold == 20, 'wrong labor auction sold');
//     }
// }
