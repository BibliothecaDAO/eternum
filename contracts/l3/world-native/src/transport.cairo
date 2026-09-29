use crate::resources::{ResourceAmount, is_troop_resource};
use crate::rules::{RESOURCE_PRECISION, SpeedConfig};
use crate::troops::Coord;

pub const DONKEY: u8 = 25;

pub fn travel_time(
    from: Coord, to: Coord, resources: Span<ResourceAmount>, speed: SpeedConfig, round_trip: bool,
) -> u64 {
    assert!(from.x != 0 || from.y != 0, "sender is not stationary");
    assert!(to.x != 0 || to.y != 0, "recipient is not stationary");
    assert!(from != to, "structures share a location");
    assert!(!from.alt && !to.alt, "transportation only allowed on surface");
    let mut seconds_per_km = speed.donkey_sec_per_km;
    for resource in resources {
        if is_troop_resource(*resource.resource_type) {
            seconds_per_km = speed.donkey_sec_per_km_troops;
            break;
        }
    }
    let one_way: u64 = (crate::geometry::distance(from, to) * seconds_per_km.into()).try_into().unwrap();
    if round_trip {
        one_way * 2
    } else {
        one_way
    }
}

pub fn donkeys_needed(weight: u128, capacity: u128) -> u128 {
    let capacity = capacity * RESOURCE_PRECISION;
    let full = weight / capacity;
    let remainder = if weight % capacity == 0 {
        0
    } else {
        1
    };
    (full + remainder) * RESOURCE_PRECISION
}
