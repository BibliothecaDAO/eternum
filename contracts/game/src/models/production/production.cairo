use core::Zeroable;
use core::debug::PrintTrait;
use core::num::traits::Bounded;
use core::option::OptionTrait;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s0_eternum::alias::ID;
use s0_eternum::models::config::{ProductionConfig};
use s0_eternum::models::config::{TickConfig, TickImpl, TickTrait};
use s0_eternum::models::resources::{Resource, ResourceImpl};
use starknet::get_block_timestamp;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Production {
    #[key]
    entity_id: ID,
    #[key]
    resource_type: u8,
    building_count: u8,
    production_rate: u128,
    labor_finish_tick: u32,
    last_updated_tick: u32,
}

// We could make this a nice JS Class with a constructor and everything
// Then maintaining logic in client will be easy
#[generate_trait]
impl ProductionImpl of ProductionTrait {
    fn has_building(self: @Production) -> bool {
        if ((*self).building_count.is_non_zero()) {
            return true;
        }
        return false;
    }

    fn increase_building_count(ref self: Production) {
        self.building_count += 1;
    }

    fn decrease_building_count(ref self: Production) {
        self.building_count -= 1;
    }

    fn increase_production_rate(ref self: Production, production_rate: u128) {
        self.production_rate += production_rate;
    }

    fn decrease_production_rate(ref self: Production, production_rate: u128) {
        self.production_rate -= production_rate;
    }
    

    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(
        ref self: Production, 
        ref resource: Resource, 
        ref resource_labor: Resource, 
        tick: @TickConfig, 
        production_config: @ProductionConfig
    ) -> bool {

        // return false if production is not active
        if !(*self).has_building() {
            return false;
        }   

        // check production duration
        let current_tick = (*tick).current();
        let production_duration = self.production_duration(current_tick);

        if production_duration.is_non_zero() {
            let labor_cost_per_tick = (*production_config).labor_amount;
    
            let total_produced_amount = production_duration.into() * self.production_rate;
            let total_labor_cost 
                = (production_duration.into() 
                    * labor_cost_per_tick * self.building_count.into());

            if total_produced_amount.is_non_zero() {
                assert!(total_labor_cost.is_non_zero(), 
                    "labor cost amount not set. cannot produce resource");
            }

            resource.balance += total_produced_amount;
            resource_labor.balance -= total_labor_cost;
            self.last_updated_tick = current_tick;

            // todo add event here
            return true;
        }

        return false;
    }


    fn production_duration(self: Production, current_tick: u64) -> u64 {
        if self.last_updated_tick >= self.labor_finish_tick {
            return 0;
        }
        if self.labor_finish_tick > current_tick {
            // if stop time is in future
            current_tick - self.last_updated_tick
        } else {
            // if stop time has passed
            self.labor_finish_tick - self.last_updated_tick
        }
    }
}

#[generate_trait]
impl ProductionLaborImpl of ProductionLaborTrait {

    // Update the labor_finish_tick of the connected production
    // to ensure that production stops when labor resource is depleted
    //
    // function must be called everytime a labor resource type is updated
    // to ensure that production stops when labor resource is depleted
    //
    // note: we expect connected_production.harvest() to have been called
    // before this function is called
    //
    fn update_connected_production(
        ref labor: Resource, 
        ref connected_production: Production, 
        tick: @TickConfig, 
        production_config: @ProductionConfig
    ) {
        match connected_production.has_building() {
            true => {
                let labor_cost_per_tick = (*production_config).labor_amount;
                assert!(labor_cost_per_tick.is_non_zero(), "labor cost amount not set");

                let labor_tick_amount = labor.balance / labor_cost_per_tick;
                connected_production.labor_finish_tick = (*tick).current() + labor_tick_amount;
                connected_production.last_updated_tick = (*tick).current();
            }
            false => {
                connected_production.labor_finish_tick = (*tick).current();
                connected_production.last_updated_tick = (*tick).current();
            }
        }

        // todo add event here
        // todo make production deadline a function of labor 
    }
    
}