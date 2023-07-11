use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Trade {
    maker_id: ID,
    taker_id: ID,
    maker_order_id: ID,
    taker_order_id: ID,
    expires_at: u64,
    claimed_by_maker: bool,
    claimed_by_taker: bool,
    // DISCUSS: maybe force to use caravan if the maker attaches caravan as well?
    taker_needs_caravan: bool,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Status {
    value: TradeStatus, 
}


// status of the trade
#[derive(Copy, Drop, Serde)]
enum TradeStatus {
    Open: (),
    Accepted: (),
    Cancelled: (),
}

impl TradeStatusSerdeLen of dojo::SerdeLen<TradeStatus> {
    #[inline(always)]
    fn len() -> usize {
       1 
    }
}

// DISCUSS: rename this to avoid using Entities?
// here fungible entities represents a collection of entities
// that will be traded through the orderbook
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct FungibleEntities {
    key: ID,
    count: usize,
}
