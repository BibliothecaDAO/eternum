#[derive(Model, Copy, Drop, Serde)]
struct Capacity {
    #[key]
    entity_id: u128,
    weight_gram: u128,
}


#[generate_trait]
impl CapacityImpl of CapacityTrait {
    fn can_carry_weight(self: Capacity, quantity: u128, weight: u128) -> bool {
        if self.is_capped() {
            let entity_total_weight_capacity = self.weight_gram * quantity;
            if entity_total_weight_capacity < weight {
                return false;
            };
        };
        return true;
    }

    fn is_capped(self: Capacity) -> bool {
        self.weight_gram != 0
    }
}
