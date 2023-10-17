use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITradeSystems<TContractState> {
    fn create_order(
        self: @TContractState,
        world: IWorldDispatcher,
        seller_id: u128,
        seller_entity_types: Span<u8>,
        seller_quantities: Span<u128>,
        seller_caravan_id: ID,
        buyer_id: u128,
        buyer_entity_types: Span<u8>,
        buyer_quantities: Span<u128>,
        expires_at: u64
    ) -> ID;

    fn accept_order(
        self: @TContractState, world: IWorldDispatcher,
        buyer_id: u128, buyer_caravan_id: u128, trade_id: u128
    );

    fn cancel_order(self: @TContractState, world: IWorldDispatcher, trade_id: u128);

    fn claim_burden(
        self: @TContractState, world: IWorldDispatcher,
        entity_id: u128, burden_id: u128
    );

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
