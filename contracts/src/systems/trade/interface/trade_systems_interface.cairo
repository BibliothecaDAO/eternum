use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITradeSystems<TContractState> {
    /// Create an offer to sell resources.
    ///
    /// The offer may be open or direct. To make an open offer, set
    /// `buyer_id` to 0 and to make a direct offer, set `buyer_id` to the
    /// ID of the buyer.
    ///
    /// # Arguments
    /// - `world`: Dojo world.
    /// - `seller_id`: seller entity id.
    /// - `seller_resource_types`: an array containing the types of resources to be sold.
    /// - `seller_resource_amounts`: an array containing the quantities of resources to be sold.
    /// - `seller_caravan_id`: The unique identifier of the seller's caravan.
    /// - `buyer_id`: The unique identifier of the buyer.
    /// - `buyer_resource_types`: an array containing the types of resources to be bought.
    /// - `buyer_resource_amounts`: an array containing the quantities of resources to be bought.
    /// - `expires_at`: The expiration time after which offer is no longer valid.
    ///
    /// # Returns
    ///    trade id
    ///
    fn create_order(
        self: @TContractState,
        world: IWorldDispatcher,
        seller_id: u128,
        seller_resource_types: Span<u8>,
        seller_resource_amounts: Span<u128>,
        seller_caravan_id: ID,
        buyer_id: u128,
        buyer_resource_types: Span<u8>,
        buyer_resource_amounts: Span<u128>,
        expires_at: u64
    ) -> ID;

    fn accept_order(
        self: @TContractState, world: IWorldDispatcher,
        buyer_id: u128, buyer_caravan_id: u128, trade_id: u128
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
