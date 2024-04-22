use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ITransportUnitSystems {
    fn create_free_unit(entity_id: u128, quantity: u128) -> ID;
    fn return_free_units(unit_ids: Span<u128>);
}
