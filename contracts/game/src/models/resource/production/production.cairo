use core::Zeroable;
use core::debug::PrintTrait;
use core::num::traits::Bounded;
use core::option::OptionTrait;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{W3eightConfig, TickImpl};
use s1_eternum::models::config::{ProductionConfig, LaborBurnPrStrategy, MultipleResourceBurnPrStrategy};
use s1_eternum::models::resource::r3esource::{
    SingleR33esource, SingleR33esourceImpl, SingleR33esourceStoreImpl, 
    WeightStoreImpl, WeightUnitImpl,
    StructureSingleR33esourceFoodImpl
};
use s1_eternum::models::resource::resource::{ResourceCost};
use s1_eternum::models::structure::{Structure, StructureTrait, StructureImpl, StructureCategory};
use s1_eternum::models::weight::{W3eight};
use s1_eternum::utils::math::{min};
use starknet::get_block_timestamp;

#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
pub struct Production {
    // active building count
    building_count: u8,
    // production rate per tick
    production_rate: u64,
    // output amount left to be produced
    output_amount_left: u128,
    // last time this struct was updated
    last_updated_tick: u32,
}

impl ProductionZeroable of Zeroable<Production> {
    #[inline(always)]
    fn zero() -> Production {
        Production { building_count: 0, production_rate: 0, output_amount_left: 0, last_updated_tick: 0 }
    }
    #[inline(always)]
    fn is_zero(self: Production) -> bool {
        self.building_count == 0 && self.production_rate == 0 && self.output_amount_left == 0 && self.last_updated_tick == 0
    }

    #[inline(always)]
    fn is_non_zero(self: Production) -> bool {
        !self.is_zero()
    }
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

    fn increase_production_rate(ref self: Production, production_rate: u64) {
        self.production_rate += production_rate;
    }

    fn decrease_production_rate(ref self: Production, production_rate: u64) {
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
        return StructureSingleR33esourceFoodImpl::is_food(resource_type);
    }

    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(ref resource: SingleR33esource, current_tick: u32) -> u128 {
        // get start tick before updating last updated tick
        let start_tick = resource.production.last_updated_tick;

        // last updated tick must always be updated
        resource.production.set_last_updated_tick(current_tick.try_into().unwrap());

        // ensure lords can not be produced
        if resource.resource_type == ResourceTypes::LORDS {return 0;}
        // stop if production is not active
        if !resource.production.has_building() {return 0;}

        // total amount of time resources were produced for
        let num_ticks_produced: u128 = current_tick.into() - start_tick.into();
        let mut total_produced_amount = num_ticks_produced * resource.production.production_rate.into();

        // limit amount of resources produced by the output amount left
        if !Self::is_free_production(resource.resource_type) {
            total_produced_amount = min(total_produced_amount, resource.production.output_amount_left);
            resource.production.decrease_output_amout_left(total_produced_amount);
        }

        // todo add event here

        // return the amount of resources produced. 
        // which is used to update the resource balance
        return total_produced_amount;
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
        let current_tick: u32 = TickImpl::get_default_tick_config(ref world).current().try_into().unwrap();
        let mut from_entity_weight: W3eight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, from_resource_type);
        let mut from_resource: SingleR33esource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, from_resource_type, ref from_entity_weight, resource_weight_grams, Option::Some(current_tick)
        );
        from_resource.spend(from_resource_amount, ref from_entity_weight, resource_weight_grams);
        from_resource.store(ref world);

        // increase labor balance of the entity
        let labor_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::LABOR);
        let mut from_labor_resource: SingleR33esource 
            = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, ResourceTypes::LABOR, ref from_entity_weight, labor_resource_weight_grams, Option::Some(current_tick)
        );
        let mut from_labor_resource_production: Production = from_labor_resource.production;
        let produced_labor_amount: u128 = from_resource_amount * from_resource_labor_burn_strategy.resource_rarity;
        from_labor_resource_production.increase_output_amout_left(produced_labor_amount);
        from_labor_resource.production = from_labor_resource_production;
        from_labor_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

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
        let current_tick: u32 = TickImpl::get_default_tick_config(ref world).current().try_into().unwrap();
        let mut from_entity_weight: W3eight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        let labor_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::LABOR);
        let mut labor_resource: SingleR33esource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, ResourceTypes::LABOR, ref from_entity_weight, labor_resource_weight_grams, Option::Some(current_tick)
        );
        labor_resource.spend(labor_amount, ref from_entity_weight, labor_resource_weight_grams);
        labor_resource.store(ref world);

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
        
        // spend wheat resource
        let wheat_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::WHEAT);
        let mut wheat_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, ResourceTypes::WHEAT, ref from_entity_weight, wheat_weight_grams, Option::Some(current_tick)
        );
        wheat_resource.spend(wheat_burn_amount, ref from_entity_weight, wheat_weight_grams);
        wheat_resource.store(ref world);

        // spend fish resource
        let fish_weight_grams: u128 = WeightUnitImpl::grams(ref world, ResourceTypes::FISH);
        let mut fish_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, ResourceTypes::FISH, ref from_entity_weight, fish_weight_grams, Option::Some(current_tick)
        );
        fish_resource.spend(fish_burn_amount, ref from_entity_weight, fish_weight_grams);
        fish_resource.store(ref world);


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
        let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, produced_resource_type, ref from_entity_weight, resource_weight_grams, Option::Some(current_tick)
        );
        let mut produced_resource_production: Production = produced_resource.production;
        produced_resource_production.increase_output_amout_left(produced_resource_amount);
        produced_resource.production = produced_resource_production;
        produced_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

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

        let current_tick: u32 = TickImpl::get_default_tick_config(ref world).current().try_into().unwrap();
        let mut from_entity_weight: W3eight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        for i in 0
            ..other_resources_count {
                let other_resource_cost: ResourceCost = world.read_model((other_resources_id, i));
                let other_resource_type = other_resource_cost.resource_type;
                let other_resource_amount = other_resource_cost.amount;
                assert!(other_resource_amount.is_non_zero(), "specified resource cost is 0");

                // make payment for produced resource
                let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, other_resource_type);
                let mut other_resource = SingleR33esourceStoreImpl::retrieve(
                    ref world, from_entity_id, other_resource_type, ref from_entity_weight, resource_weight_grams, Option::Some(current_tick)
                );
                other_resource.spend(other_resource_amount * production_tick_count, ref from_entity_weight, resource_weight_grams);
                other_resource.store(ref world);
            };


        // add produced resource amount to factory
        let produced_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleR33esourceStoreImpl::retrieve(
            ref world, from_entity_id, produced_resource_type, ref from_entity_weight, produced_resource_weight_grams, Option::Some(current_tick)
        );
        let mut produced_resource_production: Production = produced_resource.production;
        produced_resource_production.increase_output_amout_left(production_tick_count * RESOURCE_PRECISION);
        produced_resource.production = produced_resource_production;
        produced_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

        // todo add event here
    }
}
