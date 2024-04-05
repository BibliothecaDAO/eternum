use core::option::OptionTrait;
use core::integer::BoundedInt;
use core::Zeroable;
use dojo::world::{IWorldDispatcher};
use starknet::get_block_timestamp;
use eternum::models::resources::Resource;
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
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
    consumption_rate: u128,
    last_updated_tick: u64,
    materials_exhaustion_tick: u64,
    active: bool,
}


#[generate_trait]
impl ProductionBonusPercentageImpl of ProductionBonusPercentageTrait {
    fn _1() -> u128 {
        100
    }

    fn _10() -> u128 {
        1_000
    }

    fn _100() -> u128 {
        10_000
    }
}

// We could make this a nice JS Class with a constructor and everything
// Then maintaining logic in client will be easy
#[generate_trait]
impl ProductionRateImpl of ProductionRateTrait {

    fn is_active(self: Production) -> bool {
        if (self.building_count > 0 && self.active) {
            return true;
        }
        return false;
    }

    fn reactivate(
        ref self: Production, 
        ref resource: Resource,
        ref material_one: (Resource, Production), 
        ref material_two: (Resource, Production), 
        tick: @TickConfig
    ) {

        self.harvest(ref resource, tick);

        self.active = true;

        let (mut material_one_resource, mut material_one_production) 
            = material_one;
        self
            .set_materials_exhaustion_tick(
                ref material_one_production, ref material_one_resource, tick);

        let (mut material_two_resource, mut material_two_production) 
            = material_one;
        self
            .set_materials_exhaustion_tick(
                ref material_two_production, ref material_two_resource, tick);
    }

    fn deactivate(ref self: Production, ref resource: Resource, tick: @TickConfig) {
        self.harvest(ref resource, tick);
        self.active = false;
    }

    fn set_rate(ref self: Production, production_rate: u128) {
        self.production_rate = production_rate;
    }


    fn bonus(self: Production) -> u128 {
        (self.production_rate * self.building_count * self.bonus_percent) 
            / ProductionBonusPercentageImpl::_100()
    }

    fn actual_production_rate(self: Production) -> u128 {
        (self.production_rate * self.building_count) + self.bonus()
    }

    fn increase_boost_percentage(ref self: Production, amount: u128) {
        self.bonus_percent += amount;
    }

    fn decrease_boost_percentage(ref self: Production, amount: u128) {
        self.bonus_percent -= amount;
    }
    
    fn increase_building_count(ref self: Production, ref resource: Resource, tick: @TickConfig) {
        self.harvest(ref resource, tick);
        self.building_count += 1;
    }

    fn decrease_building_count(ref self: Production, ref resource: Resource, tick: @TickConfig) {
        self.harvest(ref resource, tick);
        self.building_count -= 1;
    }

    fn increase_consumption_rate(ref self: Production, ref resource: Resource, tick: @TickConfig, amount: u128) {
        self.harvest(ref resource, tick);
        self.consumption_rate += amount;
    }

    fn decrease_consumption_rate(ref self: Production, ref resource: Resource,tick: @TickConfig, amount: u128) {
        self.harvest(ref resource, tick);
        self.consumption_rate -= amount;
    }

    fn harvest(ref self: Production, ref resource: Resource, tick: @TickConfig) {
        let (sign, value) = self.net_rate();
        if sign {
            // harvest till you run out of material 
            let total = value * self.production_duration(ref resource, tick).into();
            resource.balance += total;
        } else {
            // deplete resource balance until empty
            let total = value * self.depletion_duration(ref resource, tick).into();
            if total >= resource.balance {
                resource.balance = 0;
            } else {
                resource.balance -= total;
            }
        }

        self.last_updated_tick = (*tick).current();
    }

    fn net_rate(self: Production) -> (bool, u128) {
        if !self.is_active() {
            return (false, 0);
        }
        let production_rate = self.actual_production_rate();
        if production_rate > self.consumption_rate {
            (true, production_rate - self.consumption_rate)
        } else {
            (false, self.consumption_rate - production_rate)
        }
    }

    fn set_materials_exhaustion_tick(
        ref self: Production, ref material_production: Production, 
        ref material_resource: Resource, tick: @TickConfig) 
        {
        
        if self.is_active() {

            let materials_exhaustion_tick 
                = material_production
                    .balance_exhaustion_tick(ref material_resource, tick);
            if self.last_updated_tick >= self.materials_exhaustion_tick {
                    self.materials_exhaustion_tick = materials_exhaustion_tick;
            } else {
                // stop sooner if need be
                if  materials_exhaustion_tick < self.materials_exhaustion_tick  {
                    self.materials_exhaustion_tick = materials_exhaustion_tick;
                }
            }
        
        }
    }

    // fn set_balance_exhaustion_tick(
    //     ref self: Production, ref resource: Resource, tick: @TickConfig) {
        
    //     self.balance_exhaustion_tick 
    //         = self.balance_exhaustion_tick(ref resource, tick);
    // }

    fn balance_exhaustion_tick(self: Production, ref resource: Resource, tick: @TickConfig) -> u64 {
        let current_tick = (*tick).current();

        let (sign, value) = self.net_rate();
        if value > 0 {
            if sign == false {
                let loss_per_tick = value;
                let num_ticks_left = resource.balance / loss_per_tick;
                return current_tick + num_ticks_left.try_into().unwrap();
            } else {
                return (*tick).at(BoundedInt::max());
            }
        } else {
            return (*tick).at(BoundedInt::max());
        }
    }

    fn production_duration(self: Production, ref resource: Resource, tick: @TickConfig) -> u64 {
        if self.last_updated_tick >= self.materials_exhaustion_tick {
            return 0;
        }
        let current_tick = (*tick).current();

        if self.materials_exhaustion_tick > current_tick {
            // if stop time is in future
            current_tick - self.last_updated_tick
        } else {
            // if stop time has passed
            self.materials_exhaustion_tick - self.last_updated_tick
        }
    }

    fn depletion_duration(self: Production, ref resource: Resource, tick: @TickConfig) -> u64 {
        if self.materials_exhaustion_tick >= self.last_updated_tick {
            // material exhaustion is in future
            return 0;
        }

        let exhaustion_tick 
            = self.materials_exhaustion_tick 
                + (self.last_updated_tick - self.materials_exhaustion_tick);
        let current_tick = (*tick).current();
        return current_tick - exhaustion_tick;
    }
}
