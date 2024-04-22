use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::Coord;

#[dojo::interface]
trait IDonkeySystems {
    fn send_donkeys(sender_entity_id: ID, amount: u128, destination_coord: Coord) -> ID;
    fn send_resources(sender_entity_id: ID, resources: Span<(u8, u128)>, destination_coord: Coord) -> ID;
    fn pickup_resources(donkey_owner_entity_id: ID, resource_owner_entity_id: ID, resources: Span<(u8, u128)>) -> ID;
}
