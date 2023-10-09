use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITradeSystems<TContractState> {
    fn create_order(
        self: @TContractState,
        world: IWorldDispatcher,
        maker_id: u128,
        maker_entity_types: Span<u8>,
        maker_quantities: Span<u128>,
        taker_id: u128,
        taker_entity_types: Span<u8>,
        taker_quantities: Span<u128>,
        taker_needs_caravan: bool,
        expires_at: u64
    ) -> ID;

    fn accept_order(
        self: @TContractState, world: IWorldDispatcher,
        taker_id: u128, trade_id: u128
    );

    fn claim_order(
        self: @TContractState, world: IWorldDispatcher,
        entity_id: u128, trade_id: u128
    );

    fn cancel_order(self: @TContractState, world: IWorldDispatcher, trade_id: u128);
}


#[starknet::interface]
trait ITradeCaravanSystems<TContractState> {
    fn attach_caravan(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_id: u128, 
        trade_id: u128, 
        caravan_id: u128
    );
}
