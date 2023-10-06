use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITransportUnitSystems<TContractState> {
    fn create_free_unit(
        self: @TContractState, world: IWorldDispatcher, 
        entity_id: u128, quantity: u128
    ) -> ID;
}