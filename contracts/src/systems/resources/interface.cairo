use eternum::alias::ID;
use eternum::models::resources::{Burden, BurdenResource};

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
trait IBurdenSystems<TContractState> {
    fn bundle(
        self: @TContractState, world: IWorldDispatcher,
        entity_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>
    ) -> Burden;

    fn unbundle(self: @TContractState, world: IWorldDispatcher, entity_id: ID, burden_id: ID);
}
