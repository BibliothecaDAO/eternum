use core::fmt::{Display, Formatter, Error};
use core::num::traits::Bounded;
use dojo::model::ModelStorage;

use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{
    LAST_REGULAR_RESOURCE_ID, FIRST_LABOR_RESOURCE_ID, get_resource_probabilities, RESOURCE_PRECISION, GRAMS_PER_KG,
    ResourceTypes, resource_type_name, WORLD_CONFIG_ID
};
use s1_eternum::models::config::{
    ProductionConfig, TickConfig, TickImpl, TickTrait, CapacityConfig, CapacityConfigCategory, CapacityConfigTrait
};
use s1_eternum::models::config::{WeightConfigImpl, WeightConfig};
use s1_eternum::models::realm::Realm;
use s1_eternum::models::resource::production::building::{Building, BuildingTrait, BuildingCategory, BuildingQuantityv2};
use s1_eternum::models::resource::production::labor::{LaborImpl, LaborTrait};

use s1_eternum::models::resource::production::production::{Production, ProductionTrait};
use s1_eternum::models::structure::StructureTrait;
use s1_eternum::models::structure::{Structure, StructureCategory};
use s1_eternum::utils::math::{is_u256_bit_set, set_u256_bit, min};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Resource {
    #[key]
    entity_id: ID,
    #[key]
    resource_type: u8,
    balance: u128,
    production: Production,
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
    // todo: use felt252 instead 
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
impl ResourceTransferLockImpl of ResourceTransferLockTrait {
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

    fn get(ref world: WorldStorage, entity_id: ID) -> (Resource, Resource) {
        let wheat = ResourceImpl::get(ref world, (entity_id, ResourceTypes::WHEAT));
        let fish = ResourceImpl::get(ref world, (entity_id, ResourceTypes::FISH));
        (wheat, fish)
    }

    /// Fails if the paid amount is insufficient
    fn pay(ref world: WorldStorage, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128,) {
        let (mut wheat, mut fish) = Self::get(ref world, entity_id);

        if wheat_amount > wheat.balance {
            panic!("Insufficient wheat balance");
        }
        wheat.burn(wheat_amount);
        wheat.save(ref world);

        if fish_amount > fish.balance {
            panic!("Insufficient fish balance");
        }
        fish.burn(fish_amount);
        fish.save(ref world);
    }

    /// Does not fail even if amount is insufficient
    fn burn(ref world: WorldStorage, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128,) {
        let mut wheat: Resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::WHEAT));
        let mut fish: Resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::FISH));

        if wheat_amount > wheat.balance {
            wheat_amount = wheat.balance
        }
        wheat.burn(wheat_amount);
        wheat.save(ref world);

        if fish_amount > fish.balance {
            fish_amount = fish.balance
        }
        fish.burn(fish_amount);
        fish.save(ref world);
    }
}

#[generate_trait]
impl ResourceImpl of ResourceTrait {
    fn get(ref world: WorldStorage, key: (ID, u8)) -> Resource {
        let mut resource: Resource = world.read_model(key);
        assert!(resource.entity_id.is_non_zero(), "entity id not found");
        assert!(
            resource.resource_type != 0 && resource.resource_type != Bounded::MAX, "invalid resource specified (1)"
        );
        assert!(
            resource.resource_type <= LAST_REGULAR_RESOURCE_ID // regular resources
                || resource.resource_type >= FIRST_LABOR_RESOURCE_ID, // labor resources
            "invalid resource specified (2)"
        );

        let entity_structure: Structure = world.read_model(resource.entity_id);
        let entity_is_structure = entity_structure.is_structure();
        if entity_is_structure {
            resource.update_balance(ref world);
        }

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

    fn save(ref self: Resource, ref world: WorldStorage) {
        if self.entity_id == 0 {
            return;
        };

        let entity_structure: Structure = world.read_model(self.entity_id);
        if entity_structure.is_structure() {
            // limit balance by storehouse capacity
            self.limit_balance_by_storehouse_capacity(ref world);
        }

        // save the updated resource
        world.write_model(@self);

        // update the entity's resource tracker
        let mut entity_owned_resources: OwnedResourcesTracker = world.read_model(self.entity_id);
        if self.balance == 0 {
            if entity_owned_resources.owns_resource_type(self.resource_type) {
                entity_owned_resources.set_resource_ownership(self.resource_type, false);
                world.write_model(@entity_owned_resources);
            }
        } else {
            if !entity_owned_resources.owns_resource_type(self.resource_type) {
                entity_owned_resources.set_resource_ownership(self.resource_type, true);
                world.write_model(@entity_owned_resources);
            }
        }
    }

    fn limit_balance_by_storehouse_capacity(ref self: Resource, ref world: WorldStorage) {
        let entity_structure: Structure = world.read_model(self.entity_id);
        if entity_structure.category != StructureCategory::Realm {
            return;
        }

        let resource_weight_config: WeightConfig = world.read_model((WORLD_CONFIG_ID, self.resource_type));
        if resource_weight_config.weight_gram == 0 {
            return;
        }

        let storehouse_building_quantity: BuildingQuantityv2 = world
            .read_model((self.entity_id, BuildingCategory::Storehouse));
        let storehouse_capacity: CapacityConfig = world.read_model(CapacityConfigCategory::Storehouse);
        let storehouse_capacity_grams = storehouse_capacity.weight_gram;
        let storehouse_capacity_grams = storehouse_capacity_grams
            + (storehouse_building_quantity.value.into() * storehouse_capacity_grams);

        let resource_weight_grams_with_precision = WeightConfigImpl::get_weight_grams_with_precision(
            ref world, self.resource_type, self.balance
        );

        let storehouse_capacity_grams_with_precision = storehouse_capacity_grams * RESOURCE_PRECISION;

        let max_weight_grams = min(resource_weight_grams_with_precision, storehouse_capacity_grams_with_precision);
        let max_balance = max_weight_grams / resource_weight_config.weight_gram;

        self.balance = max_balance
    }

    fn update_balance(ref self: Resource, ref world: WorldStorage) {
        let tick = TickImpl::get_default_tick_config(ref world);
        let current_tick = tick.current().try_into().unwrap();
        let mut production: Production = self.production;
        if production.has_building() && production.last_updated_tick != current_tick {
            // harvest the production
            let production_config: ProductionConfig = world.read_model(self.resource_type);
            production.harvest(ref self, @tick, @production_config);

            // update the resource production
            self.production = production;

            // limit balance by storehouse capacity
            self.limit_balance_by_storehouse_capacity(ref world);

            // save the updated resource model
            world.write_model(@self);

            // todo add event here to show amount burnt
        }
    }
}


#[generate_trait]
impl OwnedResourcesTrackerImpl of OwnedResourcesTrackerTrait {
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


    use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, TickIds};
    use s1_eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use s1_eternum::models::resource::production::production::ProductionRateTrait;
    use s1_eternum::models::resource::resource::ResourceTrait;
    use s1_eternum::models::structure::{Structure, StructureCategory};
    use s1_eternum::systems::config::contracts::config_systems;
    use s1_eternum::systems::config::contracts::{IProductionConfigDispatcher, IProductionConfigDispatcherTrait};
    use s1_eternum::utils::testing::{world::spawn_eternum, systems::deploy_system, config::set_capacity_config};
    use super::{Production, ProductionOutputImpl, Resource, ResourceImpl};
    use traits::Into;
    use traits::TryInto;


    fn setup() -> (WorldStorage, ID, u128, Span<(u8, u128)>) {
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

        let mut world = spawn_eternum();
        let config_systems_address = deploy_system(ref world, "config_systems");

        set_capacity_config(config_systems_address);
        // set tick config
        let tick_config = TickConfig {
            config_id: WORLD_CONFIG_ID, tick_id: TickIds::DEFAULT, tick_interval_in_seconds: 5
        };
        world.write_model_test(@tick_config);

        // make entity a structure
        let entity_id: ID = 1;
        world
            .write_model_test(
                @Structure {
                    entity_id, category: StructureCategory::Realm, created_at: starknet::get_block_timestamp()
                }
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
            labor_finish_tick: 0
        };
        world.write_model_test(@wood_production);

        // set gold consumption because wood production consumes gold
        let mut gold_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::GOLD,
            building_count: 0,
            production_rate: 0,
            consumption_rate: wood_cost_gold_rate,
            last_updated_tick: 0,
            labor_finish_tick: 0
        };

        // set gold resource balance

        let initial_gold_balance = 100;
        let mut gold_resource = Resource {
            entity_id, resource_type: ResourceTypes::GOLD, balance: initial_gold_balance
        };
        world.write_model_test(@gold_production);
        world.write_model_test(@gold_resource);

        IProductionConfigDispatcher { contract_address: config_systems_address }
            .set_production_config(ResourceTypes::WOOD, wood_production_rate, wood_cost.span());

        // update wood end tick
        ProductionOutputImpl::sync_all_inputs_exhaustion_ticks_for(@gold_resource, ref world);

        return (world, entity_id, wood_production_rate, wood_cost.span());
    }

    #[test]
    fn resources_test_resource_get_while_gold_is_available() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceImpl::get is called
        //
        let (mut world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get_default_tick_config(ref world);

        // advance time by 3 ticks
        let tick_passed = 3;
        starknet::testing::set_block_timestamp(tick_passed * tick_config.tick_interval_in_seconds);

        // check wood balance after 3 ticks
        let wood_resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::WOOD));
        // wood production = 50
        // wood consumption = 3
        assert_eq!(wood_resource.balance, (50 - 2) * tick_passed.into());

        // check that wood production end tick was computed correctly
        let gold_resource: Resource = world.read_model((entity_id, ResourceTypes::GOLD));
        let gold_production_end = gold_resource.balance / 3; // wood_cost_gold_rate
        let wood_production: Production = world.read_model((entity_id, ResourceTypes::WOOD));
        assert_eq!(gold_production_end, wood_production.labor_finish_tick.into());
    }


    #[test]
    fn resources_test_resource_get_after_gold_has_finished() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceImpl::get is called
        //
        let (mut world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get_default_tick_config(ref world);

        // advance time by 900 ticks (way after 33 ticks when gold finishes)
        starknet::testing::set_block_timestamp(900 * tick_config.tick_interval_in_seconds);

        let wood_resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_resource.balance, (50 - 2) * 33);
    }


    #[test]
    fn resources_test_resource_save() {
        // Ensure wood production end tick is reset after
        // gold's balance gets updated
        //
        let (mut world, entity_id, _, _) = setup();
        let mut gold_resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::GOLD));
        gold_resource.balance += 4; // makes balance 104
        gold_resource.save(ref world);
        assert_eq!(gold_resource.balance, 104); // sanity check

        // check that wood production end tick was computed correctly
        // wood production should end when gold balance finishes.
        //
        // now we have 104 gold, so wood production should end at tick 34
        // the calculation being, 104 / 3 = 34.66 // 34
        let wood_production: Production = world.read_model((entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_production.labor_finish_tick, 34);
    }
}

#[cfg(test)]
mod owned_resources_tracker_tests {
    use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};

    use s1_eternum::constants::ResourceTypes;
    use s1_eternum::models::resource::resource::{Resource, ResourceImpl};
    use s1_eternum::models::structure::{Structure, StructureCategory};
    use s1_eternum::systems::config::contracts::config_systems;
    use s1_eternum::utils::testing::{world::spawn_eternum, systems::deploy_system, config::set_capacity_config};
    use super::{OwnedResourcesTracker, OwnedResourcesTrackerTrait};


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
        let mut world = spawn_eternum();

        let config_systems_address = deploy_system(ref world, "config_systems");
        set_capacity_config(config_systems_address);

        let entity_id = 44;
        // make entity a structure
        world
            .write_model_test(
                @Structure {
                    entity_id, category: StructureCategory::Realm, created_at: starknet::get_block_timestamp()
                }
            );
        let mut entity_gold_resource = ResourceImpl::get(ref world, (entity_id, ResourceTypes::GOLD));
        entity_gold_resource.balance += 300;
        entity_gold_resource.save(ref world);

        let mut ort: OwnedResourcesTracker = world.read_model(entity_id);
        assert!(ort.owns_resource_type(ResourceTypes::GOLD), "should be true");
        assert!(ort.owns_resource_type(ResourceTypes::FISH) == false, "should be false");
    }
}

