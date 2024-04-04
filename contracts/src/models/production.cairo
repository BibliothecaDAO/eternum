use core::num::traits::zero::Zero;
use core::option::OptionTrait;
use core::integer::BoundedInt;
use core::Zeroable;
use dojo::world::{IWorldDispatcher};
use starknet::get_block_timestamp;
use eternum::models::resources::Resource;
// This exists a model per realm per resource

// This is a model that represents the production of a resource

// Whenever this resource is used on a realm, harvest() is called.

// Whenever a resource is used on a realm we use the balance of the resource to determine how much of it is left, which is a computed value, not a fixed value. This allows us to have a dynamic balance that changes over time, and not rely on claiming of the resource. We use the computed value + the stored value to determine the total balance of the resource.

// e.g resource is stone..dependents are wood andruby because they each depend on 
// stone to be produced
#[derive(Model, Copy, Drop, Serde)]
struct ProductionConfig {
    #[key]
    resource_type: u8,
    // production per tick
    amount_per_tick: u128,
    cost_resource_type_1: u8,
    cost_resource_type_1_amount: u128,
    cost_resource_type_2: u8,
    cost_resource_type_2_amount: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct ProductionDependencyConfig {
    #[key]
    dependent_resource_type: u8,
    produced_resource_type_1: u8,
    produced_resource_type_2: u8,
}

#[derive(Model, Copy, Drop, Serde)]
struct Production {
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    building_count: u128,
    production_rate: u128,
    bonus_percent: u128,
    consumed_rate: u128,
    start_at: u64, 
    stop_at: u64, 
    updated_at: u64, 
}

const PRODUCTION_BONUS_BASIS : u128 = 10_000;

// We could make this a nice JS Class with a constructor and everything
// Then maintaining logic in client will be easy
#[generate_trait]
impl ProductionRateImpl of ProductionRateTrait {

    fn is_active(self: Production) -> bool {
        if self.building_count > 0 {return true;}
        return false;
    }

    fn set_rate(ref self: Production, production_rate: u128) {
        self.production_rate = production_rate;
    }
    fn increase_boost_percentage(ref self: Production, amount: u128) {
        self.bonus_percent += amount;
    }

    fn decrease_boost_percentage(ref self: Production, amount: u128) {
        self.bonus_percent -= amount;
    }

    fn actual_production_rate(self: Production) -> u128 {
        (self.production_rate * self.building_count * self.bonus_percent)
             / PRODUCTION_BONUS_BASIS
    }


    fn increase_building_count(ref self: Production, ref resource: Resource) {
        self.harvest(ref resource);
        self.building_count += 1;
        self.estimate_stop_time(ref resource);
    }

    fn decrease_building_count(ref self: Production, ref resource: Resource) {
        self.harvest(ref resource);
        self.building_count -= 1;
        self.estimate_stop_time(ref resource);
    }

    fn increase_consumed_rate(ref self: Production, ref resource: Resource, amount: u128) {
        self.harvest(ref resource);
        self.consumed_rate += amount;
        self.estimate_stop_time(ref resource);
    }
    
    fn decrease_consumed_rate(ref self: Production, ref resource: Resource, amount: u128) {
        self.harvest(ref resource);
        self.consumed_rate -= amount;
        self.estimate_stop_time(ref resource);
    }

    // note for me: 
    // if net rate of production is positive, we have no need 
    // to check balance
    fn harvest(ref self: Production, ref resource: Resource) {
        let (sign, value) = self.net_rate();
        let total = value * self.duration().into();
        if sign {
            resource.balance += total;
        } else {
            // note for me: should never fail if stop_at is 
            // calculated correctly
            resource.balance -= total;
        }
        
        let now = get_block_timestamp();
        self.start_at = now;
    }

    fn net_rate(self: Production) -> (bool, u128) {
        if !self.is_active() {return (false, 0);}
        let production_rate = self.actual_production_rate();
        if production_rate > self.consumed_rate {
            (true, production_rate - self.consumed_rate)
        } else {
            (false, self.consumed_rate - production_rate)
        }
    }

    fn estimate_stop_time(ref self: Production, ref resource: Resource){
        if self.is_active() {
            let (sign, value) = self.net_rate();

            // todo check for division by 0 errors
            if sign == false {
                //assuming 1 second per tick
                self.stop_at 
                    = get_block_timestamp() 
                        + (resource.balance / value).try_into().unwrap(); 
            } else {
                self.stop_at = BoundedInt::max();
            }
        }

    }

    fn generated(self: Production) -> u128 {
        if !self.is_active() {return 0;}
        self.actual_production_rate() *  self.duration().into()
    }

    fn consumed(self: Production) -> u128 {
        if !self.is_active() {return 0;}
        self.consumed_rate * self.duration().into()
    }

    fn duration(self: Production) -> u64 {
        if self.start_at > self.stop_at {
            return 0;
        }
        let now = get_block_timestamp();
        if now > self.stop_at {
            self.stop_at - self.start_at
        } else {
            now - self.start_at
        }
    }
}