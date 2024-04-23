use eternum::models::position::Coord;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::{SpeedConfig};

// speed seconds per km
#[derive(Model, Copy, Drop, Serde)]
struct Movable {
    #[key]
    entity_id: u128,
    sec_per_km: u16,
    blocked: bool,
    round_trip: bool,
    start_coord_x: u128,
    start_coord_y: u128,
    intermediate_coord_x: u128,
    intermediate_coord_y: u128
}

#[generate_trait]
impl MovableImpl of MovableTrait {
    fn sec_per_km(world: IWorldDispatcher, entity_type: u128) -> u16 {
        get!(world, (WORLD_CONFIG_ID, entity_type), SpeedConfig).sec_per_km
    }
}

// DISCUSS: separated from the Movable component because
// we want to attach an ArrivalTime to the trading order
// without having to attach a Movable component to the order
#[derive(Model, Copy, Drop, Serde)]
struct ArrivalTime {
    #[key]
    entity_id: u128,
    arrives_at: u64,
}
