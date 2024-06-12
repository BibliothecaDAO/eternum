use eternum::models::capacity::{Capacity, CapacityTrait};
use eternum::models::quantity::{Quantity};
#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Weight {
    #[key]
    entity_id: u128,
    value: u128,
}

#[generate_trait]
impl WeightImpl of WeightTrait {
    fn deduct(ref self: Weight, capacity: Capacity, amount: u128) {
        if self.entity_id == 0 {
            return;
        };
        if capacity.is_capped() {
            assert(self.value >= amount, 'weight deducted>entity s weight');
            if amount > self.value {
                self.value = 0;
            } else {
                self.value -= amount;
            }
        }
    }

    fn add(ref self: Weight, capacity: Capacity, quantity: Quantity, amount: u128) {
        if self.entity_id == 0 {
            return;
        };
        if capacity.is_capped() {
            self.value += amount;
            capacity.assert_can_carry(quantity, self);
        };
    }
}
