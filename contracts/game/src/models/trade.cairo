use s0_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Trade {
    #[key]
    trade_id: ID,
    maker_id: ID,
    maker_gives_resources_origin_id: ID,
    maker_gives_resources_id: ID,
    maker_gives_resources_hash: felt252,
    maker_gives_resources_weight: u128,
    taker_id: ID,
    taker_gives_resources_origin_id: ID,
    taker_gives_resources_id: ID,
    taker_gives_resources_hash: felt252,
    taker_gives_resources_weight: u128,
    expires_at: u64,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Status {
    #[key]
    trade_id: ID,
    value: u128,
}

mod TradeStatus {
    const OPEN: u128 = 0;
    const ACCEPTED: u128 = 1;
    const CANCELLED: u128 = 2;
}
