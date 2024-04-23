use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::{SpeedConfig};
use eternum::models::position::Coord;

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
    fn assert_moveable(self: Movable) {
        assert!(!self.blocked, "Entity is blocked");
        assert!(self.sec_per_km != 0, "Entity has no speed");
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

#[generate_trait]
impl ArrivalTimeImpl of ArrivalTimeTrait {
    fn assert_not_travelling(self: ArrivalTime) {
        assert(self.arrives_at <= starknet::get_block_timestamp(), 'entity is in transit')
    }
}
