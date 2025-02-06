use core::Zeroable;
use core::debug::PrintTrait;
use core::num::traits::Bounded;
use core::option::OptionTrait;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::models::config::{ProductionConfig, LaborBurnPrStrategy, MultipleResourceBurnPrStrategy};
use s1_eternum::models::config::{TickConfig, TickImpl, TickTrait};
use s1_eternum::models::resource::resource::{
    Resource, RESOURCE_PRECISION, ResourceImpl, ResourceTypes, ResourceFoodImpl, ResourceCost
};
use s1_eternum::models::structure::{Structure, StructureTrait, StructureImpl, StructureCategory};
use s1_eternum::utils::math::{min};
use starknet::get_block_timestamp;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct Production {
    // active building count
    building_count: u8,
    // production rate per tick
    production_rate: u128,
    // output amount left to be produced
    output_amount_left: u128,
    // last time this struct was updated
    last_updated_tick: u32,
}

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


    #[inline(always)]
    fn increase_output_amout_left(ref self: Production, amount: u128) {
        self.output_amount_left += amount;
    }

    #[inline(always)]
    fn decrease_output_amout_left(ref self: Production, amount: u128) {
        self.output_amount_left -= amount;
    }

    #[inline(always)]
    fn set_last_updated_tick(ref self: Production, tick: u32) {
        self.last_updated_tick = tick;
    }

    #[inline(always)]
    fn is_free_production(resource_type: u8) -> bool {
        return ResourceFoodImpl::is_food(resource_type);
    }

    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(
        ref self: Production, ref resource: Resource, tick: @TickConfig, production_config: @ProductionConfig
    ) -> bool {
        // get start tick before updating last updated tick
        let start_tick = self.last_updated_tick;

        // last updated tick must always be updated
        let current_tick = (*tick).current();
        self.set_last_updated_tick(current_tick.try_into().unwrap());

        // ensure lords can not be produced
        if resource.resource_type == ResourceTypes::LORDS {
            return false;
        }
        // stop if production is not active
        if !self.has_building() {
            return false;
        }

        // total amount of time resources were produced for
        let num_ticks_produced: u128 = current_tick.into() - start_tick.into();
        let mut total_produced_amount = num_ticks_produced * self.production_rate;

        // limit amount of resources produced by the output amount left
        if !Self::is_free_production(resource.resource_type) {
            total_produced_amount = min(total_produced_amount, self.output_amount_left);
            self.decrease_output_amout_left(total_produced_amount);
        }

        // update resource balance
        resource.add(total_produced_amount);

        // todo add event here
        return total_produced_amount.is_non_zero();
    }
}


#[generate_trait]
impl ProductionStrategyImpl of ProductionStrategyTrait {
    // burn other resource for production of labor
    fn burn_other_resource_for_labor_production(
        ref world: WorldStorage, from_entity_id: ID, from_resource_type: u8, from_resource_amount: u128
    ) {
        assert!(from_resource_type.is_non_zero(), "wrong resource type");
        assert!(from_resource_amount.is_non_zero(), "zero resource amount");
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // ensure rarity has been set for resource
        let from_resource_production_config: ProductionConfig = world.read_model(from_resource_type);
        let from_resource_labor_burn_strategy: LaborBurnPrStrategy = from_resource_production_config
            .labor_burn_strategy;
        assert!(
            from_resource_labor_burn_strategy.resource_rarity.is_non_zero(), "resource can't be converted to labor"
        );

        // remove the resource amount from from_resource balance
        let mut from_resource = ResourceImpl::get(ref world, (from_entity_id, from_resource_type));
        from_resource.burn(from_resource_amount);
        from_resource.save(ref world);

        // increase labor balance of the entity
        let produced_labor_amount: u128 = from_resource_amount * from_resource_labor_burn_strategy.resource_rarity;
        let mut labor_resource = ResourceImpl::get(ref world, (from_entity_id, ResourceTypes::LABOR));
        let mut labor_resource_production = labor_resource.production;
        labor_resource_production.increase_output_amout_left(produced_labor_amount);
        labor_resource.production = labor_resource_production;
        labor_resource.save(ref world);
        // todo add event here
    }

    // burn labor for production of some other resource
    fn burn_labor_resource_for_other_production(
        ref world: WorldStorage, from_entity_id: ID, labor_amount: u128, produced_resource_type: u8
    ) {
        assert!(labor_amount % RESOURCE_PRECISION == 0, "labor amount must be exactly divisible by RESOURCE_PRECISION");
        assert!(labor_amount.is_non_zero(), "zero labor amount");
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // burn labor from balance
        let mut labor_resource = ResourceImpl::get(ref world, (from_entity_id, ResourceTypes::LABOR));
        labor_resource.burn(labor_amount);
        labor_resource.save(ref world);

        // ensure rarity has been set for resource
        let produced_resource_production_config: ProductionConfig = world.read_model(produced_resource_type);
        let produced_resource_labor_burn_strategy: LaborBurnPrStrategy = produced_resource_production_config
            .labor_burn_strategy;
        assert!(
            produced_resource_labor_burn_strategy.resource_rarity.is_non_zero(),
            "can't convert labor to specified resource"
        );

        // burn wheat and fish
        let wheat_burn_amount: u128 = labor_amount
            / RESOURCE_PRECISION
            * produced_resource_labor_burn_strategy.wheat_burn_per_labor;
        let fish_burn_amount: u128 = labor_amount
            / RESOURCE_PRECISION
            * produced_resource_labor_burn_strategy.fish_burn_per_labor;
        ResourceFoodImpl::pay(ref world, from_entity_id, wheat_burn_amount, fish_burn_amount);

        // get the amount of produced resource the specified labor can create
        let produced_resource_rarity: u128 = produced_resource_labor_burn_strategy.resource_rarity * RESOURCE_PRECISION;
        let produced_resource_depreciation_num: u128 = produced_resource_labor_burn_strategy
            .depreciation_percent_num
            .into();
        let produced_resource_depreciation_denom: u128 = produced_resource_labor_burn_strategy
            .depreciation_percent_denom
            .into();
        let produced_resource_depreciation_diff: u128 = (produced_resource_depreciation_denom
            - produced_resource_depreciation_num);
        let produced_resource_amount: u128 = (labor_amount
            * produced_resource_depreciation_diff
            / produced_resource_rarity
            / produced_resource_depreciation_denom);

        // add produced resource amount to factory
        let mut produced_resource = ResourceImpl::get(ref world, (from_entity_id, produced_resource_type));
        let mut produced_resource_production = produced_resource.production;
        produced_resource_production.increase_output_amout_left(produced_resource_amount);
        produced_resource.production = produced_resource_production;
        produced_resource.save(ref world);
        // todo add event here
    }


    // burn multiple other predefined resources for production of one resource
    // e.g burn stone, coal and copper for production of gold
    fn burn_other_predefined_resources_for_resource(
        ref world: WorldStorage, from_entity_id: ID, produced_resource_type: u8, production_tick_count: u128
    ) {
        assert!(produced_resource_type.is_non_zero(), "wrong resource type");
        assert!(production_tick_count.is_non_zero(), "zero production tick count");
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // ensure there is a config for this labor resource
        let produced_resource_production_config: ProductionConfig = world.read_model(produced_resource_type);
        let produced_resource_multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy =
            produced_resource_production_config
            .multiple_resource_burn_strategy;
        let other_resources_count = produced_resource_multiple_resource_burn_strategy.required_resources_count;
        let other_resources_id = produced_resource_multiple_resource_burn_strategy.required_resources_id;
        assert!(other_resources_count.is_non_zero(), "specified resource can't be produced from other resources");

        for i in 0
            ..other_resources_count {
                let other_resource_cost: ResourceCost = world.read_model((other_resources_id, i));
                let other_resource_type = other_resource_cost.resource_type;
                let other_resource_amount = other_resource_cost.amount;
                assert!(other_resource_amount.is_non_zero(), "specified resource cost is 0");

                // make payment for produced resource
                let mut other_resource = ResourceImpl::get(ref world, (from_entity_id, other_resource_type));
                other_resource.burn(other_resource_amount * production_tick_count);
                other_resource.save(ref world);
            };

        // add produced resource amount to factory
        let mut produced_resource = ResourceImpl::get(ref world, (from_entity_id, produced_resource_type));
        let mut produced_resource_production = produced_resource.production;
        produced_resource_production.increase_output_amout_left(production_tick_count * RESOURCE_PRECISION);
        produced_resource.production = produced_resource_production;
        produced_resource.save(ref world);
        // todo add event here
    }
}
