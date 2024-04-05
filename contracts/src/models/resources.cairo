use eternum::utils::math::{is_u32_bit_set, set_u32_bit};
use eternum::constants::get_resource_probabilities;
use eternum::constants::ResourceTypes;
use eternum::models::config::TickImpl;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::production::{Production, ProductionRateTrait, ProductionDependencyConfig};


#[derive(Model, Copy, Drop, Serde)]
struct Resource {
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}

#[generate_trait]
impl ResourceFoodImpl of ResourceFoodTrait {
    fn get_food(world: IWorldDispatcher, entity_id: u128) -> (Resource, Resource) {
        let wheat = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        let fish = get!(world, (entity_id, ResourceTypes::FISH), Resource);
        (wheat, fish)
    }

    fn burn_food(
        world: IWorldDispatcher,
        entity_id: u128,
        wheat_amount: u128,
        fish_amount: u128,
        check_balance: bool
    ) {
        let mut wheat: Resource = get!(world, (entity_id, ResourceTypes::WHEAT), Resource);
        let mut fish: Resource = get!(world, (entity_id, ResourceTypes::FISH), Resource);
        wheat.deduct(world, wheat_amount, check_balance);
        wheat.save(world);

        fish.deduct(world, fish_amount, check_balance);
        fish.save(world);
    }
}

#[generate_trait]
impl ProductionDependentsImpl of ProductionDependentsTrait {
    // must be called immediately after balance changes

    // e.g resource is stone..dependents are wood andruby because they each depend on 
    // stone to be produced
    fn reestimate_dependents_production_period(ref resource: Resource, world: IWorldDispatcher) {
        let mut resource_production: Production = get!(world, self.query_key(), Production);
        let (net_rate_sign, _) = resource_production.net_rate();
        if net_rate_sign == false { // net negative production so it eats into balance
            let dependency: ProductionDependencyConfig = get!(
                world, resource.resource_type, ProductionDependencyConfig
            );
            let tick = TickImpl::get(world);
            if dependency.produced_resource_type_1 != 0 {
                let mut material_one_production = get!(
                    world, (resource.entity_id, dependency.produced_resource_type_1), Production
                );
                let mut material_one_resource = get!(
                    world, (resource.entity_id, dependency.produced_resource_type_1), Resource
                );
                resource_production
                    .set_materials_exhaustion_tick(
                        ref material_one_production, ref material_one_resource, @tick);
            }

            if dependency.produced_resource_type_2 != 0 {
                let mut material_two_production = get!(
                    world, (resource.entity_id, dependency.produced_resource_type_2), Production
                );
                let mut material_two_resource = get!(
                    world, (resource.entity_id, dependency.produced_resource_type_2), Resource
                );
                resource_production
                    .set_materials_exhaustion_tick(
                        ref material_two_production, ref material_two_resource, @tick);
            }
            
            set!(world, (resource_production));
    }
}

#[generate_trait]
impl ResourceImpl of ResourceTrait {
    fn query_key(self: Resource) -> (u128, u8) {
        (self.entity_id, self.resource_type)
    }

    fn deduct(ref self: Resource, world: IWorldDispatcher, mut amount: u128, check_balance: bool) {
        if check_balance {
            assert(self.balance >= amount, 'insufficient balance');
        } else {
            if amount > self.balance {
                amount = self.balance
            }
        }

        if amount > self.balance {
            // claim produced amount before deduction where necessary

            let mut production: Production = get!(world, self.query_key(), Production);

            let tick = TickImpl::get(world);
            production.harvest(ref self, @tick);
            set!(world, (production));
        }

        self.balance -= amount;
    }


    fn add(ref self: Resource, amount: u128) {
        self.balance += amount;
    }

    fn save(ref self: Resource, world: IWorldDispatcher) {
        // Save the resource
        ProductionDependentsImpl::reestimate_dependents_production_period(ref self, world);
        set!(world, (self));

        // Update the entity's owned resources

        let mut entity_owned_resources = get!(world, self.entity_id, OwnedResourcesTracker);

        if self._is_regular_resource(self.resource_type) {
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
    }


    fn _is_regular_resource(self: @Resource, _type: u8) -> bool {
        let mut position = _type;
        if position == 255 {
            return true;
        } else if position == 254 {
            return true;
        } else if position == 253 {
            return true;
        }

        return position <= 28;
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
struct ResourceChest {
    #[key]
    entity_id: u128,
    locked_until: u64,
    resources_count: u32,
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
    resource_types: u32
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
        let pos = self._resource_type_to_position(resource_type);
        is_u32_bit_set((*self).resource_types, pos.into())
    }

    /// Set whether an entity owns a resource
    ///
    /// # Arguments
    ///
    /// * `resource_id` - The resource id to set
    /// * `value` - Whether the entity owns the resource
    ///
    fn set_resource_ownership(ref self: OwnedResourcesTracker, resource_type: u8, value: bool) {
        let pos = self._resource_type_to_position(resource_type);

        self.resource_types = set_u32_bit(self.resource_types, pos.into(), value);
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


    fn _resource_type_to_position(self: @OwnedResourcesTracker, _type: u8) -> u8 {
        // custom mapping for special cases of position 
        // i.e for LORDS = 253, WHEAT = 254, and FISH = 255
        let mut position = _type;
        if position == 255 {
            position = 32 - 1;
        } else if position == 254 {
            position = 32 - 2;
        } else if position == 253 {
            position = 32 - 3;
        } else if position == 252 {
            position = 32 - 4;
        } else if position == 251 {
            position = 32 - 5;
        } else if position == 250 {
            position = 32 - 6;
        } else {
            position -= 1;
        }

        // the mapping would be done like this
        // WOOD (resource type 1) == position 0
        // STONE (resource type 2) == position 2
        // ...
        // DEMONHIDE (resource type 28) == position 27
        // ==> 28th bit is unalloted. to be used for new resource type <==
        // LORDS (resource type 253) == position 29
        // WHEAT (resource type 254) == position 30
        // FISH (resource type 255) == position 31

        return position; // since resource types start from 1
    }
}


#[cfg(test)]
mod owned_resources_tracker_tests {
    use super::{OwnedResourcesTracker, OwnedResourcesTrackerTrait};
    use eternum::constants::ResourceTypes;


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
