use eternum::alias::ID;

#[derive(Model, Copy, Drop, Serde)]
struct Trade {
    #[key]
    trade_id: u128,
    maker_id: u128,
    taker_id: u128,
    maker_order_id: u128,
    taker_order_id: u128,
    expires_at: u64,
    claimed_by_maker: bool,
    claimed_by_taker: bool,
    // DISCUSS: maybe force to use caravan if the maker attaches caravan as well?
    taker_needs_caravan: bool,
}

#[derive(Model, Copy, Drop, Serde)]
struct Status {
    #[key]
    trade_id: u128,
    value: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct OrderId {
    #[key]
    entity_id: u128,
    id: u128,
}

// // status of the trade
// #[derive(Copy, Drop, Serde)]
// enum TradeStatus {
//     Open: (),
//     Accepted: (),
//     Cancelled: (),
// }



mod TradeStatus {
    const OPEN: u128 = 0;
    const ACCEPTED: u128 = 1;
    const CANCELLED: u128 = 2;
}

// DISCUSS: rename this to avoid using Entities?
// here fungible entities represents a collection of entities
// that will be traded through the orderbook
#[derive(Model, Copy, Drop, Serde)]
struct FungibleEntities {
    #[key]
    entity_id: u128,
    key: u128,
    count: u32,
}

#[derive(Model, Copy, Drop, Serde)]
struct OrderResource {
    #[key]
    order_id: u128,
    #[key]
    fungible_entities_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    balance: u128,
}