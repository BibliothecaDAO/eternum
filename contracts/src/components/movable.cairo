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
    // destination_coord will be that of B.
    destination_coord_x: u32,
    destination_coord_y: u32,
    round_trip: bool

}

#[generate_trait]
impl NewMovableImpl of NewMovableTrait {
    /// Calculate the current position of a movable object during its journey.
    ///
    /// This function calculates the current position of a movable object, represented by `self`,
    /// along its journey to the `journey_end_coord` based on the current timestamp. It considers
    /// factors like departure and arrival times, total transit time, and whether the journey is
    /// a round trip or one way.
    ///
    /// Args:
    ///     self: The movable object being tracked.
    ///     journey_end_coord: The final destination coordinates of the journey. 
    ///                         i.e the x,y coord of the entity's current `Position`.
    ///
    /// Returns:
    ///     A `Coord` representing the current position of the movable object.
    ///
    /// Example:
    ///
    /// ```
    /// let movable = NewMovable { ... };
    /// let destination = Coord { x: 10, y: 20 };
    /// let current_location = live_location(movable, destination);
    /// // current_location is the current position of the movable object.
    /// // e.g Coord{ x:5, y:10 } if the object is halfway through its journey.
    /// ```
      fn live_location(self: @NewMovable, journey_end_coord: Coord) -> Coord {
        
        let timestamp = starknet::get_block_timestamp();

        if *self.arrival_time > timestamp {
            let total_transit_time = *self.arrival_time - *self.departure_time;
            let time_in_transit = timestamp - *self.departure_time; 
            
            let journey_percentage_completed: u64
                     = (time_in_transit * 100) / total_transit_time;
            let journey_percentage_completed: u32 
                    = journey_percentage_completed.try_into().unwrap();

            let last_stop_coord = Coord {
                x: *self.destination_coord_x,
                y: *self.destination_coord_y
            };

            if *self.round_trip  {
                if time_in_transit <= total_transit_time / 2 {
                    // we're on the way there
                    
                    // since it's a round trip, journey_end_coord == start coord
                    // so we interpolate the start coord with last stop coord
                    return journey_end_coord.interpolate(
                        last_stop_coord, 
                        journey_percentage_completed * 2
                    );

                } else {
                    // we're on the way back

                    return last_stop_coord.interpolate(
                        journey_end_coord, 
                        (journey_percentage_completed - 50) * 2
                    );
                }
                
            } else {
                // it's a one way journey
                return last_stop_coord.interpolate(
                    journey_end_coord, 
                    journey_percentage_completed
                );
            }

        }

        return journey_end_coord;
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

