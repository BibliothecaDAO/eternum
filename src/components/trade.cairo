use eternum::alias::ID;

// DISCUSSION: in future we should be able 
// to trade any entity with any other entity as long it has a weight component
#[derive(Component, Copy, Drop, Serde)]
struct FungibleTrade {
    maker_id: ID,
    taker_id: ID,
    maker_order_id: ID,
    taker_order_id: ID,
    expire_at: u64,
    claimed_by_maker: bool,
    claimed_by_taker: bool,
    // DISCUSS: maybe force to use caravan if the maker attaches caravan as well?
    taker_needs_caravan: bool,
}

enum Status {
    Open: (),
    Closed: (),
    Cancelled: (),
}
