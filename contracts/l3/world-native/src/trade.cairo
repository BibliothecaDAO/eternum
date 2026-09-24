use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeKey {
    pub game_id: u32,
    pub trade_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TradeRules {
    pub max_count: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TradeOrder {
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_per_lot: u64,
    pub requested_per_lot: u64,
    pub remaining_lots: u64,
    pub expires_at: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateOrder {
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_per_lot: u64,
    pub requested_per_lot: u64,
    pub lots: u64,
    pub expires_at: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeListing {
    pub trade_id: u32,
    pub order: TradeOrder,
}

pub fn new_order(command: CreateOrder) -> TradeOrder {
    TradeOrder {
        maker_id: command.maker_id,
        taker_id: command.taker_id,
        offered_resource: command.offered_resource,
        requested_resource: command.requested_resource,
        offered_per_lot: command.offered_per_lot,
        requested_per_lot: command.requested_per_lot,
        remaining_lots: command.lots,
        expires_at: command.expires_at,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AcceptOrder {
    pub trade_id: u32,
    pub taker_id: u32,
    pub lots: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeFill {
    pub trade_id: u32,
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_amount: u128,
    pub requested_amount: u128,
}

#[starknet::interface]
pub trait ITrade<T> {
    fn configure_trade(ref self: T, game_id: u32, rules: TradeRules);
    #[cfg(test)]
    fn trade_rules(self: @T, game_id: u32) -> TradeRules;
    #[cfg(test)]
    fn trade_order(self: @T, key: TradeKey) -> Option<TradeOrder>;
    fn create_trade_order(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: CreateOrder,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn accept_trade_order(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: AcceptOrder,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
    fn cancel_trade_order(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        trade_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

// Only the economy domain can release escrow or queue purchased resources.
#[starknet::interface]
pub trait IEconomyDelivery<T> {
    fn queue_economy_delivery(
        ref self: T,
        key: crate::resources::ResourceKey,
        resource: crate::resources::ResourceAmount,
        travel_time: u64,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
}
