use core::num::traits::Bounded;
use core::num::traits::zero::Zero;

#[derive(Introspect, Copy, Drop, Serde, Default, PartialEq)]
pub struct Weight {
    pub capacity: u128,
    pub weight: u128,
}

pub impl WeightZeroableImpl of Zero<Weight> {
    fn zero() -> Weight {
        Weight { capacity: 0, weight: 0 }
    }

    fn is_non_zero(self: @Weight) -> bool {
        self.weight > @0 || self.capacity > @0
    }

    fn is_zero(self: @Weight) -> bool {
        !self.is_non_zero()
    }
}

#[generate_trait]
pub impl WeightImpl of WeightTrait {
    fn deduct_capacity(ref self: Weight, amount: u128, is_troop: bool) {
        if self.capacity != Bounded::MAX {
            self.capacity -= amount;

            // allow troops to be overweight incase they lose troops in battle
            if !is_troop {
                assert!(
                    self.weight <= self.capacity, "{} - {} capacity < {} weight", self.capacity, amount, self.weight,
                );
            }
        }
    }


    fn add_capacity(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            self.capacity += amount;
        }
    }

    fn deduct(ref self: Weight, amount: u128) {
        if self.capacity != Bounded::MAX {
            // this should never happen. check is a contract sanity check
            assert!(self.weight >= amount, "Weight Error: {} < {}", self.weight, amount);
            self.weight -= amount;
        }
    }

    fn add(ref self: Weight, amount: u128) {
        // the amount > 0 check fixes the case where there is an error
        // if entity weight > capacity and you try to add a weightless resource
        if self.capacity != Bounded::MAX && amount.is_non_zero() {
            self.weight += amount;
            assert!(self.weight <= self.capacity, "{} + {} weight > {} capacity", self.weight, amount, self.capacity);
        }
    }

    fn unused(ref self: Weight) -> u128 {
        if self.capacity != Bounded::MAX {
            if self.weight > self.capacity {
                // condition for overweight troops
                return 0;
            }
            return self.capacity - self.weight;
        }
        return Bounded::MAX;
    }
}
