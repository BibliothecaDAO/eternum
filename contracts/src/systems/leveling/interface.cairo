use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ILevelingSystems {
    fn level_up_realm(realm_entity_id: ID);
}
