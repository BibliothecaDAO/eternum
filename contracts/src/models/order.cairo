#[derive(Model, Copy, Drop, Serde)]
struct Orders {
    #[key]
    order_id: u128,
    hyperstructure_count: u128
}

#[generate_trait]
impl OrdersImpl of OrdersTrait {
    fn get_bonus_multiplier(self: Orders) -> u128 {
        self.hyperstructure_count * 25
    }

    fn get_bonus_denominator(self: Orders) -> u128 {
        100
    }
}

