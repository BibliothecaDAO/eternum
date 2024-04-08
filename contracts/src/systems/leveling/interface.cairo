use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ILevelingSystems {
    fn level_up_realm(realm_entity_id: ID);
}
