#[system]
mod BuildRoute {
    use traits::Into;
    use array::ArrayTrait;
    use traits::TryInto;
    use eternum::components::config::TrvlCnf;
    use eternum::components::config::TravelCV;
    use eternum::components::realm::Realm;
    use eternum::components::realm::RealmTrait;
    use eternum::components::resources::Resource;
    use eternum::components::resources::Vault;
    use eternum::components::travel::Route;
    use eternum::components::travel::RouteTrait;
    use eternum::components::travel::Segment;

    use eternum::components::labor::Labor;
    use eternum::components::labor::LaborTrait;
    use eternum::components::config::LaborConf;
    use starknet::ContractAddress;
    // todo need better way to store resources
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::constants::TRAVEL_CONFIG_ID;
    use eternum::utils::convert::convert_u64_to_u128;
    use eternum::utils::convert::convert_u8_to_u128;
    use integer::u128_safe_divmod;
    use eternum::utils::unpack::unpack_resource_ids;
    fn execute(realm_id: felt252, start_x: u32, start_y: u32, end_x: u32, end_y: u32) {
        let player_id: ContractAddress = starknet::get_caller_address();
        let realm: Realm = commands::<Realm>::entity(realm_id.into());

        // Check owner: player_id.into()owner of s_realm
        assert(realm.owner == player_id, 'Realm does not belong to player');

        let route = Route {
            start_x: start_x,
            start_y: start_y,
            end_x: end_x,
            end_y: end_y,
            order: realm.order,
            owner: player_id,
            realm_id: realm_id,
        };

        // unique id to the route
        let route_id = route.route_id();

        // check if route already exists
        let maybe_route = commands::<Route>::try_entity(route_id.into());
        match maybe_route {
            Option::Some(route) => {
                assert(false, 'Route already exists');
            },
            Option::None(_) => {}
        }
        // create the route
        // TODO: check why you cannot have Copy and Drop trait on Route
        commands::<Route>::set_entity(
            route_id.into(),
            (Route {
                start_x: start_x,
                start_y: start_y,
                end_x: end_x,
                end_y: end_y,
                order: realm.order,
                owner: player_id,
                realm_id: realm_id,
            })
        );

        // get route lenght
        let distance = route.calculate_distance();

        // pay for the route
        let travel_config = commands::<TrvlCnf>::entity(TRAVEL_CONFIG_ID.into());
        let mut route_cost_resource_ids: Array<u256> = unpack_resource_ids(
            travel_config.resource_ids_packed, travel_config.resource_ids_count
        );

        let mut index = 0;
        // loop {
        // TODO: put back loop when working in dojo
        if index == travel_config.resource_ids_count { // break ();
        }

        let resource_id = *route_cost_resource_ids[index];
        let travel_cost_values = commands::<TravelCV>::entity((resource_id.low.into()).into());
        // value = cost per km
        let total_cost = travel_cost_values.value * distance;
        // TOOD: don't use low.into() find better way to transform u256 to felt252
        let current_resource: Resource = commands::<Resource>::entity(
            (realm_id, (resource_id.low.into())).into()
        );
        assert(current_resource.balance >= total_cost, 'Not enough resources');
        commands::<Resource>::set_entity(
            (realm_id, (resource_id.low.into())).into(),
            (Resource { id: current_resource.id, balance: current_resource.balance - total_cost })
        );
        index += 1;
    // };
    }
}

#[system]
mod Travel {
    use traits::Into;
    use array::ArrayTrait;
    use traits::TryInto;
    use eternum::components::config::TrvlCnf;
    use eternum::components::config::TravelCV;
    use eternum::components::position::Position;
    use eternum::components::realm::Realm;
    use eternum::components::realm::RealmTrait;
    use eternum::components::resources::Resource;
    use eternum::components::resources::Vault;
    use eternum::components::travel::Travel;
    use eternum::components::travel::TravelTrait;
    use eternum::components::travel::Route;
    use eternum::components::travel::RouteTrait;
    use eternum::components::travel::Segment;
    use eternum::components::travel::SegmentTrait;
    use eternum::components::labor::Labor;
    use eternum::components::labor::LaborTrait;
    use eternum::components::config::LaborConf;
    use starknet::ContractAddress;
    // todo need better way to store resources
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::constants::TRAVEL_CONFIG_ID;
    use eternum::utils::convert::convert_u64_to_u128;
    use eternum::utils::convert::convert_u8_to_u128;
    use integer::u128_safe_divmod;
    use eternum::utils::unpack::unpack_resource_ids;

    fn execute(entity_id: felt252, routes: Array<Segment>) {
        // TODO: check owner of entity id, if no owner then fail
        let player_id: ContractAddress = starknet::get_caller_address();
        // TODO: create component owner ? and attach to any element that has an owner? 
        // let (entity_owner, travel) = commands::<Owner, Travel>::entity(entity_id.into());
        // Check owner
        // assert(entity_owner.owner == player_id, 'Entity does not belong to player');
        let (travel, position) = commands::<Travel, Position>::entity(entity_id.into());

        // assert not travelling
        let ts: u128 = convert_u64_to_u128(starknet::get_block_timestamp());
        assert(travel.arrival_time <= ts, 'Entity is already travelling');

        // loop over the routes to calculate distance + time

        let mut index = 0;
        let mut distance = 0;
        let mut travel_time = 0;
        let mut end_x = 0;
        let mut end_y = 0;
        let mut current_position_x = position.x;
        let mut current_position_y = position.y;
        // loop {
        if index == routes.len() { // break ();
        }

        // create the route
        let segment = *routes[index];

        // assert that the current position is the beginning of the route
        assert(segment.start_x == current_position_x, 'need to start at current pos');
        assert(segment.start_y == current_position_y, 'need to start at current pos');

        end_x = segment.end_x;
        end_y = segment.end_y;
        let route_id = segment.route_id();

        let mut is_route = false;
        let maybe_route = commands::<Route>::try_entity(route_id.into());
        match maybe_route {
            Option::Some(route) => {
                let is_route = true;
            },
            Option::None(_) => {
                let is_route = false;
            }
        }

        let segment_distance = segment.calculate_distance();
        travel_time += travel.calculate_travel_time(segment_distance, is_route);
        distance += segment_distance;
        index += 1;
        // };

        // change position
        // change travel time
        commands::<Travel,
        Position>::set_entity(
            entity_id.into(),
            (
                Travel {
                    arrival_time: ts + travel_time, seconds_per_km: travel.seconds_per_km, 
                    }, Position {
                    x: end_x, y: end_y, 
                }
            )
        );
    }
}
