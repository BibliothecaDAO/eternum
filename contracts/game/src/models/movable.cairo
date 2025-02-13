use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{DONKEY_ENTITY_TYPE, WORLD_CONFIG_ID};
use s1_eternum::models::config::{SpeedConfig, WorldConfigUtilImpl};
use s1_eternum::models::position::Coord;
// speed seconds per km
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Movable {
    #[key]
    entity_id: ID,
    entity_type: u128,
    blocked: bool,
    round_trip: bool,
    start_coord_x: u32,
    start_coord_y: u32,
    intermediate_coord_x: u32,
    intermediate_coord_y: u32,
}

#[generate_trait]
impl MovableImpl of MovableTrait {

    fn assert_moveable(self: Movable) {
        assert!(!self.blocked, "Entity is blocked");
        assert!(self.entity_type.is_non_zero(), "Entity has no speed");
    }

    fn assert_blocked(self: Movable) {
        assert!(self.blocked, "Entity {} is not blocked", self.entity_id);
    }
}
