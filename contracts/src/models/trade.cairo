use eternum::alias::ID;

#[derive(Model, Copy, Drop, Serde)]
struct Trade {
    #[key]
    trade_id: u128,
    maker_id: u128,
    maker_resource_chest_id: u128,
    maker_transport_id: u128,
    taker_id: u128,
    taker_resource_chest_id: u128,
    taker_transport_id: u128,
    expires_at: u64,
}


#[derive(Model, Copy, Drop, Serde)]
struct Status {
    #[key]
    trade_id: u128,
    value: u128,
}

mod TradeStatus {
    const OPEN: u128 = 0;
    const ACCEPTED: u128 = 1;
    const CANCELLED: u128 = 2;
}