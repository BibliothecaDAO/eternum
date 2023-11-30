use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IBankSystems<TContractState> {
    fn swap(
        self: @TContractState, 
        world: IWorldDispatcher, 
        bank_id: u128, 
        bank_swap_resource_cost_index: u8, 
        entity_id: u128, 
        bought_resource_type: u8, 
        bought_resource_amount: u128
    );
}