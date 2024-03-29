use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ICaravanSystems {
    fn create(entity_ids: Array<ID>) -> ID;
    fn disassemble(caravan_id: ID) -> Span<ID>;
}