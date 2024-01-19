#[derive(Model, Copy, Drop, Serde)]
struct Order {
    #[key]
    order_id: u128,
    hyperstructure_count: u128
}

#[generate_trait]
impl OrderImpl of OrderTrait {
    fn get_bonus_multiplier(self: Order) -> u128 {
        self.hyperstructure_count * 25
    }

    fn get_bonus_denominator(self: Order) -> u128 {
        100
    }
}

