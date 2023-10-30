use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IResourceSystems<TContractState> {
    fn approve(
        self: @TContractState, world: IWorldDispatcher, 
        entity_id: ID, approved_entity_id: ID, resources: Span<(u8, u128)>
    );
    fn transfer(
        self: @TContractState, world: IWorldDispatcher, sending_entity_id: ID,
        receiving_entity_id: ID, resources: Span<(u8, u128)>
    );

    fn transfer_from(
        self: @TContractState, world: IWorldDispatcher, 
        approved_entity_id: ID, owner_entity_id: ID, 
        receiving_entity_id: ID, resources: Span<(u8, u128)>
    );
}

#[starknet::interface]
trait IResourceChestSystems<TContractState> {
    fn offload_chest(
        self: @TContractState, world: IWorldDispatcher, 
        entity_id: ID, entity_index_in_inventory: u128, 
        receiving_entity_id: ID, transport_id: ID
    );
}
