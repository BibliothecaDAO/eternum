use core::Zeroable;
use core::debug::PrintTrait;
use core::integer::BoundedInt;
use core::option::OptionTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{ProductionConfig};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::resources::{Resource, ResourceImpl};
use starknet::get_block_timestamp;

#[derive(Model, Copy, Drop, Serde)]
struct Production {
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    building_count: u128,
    production_rate: u128,
    consumption_rate: u128,
    last_updated_tick: u64,
    input_finish_tick: u64,
}


// We could make this a nice JS Class with a constructor and everything
// Then maintaining logic in client will be easy
#[generate_trait]
impl ProductionRateImpl of ProductionRateTrait {
    fn is_active(self: @Production) -> bool {
        if ((*self).building_count.is_non_zero()) {
            return true;
        }
        if ((*self).consumption_rate.is_non_zero()) {
            return true;
        }
        return false;
    }

    fn increase_production_rate(
        ref self: Production, ref resource: Resource, tick: @TickConfig, amount: u128
    ) {
        self.harvest(ref resource, tick);
        self.production_rate += amount;
    }

    fn decrease_production_rate(
        ref self: Production, ref resource: Resource, tick: @TickConfig, amount: u128
    ) {
        self.harvest(ref resource, tick);
        self.production_rate -= amount;
    }

    fn increase_building_count(ref self: Production) {
        self.building_count += 1;
    }

    fn decrease_building_count(ref self: Production) {
        self.building_count -= 1;
    }

    fn increase_consumption_rate(
        ref self: Production, ref resource: Resource, tick: @TickConfig, amount: u128
    ) {
        self.harvest(ref resource, tick);
        self.consumption_rate += amount;
    }

    fn decrease_consumption_rate(
        ref self: Production, ref resource: Resource, tick: @TickConfig, amount: u128
    ) {
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

        if *self.production_rate > *self.consumption_rate {
            (true, *self.production_rate - *self.consumption_rate)
        } else {
            (false, *self.consumption_rate - *self.production_rate)
        }
    }


    fn set_input_finish_tick(
        ref self: Production, ref resource: Resource, tick: @TickConfig, value: u64
    ) {
        self.harvest(ref resource, tick);
        self.input_finish_tick = value;
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
        if self.last_updated_tick >= self.input_finish_tick {
            return 0;
        }
        let current_tick = (*tick).current();

        if self.input_finish_tick > current_tick {
            // if stop time is in future
            current_tick - self.last_updated_tick
        } else {
            // if stop time has passed
            self.input_finish_tick - self.last_updated_tick
        }
    }

    fn depletion_duration(self: Production, tick: @TickConfig) -> u64 {
        let current_tick = (*tick).current();
        return current_tick - self.last_updated_tick;
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

#[generate_trait]
impl ProductionInputImpl of ProductionInputTrait {
    /// Production ends when any input material runs out of balance so what this 
    /// function does is that it finds the first input resource to run out of balance that 
    /// returns the tick it runs out 
    fn first_input_finish_tick(production: @Production, world: IWorldDispatcher) -> u64 {
        let production_config = get!(world, *production.resource_type, ProductionConfig);
        let tick_config = TickImpl::get(world);

        let mut least_tick: u64 = BoundedInt::max();
        let mut count = 0;

        loop {
            if count == production_config.input_count {
                break;
            }
            let production_input: ProductionInput = get!(
                world, (*production.resource_type, count), ProductionInput
            );

            let mut input_resource: Resource = ResourceImpl::get(
                world, (*production.entity_id, production_input.input_resource_type)
            );

            let mut input_production: Production = get!(
                world, (*production.entity_id, production_input.input_resource_type), Production
            );
            let exhaustion_tick = input_production
                .balance_exhaustion_tick(@input_resource, @tick_config);
            if exhaustion_tick < least_tick {
                least_tick = exhaustion_tick;
            }

            count += 1;
        };

        return least_tick;
    }
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
    fn sync_all_inputs_exhaustion_ticks_for(resource: @Resource, world: IWorldDispatcher) {
        let resource = *resource;
        // Get the production configuration of the current resource
        let resource_production_config: ProductionConfig = get!(
            world, resource.resource_type, ProductionConfig
        );

        // Get the current tick from the world
        let tick = TickImpl::get(world);

        // Iterate through each dependent output resource
        let mut count = 0;
        loop {
            if count == resource_production_config.output_count {
                break;
            }

            // Get the output resource type from the production output configuration
            let output_resource_type: u8 = get!(
                world, (resource.resource_type, count), ProductionOutput
            )
                .output_resource_type;

            let mut output_resource: Resource = get!(
                world, (resource.entity_id, output_resource_type), Resource
            );

            // Get the production details of the output resource
            let mut output_resource_production: Production = get!(
                world, (resource.entity_id, output_resource_type), Production
            );

            // Update the end tick for the output resource based on changes in the current resource
            let output_resource_finish_tick = ProductionInputImpl::first_input_finish_tick(
                @output_resource_production, world
            );
            output_resource_production
                .set_input_finish_tick(ref output_resource, @tick, output_resource_finish_tick);

            count += 1;

            // Save the updated production details of the output resource back to the world
            set!(world, (output_resource, output_resource_production));
        }
    }
}

