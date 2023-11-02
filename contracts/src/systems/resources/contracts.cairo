#[dojo::contract]
mod resource_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceAllowance};
    use eternum::models::owner::{Owner, EntityOwner, EntityOwnerTrait};
    use eternum::models::inventory::Inventory;
    use eternum::models::metadata::ForeignKey;
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::config::{WeightConfig, WeightConfigImpl};
    use eternum::models::resources::{ResourceChest, DetachedResource};
    use eternum::models::movable::{ArrivalTime};
    use eternum::models::weight::Weight;
    use eternum::models::road::RoadImpl;

    
    use eternum::systems::transport::contracts::caravan_systems::caravan_systems::{
        InternalCaravanSystemsImpl as caravan
    };

    use eternum::constants::{WORLD_CONFIG_ID};

    use eternum::systems::resources::interface::{IResourceSystems, IResourceChestSystems};

    use core::integer::BoundedInt;
    use core::poseidon::poseidon_hash_span;

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        receiving_entity_id: u128,
        #[key]
        sending_realm_id: u128,
        sending_entity_id: u128,
        resources: Span<(u8, u128)>
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
    }

    #[external(v0)]
    impl ResourceSystemsImpl of IResourceSystems<ContractState> {
        
        /// Approve an entity to spend resources.
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The id of the entity approving the resources.
        /// * `approved_entity_id` - The id of the entity being approved.
        /// * `resources` - The resources to approve.  
        ///      
        fn approve(
            self: @ContractState, world: IWorldDispatcher, 
            entity_id: ID, approved_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(entity_id != approved_entity_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity id'
            );
            

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        set!(world, (
                            ResourceAllowance { 
                                owner_entity_id: entity_id,
                                approved_entity_id: approved_entity_id,
                                resource_type: resource_type,
                                amount: resource_amount
                            }
                        ));
                    },
                    Option::None(_) => {break;}
                };
            };
        }   

        /// Transfer resources from one entity to another.
        ///
        /// # Arguments
        ///
        /// * `sending_entity_id` - The id of the entity sending the resources.
        /// * `receiving_entity_id` - The id of the entity receiving the resources.
        /// * `resources` - The resources to transfer.  
        ///
        fn transfer(
            self: @ContractState, world: IWorldDispatcher, sending_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(sending_entity_id != receiving_entity_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            let sending_entity_owner = get!(world, sending_entity_id, Owner);
            assert(
                sending_entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity id'
            );

            let sending_entity_owner = get!(world, sending_entity_id, EntityOwner);
            let sending_realm_id = sending_entity_owner.get_realm_id(world);

            emit!(world, Transfer { receiving_entity_id, sending_realm_id, sending_entity_id, resources });

            InternalResourceSystemsImpl::transfer(
                world, sending_entity_id, receiving_entity_id, resources
            )

        }   




        /// Transfer approved resources from one entity to another.
        ///
        /// # Arguments
        ///
        /// * `approved_entity_id` - The id of the entity approved.
        /// * `owner_entity_id` - The id of the entity resource owner
        /// * `receiving_entity_id` - The id of the entity receiving resources.
        /// * `resources` - The resources to transfer.  
        ///      
        fn transfer_from(
            self: @ContractState, world: IWorldDispatcher, 
            approved_entity_id: ID, owner_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            
            assert(owner_entity_id != receiving_entity_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            let approved_entity_owner = get!(world, approved_entity_id, Owner);
            assert(
                approved_entity_owner.address == starknet::get_caller_address(), 
                    'not owner of entity'
            );

            // update allowance
            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance 
                            = get!(world, (owner_entity_id, approved_entity_id, resource_type), ResourceAllowance);
                        
                        assert(approved_allowance.amount >= resource_amount, 'insufficient approval');

                        if (approved_allowance.amount != BoundedInt::max()){ 
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            set!(world, (approved_allowance));
                        }
                    },
                    Option::None(_) => {break;}
                };
            };


            InternalResourceSystemsImpl::transfer(
                world, owner_entity_id, receiving_entity_id, resources
            )
        }   
    }

    #[generate_trait]
    impl InternalResourceSystemsImpl of InternalResourceSystemsTrait {

        fn transfer(
            world: IWorldDispatcher, sending_entity_id: ID, 
            receiving_entity_id: ID, resources: Span<(u8, u128)>
        ) {

            // compare positions
            let sending_entity_position = get!(world, sending_entity_id, Position);
            let receiving_entity_position = get!(world, receiving_entity_id, Position);

            assert(receiving_entity_position.x !=  0, 'entity position mismatch');
            assert(receiving_entity_position.y != 0, 'entity position mismatch');

            assert(receiving_entity_position.x == sending_entity_position.x, 'entity position mismatch');
            assert(receiving_entity_position.y == sending_entity_position.y, 'entity position mismatch');
        
            // // get receiving entity's total capacity
            let receiving_entity_capacity = get!(world, receiving_entity_id, Capacity);
            let mut receiving_entity_total_capacity = 0;
            if receiving_entity_capacity.weight_gram != 0 {
                let receiving_entity_quantity = get!(world, receiving_entity_id, Quantity );
                receiving_entity_total_capacity = receiving_entity_capacity.weight_gram * receiving_entity_quantity.get_value();
            }


            let mut total_weight = 0;
            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((resource_type, resource_amount)) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        assert(resource_amount != 0, 'resource transfer amount is 0');

                        let sending_entity_resource = get!(world, (sending_entity_id, resource_type) , Resource);  
                        assert(sending_entity_resource.balance >= resource_amount, 'insufficient balance');

                        let receiving_entity_resource = get!(world, (receiving_entity_id, resource_type) , Resource);
                        set!(world, (
                            Resource { 
                                entity_id: sending_entity_id, 
                                resource_type: resource_type, 
                                balance: sending_entity_resource.balance - resource_amount
                            },
                            Resource { 
                                entity_id: receiving_entity_id, 
                                resource_type: resource_type, 
                                balance: receiving_entity_resource.balance + resource_amount
                            }
                        ));
                        
                        total_weight += WeightConfigImpl::get_weight(
                            world, resource_type, resource_amount
                        );
                    },
                    Option::None(_) => {break;}
                };
            };

            // ensure receiving entity has adequate capacity
            if receiving_entity_total_capacity != 0 {
                assert(
                    receiving_entity_total_capacity >= total_weight, 
                        'capacity not enough'
                );
            }
        }
    }




    #[external(v0)]
    impl ResourceChestSystemsImpl of IResourceChestSystems<ContractState> {

        /// Offload resources in a resource_chest from a caravan
        fn offload_chest(
            self: @ContractState, world: IWorldDispatcher, 
            entity_id: ID, entity_index_in_inventory: u128, 
            receiving_entity_id: ID, transport_id: ID
            ) {

            caravan::check_owner(world, transport_id, starknet::get_caller_address());
            caravan::check_position(world, transport_id, receiving_entity_id);
            caravan::check_arrival_time(world, transport_id);

            InternalInventorySystemsImpl::remove(
                world, transport_id, entity_index_in_inventory, entity_id
                );
            InternalResourceChestSystemsImpl::offload(world, entity_id, receiving_entity_id);
            
        }
    }



    #[generate_trait]
    impl InternalResourceChestSystemsImpl of InternalResourceChestTrait {

        fn create( 
                world: IWorldDispatcher, resource_types: Span<u8>, resource_amounts: Span<u128>
            ) -> (ResourceChest, u128) {

            assert(resource_types.len() == resource_amounts.len(), 'length not equal');
            
            let resource_chest_id = world.uuid().into();

            // create the chest
            let mut index = 0;
            let mut resources_weight = 0;
            loop {
                if index == resource_types.len() {
                    break ();
                }
                let resource_type = *resource_types[index];
                let resource_amount = *resource_amounts[index];
                set!(world,(
                    DetachedResource {
                        entity_id: resource_chest_id,
                        index,
                        resource_type,
                        resource_amount
                    }
                ));

              
                // update resources total weight
                let resource_type_weight 
                    = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);
                resources_weight += resource_type_weight.weight_gram * resource_amount;
                index += 1;
            };

            let resource_chest 
                = ResourceChest {
                    entity_id:resource_chest_id,
                    locked_until: 0,
                    resources_count: resource_types.len(),
                };

            set!(world,(resource_chest));

            (resource_chest, resources_weight)
        }

        fn fill(world: IWorldDispatcher, entity_id: u128, donor_id: u128 ) {
            
            let resource_chest = get!(world, entity_id, ResourceChest);
            let mut resource_chest_weight = get!(world, entity_id, Weight);
            assert(resource_chest_weight.value == 0, 'chest is not empty');

            // create the chest
            let mut index = 0;
            let mut resources_weight = 0;
            loop {
                if index == resource_chest.resources_count {
                    break ();
                }
                let detached_resource = get!(world, (entity_id, index), DetachedResource);
                let mut donor_resource = get!(world, (donor_id, detached_resource.resource_type), Resource);
                assert(donor_resource.balance >= detached_resource.resource_amount, 'insufficient balance');
                
                // remove resources from donor's balance
                donor_resource.balance -= detached_resource.resource_amount;
                set!(world, (donor_resource));
            
                // update resources total weight
                let resource_type_weight 
                    = get!(world, (WORLD_CONFIG_ID, detached_resource.resource_type), WeightConfig);
                resources_weight += resource_type_weight.weight_gram * detached_resource.resource_amount;
                index += 1;
            };

            // update chest weight
            resource_chest_weight.value = resources_weight;
            set!(world,(resource_chest_weight));

        }


        fn lock_until(world: IWorldDispatcher, entity_id: u128, ts: u64) {

            let mut resource_chest = get!(world, entity_id, ResourceChest);
            
            // update locked time
            resource_chest.locked_until = ts;
            set!(world, (resource_chest));
        }


        fn offload(world: IWorldDispatcher, entity_id: ID, receiving_entity_id: ID) {
            let mut resource_chest = get!(world, entity_id, ResourceChest);
            let mut resource_chest_weight = get!(world, entity_id, Weight);
            assert(resource_chest_weight.value != 0, 'chest is empty');
            
            // ensure that receiver has enough weight capacity
            let receiver_weight = get!(world, receiving_entity_id, Weight);

            let receiver_capacity = get!(world, receiving_entity_id, Capacity);
            let receiver_quantity = get!(world, receiving_entity_id, Quantity);

            assert(
                receiver_capacity
                    .can_carry_weight(
                            receiving_entity_id, 
                            receiver_quantity.get_value(), 
                            receiver_weight.value + resource_chest_weight.value
                        ),
                'not enough capacity'
            );

            // return resources to the entity
            let mut index = 0;
            loop {
                if index == resource_chest.resources_count {
                    break ();
                };

                let resource_chest_resource 
                    = get!(world, (resource_chest.entity_id, index), DetachedResource);
                
                let mut receiving_entity_resource 
                    = get!(world, (receiving_entity_id, resource_chest_resource.resource_type), Resource);

                // update entity balance
                receiving_entity_resource.balance += resource_chest_resource.resource_amount;
                set!(world,( receiving_entity_resource ));

                index += 1;
            };

            // reset resource chest
            resource_chest.resources_count = 0;
            resource_chest.locked_until = 0;
            set!(world,(resource_chest));

            // reset resource chest weight
            resource_chest_weight.value = 0;
            set!(world,(resource_chest_weight));

        }

    }



    #[generate_trait]
    impl InternalInventorySystemsImpl of InternalInventorySystemsTrait {

        fn get_foreign_key(inventory: Inventory, index: u128) -> felt252 {
                let foreign_key_arr 
                    = array![
                        inventory.entity_id.into(), 
                        inventory.items_key.into(), 
                        index.into()
                    ];
               return poseidon_hash_span(foreign_key_arr.span());
        }

        fn add(world: IWorldDispatcher, entity_id: ID, item_id: ID) {

                // ensure entity can carry the weight
                let item_weight = get!(world, item_id, Weight);
                assert(item_weight.value > 0, 'item is empty');

                let mut entity_weight = get!(world, entity_id, Weight);
                entity_weight.value += item_weight.value;

                let entity_capacity = get!(world, entity_id, Capacity); 
                if entity_capacity.weight_gram != 0  {
                    let entity_quantity = get!(world, entity_id, Quantity);
                    let entity_quantity = entity_quantity.get_value();
                    assert(
                        entity_capacity.weight_gram * entity_quantity 
                            >= entity_weight.value,
                            'capacity is not enough'
                    );
                }  
                set!(world, (entity_weight));

                // add item to inventory
                let mut inventory = get!(world, entity_id, Inventory);
                let foreign_key 
                    = InternalInventorySystemsImpl::get_foreign_key(inventory, inventory.items_count);
                set!(world, (
                    ForeignKey {
                        foreign_key: foreign_key,
                        entity_id: item_id
                    }
                ));

                // update entity's inventory
                inventory.items_count += 1;
                set!(world, (inventory));
        }

        /// Remove an item from an inventory
        fn remove(
            world: IWorldDispatcher, entity_id: ID, index: u128, item_id: ID
        ) {
            let mut inventory = get!(world, entity_id, Inventory);
            assert(inventory.items_count > 0, 'inventory is empty');

            let last_inventory_item_foreign_key 
                = InternalInventorySystemsImpl::get_foreign_key(inventory, inventory.items_count);
            let last_inventory_item = get!(world, last_inventory_item_foreign_key, ForeignKey);
 
                
            let current_inventory_item_foreign_key 
                = InternalInventorySystemsImpl::get_foreign_key(inventory, index);
            let mut current_inventory_item 
                = get!(world, current_inventory_item_foreign_key, ForeignKey);
            // ensure that the index maps to the item id 
            assert(current_inventory_item.entity_id == item_id, 'inventory: wrong index');

            current_inventory_item.entity_id = last_inventory_item.entity_id;
            inventory.items_count -= 1;

            set!(world, (current_inventory_item));
            set!(world, (inventory));

            // remove weight from entity
            let mut entity_weight = get!(world, entity_id, Weight);
            let mut item_weight = get!(world, item_id, Weight);
            entity_weight.value -= item_weight.value;
            set!(world, (entity_weight));
        }
    }
    
}