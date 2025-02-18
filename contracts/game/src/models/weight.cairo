use core::num::traits::Bounded;
use core::zeroable::Zeroable;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use s1_eternum::alias::ID;
use s1_eternum::models::config::{CapacityConfig};
use s1_eternum::models::quantity::{Quantity};


#[derive(Introspect, Copy, Drop, Serde, Default)]
pub struct Weight {
    capacity: u128,
    weight: u128,
}

impl WeightZeroableImpl of Zeroable<Weight> {
    fn zero() -> Weight {
        Weight { capacity: 0, weight: 0 }
    }

    fn is_non_zero(self: Weight) -> bool {
        self.weight > 0 || self.capacity > 0
    }

    fn is_zero(self: Weight) -> bool {
        !self.is_non_zero()
    }
}

#[generate_trait]
impl WeightImpl of WeightTrait {
    fn deduct_capacity(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            self.capacity -= amount;
            assert!(self.weight <= self.capacity, "{} - {} capacity < {} weight", self.capacity, amount, self.weight);
        }
    }

    fn add_capacity(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            self.capacity += amount;
        }
    }

    fn deduct(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            self.weight -= amount;
        }
    }

    fn add(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            self.weight += amount;
            assert!(self.weight <= self.capacity, "{} + {} weight > {} capacity", self.weight, amount, self.capacity);
        }
    }

    fn unused(ref self: Weight) -> u128 {
        if self.capacity != Bounded::MAX {
            return self.capacity - self.weight;
        }
        return Bounded::MAX;
    }
}
