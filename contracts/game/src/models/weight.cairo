use s1_eternum::alias::ID;
use s1_eternum::models::config::{CapacityConfig, CapacityConfigTrait};
use s1_eternum::models::quantity::{Quantity};
use core::num::traits::Bounded;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Weight {
    #[key]
    entity_id: ID,
    value: u128,
}

#[generate_trait]
impl WeightImpl of WeightTrait {
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


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct W3eight {
    capacity: u64,
    weight: u64,
}

#[generate_trait]
impl W3eightImpl of W3eightTrait {
    fn deduct(ref self: W3eight, amount: u128) {
        if self.capacity != Bounded::Max {
            self.weight -= amount;
        }
    }

    fn add(ref self: W3eight, amount: u128) {
        if self.capacity != Bounded::Max {
            self.weight += amount;
            assert!(self.weight <= self.capacity, "{} weight + {} weight > {} capacity", self.weight, amount, self.capacity);
        }
    }
}