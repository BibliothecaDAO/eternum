use eternum::alias::ID;
use eternum::models::combat::Duty;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ISoldierSystems<TContractState> {
    fn create_soldiers( 
        self: @TContractState, world: IWorldDispatcher, 
        realm_entity_id: u128, quantity: u128
    ) -> ID;

    fn detach_soldiers( 
        self: @TContractState, world: IWorldDispatcher, 
        unit_id: u128, detached_quantity: u128
    ) -> ID;

    fn merge_soldiers(
        self: @TContractState, world: IWorldDispatcher, 
        merge_into_unit_id: u128, units: Span<(ID, u128)>
    );

    fn heal_soldiers( 
        self: @TContractState, world: IWorldDispatcher, 
        unit_id: ID, health_amount: u128
    );
}

#[starknet::interface]
trait ICombatSystems<TContractState> {
    fn attack( 
        self: @TContractState, world: IWorldDispatcher, 
        attacker_ids: Span<u128>, target_realm_entity_id: u128
    );
    
    fn steal(
        self: @TContractState, world: IWorldDispatcher,
        attacker_id: u128, target_realm_entity_id: u128
    );
}