use s1_eternum::alias::ID;

// Used as helper struct throughout the world
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Bank {
    #[key]
    pub entity_id: ID,
    pub owner_fee_num: u128,
    pub owner_fee_denom: u128,
    pub owner_bridge_fee_dpt_percent: u16,
    pub owner_bridge_fee_wtdr_percent: u16,
    pub exists: bool,
}

