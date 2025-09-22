use s1_eternum::alias::ID;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct SeasonPrize {
    #[key]
    pub config_id: ID,
    pub total_registered_points: u128,
    pub total_lords_pool: u256,
}
