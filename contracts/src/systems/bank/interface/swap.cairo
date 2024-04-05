use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ISwapSystems {
    fn buy(
        bank_entity_id: u128,
        resource_type: u8,
        amount: u128
    );
    fn sell(
        bank_entity_id: u128,
        resource_type: u8,
        amount: u128
    );
}
