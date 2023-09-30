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

// comment@reviewer using this temporarily to avoid changing
//                  all the code that uses Movable without 
//                  finalizing the changes
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct NewMovable {
    #[key]
    entity_id: u128,
    sec_per_km: u16,
    blocked: bool,

    arrival_time: u64,
    departure_time: u64,
    // last stop means last location before reaching destination
    // e.g if a caravan is traveling from A -> B -> A,
    // last_stop_coord will be that of B.
    last_stop_coord_x: u32,
    last_stop_coord_y: u32,
    round_trip: bool

}

#[generate_trait]
impl NewMovableImpl of NewMovableTrait {
    fn live_location(self: @NewMovable, destination_coord: Coord) -> Coord {
        
        let timestamp = starknet::get_block_timestamp();

        if *self.arrival_time > timestamp {
            let total_transit_time = *self.arrival_time - *self.departure_time;
            let time_in_transit = timestamp - *self.departure_time; 
            
            let journey_percentage_completed: u64
                     = (time_in_transit * 100) / total_transit_time;
            let journey_percentage_completed: u32 
                    = journey_percentage_completed.try_into().unwrap();

            let last_stop_coord = Coord {
                x: *self.last_stop_coord_x,
                y: *self.last_stop_coord_y
            };

            if *self.round_trip  {
                if time_in_transit <= total_transit_time / 2 {
                    // we're on the way there
                    
                    // since it's a round trip, destination coord == start coord
                    // so we interpolate the start coord with last stop coord
                    return destination_coord.interpolate(
                        last_stop_coord, 
                        journey_percentage_completed * 2
                    );

                } else {
                    // we're on the way back

                    return last_stop_coord.interpolate(
                        destination_coord, 
                        (journey_percentage_completed - 50) * 2
                    );
                }
                
            } else {
                // it's a one way journey
                return last_stop_coord.interpolate(
                    destination_coord, 
                    journey_percentage_completed
                );
            }

        }

        return destination_coord;
    }
    
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

