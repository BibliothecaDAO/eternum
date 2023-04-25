use starknet::ContractAddress;
use eternum::constants::PRIME;
use eternum::alias::ID;
use eternum::constants::COORDINATE_PRECISION;
use quaireaux_math::fast_power::fast_power;
use eternum::utils::convert::convert_u32_to_u128;
use integer::u128_sqrt;
use traits::Into;
use traits::TryInto;
use option::OptionTrait;
use hash::pedersen;

#[derive(Component)]
struct Travel {
    // in seconds per km
    seconds_per_km: u128,
    arrival_time: u128,
}

trait TravelTrait {
    fn calculate_travel_time(self: Travel, distance: u128, route: bool) -> u128;
}

impl TravelImpl of TravelTrait {
    fn calculate_travel_time(self: Travel, distance: u128, route: bool) -> u128 {
        let seconds = distance * self.seconds_per_km;
        if route == true {
            seconds / 2
        } else {
            seconds
        }
    }
}

#[test]
fn test_calculate_travel_time_without_route() {
    let travel = Travel { seconds_per_km: 1, arrival_time: 0,  };

    let distance = 100;

    let travel_time = travel.calculate_travel_time(distance, false);

    assert(travel_time == 100, 'travel time should be 100');
}

#[test]
fn test_calculate_travel_time_with_route() {
    let travel = Travel { seconds_per_km: 1, arrival_time: 0,  };

    let distance = 100;

    let travel_time = travel.calculate_travel_time(distance, true);

    assert(travel_time == 50, 'travel time should be 50');
}

#[derive(Component)]
struct Route {
    start_x: u32,
    start_y: u32,
    end_x: u32,
    end_y: u32,
    order: u8,
    owner: ContractAddress,
    realm_id: ID,
    construction_time: u128,
}

trait RouteTrait {
    fn calculate_distance(self: Route) -> u128;
    fn route_id(self: Route) -> felt252;
}

impl RouteImpl of RouteTrait {
    fn calculate_distance(self: Route) -> u128 {
        let x: felt252 = fast_power((self.end_x - self.start_x).into(), 2, PRIME);
        let y: felt252 = fast_power((self.end_y - self.start_y).into(), 2, PRIME);

        let distance = u128_sqrt((x + y).try_into().unwrap());

        let d = distance / COORDINATE_PRECISION;

        d
    }
    // give a unique id to the route
    // will give the same id whatever the order of the points
    fn route_id(self: Route) -> felt252 {
        let start_hash = pedersen(self.start_x.into(), self.start_y.into());
        let end_hash = pedersen(self.end_x.into(), self.end_y.into());
        if self.start_x
            + self.start_y > self.end_x
            + self.end_y {
                return pedersen(start_hash, end_hash);
            } else {
                return pedersen(end_hash, start_hash);
            }
    }
}


// TODO: tests not working atm error: Error: Failed setting up runner.
// Caused by : Failed calculating gas usage , it is likely a call for ` gas :: withdraw_gas ` is missing . 
#[test]
fn test_calculate_distance() {
    let route = Route {
        start_x: 0,
        start_y: 0,
        end_x: 100,
        end_y: 100,
        order: 0,
        owner: starknet::contract_address_const::<0x420>(),
        realm_id: 0,
        construction_time: 0,
    };

    let distance = route.calculate_distance();

    assert(distance == 141, 'distance should be 141');
}

#[derive(Copy, Drop, Serde)]
struct Segment {
    start_x: u32,
    start_y: u32,
    end_x: u32,
    end_y: u32,
}

// TODO: how to have the same traits for both Route and Segment?
trait SegmentTrait {
    fn calculate_distance(self: Segment) -> u128;
    fn route_id(self: Segment) -> felt252;
}

impl SegmentImpl of SegmentTrait {
    fn calculate_distance(self: Segment) -> u128 {
        let x: felt252 = fast_power((self.end_x - self.start_x).into(), 2, PRIME);
        let y: felt252 = fast_power((self.end_y - self.start_y).into(), 2, PRIME);

        let distance = u128_sqrt((x + y).try_into().unwrap());

        let d = distance / COORDINATE_PRECISION;

        d
    }
    // give a unique id to the route
    // will give the same id whatever the order of the points
    fn route_id(self: Segment) -> felt252 {
        let start_hash = pedersen(self.start_x.into(), self.start_y.into());
        let end_hash = pedersen(self.end_x.into(), self.end_y.into());
        if self.start_x
            + self.start_y > self.end_x
            + self.end_y {
                return pedersen(start_hash, end_hash);
            } else {
                return pedersen(end_hash, start_hash);
            }
    }
}
