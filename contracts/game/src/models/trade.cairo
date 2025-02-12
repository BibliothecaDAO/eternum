use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Trade {
    #[key]
    trade_id: ID,
    maker_gives_resource_hash: felt252,
    taker_gives_resource_hash: felt252,
    maker_id: ID,
    taker_id: ID,
    maker_gives_resource_origin_id: ID,
    taker_gives_resource_origin_id: ID,
    maker_gives_resource_id: ID,
    taker_gives_resource_id: ID,
    expires_at: u64,
    status: u8,
}

mod TradeStatus {
    const OPEN: u8 = 0;
    const ACCEPTED: u8 = 1;
    const CANCELLED: u8 = 2;
}
