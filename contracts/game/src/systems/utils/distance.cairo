
use dojo::world::WorldStorage;
use s1_eternum::models::position::{Coord, CoordTrait};
use s1_eternum::models::movable::{MovableImpl};
use starknet::ContractAddress;


#[generate_trait]
pub impl iDistanceImpl of iDistanceTrait {
  
    fn time_required(
        ref world: WorldStorage,
        resources_coord: Coord,
        destination_coord: Coord,
        sec_per_km: u16,
        round_trip: bool,
    ) -> u64 {
        let mut travel_time = resources_coord.calculate_travel_time(destination_coord, sec_per_km);
        if round_trip {travel_time *= 2;};

        travel_time
    }
}

