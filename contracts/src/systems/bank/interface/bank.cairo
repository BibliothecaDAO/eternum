use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[starknet::interface]
trait IBankSystems<TContractState> {
    fn open_account(self: @TContractState, world: IWorldDispatcher, bank_entity_id: u128) -> ID;
    fn change_owner_fee(
        self: @TContractState,
        world: IWorldDispatcher,
        bank_entity_id: u128,
        new_swap_fee_unscaled: u128
    );
}

