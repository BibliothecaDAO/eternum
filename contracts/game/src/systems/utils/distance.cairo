use dojo::world::WorldStorage;
use crate::models::position::{Coord, TravelTrait};


#[generate_trait]
pub impl iDistanceKmImpl of iDistanceKmTrait {
    fn time_required(
        ref world: WorldStorage, start_coord: Coord, destination_coord: Coord, sec_per_km: u16, round_trip: bool,
    ) -> u64 {
        let mut travel_time = start_coord.km_travel_time(destination_coord, sec_per_km);
        if round_trip {
            travel_time *= 2;
        }

        travel_time
    }
}

