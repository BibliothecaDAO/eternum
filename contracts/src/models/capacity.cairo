use eternum::{
    alias::ID, models::quantity::{Quantity, QuantityCustomTrait}, models::weight::{Weight},
    constants::RESOURCE_PRECISION
};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Capacity {
    #[key]
    entity_id: ID,
    weight_gram: u128,
}


#[generate_trait]
impl CapacityCustomImpl of CapacityCustomTrait {
    fn assert_can_carry(self: Capacity, quantity: Quantity, weight: Weight) {
        assert!(self.can_carry(quantity, weight), "entity {} capacity not enough", self.entity_id);
    }

    fn can_carry(self: Capacity, quantity: Quantity, weight: Weight) -> bool {
        if self.is_capped() {
            let entity_total_weight_capacity = self.weight_gram * (quantity.get_value() / RESOURCE_PRECISION);
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
