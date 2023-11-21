
#[dojo::contract]
mod labor_systems {

    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    use eternum::models::owner::Owner;
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::position::{Position, PositionTrait};
    use eternum::models::resources::Resource;
    use eternum::models::labor::{Labor, LaborTrait};
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};
    use eternum::models::labor_auction::{LinearVRGDA, LinearVRGDATrait};
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::config::{WorldConfig, LaborConfig, LaborCostResources, LaborCostAmount};

    use eternum::systems::labor::utils::{assert_harvestable_resource, get_labor_resource_type};
    use eternum::constants::{LABOR_CONFIG_ID,WORLD_CONFIG_ID, ResourceTypes};
    use eternum::utils::unpack::unpack_resource_types;

    use starknet::ContractAddress;

    use eternum::systems::labor::interface::ILaborSystems;
    
    
    #[external(v0)]
    impl LaborSystemsImpl of ILaborSystems<ContractState> {
        /// Builds labor for a particular resource on a realm
        ///
        /// This function is called when a player wants to build labor 
        /// for a particular resource on their realm. In order to call this
        /// function, the realm must have enough of some other resource type used 
        /// to pay for it. for example, if you want to build labor for gold, 
        /// you need to have enough some other resource (e.g `labor_gold`) to pay for it.
        /// This other resource can be gotten by purchasing it from the labor auction 
        /// as defined in the `purchase` system below.
        ///
        ///
        /// # Arguments
        ///
        /// * `realm_id` - The realm id
        /// * `resource_type` - The resource type (e.g fish, wheat, gold etc)
        /// * `labor_units` - The number of labor units to build
        /// * `multiplier` - The multiplier for the labor units. 
        ///     Note that multiplier can only be greater than 1 when it used 
        ///     for food (fish and wheat). say for example the realm has 3 rivers,
        ///     then the multiplier can be 1, 2 or 3. 
        ///
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


            /// Harvests a particular resource on a realm
            ///
            /// This function is called when a player wants to harvest a particular resource
            /// on their realm. In order to call this function, the realm must have previously
            /// built labor for that resource. The amount harvested will be based on the
            /// amount of labor built and the percentage of the harvest cycle that has passed.
            ///
            /// For example, if the player has built labor for fish and the total harvestable 
            /// at the end of the cycle is 100, if the cycle is 50% complete( i.e half the amount of time
            /// required for the cycle has passed), then the player will be able to harvest 50 fish.
            ///
            /// # Arguments
            ///
            /// * `realm_id` - The realm id
            /// * `resource_type` - The resource type (e.g fish, wheat, gold etc)
            ///
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

                // get level bonus
                let level = get!(world, (realm_id), Level);
                let level_bonus = level.get_level_multiplier();

                // update resources with multiplier
                // and with level bonus
                set!(
                    world,
                    Resource {
                        entity_id: realm_id,
                        resource_type: resource_type,
                        balance: resource.balance
                            + (labor_units_generated.into()
                                * base_production_per_cycle
                                * labor.multiplier.into() * level_bonus) / 100,
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





            /// Purchases labor for a particular resource on a realm
            ///
            /// This function is called when a player wants to purchase resources
            /// that can be used to build labor for a particular resource on their realm.
            /// For example, if you want to build labor for gold, you need to have enough
            /// some other resource (e.g `labor_gold`) to pay for it. This other resource
            /// can be gotten by purchasing it from the labor auction as defined here.
            ///
            /// # Arguments
            ///
            /// * `entity_id` - The realm id
            /// * `resource_type` - The resource type (e.g fish, wheat, gold etc)
            /// * `labor_units` - The number of labor units to build
            ///
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
                let mut labor_auction_vrgda = labor_auction.to_LinearVRGDA();
                let mut labor_auction_time_since_start_fixed 
                    = labor_auction.get_time_since_start_fixed();

                assert(labor_auction.per_time_unit != 0, 'Labor auction not found');


                let zero_fixed = Fixed {sign: false, mag: 0};

                let mut index = 0_usize;
                loop {
                    if index == labor_cost_resources.resource_types_count.into() {
                        break ();
                    }

                    let labor_cost_resource_type = *labor_cost_resource_types[index];
                    let labor_cost_per_unit = get!(
                        world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
                    );
        
                    let labor_cost_per_unit_fixed 
                        = FixedTrait::new_unscaled(labor_cost_per_unit.value, false);
                    
    
                    let mut total_resource_labor_cost_fixed = FixedTrait::new_unscaled(0, false);

                    let mut labor_units_remaining = labor_units;
                    
                    loop {
                        if labor_units_remaining == 0 {
                            break;
                        }

                        let labor_cost_multiplier
                            = labor_auction_vrgda.get_vrgda_price(
                                labor_auction_time_since_start_fixed,
                                FixedTrait::new_unscaled(labor_auction.sold, false)
                            );

                        let mut labor_unit_count 
                            = labor_auction.price_update_interval - 
                                (labor_auction.sold % labor_auction.price_update_interval);

                        if labor_units_remaining < labor_unit_count {
                            labor_unit_count = labor_units_remaining;
                        }

                        let mut resource_labor_cost
                            = labor_cost_per_unit_fixed * labor_cost_multiplier * FixedTrait::new_unscaled(labor_unit_count, false);

                        labor_units_remaining -= labor_unit_count;
                        labor_auction.sold += labor_unit_count;
                        total_resource_labor_cost_fixed += resource_labor_cost;
                        
                    };

                    let total_resource_labor_cost: u128 = total_resource_labor_cost_fixed.try_into().unwrap();

                    // deduct total labor cost for the current
                    // resource from entity's balance
                    let current_resource: Resource = get!(
                        world, (entity_id, labor_cost_resource_type).into(), Resource
                    );
                    assert(current_resource.balance >= total_resource_labor_cost, 'Not enough resources');

                    set!(
                        world,
                        Resource {
                            entity_id,
                            resource_type: labor_cost_resource_type,
                            balance: current_resource.balance - total_resource_labor_cost
                        }
                    );

                    // reset labor amount sold for next loop
                    labor_auction.sold -= labor_units;

                    // increment index
                    index += 1;
                };

                labor_auction.sold = labor_units;
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