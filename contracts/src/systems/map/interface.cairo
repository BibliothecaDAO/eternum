use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IMapSystems<TContractState> {
    fn explore(
        self: @TContractState, world: IWorldDispatcher, 
        realm_entity_id: u128, col: u128, row: u128
    );
}
