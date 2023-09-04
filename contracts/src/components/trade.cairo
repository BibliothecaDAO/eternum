use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
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

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Status {
    #[key]
    trade_id: u128,
    value: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
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


// impl TradeStatusSerdeLen of dojo::SerdeLen<TradeStatus> {
//     #[inline(always)]
//     fn len() -> usize {
//         1
//     }
// }

mod TradeStatus {
    const OPEN: u128 = 0;
    const ACCEPTED: u128 = 1;
    const CANCELLED: u128 = 2;
}

// DISCUSS: rename this to avoid using Entities?
// here fungible entities represents a collection of entities
// that will be traded through the orderbook
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct FungibleEntities {
    #[key]
    entity_id: u128,
    key: u128,
    count: usize,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct OrderResource {
    #[key]
    order_id: u128,
    #[key]
    fungible_entities_id: u128,
    #[key]
    index: usize,
    resource_type: u8,
    balance: u128,
}


#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct TradeRoute {
    #[key]
    entity_id: ID,
    from_position_id: ID,
    to_position_id: ID
}