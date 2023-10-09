use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ICaravanSystems<TContractState> {
    fn create(self: @TContractState, world: IWorldDispatcher, entity_ids: Array<ID>) -> ID;
}