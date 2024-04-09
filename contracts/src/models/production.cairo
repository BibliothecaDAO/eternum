use core::option::OptionTrait;
use core::integer::BoundedInt;
use core::Zeroable;
use dojo::world::{IWorldDispatcher};
use starknet::get_block_timestamp;
use eternum::models::resources::Resource;
use eternum::models::config::{TickConfig, TickImpl, TickTrait};

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
    end_tick: u64,
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

    fn is_active(self: @Production) -> bool {
        if ((*self).building_count.is_non_zero()) {
            return true;
        }
        return false;
    }

    fn set_rate(ref self: Production, production_rate: u128) {
        self.production_rate = production_rate;
    }


    fn bonus(self: @Production) -> u128 {
        (*self.production_rate * *self.building_count * *self.bonus_percent) 
            / ProductionBonusPercentageImpl::_100()
    }

    fn actual_production_rate(self: @Production) -> u128 {
        (*self.production_rate * *self.building_count) + self.bonus()
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
                    print!("\n prod {}\n", value);
                let c:u128 =  self.depletion_duration(ref resource, tick).into();
        print!("\n consum {}\n",  c);
            let total = value * self.depletion_duration(ref resource, tick).into();
            if total >= resource.balance {
                resource.balance = 0;
            } else {
                resource.balance -= total;
            }
        }

        self.last_updated_tick = (*tick).current();
    }

    fn net_rate(self: @Production) -> (bool, u128) {
        if !(*self).is_active() {
            return (false, 0);
        }
        let production_rate = self.actual_production_rate();


        if production_rate > *self.consumption_rate {
            (true, production_rate - *self.consumption_rate)
        } else {
            (false, *self.consumption_rate - production_rate)
        }
    }

    fn set_end_tick(
        ref self: Production, material_production: @Production, 
        material_resource: @Resource, tick: @TickConfig) 
        {
        
        if self.is_active() {

            let end_tick 
                = material_production
                    .balance_exhaustion_tick(material_resource, tick);

            if self.last_updated_tick >= self.end_tick {
                    self.end_tick = end_tick;
            } else {
                // stop sooner if need be
                if  end_tick < self.end_tick  {
                    self.end_tick = end_tick;
                }
            }
        
        }
    }


    fn balance_exhaustion_tick(self: @Production, resource: @Resource, tick: @TickConfig) -> u64 {
        let current_tick = (*tick).current();

        let (sign, value) = self.net_rate();
        if value > 0 {
            if sign == false {
                let loss_per_tick = value;
                let num_ticks_left = *resource.balance / loss_per_tick;
                return current_tick + num_ticks_left.try_into().unwrap();
            } else {
                return (*tick).at(BoundedInt::max());
            }
        } else {
            return (*tick).at(BoundedInt::max());
        }
    }

    fn production_duration(self: Production, ref resource: Resource, tick: @TickConfig) -> u64 {
        if self.last_updated_tick >= self.end_tick {
            return 0;
        }
        let current_tick = (*tick).current();

        if self.end_tick > current_tick {
            // if stop time is in future
            current_tick - self.last_updated_tick
        } else {
            // if stop time has passed
            self.end_tick - self.last_updated_tick
        }
    }

    fn depletion_duration(self: Production, ref resource: Resource, tick: @TickConfig) -> u64 {
        if self.end_tick > self.last_updated_tick {
            return 0;
        }

        let exhaustion_tick 
            = self.end_tick 
                + (self.last_updated_tick - self.end_tick);
        let current_tick = (*tick).current();
        return current_tick - exhaustion_tick;
    }
}



#[cfg(test)]
mod tests {

    use eternum::models::production::ProductionRateTrait;
use core::option::OptionTrait;
    use super::{Production, Resource, ProductionBonusPercentageImpl};
    use debug::PrintTrait;
    use traits::Into;
    use traits::TryInto;
    use eternum::constants::{ResourceTypes};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};

    #[test]
    fn test_harvest_gain() {

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        // move time 7 ticks in future
        let _7_ticks_in_future = tick_config.tick_interval_in_seconds * 7;
        starknet::testing::set_block_timestamp(_7_ticks_in_future);

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id: entity_id,
            resource_type,
            balance: 300,
        };


        let production_building_count = 2;
        let production_rate = 12;
        let production_bonus_percent = ProductionBonusPercentageImpl::_10(); // 10%
        let production_consumption_rate = 2;
        let production_last_updated_tick = 0;
        let production_end_tick = _7_ticks_in_future;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            end_tick: production_end_tick
        };


        wood_production.harvest(ref wood_resource, @tick_config);
        assert_eq!(wood_resource.balance, 300 + 168);
    }


    #[test]
    fn test_harvest_loss() {
        // consumption rate is higher than production

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        // move time 7 ticks in future
        let _7_ticks_in_future = tick_config.tick_interval_in_seconds * 7;
        starknet::testing::set_block_timestamp(_7_ticks_in_future);

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id: entity_id,
            resource_type,
            balance: 300,
        };


        let production_building_count = 1;
        let production_rate = 2;
        let production_bonus_percent = ProductionBonusPercentageImpl::_10(); // 10%
        let production_consumption_rate = 12;
        let production_last_updated_tick = 0;
        let production_end_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            end_tick: production_end_tick
        };


        wood_production.harvest(ref wood_resource, @tick_config);
        assert_eq!(wood_resource.balance, 300 - 70);
    }



    #[test]
    fn test_food_prod() {
        // consumption rate is higher than production

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        // move time 7 ticks in future
        let _7_ticks_in_future = tick_config.tick_interval_in_seconds * 7;
        starknet::testing::set_block_timestamp(_7_ticks_in_future);

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id: entity_id,
            resource_type,
            balance: 300,
        };


        let production_building_count = 1;
        let production_rate = 2;
        let production_bonus_percent = ProductionBonusPercentageImpl::_10(); // 10%
        let production_consumption_rate = 12;
        let production_last_updated_tick = 0;
        let production_end_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            end_tick: production_end_tick
        };


        wood_production
            .set_end_tick(
                @wood_production, @wood_resource, @tick_config);

        assert_eq!(wood_production.end_tick, 300 / (12 -2) + 7); // 300 / (12 -2) + 7 ticks since were in the seventh tick

    }
}