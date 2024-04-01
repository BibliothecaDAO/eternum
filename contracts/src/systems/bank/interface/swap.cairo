use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ISwapSystems<TContractState> {
    fn buy(
        self: @TContractState,
        world: IWorldDispatcher,
        bank_entity_id: u128,
        resource_type: u8,
        amount: u128
    );
    fn sell(
        self: @TContractState,
        world: IWorldDispatcher,
        bank_entity_id: u128,
        resource_type: u8,
        amount: u128
    );
}
