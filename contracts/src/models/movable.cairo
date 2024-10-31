use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use eternum::alias::ID;
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::{SpeedConfig};
use eternum::models::position::Coord;
// speed seconds per km
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Movable {
    #[key]
    entity_id: ID,
    sec_per_km: u16,
    blocked: bool,
    round_trip: bool,
    start_coord_x: u32,
    start_coord_y: u32,
    intermediate_coord_x: u32,
    intermediate_coord_y: u32
}

#[generate_trait]
impl MovableCustomImpl of MovableCustomTrait {
    fn sec_per_km(ref world: WorldStorage, entity_type: ID) -> u16 {
        let speed_config: SpeedConfig = world.read_model((WORLD_CONFIG_ID, entity_type));
        speed_config.sec_per_km
    }
    fn assert_moveable(self: Movable) {
        assert!(!self.blocked, "Entity is blocked");
        assert!(self.sec_per_km.is_non_zero(), "Entity has no speed");
    }

    fn assert_blocked(self: Movable) {
        assert!(self.blocked, "Entity {} is not blocked", self.entity_id);
    }
}

// DISCUSS: separated from the Movable component because
// we want to attach an ArrivalTime to the trading order
// without having to attach a Movable component to the order
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ArrivalTime {
    #[key]
    entity_id: ID,
    arrives_at: u64,
}

#[generate_trait]
impl ArrivalTimeCustomImpl of ArrivalTimeCustomTrait {
    fn assert_not_travelling(self: ArrivalTime) {
        assert(self.arrives_at <= starknet::get_block_timestamp(), 'entity is in transit')
    }
}
