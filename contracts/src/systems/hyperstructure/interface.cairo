use eternum::alias::ID;

use dojo::world::IWorldDispatcher;


#[starknet::interface]
trait IHyperstructureSystems<TContractState> {
    fn initialize(self: @TContractState, world: IWorldDispatcher, entity_id:ID, hyperstructure_id: ID);
    fn complete(self: @TContractState, world: IWorldDispatcher, hyperstructure_id: ID);
}