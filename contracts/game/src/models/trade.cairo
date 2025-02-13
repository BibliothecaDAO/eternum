use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Trade {
    #[key]
    trade_id: ID,
    maker_id: ID,
    taker_id: ID,
    expires_at: u32,
    maker_gives_resource_type: u8,
    maker_gives_min_resource_amount: u128,
    maker_gives_max_count: u128,
    taker_pays_min_lords_amount: u128,
}
