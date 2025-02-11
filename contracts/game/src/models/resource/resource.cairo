use core::fmt::{Display, Error, Formatter};
use core::num::traits::Bounded;
use dojo::model::ModelStorage;

use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{
    GRAMS_PER_KG, RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID, get_resource_probabilities, resource_type_name,
};
use s1_eternum::models::config::{
    CapacityCategory, CapacityConfig, CapacityConfigTrait, ProductionConfig, TickConfig, TickImpl, TickTrait,
};
use s1_eternum::models::config::{WeightConfig, WeightConfigImpl};
use s1_eternum::models::realm::Realm;
use s1_eternum::models::resource::production::production::{Production};
use s1_eternum::models::structure::StructureTrait;
use s1_eternum::models::structure::{Structure, StructureCategory};
use s1_eternum::utils::math::{is_u256_bit_set, min, set_u256_bit};

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
            *self.balance,
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
    amount: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct DetachedResource {
    #[key]
    entity_id: ID,
    #[key]
    index: u32,
    resource_type: u8,
    resource_amount: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct OwnedResourcesTracker {
    #[key]
    entity_id: ID,
    // todo: use felt252 instead
    resource_types: u256,
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
    fn pay(ref world: WorldStorage, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128) {
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
    fn burn(ref world: WorldStorage, entity_id: ID, mut wheat_amount: u128, mut fish_amount: u128) {
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
        assert!(resource.resource_type.is_non_zero(), "invalid resource specified");

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

        if self.balance == 0 {
            world.erase_model(@self);
        } else {
            // save the updated resource
            world.write_model(@self);
        }
    }
}

