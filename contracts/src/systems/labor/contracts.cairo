#[dojo::contract]
mod labor_systems {
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use cubit::f128::math::ops::{pow};

    use eternum::models::owner::Owner;
    use eternum::models::order::{Orders, OrdersTrait};
    use eternum::models::realm::{Realm, RealmTrait};
    use eternum::models::position::{Position, PositionTrait};
    use eternum::models::resources::{Resource, ResourceTrait};
    use eternum::models::labor::{Labor, LaborTrait};
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};
    use eternum::models::labor_auction::{LinearVRGDA, LinearVRGDATrait};
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::config::{
        LevelingConfig, WorldConfig, LaborConfig, LaborCostResources, LaborCostAmount,
        LaborBuildingsConfig, LaborBuildingsConfigTrait
    };

    use eternum::models::buildings::{LaborBuilding};

    use eternum::systems::labor::utils::{assert_harvestable_resource, get_labor_resource_type};
    use eternum::constants::{
        LABOR_CONFIG_ID, WORLD_CONFIG_ID, HYPERSTRUCTURE_LEVELING_START_TIER,
        REALM_LEVELING_START_TIER, ResourceTypes, LevelIndex, BUILDING_CONFIG_ID
    };
    use eternum::utils::unpack::unpack_resource_types;

    use starknet::ContractAddress;

    use eternum::systems::labor::interface::ILaborSystems;

    use eternum::constants::{REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID};

    #[abi(embed_v0)]
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
            assert_eq!(owner.address, player_id, "Realm does not belong to player");

            // check that resource is on realm
            let realm_has_resource = realm.has_resource(resource_type);
            let is_food = (resource_type == ResourceTypes::FISH)
                | (resource_type == ResourceTypes::WHEAT);
            if realm_has_resource == false {
                assert!(is_food, "Resource is not on realm");
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
            assert!(multiplier > 0, "Multiplier cannot be zero");

            // if multiplier is bigger than 1, verify that it's either fish or wheat 
            // assert ressource_id is fish or wheat
            if multiplier > 1 {
                if resource_type == ResourceTypes::FISH {
                    // assert that realm can have that many fishing villages
                    let harbors: u64 = realm.harbors.into();
                    assert!(harbors >= multiplier, "Not enough harbors")
                } else {
                    assert_eq!(resource_type, ResourceTypes::WHEAT, "Resource id is not valid");
                    // assert that realm can have that many farms
                    let rivers: u64 = realm.rivers.into();
                    assert!(rivers >= multiplier, "Not enough rivers")
                }
            }

            let mut realm_current_resource = get!(world, resource_query, Resource);

            // if multiplier is different than previous multiplier, you need to harvest unharvested
            if multiplier != labor.multiplier {
                // get what has not been harvested and what will be harvested in the future
                let (labor_generated, is_complete, labor_unharvested) = labor
                    .get_labor_generated(ts);
                let mut total_harvest = 0;
                if (is_complete == false) { // divide the unharvested resources by 4 and add them to the balance
                    total_harvest = labor_generated + labor_unharvested / 4;
                } else {
                    total_harvest = labor_generated;
                }
                let total_harvest_units = total_harvest
                    / labor_config.base_labor_units; // get current resource
                // add these resources to balance

                realm_current_resource
                    .balance +=
                        (total_harvest_units.into()
                            * labor.multiplier.into()
                            * labor_config.base_food_per_cycle);
                realm_current_resource.save(world);

                new_labor.harvest_unharvested(labor_unharvested, ts)
            }

            // update the labor
            set!(world, (new_labor));

            let labor_resource_type = get_labor_resource_type(resource_type);

            // pay for labor 
            let mut realm_labor_resources = get!(world, (realm_id, labor_resource_type), Resource);
            assert!(
                realm_labor_resources.balance >= labor_units.into() * multiplier.into(),
                "Not enough labor resources"
            );
            realm_labor_resources.balance -= (labor_units.into() * multiplier.into());
            realm_labor_resources.save(world);
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
        fn harvest(
            self: @ContractState, world: IWorldDispatcher, realm_id: u128, resource_type: u8
        ) {
            let player_id: ContractAddress = starknet::get_caller_address();
            let (realm, owner) = get!(world, realm_id, (Realm, Owner));

            assert_eq!(owner.address, player_id, "Realm does not belong to player");

            // check that resource is on realm
            let realm_has_resource = realm.has_resource(resource_type);
            let is_food = (resource_type == ResourceTypes::FISH)
                | (resource_type == ResourceTypes::WHEAT);
            if realm_has_resource == false {
                assert!(is_food, "Resource is not on realm");
            }

            // Get Config
            let labor_config: LaborConfig = get!(world, LABOR_CONFIG_ID, LaborConfig);

            // get production per cycle
            let mut base_production_per_cycle: u128 = labor_config.base_resources_per_cycle;
            if is_food {
                base_production_per_cycle = labor_config.base_food_per_cycle;
            }

            let resource_query = (realm_id, resource_type);
            // if no labor, panic
            let labor = get!(world, resource_query, Labor);

            // transform timestamp from u64 to u128
            let ts = starknet::get_block_timestamp();

            // generated labor
            // TODO: don't retrive labor_unharvested
            let (labor_generated, is_complete, _) = labor.get_labor_generated(ts);

            // assert base labor units not zero
            assert_ne!(labor_config.base_labor_units, 0, "Base labor units cannot be zero");

            // labor units and part units
            let labor_units_generated = labor_generated / labor_config.base_labor_units;

            // assert that at least some labor has been generated
            assert_ne!(labor_units_generated, 0, "Wait end of harvest cycle");

            // remainder is what is left from division by base labor units
            let remainder = labor_generated % labor_config.base_labor_units;

            let level_index = if is_food {
                LevelIndex::FOOD
            } else {
                LevelIndex::RESOURCE
            };

            /// REALM BONUS ///
            let realm_leveling_config: LevelingConfig = get!(
                world, REALM_LEVELING_CONFIG_ID, LevelingConfig
            );
            let realm_level = get!(world, (realm_id), Level);
            let realm_level_bonus = realm_level
                .get_index_multiplier(realm_leveling_config, level_index, REALM_LEVELING_START_TIER)
                - 100;

            /// ORDER BONUS ///
            let order = get!(world, (realm.order), Orders);
            let order_level_bonus = order.get_bonus_multiplier();

            // update resources with multiplier
            // and with level bonus
            let mut resource = get!(world, resource_query, Resource);
            let generated_resources = (labor_units_generated.into()
                * base_production_per_cycle
                * labor.multiplier.into());
            resource.balance = generated_resources
                + ((generated_resources * realm_level_bonus) / 100)
                + ((generated_resources * order_level_bonus) / order.get_bonus_denominator());

            resource.save(world);

            // if is complete, balance should be set to current ts
            // remove the 
            if (is_complete) {
                set!(
                    world,
                    Labor {
                        entity_id: realm_id,
                        resource_type: resource_type,
                        balance: ts.into() + remainder,
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
            assert_eq!(owner.address, player_id, "Realm does not belong to player");

            assert_harvestable_resource(resource_type);

            // get buildings config
            let buildings_config: LaborBuildingsConfig = get!(
                world, BUILDING_CONFIG_ID, LaborBuildingsConfig
            );

            let mut building_multiplier: Fixed = FixedTrait::new_unscaled(1, false);
            let building_type = buildings_config.get_building_type(resource_type);

            // check if there's that type of building on the realm
            let mut building = get!(world, (entity_id), LaborBuilding);

            if building_type != 0 && building_type == building.building_type {
                // get discount based on level (if discount per level = 0.9 and level = 2, then discount = 0.9^2 = 0.81)
                let level_fixed = FixedTrait::new_unscaled(building.level, false);
                let discount_fixed = FixedTrait::new(buildings_config.level_discount_mag, false);
                building_multiplier = pow(discount_fixed, level_fixed);

                // update level
                let mut count_to_levelup = buildings_config.level_multiplier * (building.level + 1);
                let mut new_count = building.labor_count + labor_units;

                loop {
                    if new_count >= count_to_levelup {
                        new_count -= count_to_levelup;
                        building.level += 1;
                        count_to_levelup = buildings_config.level_multiplier * (building.level + 1);
                    } else {
                        building.labor_count = new_count;
                        break ();
                    };
                };

                set!(world, (building));
            }

            // pay for labor 
            let labor_cost_resources = get!(world, resource_type, LaborCostResources);
            let labor_cost_resource_types: Span<u8> = unpack_resource_types(
                labor_cost_resources.resource_types_packed,
                labor_cost_resources.resource_types_count
            );

            let zone = position.get_zone();
            let mut labor_auction = get!(world, (zone), (LaborAuction));
            let mut labor_auction_vrgda = labor_auction.to_LinearVRGDA();
            let mut labor_auction_time_since_start_fixed = labor_auction
                .get_time_since_start_fixed();

            assert_ne!(labor_auction.per_time_unit, 0, "Labor auction not found");

            let mut index = 0_usize;
            loop {
                if index == labor_cost_resources.resource_types_count.into() {
                    break ();
                }

                let labor_cost_resource_type = *labor_cost_resource_types[index];
                let labor_cost_per_unit = get!(
                    world, (resource_type, labor_cost_resource_type).into(), LaborCostAmount
                );

                let labor_cost_per_unit_fixed = FixedTrait::new_unscaled(
                    labor_cost_per_unit.value, false
                );

                let mut total_resource_labor_cost_fixed = FixedTrait::new_unscaled(0, false);

                let mut labor_units_remaining = labor_units;

                loop {
                    if labor_units_remaining == 0 {
                        break;
                    }

                    let labor_cost_multiplier = labor_auction_vrgda
                        .get_vrgda_price(
                            labor_auction_time_since_start_fixed,
                            FixedTrait::new_unscaled(labor_auction.sold, false)
                        );

                    let mut labor_unit_count = labor_auction.price_update_interval
                        - (labor_auction.sold % labor_auction.price_update_interval);

                    if labor_units_remaining < labor_unit_count {
                        labor_unit_count = labor_units_remaining;
                    }

                    let mut resource_labor_cost = labor_cost_per_unit_fixed
                        * building_multiplier
                        * labor_cost_multiplier
                        * FixedTrait::new_unscaled(labor_unit_count, false);

                    labor_units_remaining -= labor_unit_count;
                    labor_auction.sold += labor_unit_count;
                    total_resource_labor_cost_fixed += resource_labor_cost;
                };

                let total_resource_labor_cost: u128 = total_resource_labor_cost_fixed
                    .try_into()
                    .unwrap();

                // deduct total labor cost for the current
                // resource from entity's balance
                let mut current_resource: Resource = get!(
                    world, (entity_id, labor_cost_resource_type).into(), Resource
                );
                assert!(
                    current_resource.balance >= total_resource_labor_cost, "Not enough resources"
                );
                current_resource.balance -= total_resource_labor_cost;
                current_resource.save(world);

                // reset labor amount sold for next loop
                labor_auction.sold -= labor_units;

                // increment index
                index += 1;
            };

            labor_auction.sold = labor_units;
            set!(world, (labor_auction));

            let labor_resource_type: u8 = get_labor_resource_type(resource_type);

            // increment new labor resource in entity balance
            let mut labor_resource = get!(world, (entity_id, labor_resource_type), Resource);
            labor_resource.balance += labor_units;
            labor_resource.save(world);

            return ();
        }
    }
}
