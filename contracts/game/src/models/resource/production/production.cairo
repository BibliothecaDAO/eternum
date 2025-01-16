use core::Zeroable;
use core::debug::PrintTrait;
use core::num::traits::Bounded;
use core::option::OptionTrait;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::models::config::{ProductionConfig};
use s1_eternum::models::config::{TickConfig, TickImpl, TickTrait};
use s1_eternum::models::resource::resource::{Resource, ResourceImpl, ResourceTypes};
use starknet::get_block_timestamp;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct Production {
    // active building count
    building_count: u8,
    // production rate per tick
    production_rate: u128,
    // labor units left for production
    labor_units_left: u64,
    // last tick updated
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

    fn use_labor(ref self: Production, production_config: @ProductionConfig, labor_amount: u128) {
        // assert!(self.resource_type == *production_config.resource_type, "mismatched resource type when using labor");
        assert!(labor_amount.is_non_zero(), "zero labor amount");
        assert!(
            labor_amount % (*production_config).labor_cost == 0, "labor amount not exactly divisible by labor cost"
        );

        let additional_labor_units: u64 = (labor_amount / (*production_config).labor_cost).try_into().unwrap();
        self.labor_units_left += additional_labor_units;
    }

    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(
        ref self: Production, ref resource: Resource, tick: @TickConfig, production_config: @ProductionConfig
    ) -> bool {
        // return false if production is not active
        if !self.has_building() {
            return false;
        }

        // check production duration
        let current_tick = (*tick).current();
        if self.labor_units_left.is_non_zero() {
            // total units produced by all buildings
            let mut labor_units_burned: u128 = (current_tick.into() - self.last_updated_tick.into())
                * self.building_count.into();

            // limit units produced to labor units left
            if labor_units_burned > self.labor_units_left.into() {
                labor_units_burned = self.labor_units_left.into();
            }

            // get total produced amount
            let total_produced_amount: u128 = labor_units_burned * self.production_rate;

            // ensure lords can not be produced by any means
            assert!(resource.resource_type != ResourceTypes::LORDS, "lords can not be produced");

            // update resource balance
            resource.balance += total_produced_amount;

            // update labor cycles left
            self.labor_units_left -= labor_units_burned.try_into().unwrap();

            // update last updated tick
            self.last_updated_tick = current_tick.try_into().unwrap();

            // todo add event here
            return true;
        }

        return false;
    }
}
