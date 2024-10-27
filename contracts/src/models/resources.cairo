use core::fmt::{Display, Formatter, Error};
use core::num::traits::Bounded;
use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{
    get_resource_probabilities, RESOURCE_PRECISION, GRAMS_PER_KG, ResourceTypes, resource_type_name, WORLD_CONFIG_ID
};
use eternum::models::buildings::{Building, BuildingCustomTrait, BuildingCategory, BuildingQuantityv2};
use eternum::models::config::{
    ProductionConfig, TickConfig, TickImpl, TickTrait, CapacityConfig, CapacityConfigCategory, CapacityConfigCustomTrait
};
use eternum::models::config::{WeightConfigCustomImpl, WeightConfig};

use eternum::models::production::{Production, ProductionOutputCustomImpl, ProductionRateTrait};
use eternum::models::realm::Realm;
use eternum::models::structure::StructureCustomTrait;
use eternum::models::structure::{Structure, StructureCategory};
use eternum::utils::math::{is_u256_bit_set, set_u256_bit, min};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Resource {
    #[key]
    entity_id: ID,
    #[key]
    resource_type: u8,
    balance: u128,
}

impl ResourceDisplay of Display<Resource> {
    fn fmt(self: @Resource, ref f: Formatter) -> Result<(), Error> {
        let str: ByteArray = format!(
            "Resource (entity id: {}, resource type: {}, balance: {})",
            *self.entity_id,
            resource_type_name(*self.resource_type),
            *self.balance
        );
        f.buffer.append(@str);
        Result::Ok(())
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ResourceAllowance {
    #[key]
    owner_entity_id: ID,
    #[key]
    approved_entity_id: ID,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ResourceCost {
    #[key]
    entity_id: ID,
    #[key]
    index: u32,
    resource_type: u8,
    amount: u128
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct DetachedResource {
    #[key]
    entity_id: ID,
    #[key]
    index: u32,
    resource_type: u8,
    resource_amount: u128
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct OwnedResourcesTracker {
    #[key]
    entity_id: ID,
    resource_types: u256
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ResourceTransferLock {
    #[key]
    entity_id: ID,
    start_at: u64,
    release_at: u64,
}


#[generate_trait]
impl ResourceTransferLockCustomImpl of ResourceTransferLockCustomTrait {
    fn assert_not_locked(self: ResourceTransferLock) {
        assert!(self.is_open(), "resource locked for entity {}", self.entity_id);
    }

    fn assert_locked(self: ResourceTransferLock) {
        assert!(!self.is_open(), "resource NOT locked for entity {}", self.entity_id);
    }

    fn is_open(self: ResourceTransferLock) -> bool {
        let now = starknet::get_block_timestamp();
        if self.start_at.is_non_zero() {
            if now < self.start_at {
                return true;
            }
        }
        now >= self.release_at
    }
}


#[generate_trait]
impl ResourceFoodImpl of ResourceFoodTrait {
    fn is_food(resource_type: u8) -> bool {
        resource_type == ResourceTypes::WHEAT || resource_type == ResourceTypes::FISH
    }

    fn get(world: IWorldDispatcher, entity_id: ID) -> (Resource, Resource) {
        let wheat = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::WHEAT));
        let fish = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::FISH));
        (wheat, fish)
    }

    /// Fails if the paid amount is insufficient
    fn pay(world: IWorldDispatcher, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128,) {
        let (mut wheat, mut fish) = Self::get(world, entity_id);

        if wheat_amount > wheat.balance {
            panic!("Insufficient wheat balance");
        }
        wheat.burn(wheat_amount);
        wheat.save(world);

        if fish_amount > fish.balance {
            panic!("Insufficient fish balance");
        }
        fish.burn(fish_amount);
        fish.save(world);
    }

    /// Does not fail even if amount is insufficient
    fn burn(world: IWorldDispatcher, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128,) {
        let mut wheat: Resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::WHEAT));
        let mut fish: Resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::FISH));

        if wheat_amount > wheat.balance {
            wheat_amount = wheat.balance
        }
        wheat.burn(wheat_amount);
        wheat.save(world);

        if fish_amount > fish.balance {
            fish_amount = fish.balance
        }
        fish.burn(fish_amount);
        fish.save(world);
    }
}

#[generate_trait]
impl ResourceCustomImpl of ResourceCustomTrait {
    fn get(world: IWorldDispatcher, key: (ID, u8)) -> Resource {
        let mut resource: Resource = get!(world, key, Resource);
        assert!(resource.resource_type.is_non_zero(), "resource type not found");
        assert!(resource.entity_id.is_non_zero(), "entity id not found");

        resource.harvest(world);
        return resource;
    }

    fn burn(ref self: Resource, amount: u128) {
        if self.entity_id == 0 {
            return;
        };

        assert!(self.balance >= amount, "not enough resources, {}. deduction: {}", self, amount);

        if amount > self.balance {
            self.balance = 0;
        } else {
            self.balance -= amount;
        }
    }

    fn add(ref self: Resource, amount: u128) {
        if self.entity_id == 0 {
            return;
        };
        self.balance += amount;
    }

    fn save(ref self: Resource, world: IWorldDispatcher) {
        if self.entity_id == 0 {
            return;
        };

        // ensure realm has enough store houses to keep resource balance
        let entity_structure: Structure = get!(world, self.entity_id, Structure);
        let entity_is_structure = entity_structure.is_structure();
        if entity_is_structure {
            self.limit_balance_by_storehouse_capacity(world);
        }

        // save the updated resource
        set!(world, (self));

        if entity_is_structure {
            // sync end ticks of resources that use this resource in their production
            // e.g `self` may be wheat resource and is stone, coal and gold are used
            // in production of wheat, we update their exhaustion ticks
            ProductionOutputCustomImpl::sync_all_inputs_exhaustion_ticks_for(@self, world);
        }

        // Update the entity's owned resources tracker

        let mut entity_owned_resources = get!(world, self.entity_id, OwnedResourcesTracker);

        if self.balance == 0 {
            if entity_owned_resources.owns_resource_type(self.resource_type) {
                entity_owned_resources.set_resource_ownership(self.resource_type, false);
                set!(world, (entity_owned_resources));
            }
        } else {
            if !entity_owned_resources.owns_resource_type(self.resource_type) {
                entity_owned_resources.set_resource_ownership(self.resource_type, true);
                set!(world, (entity_owned_resources));
            }
        }
    }

    fn limit_balance_by_storehouse_capacity(ref self: Resource, world: IWorldDispatcher) {
        let entity_structure: Structure = get!(world, self.entity_id, Structure);
        if entity_structure.category != StructureCategory::Realm {
            return;
        }

        let resource_weight_config = get!(world, (WORLD_CONFIG_ID, self.resource_type), WeightConfig);

        let storehouse_building_quantity: BuildingQuantityv2 = get!(
            world, (self.entity_id, BuildingCategory::Storehouse), BuildingQuantityv2
        );
        let storehouse_capacity_grams = get!(world, CapacityConfigCategory::Storehouse, CapacityConfig).weight_gram;
        let storehouse_capacity_grams = storehouse_capacity_grams
            + (storehouse_building_quantity.value.into() * storehouse_capacity_grams);

        if (resource_weight_config.weight_gram == 0) {
            self.balance = min(self.balance, storehouse_capacity_grams);
            return;
        }

        let resource_weight_grams_with_precision = WeightConfigCustomImpl::get_weight_grams_with_precision(
            world, self.resource_type, self.balance
        );

        let storehouse_capacity_grams_with_precision = storehouse_capacity_grams * RESOURCE_PRECISION;

        let max_weight_grams = min(resource_weight_grams_with_precision, storehouse_capacity_grams_with_precision);

        let max_balance = max_weight_grams / resource_weight_config.weight_gram;

        self.balance = max_balance
    }

    fn harvest(ref self: Resource, world: IWorldDispatcher) {
        let mut production: Production = get!(world, (self.entity_id, self.resource_type), Production);
        let tick = TickImpl::get_default_tick_config(world);
        if production.is_active() && production.last_updated_tick != tick.current() {
            production.harvest(ref self, @tick);
            self.limit_balance_by_storehouse_capacity(world);
            set!(world, (self));
            set!(world, (production));
        }
    }
}


#[generate_trait]
impl OwnedResourcesTrackerCustomImpl of OwnedResourcesTrackerCustomTrait {
    /// Check whether an entity owns a resource
    ///
    /// # Arguments
    ///
    /// * `resource_id` - The resource id to check
    ///
    /// # Returns
    ///
    /// * `bool` - Whether the entity owns the resource
    ///
    fn owns_resource_type(self: @OwnedResourcesTracker, resource_type: u8) -> bool {
        let pos = resource_type - 1;
        is_u256_bit_set((*self).resource_types, pos.into())
    }

    /// Set whether an entity owns a resource
    ///
    /// # Arguments
    ///
    /// * `resource_id` - The resource id to set
    /// * `value` - Whether the entity owns the resource
    ///
    fn set_resource_ownership(ref self: OwnedResourcesTracker, resource_type: u8, value: bool) {
        let pos = resource_type - 1;
        self.resource_types = set_u256_bit(self.resource_types, pos.into(), value);
    }
}

#[cfg(test)]
mod tests_resource_traits {
    use core::num::traits::Bounded;
    use core::option::OptionTrait;
    use debug::PrintTrait;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, TickIds};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use eternum::models::production::ProductionRateTrait;
    use eternum::models::resources::ResourceCustomTrait;
    use eternum::models::structure::{Structure, StructureCategory};
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::contracts::{IProductionConfigDispatcher, IProductionConfigDispatcherTrait};
    use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system, config::set_capacity_config};
    use super::{Production, ProductionOutputCustomImpl, Resource, ResourceCustomImpl};
    use traits::Into;
    use traits::TryInto;

    fn setup() -> (IWorldDispatcher, ID, u128, Span<(u8, u128)>) {
        // SCENERIO
        // There are two buildings in the structure. One producing
        // something which consumes `2` wood per tick. The only important
        // thing about the first building is that it consumes wood.
        //
        // Then the other building is a wood building which produces
        // `50` wood per tick. The cost of producing wood is `3` gold per tick.
        //
        // The entity has 100 gold initially.
        //

        let world = spawn_eternum();
        let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

        set_capacity_config(config_systems_address);
        // set tick config
        let tick_config = TickConfig {
            config_id: WORLD_CONFIG_ID, tick_id: TickIds::DEFAULT, tick_interval_in_seconds: 5
        };
        set!(world, (tick_config));

        // make entity a structure
        let entity_id: ID = 1;
        set!(
            world,
            (Structure { entity_id, category: StructureCategory::Realm, created_at: starknet::get_block_timestamp() })
        );

        // The entity pays 3 gold for wood production per tick
        let wood_cost_gold_rate: u128 = 3;
        let wood_cost = array![(ResourceTypes::GOLD, wood_cost_gold_rate)];

        let wood_production_rate: u128 = 50;
        // let's assume wood is consumed by some other resource
        let wood_consumption_rate: u128 = 2;
        let mut wood_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::WOOD,
            building_count: 1,
            production_rate: wood_production_rate,
            consumption_rate: wood_consumption_rate,
            last_updated_tick: 0,
            input_finish_tick: 0
        };
        set!(world, (wood_production));

        // set gold consumption because wood production consumes gold
        let mut gold_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::GOLD,
            building_count: 0,
            production_rate: 0,
            consumption_rate: wood_cost_gold_rate,
            last_updated_tick: 0,
            input_finish_tick: 0
        };

        // set gold resource balance

        let initial_gold_balance = 100;
        let mut gold_resource = Resource {
            entity_id, resource_type: ResourceTypes::GOLD, balance: initial_gold_balance
        };
        set!(world, (gold_production, gold_resource));

        IProductionConfigDispatcher { contract_address: config_systems_address }
            .set_production_config(ResourceTypes::WOOD, wood_production_rate, wood_cost.span());

        // update wood end tick
        ProductionOutputCustomImpl::sync_all_inputs_exhaustion_ticks_for(@gold_resource, world);

        return (world, entity_id, wood_production_rate, wood_cost.span());
    }

    #[test]
    fn resources_test_resource_get_while_gold_is_available() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceCustomImpl::get is called
        //
        let (world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get_default_tick_config(world);

        // advance time by 3 ticks
        let tick_passed = 3;
        starknet::testing::set_block_timestamp(tick_passed * tick_config.tick_interval_in_seconds);

        // check wood balance after 3 ticks
        let wood_resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::WOOD));
        // wood production = 50
        // wood consumption = 3
        assert_eq!(wood_resource.balance, (50 - 2) * tick_passed.into());

        // check that wood production end tick was computed correctly
        let gold_resource: Resource = get!(world, (entity_id, ResourceTypes::GOLD), Resource);
        let gold_production_end = gold_resource.balance / 3; // wood_cost_gold_rate
        let wood_production: Production = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(gold_production_end, wood_production.input_finish_tick.into());
    }


    #[test]
    fn resources_test_resource_get_after_gold_has_finished() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceCustomImpl::get is called
        //
        let (world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get_default_tick_config(world);

        // advance time by 900 ticks (way after 33 ticks when gold finishes)
        starknet::testing::set_block_timestamp(900 * tick_config.tick_interval_in_seconds);

        let wood_resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_resource.balance, (50 - 2) * 33);
    }


    #[test]
    fn resources_test_resource_save() {
        // Ensure wood production end tick is reset after
        // gold's balance gets updated
        //
        let (world, entity_id, _, _) = setup();
        let mut gold_resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::GOLD));
        gold_resource.balance += 4; // makes balance 104
        gold_resource.save(world);
        assert_eq!(gold_resource.balance, 104); // sanity check

        // check that wood production end tick was computed correctly
        // wood production should end when gold balance finishes.
        //
        // now we have 104 gold, so wood production should end at tick 34
        // the calculation being, 104 / 3 = 34.66 // 34
        let wood_production: Production = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(wood_production.input_finish_tick, 34);
    }
}

#[cfg(test)]
mod owned_resources_tracker_tests {
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::constants::ResourceTypes;
    use eternum::models::resources::{Resource, ResourceCustomImpl};
    use eternum::models::structure::{Structure, StructureCategory};
    use eternum::systems::config::contracts::config_systems;
    use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system, config::set_capacity_config};
    use super::{OwnedResourcesTracker, OwnedResourcesTrackerCustomTrait};


    #[test]
    fn resources_test_get_and_set_resource_ownership() {
        let mut ort = OwnedResourcesTracker { entity_id: 0, resource_types: 0 };
        ort.set_resource_ownership(ResourceTypes::WOOD, true);
        ort.set_resource_ownership(ResourceTypes::COAL, true);
        ort.set_resource_ownership(ResourceTypes::LORDS, true);
        ort.set_resource_ownership(ResourceTypes::WHEAT, true);

        assert!(ort.owns_resource_type(ResourceTypes::WOOD), "should be true");
        assert!(ort.owns_resource_type(ResourceTypes::COAL), "should be true");
        assert!(ort.owns_resource_type(ResourceTypes::LORDS), "should be true");
        assert!(ort.owns_resource_type(ResourceTypes::WHEAT), "should be true");

        assert!(ort.owns_resource_type(ResourceTypes::DRAGONHIDE) == false, "should be false");
        assert!(ort.owns_resource_type(ResourceTypes::DEMONHIDE) == false, "should be false");
    }


    #[test]
    fn resources_test_get_and_set_resource_ownership_after_resource_save() {
        let world = spawn_eternum();

        let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
        set_capacity_config(config_systems_address);

        let entity_id = 44;
        // make entity a structure
        set!(
            world,
            (Structure { entity_id, category: StructureCategory::Realm, created_at: starknet::get_block_timestamp() })
        );
        let mut entity_gold_resource = ResourceCustomImpl::get(world, (entity_id, ResourceTypes::GOLD));
        entity_gold_resource.balance += 300;
        entity_gold_resource.save(world);

        let mut ort: OwnedResourcesTracker = get!(world, (entity_id), OwnedResourcesTracker);
        assert!(ort.owns_resource_type(ResourceTypes::GOLD), "should be true");
        assert!(ort.owns_resource_type(ResourceTypes::FISH) == false, "should be false");
    }
}

