#[system]
mod BuildBuilding {
    use array::ArrayTrait;
    use traits::Into;

    use eternum::components::config::WorldConfig;

    use eternum::components::realm::Realm;
    use eternum::components::tick::Tick;
    use eternum::components::resources::Resource;
    use eternum::components::buildings::Building;

    // todo need better way to store resources
    use eternum::constants::Resources;
    use eternum::constants::BuildingIds;
    use eternum::constants::BUILDING_CONFIG_ID;

    use eternum::utils::math::u128_div_remainder;
    use eternum::utils::math::get_percentage_by_bp;

    #[external]
    fn execute(realm_id: felt252, building_type: felt252, quantity: felt252) {
        let player_id: felt252 = starknet::get_caller_address().into();
        let realm: Realm = commands::<Realm>::entity(realm_id.into());

        assert(realm.owner == player_id, 'Realm does not belong to player');

        // Get Config
        let building_config: BuildingConfig = commands::<BuildingConfig>::entity(
            BUILDING_CONFIG_ID.into()
        );
        // check if player can build building
        let can_build_ = can_build(building_id, quantity, realm.regions, realm.cities);
        assert(can_build_, 'Player cannot build building');
        // get current building quantity for that building type
        // TODO: what if not found?
        let building = commands::<Building>::entity((realm_id, (building_type)).into());

        // build building and set state
        commands::<Building>::set_entity(
            (realm_id, (building_type)).into(),
            Building {
                quantity: building.quantity + quantity,
                building_type,
                population: building.population,
                integrity: building.integrity,
            }
        );

        // get resource ids of realm
        let resource_ids = Array::<u8>::new();
        let resource_costs = Array::<felt252>::new();
        unpack_resource_ids(realm.resource_ids_packed, resource_ids, realm.resource_ids_count, 0);

        let building_cost_resource_ids = Array::<u8>::new();

        // else get building cost
        // if building is a house, it's a fixed cost
        if building_type == BuildingIds.HOUSE {
            get_workhut_costs(resource_ids, resource_costs, quantity);
        } else {
            get_building_costs(building_type, resource_ids, resource_costs, quantity);
        }
    // decrease only resources that are on the realm ?
    // for (resource_id, i) in resource_ids {
    //     let (resources) = commands::<Resource>::entities((realm_id, (resource_id)).into());

    //     commands::<Resource>::set_entity(
    //         (realm_id, (resource_id)).into(),
    //         Resource {
    //             quantity: resources.quantity - resource_costs[i],
    //         }
    //     );
    // }
    }

    fn can_build(building_id: felt252, quantity: felt252, regions: felt252, cities: felt252) {
        let (total_buildable_area) = get_realm_buildable_area(cities, regions);
        let (built_area) = get_realm_built_area(regions, cities);
        let buildable_area = total_buildable_area - built_area;
        if (buildable_units < quantity) {
            return false;
        } else {
            return true;
        }
    }

    fn get_realm_buildable_area(
        cities: felt252, regions: felt252, build_config: BuildConfig
    ) -> (felt252) {
        let quotient = regions / 2_felt252;
        return (cities * quotient + build_config.base_sqm);
    }

    fn get_realm_built_area(build_config: BuildConfig) -> (felt252) {
        let buildings = commands::<Building>::entities(realm_id.into());

        let built_area = 0_felt252;
        // TODO: when for loop is implemented
        // for building in buildings {
        //     built_area += building.sqm;
        // }

        return (built_area);
    }

    fn get_workhut_costs(
        resource_costs: Array<felt252>, resource_ids: Array<u8>, quantity: felt252
    ) {
        let building_config: BuildingConfig = commands::<BuildingConfig>::entity(
            BUILDING_CONFIG_ID.into()
        );
        let realm: Realm = commands::<Realm>::entity(realm_id.into());

        let workhut_cost = (building_config.workhut_cost * 10 * *18) * quantity;
        // // TODO: do recursion?
        // for resource_id in resource_ids {
        //     resource_cost.append(workhut_cost); 
        // }

        return (realm.resource_ids, resource_cost);
    }

    fn get_building_costs(
        building_id: felt252,
        resource_costs: Array<felt252>,
        resource_ids: Array<u8>,
        quantity: felt252
    ) {
        let building_config: BuildingConfig = commands::<BuildingConfig>::entity(
            BUILDING_CONFIG_ID.into()
        );

        // get list of resource ids needed for that building id
        let resource_ids_packed = building_config.resource_ids_packed;
        let resource_ids_count = building_config.resource_ids_count;
        unpack_resource_ids(resource_ids_packed, resource_ids, resource_ids_count, 0)

        // // TODO: do recursion?
        // for resource_id in resource_ids {
        //     let cost = building_config.costs[building_id, resource_id] * quantity;
        //     resource_costs.append(cost);
        // }

        return ();
    }

    fn unpack_resource_ids(
        resource_ids_packed: felt252, resource_ids: Array<u8>, resource_ids_count: u8, index: u8
    ) -> Array<u8> {
        if (index == resource_ids_count) {
            return resource_ids;
        }
        let mask_size = 2 * *constants.RESOURCE_IDS_PACKED_SIZE - 1;
        let resource_id = unpack_data(
            resource_ids_packed, index * constants.RESOURCE_IDS_PACKED_SIZE, mask_size
        );
        resource_ids.append(resource_id);

        return unpack_resource_ids(
            resource_ids_packed, resource_ids, resource_ids_count, index + 1
        );
    }

    fn unpack_data(data: felt252, index: Array<u8>, mask_size: u8) -> u8 {
        let (power) = 2 * *index;
        let mask = mask_size * power;

        // 2. Apply mask using bitwise operation: mask AND data.
        let (masked) = bitwise_and(mask, data);

        // 3. Shift element right by dividing by the order of the mask.
        let result = masked / power;

        return result;
    }
}
