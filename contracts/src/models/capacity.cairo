use eternum::models::quantity::{Quantity, QuantityTrait};
use eternum::models::weight::{Weight};

#[derive(Model, Copy, Drop, Serde)]
struct Capacity {
    #[key]
    entity_id: u128,
    weight_gram: u128,
}


#[generate_trait]
impl CapacityImpl of CapacityTrait {
    fn assert_can_carry(self: Capacity, quantity: Quantity, weight: Weight) {
        assert!(self.can_carry(quantity, weight), "entity {} capacity not enough", self.entity_id); 
    }
    
    fn can_carry(self: Capacity, quantity: Quantity, weight: Weight) -> bool {
        if self.is_capped() {
            let entity_total_weight_capacity = self.weight_gram * quantity.get_value();
            if entity_total_weight_capacity < weight.value {
                return false;
            };
        };
        return true;
    }

    fn is_capped(self: Capacity) -> bool {
        self.weight_gram != 0
    }
}
