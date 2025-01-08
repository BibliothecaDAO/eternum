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
    labor_amount_left: u128,
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

    fn add_labor(ref self: Production, labor_amount: u128) {
        self.labor_amount_left += labor_amount;
    }
    
    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(
        ref self: Production, 
        ref resource: Resource, 
        tick: @TickConfig, 
        production_config: @ProductionConfig
    ) -> bool {

        // return false if production is not active
        if !(*self).has_building() {
            return false;
        }

        // check production duration
        let current_tick = (*tick).current();
        if self.labor_amount_left.is_non_zero() {

            // get total labor cost
            let labor_cost_per_tick = (*production_config).labor_amount;
            let ticks_left = self.labor_amount_left / (labor_cost_per_tick * self.building_count.into());
            let ticks_passed = current_tick - self.last_updated_tick;
            let duration_passed = core::cmp::min(ticks_passed, ticks_left);

            let total_labor_cost 
                = (duration_passed.into() 
                    * labor_cost_per_tick * self.building_count.into());

            // get total produced amount
            let total_produced_amount = duration_passed.into() * self.production_rate;

            // ensure that labor cost is set
            if total_produced_amount.is_non_zero() {
                assert!(total_labor_cost.is_non_zero(), 
                    "labor cost amount not set. cannot produce resource");
            }

            // update resource balance
            resource.balance += total_produced_amount;

            // update labor amount left
            self.labor_amount_left -= total_labor_cost;

            // update last updated tick
            self.last_updated_tick = current_tick;

            // todo add event here
            return true;
        }

        return false;
    }
}