use eternum::utils::math::{is_u32_bit_set, set_u32_bit};
use eternum::constants::get_resource_probabilities;
use eternum::constants::ResourceTypes;
use eternum::models::config::{ProductionConfig, TickConfig, TickImpl, TickTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::production::{Production, ProductionOutputImpl, ProductionRateTrait};
use core::integer::BoundedInt;
use debug::PrintTrait;


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
    fn get(world: IWorldDispatcher, entity_id: u128) -> (Resource, Resource) {
        let wheat = ResourceImpl::get(world, (entity_id, ResourceTypes::WHEAT));
        let fish = ResourceImpl::get(world, (entity_id, ResourceTypes::FISH));
        (wheat, fish)
    }

    /// Fails if the paid amount is insufficient
    fn pay(
        world: IWorldDispatcher,
        entity_id: u128,
        mut wheat_amount: u128,
        mut fish_amount: u128,
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
        world: IWorldDispatcher,
        entity_id: u128,
        mut wheat_amount: u128,
        mut fish_amount: u128,
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
        let mut resource : Resource = get!(world, key, Resource);
        resource.harvest(world);
        return resource;
    } 
    

    fn save(ref self: Resource, world: IWorldDispatcher) {

        // save the updated resource
        set!(world, (self));

        // sync end ticks of resources that depend on this one
        ProductionOutputImpl::sync_all_inputs_exhaustion_ticks_for(@self,world);

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

    fn harvest(ref self: Resource, world: IWorldDispatcher) {
        let mut production: Production = get!(world, (self.entity_id, self.resource_type), Production);
        let tick = TickImpl::get(world);
        if production.last_updated_tick != tick.current() {
            production.harvest(ref self, @tick);
            set!(world, (self));
            set!(world, (production));
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
mod tests_resource_traits {
    use eternum::models::resources::ResourceTrait;
use eternum::models::production::ProductionRateTrait;
    use core::option::OptionTrait;
    use super::{Production, ProductionOutputImpl, Resource, ResourceImpl};
    use debug::PrintTrait;
    use traits::Into;
    use traits::TryInto;
    use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
    use eternum::models::config::{TickConfig, TickImpl, TickTrait};
    use core::integer::BoundedInt;
    use eternum::utils::testing::{spawn_eternum, deploy_system};
    use eternum::systems::config::contracts::config_systems;
    use eternum::systems::config::interface::{
        IProductionConfigDispatcher, IProductionConfigDispatcherTrait
    };
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    fn setup() -> (IWorldDispatcher, u128, u128, Span<(u8, u128)>) {
        let world = spawn_eternum();
        let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

        // set tick config 
        let tick_config = TickConfig {
            config_id: WORLD_CONFIG_ID,
            max_moves_per_tick: 5,
            tick_interval_in_seconds: 5
        };
        set!(world, (tick_config));

        // wood production cost 3 gold per tick
        let wood_cost_gold_rate : u128 = 3;
        let wood_cost = array![(ResourceTypes::GOLD, wood_cost_gold_rate)];
        let entity_id: u128 = 1;



        // set wood production

        let wood_production_rate: u128 = 50;
        let mut wood_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::WOOD,
            building_count: 1,
            production_rate: wood_production_rate,
            bonus_percent: 0,
            consumption_rate: 2,
            last_updated_tick: 0,
            end_tick: 0
        };
        set!(world, (wood_production));



        // set gold consumption rate to be wood cost


        let mut gold_production: Production = Production {
            entity_id,
            resource_type: ResourceTypes::GOLD,
            building_count: 0,
            production_rate: 0,
            bonus_percent: 0,
            consumption_rate: wood_cost_gold_rate,
            last_updated_tick: 0,
            end_tick: 0
        };

        // set gold resource balance 
        let mut gold_resource: Resource = Resource {
            entity_id,
            resource_type: ResourceTypes::GOLD,
            balance: 100
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
        starknet::testing::set_block_timestamp(
            3 * tick_config.tick_interval_in_seconds);


        // check wood balance after 3 ticks
        let wood_resource = ResourceImpl::get(world, (entity_id, ResourceTypes::WOOD));
        assert_eq!(wood_resource.balance, (50 - 2) * 3);


        // check that wood production end tick was computed correctly
        let gold_resource: Resource
            = get!(world, (entity_id, ResourceTypes::GOLD), Resource);
        let gold_production_end 
            = gold_resource.balance / 3; // wood_cost_gold_rate
        let wood_production: Production 
            = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(gold_production_end, wood_production.end_tick.into());

    }



    #[test]
    fn test_resource_get_after_gold_has_finished() {
        // Ensure production is harvested and added to the
        // resource's balance when ResourceImpl::get is called
        //
        let (world, entity_id, _, _) = setup();

        let tick_config = TickImpl::get(world);

        // advance time by 900 ticks (way after 33 ticks when gold finishes)
        starknet::testing::set_block_timestamp(
            900 * tick_config.tick_interval_in_seconds);

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

        let wood_production: Production 
            = get!(world, (entity_id, ResourceTypes::WOOD), Production);
        assert_eq!(wood_production.end_tick, (104 - 2) / 3); // 3 =  wood_cost_gold_rate

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
