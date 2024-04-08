use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IBankSystems {
    fn swap(
        bank_id: u128,
        bank_swap_resource_cost_index: u8,
        entity_id: u128,
        bought_resource_type: u8,
        bought_resource_amount: u128
    );
}
