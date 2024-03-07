use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IResourceSystems<TContractState> {
    fn mint(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_id: u128, 
        resources: Span<(u8, u128)>, 
    );
}
