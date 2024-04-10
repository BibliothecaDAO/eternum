use core::debug::PrintTrait;
use core::option::OptionTrait;
use core::integer::BoundedInt;
use core::Zeroable;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use starknet::get_block_timestamp;
use eternum::models::resources::Resource;
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{ProductionConfig};

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
    input_exhaustion_tick: u64,
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
            // harvest till you run out of input materials
            let total = value * self.production_duration(tick).into();
            resource.balance += total;
        } else {
            // deplete resource balance until empty
            let total = value * self.depletion_duration(tick).into();
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

    fn set_input_exhaustion_tick(
        ref self: Production, input_production: @Production, 
        input_resource: @Resource, tick: @TickConfig) 
        {
        print!("abc");
        
        if self.is_active() {

            let input_exhaustion_tick 
                = input_production
                    .balance_exhaustion_tick(input_resource, tick);
            if self.last_updated_tick >= self.input_exhaustion_tick {
                if input_exhaustion_tick > self.last_updated_tick {
                    self.input_exhaustion_tick = input_exhaustion_tick;
                }
            } else {
                // stop sooner if need be
                if  input_exhaustion_tick < self.input_exhaustion_tick  {
                    self.input_exhaustion_tick = input_exhaustion_tick;
                }
            }
        
        }
    }


    fn balance_exhaustion_tick(self: @Production, resource: @Resource, tick: @TickConfig) -> u64 {
        let current_tick = (*tick).current();

        let (production_sign, production_value) = self.net_rate();
        if production_value > 0 {
            if production_sign == false {
                let loss_per_tick = production_value;
                let num_ticks_left = *resource.balance / loss_per_tick;
                return current_tick + num_ticks_left.try_into().unwrap();
            } else {
                return (*tick).at(BoundedInt::max());
            }
        } else {
            if *resource.balance > 0 {
                return (*tick).at(BoundedInt::max());
            } else {
                return (*tick).current();
            }
        }
    }

    fn production_duration(self: Production, tick: @TickConfig) -> u64 {
        if self.last_updated_tick >= self.input_exhaustion_tick {
            return 0;
        }
        let current_tick = (*tick).current();

        if self.input_exhaustion_tick > current_tick {
            // if stop time is in future
            current_tick - self.last_updated_tick
        } else {
            // if stop time has passed
            self.input_exhaustion_tick - self.last_updated_tick
        }
    }

    fn depletion_duration(self: Production, tick: @TickConfig) -> u64 {
        if self.input_exhaustion_tick > self.last_updated_tick {
            return 0;
        }

        let exhaustion_tick 
            = self.input_exhaustion_tick 
                + (self.last_updated_tick - self.input_exhaustion_tick);
        let current_tick = (*tick).current();
        return current_tick - exhaustion_tick;
    }
}




#[derive(Model, Copy, Drop, Serde)]
struct ProductionInput {
    #[key]
    output_resource_type: u8,
    #[key]
    index: u8, 
    input_resource_type: u8,
    input_resource_amount: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct ProductionOutput {
    #[key]
    input_resource_type: u8,
    #[key]
    index: u8, 
    output_resource_type: u8
}

#[generate_trait]
impl ProductionOutputImpl of ProductionOutputTrait {
    /// Updates end ticks for dependent resources based 
    /// on changes in this resource's balance.
    fn sync_input_exhaustion_ticks(
        resource: @Resource,
        world: IWorldDispatcher
    ) {
        let resource = *resource;
        // Get the production configuration of the current resource
        let resource_production_config: ProductionConfig =
            get!(world, resource.resource_type, ProductionConfig);

        // Get the production details of the current resource
        let mut resource_production: Production =
            get!(world, (resource.entity_id, resource.resource_type), Production);

        // Get the current tick from the world
        let tick = TickImpl::get(world);

        // Iterate through each dependent output resource
        let mut count = 0;
        loop {
            if count == resource_production_config.output_count {
                break;
            }

            // Get the output resource type from the production output configuration
            let output_resource_type: u8 =
                get!(world, (resource.resource_type, count), ProductionOutput)
                    .output_resource_type;

            // Get the production details of the output resource
            let mut output_resource_production: Production =
                get!(world, (resource.entity_id, output_resource_type), Production);

            // Update the end tick for the output resource based on changes in the current resource
            output_resource_production.set_input_exhaustion_tick(
                @resource_production,
                @resource,
                @tick
            );

            count += 1;

            // Save the updated production details of the output resource back to the world
            set!(world, (output_resource_production));
        }
    }
}


#[cfg(test)]
mod tests_production {

    use eternum::models::production::ProductionRateTrait;
    use core::option::OptionTrait;
    use super::{Production, Resource, ProductionBonusPercentageImpl};
    use debug::PrintTrait;
    use traits::Into;
    use traits::TryInto;
    use eternum::constants::{ResourceTypes};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use core::integer::BoundedInt;

    #[test]
    fn test_bonus() {

 
        let production_building_count = 2;
        let production_rate = 140;
        let production_bonus_percent = ProductionBonusPercentageImpl::_10(); // 10%
        let production_consumption_rate = 20;
        let production_last_updated_tick = 0;
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id: 'entity_id'.try_into().unwrap(),
            resource_type: ResourceTypes::WOOD,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };

        assert_eq!(wood_production.bonus(), 28);
    }


    #[test]
    fn test_balance_exhaustion_tick_with_positive_net_rate() {

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id,
            resource_type,
            balance: 300,
        };


        let production_building_count = 2;
        let production_rate = 12;
        let production_bonus_percent = 0; 
        let production_consumption_rate = 23;
        let production_last_updated_tick = 0;
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };

        let wood_production_input_exhaustion_tick 
            = wood_production
            .balance_exhaustion_tick(@wood_resource, @tick_config);

        let max_tick: u64 = tick_config.at(BoundedInt::max());
        assert_eq!(wood_production_input_exhaustion_tick, max_tick);
    }

    #[test]
    fn test_balance_exhaustion_tick_with_negative_net_rate() {

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id,
            resource_type,
            balance: 300,
        };


        let production_building_count = 2;
        let production_rate = 12;
        let production_bonus_percent = 0; 
        let production_consumption_rate = 25;
        let production_last_updated_tick = 0;
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };

        let wood_production_input_exhaustion_tick 
            = wood_production
            .balance_exhaustion_tick(@wood_resource, @tick_config);

        assert_eq!(wood_production_input_exhaustion_tick, 300);
    }

    #[test]
    fn test_balance_exhaustion_tick_with_0_net_rate_and_0_balance() {

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id,
            resource_type,
            balance: 0,
        };


        let production_building_count = 2;
        let production_rate = 12;
        let production_bonus_percent = 0; 
        let production_consumption_rate = 24;
        let production_last_updated_tick = 0;
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };

        let wood_production_input_exhaustion_tick 
            = wood_production
            .balance_exhaustion_tick(@wood_resource, @tick_config);

        let current_tick: u64 = tick_config.current();
        assert_eq!(wood_production_input_exhaustion_tick, current_tick);
    }


    #[test]
    fn test_balance_exhaustion_tick_with_0_net_rate_and_positive_balance() {

        let tick_id: u128 = 'tick_id'.try_into().unwrap();
        let tick_config = TickConfig {
            config_id: tick_id,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };

        let entity_id : u128 = 'resource_id'.try_into().unwrap();
        let resource_type: u8 = ResourceTypes::WOOD;
        let mut wood_resource: Resource = Resource {
            entity_id,
            resource_type,
            balance: 1,
        };


        let production_building_count = 2;
        let production_rate = 12;
        let production_bonus_percent = 0; 
        let production_consumption_rate = 24;
        let production_last_updated_tick = 0;
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };

        let wood_production_input_exhaustion_tick 
            = wood_production
            .balance_exhaustion_tick(@wood_resource, @tick_config);
        
        let max_tick: u64 = tick_config.at(BoundedInt::max());
        assert_eq!(wood_production_input_exhaustion_tick, max_tick);
    }

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
        let production_input_exhaustion_tick = _7_ticks_in_future;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
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
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
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
        let production_input_exhaustion_tick = 0;
        
        let mut wood_production: Production = Production {
            entity_id,
            resource_type,
            building_count: production_building_count,
            production_rate: production_rate,
            bonus_percent: production_bonus_percent,
            consumption_rate: production_consumption_rate,
            last_updated_tick: production_last_updated_tick,
            input_exhaustion_tick: production_input_exhaustion_tick
        };


        wood_production
            .set_input_exhaustion_tick(
                @wood_production, @wood_resource, @tick_config);

        assert_eq!(wood_production.input_exhaustion_tick, 300 / (12 -2) + 7); // 300 / (12 -2) + 7 ticks since were in the seventh tick

    }
}


#[cfg(test)]
mod tests_production_output {

    use eternum::models::production::ProductionRateTrait;
    use core::option::OptionTrait;
    use super::{Production, ProductionOutputImpl, Resource, ProductionBonusPercentageImpl};
    use debug::PrintTrait;
    use traits::Into;
    use traits::TryInto;
    use eternum::constants::{ResourceTypes};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use core::integer::BoundedInt;
    use eternum::utils::testing::{spawn_eternum, deploy_system};
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IProductionConfigDispatcher, IProductionConfigDispatcherTrait
    };
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    fn setup() -> (IWorldDispatcher, u128, u128, Span<(u8, u128)>) {
        let world = spawn_eternum();
        let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

        // set 
        let wood_cost = array![
            (ResourceTypes::WHEAT, 100), 
            (ResourceTypes::COAL, 200), 
            (ResourceTypes::STONE, 300), 
        ];
        let entity_id: u128 = 1;


        // set wheat production 

        let mut wheat_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::WHEAT,
            building_count: 1,
            production_rate: 7,
            bonus_percent: 0,
            consumption_rate: 2,
            last_updated_tick: 0,
            input_exhaustion_tick: 0
        };
        let mut wheat_resource: Resource = Resource {
            entity_id,
            resource_type: ResourceTypes::WHEAT,
            balance: 100
        };
        set!(world, (wheat_resource, wheat_production));

        // set coal production and resource

        // coal's consumption is higher than production so 
        // its balance will get depleted eventually
        let mut coal_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::COAL,
            building_count: 1,
            production_rate: 4,
            bonus_percent: 0,
            consumption_rate: 8,
            last_updated_tick: 0,
            input_exhaustion_tick: 0
        };

        let mut coal_resource: Resource =Resource {
            entity_id,
            resource_type: ResourceTypes::COAL,
            balance: 100
        };
        set!(world, (coal_resource, coal_production));


        // set stone production 

        let mut stone_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::STONE,
            building_count: 1,
            production_rate: 6,
            bonus_percent: 0,
            consumption_rate: 2,
            last_updated_tick: 0,
            input_exhaustion_tick: 0
        };
        let mut stone_resource: Resource =Resource {
            entity_id,
            resource_type: ResourceTypes::STONE,
            balance: 100
        };
        set!(world, (stone_resource, stone_production));

        // start wood production
        let wood_production_rate: u128 = 50;
        let mut wood_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::WOOD,
            building_count: 1,
            production_rate: wood_production_rate,
            bonus_percent: 0,
            consumption_rate: 2,
            last_updated_tick: 0,
            input_exhaustion_tick: 0
        };
        set!(world, (wood_production));

        IProductionConfigDispatcher { contract_address: config_systems_address }
            .set_production_config(ResourceTypes::WOOD, wood_production_rate, wood_cost.span());

        return (world, entity_id, wood_production_rate, wood_cost.span());
    }

    #[test]
    fn test_sync_input_exhaustion_ticks() {
        let (world, entity_id, _, _) = setup();


        let wheat_resource: Resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        let coal_resource: Resource = get!(world, (entity_id, ResourceTypes::COAL), Resource);
        let stone_resource: Resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);

        ProductionOutputImpl::sync_input_exhaustion_ticks(@wheat_resource, world);
        ProductionOutputImpl::sync_input_exhaustion_ticks(@coal_resource, world);
        ProductionOutputImpl::sync_input_exhaustion_ticks(@stone_resource, world);


        let coal_production: Production 
            = get!(world, (entity_id, ResourceTypes::COAL), Production);
        let coal_resource: Resource
            = get!(world, (entity_id, ResourceTypes::COAL), Resource);
        let tick_config : TickConfig = TickImpl::get(world);
        let coal_production_end 
            = coal_production
                .balance_exhaustion_tick(@coal_resource, @tick_config);
        let wood_production: Production 
            = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(coal_production_end, wood_production.input_exhaustion_tick);

    }
}
