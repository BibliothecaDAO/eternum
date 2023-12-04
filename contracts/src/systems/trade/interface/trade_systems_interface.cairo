use eternum::alias::ID;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITradeSystems<TContractState> {
    /// Create an offer to sell resources.
    ///
    /// The offer may be open or direct. To make an open offer, set
    /// `taker_id` to 0 and to make a direct offer, set `taker_id` to the
    /// ID of the taker.
    ///
    /// # Arguments
    /// - `world`: Dojo world.
    /// - `maker_id`: maker entity id.
    /// - `maker_gives_resources`: an array containing the types of resources to be sold and amount.
    /// - `maker_caravan_id`: The unique identifier of the maker's caravan.
    /// - `taker_id`: The unique identifier of the taker.
    /// - `taker_gives_resources`: an array containing the types of resources to be bought and amount.
    /// - `expires_at`: The expiration time after which offer is no longer valid.
    ///
    /// # Returns
    ///    trade id
    ///
    fn create_order(
        self: @TContractState,
        world: IWorldDispatcher,
        maker_id: u128,
        maker_gives_resources: Span<(u8, u128)>,
        maker_transport_id: ID,
        taker_id: u128,
        taker_gives_resources: Span<(u8, u128)>,
        expires_at: u64
    ) -> ID;

    fn accept_order(
        self: @TContractState, world: IWorldDispatcher,
        taker_id: u128, taker_transport_id: u128, trade_id: u128
    );

    fn cancel_order(self: @TContractState, world: IWorldDispatcher, trade_id: u128);

}
