use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IBankSystems<TContractState> {
    fn open_account(self: @TContractState, world: IWorldDispatcher, bank_entity_id: u128);
}

