use eternum::alias::ID;
use eternum::models::combat::Duty;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ISoldierSystems<TContractState> {
    fn create_soldiers( 
            self: @TContractState, world: IWorldDispatcher, 
            entity_id: u128, quantity: u128
    );

    fn group_and_deploy_soldiers( 
        self: @TContractState, world: IWorldDispatcher, 
        entity_id: u128, soldier_ids: Span<ID>, duty: Duty
    );

    fn ungroup_soldiers(
        self: @TContractState, world: IWorldDispatcher, group_id: ID
    );
}