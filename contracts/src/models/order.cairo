#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Orders {
    #[key]
    order_id: u128,
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

