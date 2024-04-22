use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait ICaravanSystems {
    fn create(entity_ids: Array<ID>) -> ID;
    fn disassemble(caravan_id: ID) -> Span<ID>;
}
