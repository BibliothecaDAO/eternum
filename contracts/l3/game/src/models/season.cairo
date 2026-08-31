#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct SeasonPrize {
    #[key]
    pub game_id: u32,
    pub total_registered_points: u128,
    pub total_lords_pool: u256,
}
