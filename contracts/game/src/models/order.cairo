use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Orders {
    #[key]
    order_id: ID,
    hyperstructure_count: u32
}

#[generate_trait]
impl OrdersImpl of OrdersTrait {
    fn get_bonus_multiplier(self: Orders) -> u128 {
        self.hyperstructure_count.into() * 25
    }

    fn get_bonus_denominator(self: Orders) -> u128 {
        100
    }
}

