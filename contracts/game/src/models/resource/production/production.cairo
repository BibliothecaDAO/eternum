use core::num::traits::Bounded;
use core::num::traits::zero::Zero;
use core::option::OptionTrait;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{ResourceFactoryConfig, TickImpl, TickTrait};

use s1_eternum::models::resource::resource::{ResourceList};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl,
    TroopResourceImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{StructureImpl, StructureOwnerStoreImpl};
use s1_eternum::models::weight::{Weight};
use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
use s1_eternum::utils::math::{PercentageValueImpl};
use s1_eternum::utils::math::{min};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ProductionBoostBonus {
    #[key]
    pub structure_id: ID,
    pub wonder_incr_percent_num: u16,
    pub incr_resource_rate_percent_num: u16,
    pub incr_labor_rate_percent_num: u16,
    pub incr_troop_rate_percent_num: u16,
    pub incr_resource_rate_end_tick: u32,
    pub incr_labor_rate_end_tick: u32,
    pub incr_troop_rate_end_tick: u32,
}


pub impl ProductionBoostBonusZeroable of Zero<ProductionBoostBonus> {
    fn is_zero(self: @ProductionBoostBonus) -> bool {
        self.wonder_incr_percent_num == @0
            && self.incr_resource_rate_percent_num == @0
            && self.incr_labor_rate_percent_num == @0
            && self.incr_troop_rate_percent_num == @0
            && self.incr_resource_rate_end_tick == @0
            && self.incr_labor_rate_end_tick == @0
            && self.incr_troop_rate_end_tick == @0
            && self.structure_id == @0
    }

    fn is_non_zero(self: @ProductionBoostBonus) -> bool {
        !self.is_zero()
    }

    fn zero() -> ProductionBoostBonus {
        ProductionBoostBonus {
            structure_id: 0,
            wonder_incr_percent_num: 0,
            incr_resource_rate_percent_num: 0,
            incr_labor_rate_percent_num: 0,
            incr_troop_rate_percent_num: 0,
            incr_resource_rate_end_tick: 0,
            incr_labor_rate_end_tick: 0,
            incr_troop_rate_end_tick: 0,
        }
    }
}
#[generate_trait]
pub impl ProductionBoostBonusImpl of ProductionBoostBonusTrait {
    fn include_bonuses(
        ref world: WorldStorage, structure_id: ID, resource_type: u8, original_produced_amount: u128, current_tick: u32,
    ) -> u128 {
        let mut total_amount: u128 = original_produced_amount;
        let mut production_boost_bonus: ProductionBoostBonus = world.read_model(structure_id);
        total_amount += (original_produced_amount * production_boost_bonus.wonder_incr_percent_num.into())
            / PercentageValueImpl::_100().into();

        // ensure bonus is not applied after the end of bonus tick
        if current_tick > production_boost_bonus.incr_resource_rate_end_tick {
            production_boost_bonus.incr_resource_rate_percent_num = 0;
        }
        if current_tick > production_boost_bonus.incr_labor_rate_end_tick {
            production_boost_bonus.incr_labor_rate_percent_num = 0;
        }
        if current_tick > production_boost_bonus.incr_resource_rate_end_tick {
            production_boost_bonus.incr_resource_rate_percent_num = 0;
        }

        // get bonus percent num for resource type
        let rate_bonus_percent_num = if resource_type == ResourceTypes::LABOR {
            production_boost_bonus.incr_labor_rate_percent_num
        } else if TroopResourceImpl::is_troop(resource_type) {
            production_boost_bonus.incr_troop_rate_percent_num
        } else {
            production_boost_bonus.incr_resource_rate_percent_num
        };

        // apply production bonus for resource rate
        total_amount += (original_produced_amount * rate_bonus_percent_num.into()) / PercentageValueImpl::_100().into();

        return total_amount;
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde, Default, PartialEq)]
pub struct Production {
    // active building count
    pub building_count: u8,
    // production rate per second
    pub production_rate: u64,
    // output amount left to be produced
    pub output_amount_left: u128,
    // last time this struct was updated
    pub last_updated_at: u32,
}

pub impl ProductionZeroable of Zero<Production> {
    #[inline(always)]
    fn zero() -> Production {
        Production { building_count: 0, production_rate: 0, output_amount_left: 0, last_updated_at: 0 }
    }
    #[inline(always)]
    fn is_zero(self: @Production) -> bool {
        self.building_count == @0
            && self.production_rate == @0
            && self.output_amount_left == @0
            && self.last_updated_at == @0
    }

    #[inline(always)]
    fn is_non_zero(self: @Production) -> bool {
        !self.is_zero()
    }
}


#[generate_trait]
pub impl ProductionImpl of ProductionTrait {
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
    fn set_last_updated_at(ref self: Production, seconds: u32) {
        self.last_updated_at = seconds;
    }

    #[inline(always)]
    fn is_free_production(resource_type: u8) -> bool {
        return StructureSingleResourceFoodImpl::is_food(resource_type);
    }

    // function must be called on every resource before querying their balance
    // to ensure that the balance is accurate
    fn harvest(ref resource: SingleResource) -> u128 {
        // get start time before updating last updated seconds
        let now: u32 = starknet::get_block_timestamp().try_into().unwrap();
        let start_at = resource.production.last_updated_at;

        // last updated time must always be updated
        resource.production.set_last_updated_at(now);

        // ensure lords can not be produced
        if resource.resource_type == ResourceTypes::LORDS {
            return 0;
        }
        // stop if production is not active
        if !resource.production.has_building() {
            return 0;
        }

        // total amount of time resources were produced for
        let num_seconds_produced: u128 = (now - start_at).into();
        let mut total_produced_amount = num_seconds_produced * resource.production.production_rate.into();

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
pub impl ProductionStrategyImpl of ProductionStrategyTrait {
    fn _grant_producer_achievement(
        ref world: WorldStorage, owner: starknet::ContractAddress, resource_type: u8, amount: u128,
    ) {
        if amount > RESOURCE_PRECISION {
            let mut amount_check_u32: u128 = amount / RESOURCE_PRECISION;
            let max_u32: u32 = Bounded::MAX;
            if amount_check_u32 > max_u32.into() {
                panic!("amount is too large. try producing in batches of <= 4 billion resources");
            }
            let amount_u32: u32 = amount_check_u32.try_into().unwrap();
            if resource_type == ResourceTypes::LABOR {
                AchievementTrait::progress(
                    world, owner.into(), Tasks::LABOR_PRODUCE, amount_u32, starknet::get_block_timestamp(),
                );
            } else if TroopResourceImpl::is_troop(resource_type) {
                if TroopResourceImpl::is_t2_troop(resource_type) {
                    AchievementTrait::progress(
                        world, owner.into(), Tasks::PRODUCE_T2, 1, starknet::get_block_timestamp(),
                    );
                }

                if TroopResourceImpl::is_t3_troop(resource_type) {
                    AchievementTrait::progress(
                        world, owner.into(), Tasks::PRODUCE_T3, 1, starknet::get_block_timestamp(),
                    );
                }
            } else {
                AchievementTrait::progress(
                    world, owner.into(), Tasks::RESOURCE_PRODUCE, amount_u32, starknet::get_block_timestamp(),
                );
            }
        }
    }


    // burn resource for production of labor
    fn burn_resource_for_labor_production(
        ref world: WorldStorage, from_entity_id: ID, from_resource_type: u8, from_resource_amount: u128,
    ) {
        assert!(from_resource_type.is_non_zero(), "wrong resource type");
        assert!(from_resource_amount.is_non_zero(), "zero resource amount");
        assert!(
            from_resource_amount % RESOURCE_PRECISION == 0,
            "resource amount must be exactly divisible by RESOURCE_PRECISION",
        );
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // ensure cost has been set for resource
        let from_resource_factory_config: ResourceFactoryConfig = world.read_model(from_resource_type);
        let from_resource_amount_without_precision = from_resource_amount / RESOURCE_PRECISION;
        let produced_labor_amount: u128 = from_resource_factory_config.labor_output_per_resource.into()
            * from_resource_amount_without_precision;
        assert!(produced_labor_amount.is_non_zero(), "resource can't be converted to labor");

        // remove the resource amount from from_resource balance
        let mut from_entity_weight: Weight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, from_resource_type);
        let mut from_resource: SingleResource = SingleResourceStoreImpl::retrieve(
            ref world, from_entity_id, from_resource_type, ref from_entity_weight, resource_weight_grams, true,
        );
        from_resource.spend(from_resource_amount, ref from_entity_weight, resource_weight_grams);
        from_resource.store(ref world);

        // add produceable labor amount to factory
        let labor_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LABOR);
        let mut from_labor_resource: SingleResource = SingleResourceStoreImpl::retrieve(
            ref world, from_entity_id, ResourceTypes::LABOR, ref from_entity_weight, labor_resource_weight_grams, true,
        );
        let mut from_labor_resource_production: Production = from_labor_resource.production;
        let current_tick: u32 = TickImpl::get_tick_interval(ref world).current().try_into().unwrap();
        let produced_labor_amount = ProductionBoostBonusImpl::include_bonuses(
            ref world, from_entity_id, ResourceTypes::LABOR, produced_labor_amount, current_tick,
        );
        from_labor_resource_production.increase_output_amout_left(produced_labor_amount);
        from_labor_resource.production = from_labor_resource_production;
        from_labor_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

        // grant achievement
        let from_entity_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_entity_id);
        Self::_grant_producer_achievement(ref world, from_entity_owner, ResourceTypes::LABOR, produced_labor_amount);
        // todo add event here
    }

    // burn labor for production of some other resource
    fn burn_labor_for_resource_production(
        ref world: WorldStorage, from_entity_id: ID, cycles: u128, produced_resource_type: u8,
    ) {
        assert!(cycles.is_non_zero(), "zero cycles");
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // ensure resource can be converted to labor
        let produced_resource_factory_config: ResourceFactoryConfig = world.read_model(produced_resource_type);
        let produced_resource_amount: u128 = produced_resource_factory_config.output_per_simple_input.into() * cycles;
        assert!(produced_resource_amount.is_non_zero(), "can't convert labor to specified resource");

        // burn labor and food from balance
        let produced_resource_factory_config: ResourceFactoryConfig = world.read_model(produced_resource_type);
        let payment_resources_id = produced_resource_factory_config.simple_input_list_id;
        let payment_resources_count = produced_resource_factory_config.simple_input_list_count;
        assert!(payment_resources_count.is_non_zero(), "labor can't be produced from specified resource");

        let mut from_entity_weight: Weight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        for i in 0..payment_resources_count {
            let payment_resource_cost: ResourceList = world.read_model((payment_resources_id, i));
            let payment_resource_type = payment_resource_cost.resource_type;
            let payment_resource_amount = payment_resource_cost.amount;
            assert!(payment_resource_amount.is_non_zero(), "payment resource cost is 0");

            // make payment for produced resource
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, payment_resource_type);
            let mut payment_resource = SingleResourceStoreImpl::retrieve(
                ref world, from_entity_id, payment_resource_type, ref from_entity_weight, resource_weight_grams, true,
            );
            payment_resource.spend(payment_resource_amount * cycles, ref from_entity_weight, resource_weight_grams);
            payment_resource.store(ref world);
        };

        // add produceable resource amount to factory
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleResourceStoreImpl::retrieve(
            ref world, from_entity_id, produced_resource_type, ref from_entity_weight, resource_weight_grams, true,
        );
        let mut produced_resource_production: Production = produced_resource.production;
        let current_tick: u32 = TickImpl::get_tick_interval(ref world).current().try_into().unwrap();
        let produced_resource_amount = ProductionBoostBonusImpl::include_bonuses(
            ref world, from_entity_id, produced_resource_type, produced_resource_amount, current_tick,
        );
        produced_resource_production.increase_output_amout_left(produced_resource_amount);
        produced_resource.production = produced_resource_production;
        produced_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

        // grant achievement
        let from_entity_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_entity_id);
        Self::_grant_producer_achievement(
            ref world, from_entity_owner, produced_resource_type, produced_resource_amount,
        );
        // todo add event here
    }


    // burn multiple other predefined resources for production of one resource
    // e.g burn stone, coal and copper for production of gold
    fn burn_resource_for_resource_production(
        ref world: WorldStorage, from_entity_id: ID, produced_resource_type: u8, cycles: u128,
    ) {
        assert!(produced_resource_type.is_non_zero(), "wrong resource type");
        assert!(cycles.is_non_zero(), "zero production seconds");
        assert!(from_entity_id.is_non_zero(), "zero entity id");

        // ensure there is a config for this labor resource
        let produced_resource_factory_config: ResourceFactoryConfig = world.read_model(produced_resource_type);
        let payment_resources_id = produced_resource_factory_config.complex_input_list_id;
        let payment_resources_count = produced_resource_factory_config.complex_input_list_count;
        assert!(payment_resources_count.is_non_zero(), "specified resource can't be produced from non labor resources");

        let mut from_entity_weight: Weight = WeightStoreImpl::retrieve(ref world, from_entity_id);
        for i in 0..payment_resources_count {
            let payment_resource_cost: ResourceList = world.read_model((payment_resources_id, i));
            let payment_resource_type = payment_resource_cost.resource_type;
            let payment_resource_amount = payment_resource_cost.amount;
            assert!(payment_resource_amount.is_non_zero(), "payment resource cost is 0");

            // make payment for produced resource
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, payment_resource_type);
            let mut payment_resource = SingleResourceStoreImpl::retrieve(
                ref world, from_entity_id, payment_resource_type, ref from_entity_weight, resource_weight_grams, true,
            );
            payment_resource.spend(payment_resource_amount * cycles, ref from_entity_weight, resource_weight_grams);
            payment_resource.store(ref world);
        };

        // add produced resource amount to factory
        let produced_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleResourceStoreImpl::retrieve(
            ref world,
            from_entity_id,
            produced_resource_type,
            ref from_entity_weight,
            produced_resource_weight_grams,
            true,
        );
        let mut produced_resource_production: Production = produced_resource.production;
        let produceable_amount = cycles * produced_resource_factory_config.output_per_complex_input.into();
        assert!(produceable_amount.is_non_zero(), "can't produce this resource in standard mode");

        // apply production boost bonus
        let current_tick: u32 = TickImpl::get_tick_interval(ref world).current().try_into().unwrap();
        let produceable_amount = ProductionBoostBonusImpl::include_bonuses(
            ref world, from_entity_id, produced_resource_type, produceable_amount, current_tick,
        );
        produced_resource_production.increase_output_amout_left(produceable_amount);
        produced_resource.production = produced_resource_production;
        produced_resource.store(ref world);

        // update entity weight
        from_entity_weight.store(ref world, from_entity_id);

        // grant achievement
        let from_entity_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_entity_id);
        Self::_grant_producer_achievement(ref world, from_entity_owner, produced_resource_type, produceable_amount);
        // todo add event here
    }
}
