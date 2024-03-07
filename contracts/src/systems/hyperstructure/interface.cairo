use eternum::alias::ID;
use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IHyperstructureSystems<TContractState> {
    fn control(
        self: @TContractState, world: IWorldDispatcher, hyperstructure_id: ID, order_id: u8
    );
    fn complete( 
        self: @TContractState, world: IWorldDispatcher, hyperstructure_id: ID
    );
}
