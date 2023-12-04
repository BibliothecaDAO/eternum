use eternum::alias::ID;

use dojo::world::IWorldDispatcher;


#[starknet::interface]
trait IHyperstructureSystems<TContractState> {
    fn level_up(
        self: @TContractState,
        world: IWorldDispatcher,
        hyperstructure_id: u128
    );
    fn downgrade_level(
        self: @TContractState,
        world: IWorldDispatcher,
        hyperstructure_id: u128
    );
}