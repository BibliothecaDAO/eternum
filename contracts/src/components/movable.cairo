use eternum::components::position::{Coord, CoordTrait};
use core::traits::{Into, TryInto};

// speed seconds per km
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Movable {
    #[key]
    entity_id: u128,
    sec_per_km: u16,
    blocked: bool,
}

// DISCUSS: separated from the Movable component because
// we want to attach an ArrivalTime to the trading order
// without having to attach a Movable component to the order
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct ArrivalTime {
    #[key]
    entity_id: u128,
    arrives_at: u64,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Travel {
    #[key]
    entity_id: u128,
    arrival_time: u64,
    departure_time: u64,
    departure_coord_x: u32,
    departure_coord_y: u32,
    // last stop means last location before reaching destination
    // e.g if a caravan is traveling from A -> B -> A,
    // last_stop_coord will be that of B.
    last_stop_coord_x: u32,
    last_stop_coord_y: u32
}


#[generate_trait]
impl TravelImpl of TravelTrait {
    fn live_location(self: @Travel, destination: Coord, timestamp: u64) -> Coord {
        if *self.arrival_time < timestamp {
            let total_transit_time = *self.arrival_time - *self.departure_time;
            let time_in_transit = timestamp - *self.departure_time; 
            
            let journey_percentage_completed: u64 = (time_in_transit * 100) / total_transit_time;
            let journey_percentage_completed: u32 = journey_percentage_completed.try_into().unwrap();

            let departure_coord = Coord {
                x: *self.departure_coord_x,
                y: *self.departure_coord_y
            };

            let last_stop_coord = Coord {
                x: *self.last_stop_coord_x,
                y: *self.last_stop_coord_y
            };

            if departure_coord == last_stop_coord {
                // it's a one way journey
                return departure_coord.interpolate(destination, journey_percentage_completed);
            } else {
                // it's a round trip journey
                if time_in_transit <= total_transit_time / 2 {
                    // we're on the way there
                    return departure_coord.interpolate(last_stop_coord, journey_percentage_completed * 2);

                } else {
                    // we're on the way back
                    return last_stop_coord.interpolate(destination, (journey_percentage_completed - 50) * 2);
                }
            }

        }

        return destination;
    }
    
}
