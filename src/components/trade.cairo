use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde)]
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

#[derive(Component, Copy, Drop, Serde)]
struct Status {
    value: status, 
}


// status of the trade
#[derive(Copy, Drop, Serde)]
enum status {
    Open: (),
    Accepted: (),
    Cancelled: (),
}

// DISCUSS: rename this to avoid using Entities?
// here fungible entities represents a collection of entities
// that will be traded through the orderbook
#[derive(Component, Copy, Drop, Serde)]
struct FungibleEntities {
    key: ID,
    count: usize,
}
