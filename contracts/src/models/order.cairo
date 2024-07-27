use eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Orders {
    #[key]
    order_id: ID,
    hyperstructure_count: u128
}

#[generate_trait]
impl OrdersCustomImpl of OrdersCustomTrait {
    fn get_bonus_multiplier(self: Orders) -> u128 {
        self.hyperstructure_count * 25
    }

    fn get_bonus_denominator(self: Orders) -> u128 {
        100
    }
}

