// stores entity metadata that is global to the world
// eg: birth time, moveable, alive
// TODO for next milestone

use eternum::constants::TICK_TIME;

#[derive(Component, Copy, Drop, Serde)]
struct Metadata {
    name: felt252,
    created_at: u64,
    is_moveable: bool, // can move
    is_alive: bool,
    parent_entity: felt252, // if entity has parent
    last_update: felt252
}

trait RealmTrait {
    // check last update in the past
    fn tick(self: Realm) -> bool;
}

// TODO: find new name
impl RealmImpl of RealmTrait {
    fn tick(self: Realm) -> bool {
        if (self.last_update + TICK_TIME) < starknet::get_block_timestamp() {
            true
        } else {
            false
        }
    }
}

