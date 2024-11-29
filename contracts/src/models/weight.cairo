use s0_eternum::alias::ID;
use s0_eternum::models::config::{CapacityConfig, CapacityConfigCustomTrait};
use s0_eternum::models::quantity::{Quantity};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Weight {
    #[key]
    entity_id: ID,
    value: u128,
}

#[generate_trait]
impl WeightCustomImpl of WeightCustomTrait {
    fn deduct(ref self: Weight, capacity: CapacityConfig, amount: u128) {
        if self.entity_id == 0 {
            return;
        };
        if capacity.is_capped() {
            assert!(self.value >= amount, "weight deducted > entity {}'s weight", self.entity_id);
            if amount > self.value {
                self.value = 0;
            } else {
                self.value -= amount;
            }
        }
    }

    fn add(ref self: Weight, capacity: CapacityConfig, quantity: Quantity, amount: u128) {
        if self.entity_id == 0 {
            return;
        };
        if capacity.is_capped() {
            self.value += amount;
            capacity.assert_can_carry(quantity, self);
        };
    }
}
