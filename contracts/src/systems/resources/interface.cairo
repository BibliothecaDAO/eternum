use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IResourceSystems<TContractState> {
    fn transfer(
        self: @TContractState, world: IWorldDispatcher, sending_entity_id: ID,
        receiving_entity_id: ID, resources: Span<(u8, u128)>
    );
}
