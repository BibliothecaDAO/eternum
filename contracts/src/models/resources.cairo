use core::fmt::{Display, Formatter, Error};
use core::integer::BoundedInt;
use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::ResourceTypes;
use eternum::constants::get_resource_probabilities;
use eternum::models::config::{ProductionConfig, TickConfig, TickImpl, TickTrait};

use eternum::models::production::{Production, ProductionOutputImpl, ProductionRateTrait};
use eternum::models::quantity::{QuantityTracker};
use eternum::models::buildings::{Building, BuildingTrait, BuildingQuantityTrackerImpl, BuildingCategory};
use eternum::utils::math::{is_u256_bit_set, set_u256_bit};


#[derive(Model, Copy, Drop, Serde)]
struct Resource {
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}

impl ResourceDisplay of Display<Resource> {
    fn fmt(self: @Resource, ref f: Formatter) -> Result<(), Error> {
        let str: ByteArray = format!(
            "Resource ({}, {}, {})", *self.entity_id, *self.resource_type, *self.balance
        );
        f.buffer.append(@str);
        Result::Ok(())
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct ResourceAllowance {
    #[key]
    owner_entity_id: u128,
    #[key]
    approved_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceCost {
    #[key]
    entity_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    amount: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct DetachedResource {
    #[key]
    entity_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    resource_amount: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct OwnedResourcesTracker {
    #[key]
    entity_id: u128,
    resource_types: u256
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceLock {
    #[key]
    entity_id: u128,
    release_at: u64,
}


#[generate_trait]
impl ResourceLockImpl of LockTrait {
    fn assert_not_locked(self: ResourceLock) {
        assert!(self.is_open(), "resource locked for entity {}", self.entity_id);
    }
    fn is_open(self: ResourceLock) -> bool {
        let now = starknet::get_block_timestamp();
        now > self.release_at
    }
}


#[generate_trait]
impl ResourceFoodImpl of ResourceFoodTrait {
    fn get(world: IWorldDispatcher, entity_id: u128) -> (Resource, Resource) {
        let wheat = ResourceImpl::get(world, (entity_id, ResourceTypes::WHEAT));
        let fish = ResourceImpl::get(world, (entity_id, ResourceTypes::FISH));
        (wheat, fish)
    }

    /// Fails if the paid amount is insufficient
    fn pay(
        world: IWorldDispatcher, entity_id: u128, mut wheat_amount: u128, mut fish_amount: u128,
    ) {
        let (mut wheat, mut fish) = ResourceFoodImpl::get(world, entity_id);

        if wheat_amount > wheat.balance {
            panic!("Insufficient wheat balance");
        }
        wheat.balance -= wheat_amount;
        wheat.save(world);

        if fish_amount > fish.balance {
            panic!("Insufficient fish balance");
        }
        fish.balance -= fish_amount;
        fish.save(world);
    }

    /// Does not fail even if amount is insufficient
    fn burn(
        world: IWorldDispatcher, entity_id: u128, mut wheat_amount: u128, mut fish_amount: u128,
    ) {
        let mut wheat: Resource = ResourceImpl::get(world, (entity_id, ResourceTypes::WHEAT));
        let mut fish: Resource = ResourceImpl::get(world, (entity_id, ResourceTypes::FISH));

        if wheat_amount > wheat.balance {
            wheat_amount = wheat.balance
        }
        wheat.balance -= wheat_amount;
        wheat.save(world);

        if fish_amount > fish.balance {
            fish_amount = fish.balance
        }
        fish.balance -= fish_amount;
        fish.save(world);
    }
}

#[generate_trait]
impl ResourceImpl of ResourceTrait {
    fn get(world: IWorldDispatcher, key: (u128, u8)) -> Resource {
        let mut resource: Resource = get!(world, key, Resource);
        if resource.entity_id == 0 {
            return resource;
        };

        resource.harvest(world);
        return resource;
    }

    fn burn(ref self: Resource, amount: u128) {
        if self.entity_id == 0 {
            return;
        };

        assert!(self.balance >= amount, "not enough resources, {}", self);

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
        // save the updated resource
        set!(world, (self));

        // let entity_realm = get!(world, self.entity_id, Realm);
        // let entity_is_realm = entity_realm.realm_id != 0;
        // if entity_is_realm {
        //     let realm_building_quantity_key 
        //         = BuildingQuantityTrackerImpl::key(
        //             self.entity_id, BuildingCategory::Storehouse.into(), self.resource_type);
        //     let mut realm_building_quantity_tracker: QuantityTracker 
        //         = get!(world, realm_building_quantity_key, QuantityTracker);

        //     // let max_resource_balance 

        // }

        // sync end ticks of resources that depend on this one
        ProductionOutputImpl::sync_all_inputs_exhaustion_ticks_for(@self, world);

        // Update the entity's owned resources

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

    fn harvest(ref self: Resource, world: IWorldDispatcher) {
        let mut production: Production = get!(
            world, (self.entity_id, self.resource_type), Production
        );
        let tick = TickImpl::get(world);
        if production.last_updated_tick != tick.current() {
            production.harvest(ref self, @tick);
            set!(world, (self));
            set!(world, (production));
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


    /// Get all the resources an entity owns and their probability of occurence
    ///
    /// # Returns
    ///
    /// * `Span<u8>` - The resource types
    /// * `Span<u128>` - The resource probabilities
    ///
    ///    resource_types.length == resource_probabilities.length
    ///
    fn get_owned_resources_and_probs(self: @OwnedResourcesTracker) -> (Span<u8>, Span<u128>) {
        let zipped = get_resource_probabilities();
        let mut owned_resource_types = array![];
        let mut owned_resource_probabilities = array![];
        let mut index = 0;
        loop {
            if index == zipped.len() {
                break;
            }

            let (resource_type, probability) = *zipped.at(index);
            if self.owns_resource_type(resource_type) {
                owned_resource_types.append(resource_type);
                owned_resource_probabilities.append(probability);
            }
            index += 1;
        };

        return (owned_resource_types.span(), owned_resource_probabilities.span());
    }
}

#[cfg(test)]
mod tests_resource_traits {
    use core::integer::BoundedInt;
    use core::option::OptionTrait;
    use debug::PrintTrait;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use eternum::models::production::ProductionRateTrait;
    use eternum::models::resources::ResourceTrait;
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IProductionConfigDispatcher, IProductionConfigDispatcherTrait
    };
    use eternum::utils::testing::{spawn_eternum, deploy_system};
    use super::{Production, ProductionOutputImpl, Resource, ResourceImpl};
    use traits::Into;
    use traits::TryInto;

    fn setup() -> (IWorldDispatcher, u128, u128, Span<(u8, u128)>) {
        let world = spawn_eternum();
        let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

        // set tick config 
        let tick_config = TickConfig {
            config_id: WORLD_CONFIG_ID, max_moves_per_tick: 5, tick_interval_in_seconds: 5
        };
        set!(world, (tick_config));

        // wood production cost 3 gold per tick
        let wood_cost_gold_rate: u128 = 3;
        let wood_cost = array![(ResourceTypes::GOLD, wood_cost_gold_rate)];
        let entity_id: u128 = 1;

        // set wood production

        let wood_production_rate: u128 = 50;
        let mut wood_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::WOOD,
            building_count: 1,
            production_rate: wood_production_rate,
            consumption_rate: 2,
            last_updated_tick: 0,
            input_finish_tick: 0
        };
        set!(world, (wood_production));

        // set gold consumption rate to be wood cost

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
        let mut gold_resource: Resource = Resource {
            entity_id, resource_type: ResourceTypes::GOLD, balance: 100
        };
        set!(world, (gold_production, gold_resource));

        IProductionConfigDispatcher { contract_address: config_systems_address }
            .set_production_config(ResourceTypes::WOOD, wood_production_rate, wood_cost.span());

        // update wood end tick
        ProductionOutputImpl::sync_all_inputs_exhaustion_ticks_for(@gold_resource, world);

        return (world, entity_id, wood_production_rate, wood_cost.span());
    }

    #[test]
    fn test_resource_get_while_gold_is_available() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceImpl::get is called
        //
        let (world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get(world);

        // advance time by 3 ticks
        starknet::testing::set_block_timestamp(3 * tick_config.tick_interval_in_seconds);

        // check wood balance after 3 ticks
        let wood_resource = ResourceImpl::get(world, (entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_resource.balance, (50 - 2) * 3);

        // check that wood production end tick was computed correctly
        let gold_resource: Resource = get!(world, (entity_id, ResourceTypes::GOLD), Resource);
        let gold_production_end = gold_resource.balance / 3; // wood_cost_gold_rate
        let wood_production: Production = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(gold_production_end, wood_production.input_finish_tick.into());
    }


    #[test]
    fn test_resource_get_after_gold_has_finished() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceImpl::get is called
        //
        let (world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get(world);

        // advance time by 900 ticks (way after 33 ticks when gold finishes)
        starknet::testing::set_block_timestamp(900 * tick_config.tick_interval_in_seconds);

        let wood_resource = ResourceImpl::get(world, (entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_resource.balance, (50 - 2) * 33);
    }


    #[test]
    fn test_resource_save() {
        // Ensure wood production end tick is reset after
        // gold's balance gets updated
        //
        let (world, entity_id, _, _) = setup();

        let mut gold_resource = ResourceImpl::get(world, (entity_id, ResourceTypes::GOLD));
        gold_resource.balance += 4; // makes balance 104
        gold_resource.save(world);
        assert_eq!(gold_resource.balance, 104);

        let wood_production: Production = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(wood_production.input_finish_tick, (104 - 2) / 3); // 3 =  wood_cost_gold_rate
    }
}


#[cfg(test)]
mod owned_resources_tracker_tests {
    use eternum::constants::ResourceTypes;
    use super::{OwnedResourcesTracker, OwnedResourcesTrackerTrait};


    #[test]
    fn test_resource_type_to_position() {
        let ort = OwnedResourcesTracker { entity_id: 0, resource_types: 0 };
        assert!(ort._resource_type_to_position(255) == 31, " wrong ans");
        assert!(ort._resource_type_to_position(254) == 30, " wrong ans");
        assert!(ort._resource_type_to_position(253) == 29, " wrong ans");
        assert!(ort._resource_type_to_position(28) == 27, " wrong ans");
        assert!(ort._resource_type_to_position(2) == 1, " wrong ans");
        assert!(ort._resource_type_to_position(1) == 0, " wrong ans");
    }


    #[test]
    fn test_get_and_set_resource_ownership() {
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
}

