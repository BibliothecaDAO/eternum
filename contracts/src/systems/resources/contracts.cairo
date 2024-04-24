use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait IResourceSystems {
    fn approve(entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn send(sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn pickup(recipient_entity_id: ID, owner_entity_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::interface]
trait IInventorySystems {
    fn transfer_item(sender_id: ID, index: u128, receiver_id: ID);
}


#[dojo::contract]
mod resource_systems {
    use core::array::SpanTrait;

    use core::integer::BoundedInt;
    use core::poseidon::poseidon_hash_span;
    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::config::{WeightConfig, WeightConfigImpl};
    use eternum::models::inventory::{Inventory, InventoryTrait};
    use eternum::models::metadata::ForeignKey;
    use eternum::models::movable::{ArrivalTime, ArrivalTimeTrait};
    use eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceTrait, ResourceAllowance};
    use eternum::models::resources::{ResourceChest, DetachedResource};
    use eternum::models::road::RoadImpl;
    use eternum::models::weight::Weight;
    use eternum::systems::transport::contracts::donkey_systems::donkey_systems::{
        InternalDonkeySystemsImpl as donkey
    };

    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl as travel
    };

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        recipient_entity_id: u128,
        #[key]
        sending_realm_id: u128,
        sender_entity_id: u128,
        resources: Span<(u8, u128)>
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
    }

    #[abi(embed_v0)]
    impl ResourceSystemsImpl of super::IResourceSystems<ContractState> {
        /// Approve an entity to spend or pickup resources.
        ///
        /// # Arguments
        ///
        /// * `entity_id` - The id of the entity approving the resources.
        /// * `recipient_entity_id` - The id of the entity being approved.
        /// * `resources` - The resources to approve.  
        ///      
        fn approve(
            world: IWorldDispatcher,
            entity_id: ID,
            recipient_entity_id: ID,
            resources: Span<(u8, u128)>
        ) {
            assert(entity_id != recipient_entity_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            let entity_owner = get!(world, entity_id, Owner);
            assert(
                entity_owner.address == starknet::get_caller_address(), 'not owner of entity id'
            );

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        set!(
                            world,
                            (ResourceAllowance {
                                owner_entity_id: entity_id,
                                approved_entity_id: recipient_entity_id,
                                resource_type: resource_type,
                                amount: resource_amount
                            })
                        );
                    },
                    Option::None(_) => { break; }
                };
            };
        }

        /// Send a resource from an entity to another. This involves
        /// one way transportation of resources from one entity's location 
        /// to another. This would be useful to gift out resources or for other 
        /// similar purposes
        ///
        /// # Arguments
        ///
        /// * `sender_entity_id` - The id of the entity sending the resources.
        /// * `recipient_entity_id` - The id of the entity receiving the resources.
        /// * `resources` - The resources to transfer.  
        ///
        /// # Returns
        ///     the resource chest id
        ///
        fn send(
            world: IWorldDispatcher,
            sender_entity_id: ID,
            recipient_entity_id: ID,
            resources: Span<(u8, u128)>
        ) {
            assert(sender_entity_id != recipient_entity_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            get!(world, sender_entity_id, Owner).assert_caller_owner();

            InternalResourceSystemsImpl::transfer(
                world, sender_entity_id, sender_entity_id, recipient_entity_id, resources
            );
        }


        /// Pick up a resource from another entity which has previously approved
        /// you to collect or spend the resources you want to pick up
        ///
        /// # Arguments
        ///
        /// * `owner_entity_id` - The id of the entity resource owner
        /// * `recipient_entity_id` - The id of the entity receiving resources.
        /// * `resources` - The resources to transfer.  
        ///      
        /// # Returns
        ///    the resource chest id
        ///
        fn pickup(
            world: IWorldDispatcher,
            recipient_entity_id: ID,
            owner_entity_id: ID,
            resources: Span<(u8, u128)>
        ) {
            assert(owner_entity_id != recipient_entity_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            get!(world, recipient_entity_id, Owner).assert_caller_owner();

            // check and update allowance

            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance = get!(
                            world,
                            (owner_entity_id, recipient_entity_id, resource_type),
                            ResourceAllowance
                        );

                        assert(
                            approved_allowance.amount >= resource_amount, 'insufficient approval'
                        );

                        if (approved_allowance.amount != BoundedInt::max()) {
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            set!(world, (approved_allowance));
                        }
                    },
                    Option::None(_) => { break; }
                };
            };

            InternalResourceSystemsImpl::transfer(
                world, recipient_entity_id, owner_entity_id, recipient_entity_id, resources
            );
        }
    }

    #[generate_trait]
    impl InternalResourceSystemsImpl of InternalResourceSystemsTrait {
        fn mint(world: IWorldDispatcher, receiver_id: ID, mut resources: Span<(u8, u128)>) {
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let mut entity_resource = ResourceImpl::get(
                            world, (receiver_id, *resource_type)
                        );

                        entity_resource.balance += *resource_amount;
                        entity_resource.save(world);
                    },
                    Option::None(()) => { break; }
                }
            }
        }

        fn transfer(
            world: IWorldDispatcher,
            caller_id: ID,
            sender_id: ID,
            receiver_id: ID,
            resources: Span<(u8, u128)>
        ) -> ID {
            // entities may not have arrived at the location shown in their Position, so ..

            // ensure owner is not moving because they provide the resources
            get!(world, sender_id, ArrivalTime).assert_not_travelling();

            // ensure caller is not moving because they receiver the resources
            get!(world, receiver_id, ArrivalTime).assert_not_travelling();

            // create resource chest
            let resource_chest = InternalResourceChestSystemsImpl::create_and_fill(
                world, sender_id, resources
            );


            // lock resource chest for travel duration and burn donkeys
            // if recipient and owner arent at the same location

            let owner_coord: Coord = get!(world, sender_id, Position).into();
            let receiver_coord: Coord = get!(world, receiver_id, Position).into();
            if owner_coord == receiver_coord {
                // give resource chest to receiver
                InternalInventorySystemsImpl::add(world, receiver_id, resource_chest.entity_id);
            } else {

                // create donkey that can carry Weight
                let resources_weight = get!(world, resource_chest.entity_id, Weight);
                let donkey_id: ID = donkey::create_donkey(
                    world, caller_id, receiver_id,  resources_weight.value, owner_coord, receiver_coord);
                
                // give resource chest to donkey
                InternalInventorySystemsImpl::add(world, donkey_id, resource_chest.entity_id);

                // lock resource chest till it is in possession of the owner
                let donkey_arrival_time : ArrivalTime = get!(world, donkey_id, ArrivalTime);
                let is_round_trip: bool = caller_id == receiver_id;
                if is_round_trip {
                    InternalResourceChestSystemsImpl::lock_until(
                        world, resource_chest.entity_id, donkey_arrival_time.arrives_at / 2
                    );
                }
            }

            // emit transfer event
            InternalResourceSystemsImpl::emit_transfer_event(
                world, sender_id, receiver_id, resources
            );

            resource_chest.entity_id
        }

        fn emit_transfer_event(
            world: IWorldDispatcher,
            sender_entity_id: ID,
            recipient_entity_id: ID,
            resources: Span<(u8, u128)>
        ) {
            let mut sending_realm_id = 0;

            let sending_realm = get!(world, sender_entity_id, Realm);
            if sending_realm.realm_id != 0 {
                sending_realm_id = sending_realm.realm_id;
            } else {
                let sending_entity_owner = get!(world, sender_entity_id, EntityOwner);
                sending_realm_id = sending_entity_owner.get_realm_id(world);
            }

            emit!(
                world,
                (
                    Event::Transfer(
                        Transfer {
                            recipient_entity_id, sending_realm_id, sender_entity_id, resources
                        }
                    ),
                )
            );
        }


        fn check_capacity(
            world: IWorldDispatcher,
            entity_capacity: Capacity,
            entity_quantity: Quantity,
            mut entity_current_weight: Weight,
            additional_weight: u128,
            throw_error: bool
        ) -> bool {
            // ensure that receiver has enough weight capacity
            if entity_capacity.is_capped() {
                entity_current_weight.value += additional_weight;

                let can_carry = entity_capacity
                    .can_carry_weight(entity_quantity.get_value(), entity_current_weight.value);

                if throw_error {
                    assert(can_carry, 'not enough capacity');
                }

                return can_carry;
            }

            return true;
        }
    }


    #[abi(embed_v0)]
    impl InventorySystemsImpl of super::IInventorySystems<ContractState> {
        /// Transfer item from inventory
        fn transfer_item(world: IWorldDispatcher, sender_id: ID, index: u128, receiver_id: ID) {
            travel::check_owner(world, sender_id, starknet::get_caller_address());
            travel::check_position(world, sender_id, receiver_id);
            travel::check_arrival_time(world, sender_id);
            travel::check_arrival_time(world, receiver_id);

            // remove resource chest from sender's inventory
            let item_id = InternalInventorySystemsImpl::remove(world, sender_id, index);

            // remove resources from resource chest and give receiver
            InternalResourceChestSystemsImpl::offload(world, sender_id, item_id, receiver_id);
        }
    }


    #[generate_trait]
    impl InternalResourceChestSystemsImpl of InternalResourceChestTrait {
        fn create(world: IWorldDispatcher, resources: Span<(u8, u128)>) -> (ResourceChest, u128) {
            let resource_chest_id = world.uuid().into();

            // create the chest
            let mut index = 0;
            let mut resources_weight = 0;
            loop {
                if index == resources.len() {
                    break;
                }

                let (resource_type, resource_amount) = *resources.at(index);

                set!(
                    world,
                    (DetachedResource {
                        entity_id: resource_chest_id, index, resource_type, resource_amount
                    })
                );

                // update resources total weight
                let resource_type_weight = get!(
                    world, (WORLD_CONFIG_ID, resource_type), WeightConfig
                );
                resources_weight += resource_type_weight.weight_gram * resource_amount;
                index += 1;
            };

            let resource_chest = ResourceChest {
                entity_id: resource_chest_id, locked_until: 0, resources_count: resources.len(),
            };

            set!(world, (resource_chest));

            (resource_chest, resources_weight)
        }

        fn fill(world: IWorldDispatcher, entity_id: u128, donor_id: u128) {
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
                let mut donor_resource = ResourceImpl::get(
                    world, (donor_id, detached_resource.resource_type)
                );

                // burn resources from donor's balance
                donor_resource.burn(detached_resource.resource_amount);
                donor_resource.save(world);

                // update resources total weight
                let resource_type_weight = get!(
                    world, (WORLD_CONFIG_ID, detached_resource.resource_type), WeightConfig
                );
                resources_weight += resource_type_weight.weight_gram
                    * detached_resource.resource_amount;
                index += 1;
            };

            // update chest weight
            resource_chest_weight.value = resources_weight;
            set!(world, (resource_chest_weight));
        }


        fn create_and_fill(
            world: IWorldDispatcher, donor_id: u128, resources: Span<(u8, u128)>
        ) -> ResourceChest {
            let resource_chest_id = world.uuid().into();

            // create the chest
            let mut index = 0;
            let mut resources_weight = 0;
            loop {
                if index == resources.len() {
                    break;
                }

                let (resource_type, resource_amount) = *resources.at(index);
                if donor_id != 0 {
                    let mut donor_resource = ResourceImpl::get(world, (donor_id, resource_type));
                    assert(donor_resource.balance >= resource_amount, 'insufficient balance');

                    // remove resources from donor's balance
                    donor_resource.balance -= resource_amount;
                    donor_resource.save(world);
                }

                // create detached resource
                set!(
                    world,
                    (DetachedResource {
                        entity_id: resource_chest_id, index, resource_type, resource_amount
                    })
                );

                // update resources total weight
                let resource_type_weight = get!(
                    world, (WORLD_CONFIG_ID, resource_type), WeightConfig
                );
                resources_weight += resource_type_weight.weight_gram * resource_amount;
                index += 1;
            };

            // create resource chest
            let resource_chest = ResourceChest {
                entity_id: resource_chest_id, locked_until: 0, resources_count: resources.len(),
            };
            set!(
                world,
                (resource_chest, Weight { entity_id: resource_chest_id, value: resources_weight })
            );

            resource_chest
        }


        fn lock_until(world: IWorldDispatcher, entity_id: u128, ts: u64) {
            let mut resource_chest = get!(world, entity_id, ResourceChest);

            // update locked time
            resource_chest.locked_until = ts;
            set!(world, (resource_chest));
        }


        fn offload(
            world: IWorldDispatcher, sender_entity_id: ID, chest_id: ID, recipient_entity_id: ID
        ) {
            let mut resource_chest = get!(world, chest_id, ResourceChest);
            assert(
                resource_chest.locked_until <= starknet::get_block_timestamp(), 'chest is locked'
            );

            let mut resource_chest_weight = get!(world, chest_id, Weight);
            assert(resource_chest_weight.value != 0, 'chest is empty');

            // ensure that receiver has enough weight capacity
            let receiver_capacity = get!(world, recipient_entity_id, Capacity);
            if receiver_capacity.is_capped() {
                let receiver_quantity = get!(world, recipient_entity_id, Quantity);
                let mut receiver_weight = get!(world, recipient_entity_id, Weight);
                receiver_weight.value += resource_chest_weight.value;

                assert(
                    receiver_capacity
                        .can_carry_weight(receiver_quantity.get_value(), receiver_weight.value),
                    'not enough capacity'
                );

                // update receiver weight
                set!(world, (receiver_weight));
            }

            // return resources to the entity
            let mut index = 0;
            let mut resources: Array<(u8, u128)> = array![];
            loop {
                if index == resource_chest.resources_count {
                    break ();
                };

                let resource_chest_resource = get!(
                    world, (resource_chest.entity_id, index), DetachedResource
                );

                let mut receiving_entity_resource = ResourceImpl::get(
                    world, (recipient_entity_id, resource_chest_resource.resource_type)
                );

                // update entity balance
                receiving_entity_resource.balance += resource_chest_resource.resource_amount;
                receiving_entity_resource.save(world);

                resources
                    .append(
                        (
                            resource_chest_resource.resource_type,
                            resource_chest_resource.resource_amount
                        )
                    );

                index += 1;
            };

            // reset resource chest
            resource_chest.resources_count = 0;
            resource_chest.locked_until = 0;
            set!(world, (resource_chest));

            // reset resource chest weight
            resource_chest_weight.value = 0;
            set!(world, (resource_chest_weight));

            InternalResourceSystemsImpl::emit_transfer_event(
                world, sender_entity_id, recipient_entity_id, resources.span()
            );
        }
    }


    #[generate_trait]
    impl InternalInventorySystemsImpl of InternalInventorySystemsTrait {
        fn get_foreign_key(inventory: Inventory, index: u128) -> felt252 {
            let foreign_key_arr = array![
                inventory.entity_id.into(), inventory.items_key.into(), index.into()
            ];
            return poseidon_hash_span(foreign_key_arr.span());
        }

        fn add(world: IWorldDispatcher, entity_id: ID, item_id: ID) {
            let mut inventory: Inventory = get!(world, entity_id, Inventory);
            if inventory.items_key == 0 {
                inventory.items_key = world.uuid().into();
                set!(world, (inventory));
            }

            let item_weight = get!(world, item_id, Weight);
            assert(item_weight.value > 0, 'no item weight');

            // ensure entity can carry the weight
            let mut entity_weight = get!(world, entity_id, Weight);
            let entity_capacity = get!(world, entity_id, Capacity);
            let entity_quantity = get!(world, entity_id, Quantity);

            InternalResourceSystemsImpl::check_capacity(
                world, entity_capacity, entity_quantity, entity_weight, item_weight.value, true
            );

            entity_weight.value += item_weight.value;
            set!(world, (entity_weight));

            // add item to inventory
            let mut inventory = get!(world, entity_id, Inventory);
            let mut item_fk = inventory.next_item_fk(world);
            item_fk.entity_id = item_id;
            set!(world, (item_fk));

            inventory.items_count += 1;
            set!(world, (inventory));
        }


        fn add_many(world: IWorldDispatcher, entity_id: ID, mut item_ids: Span<ID>) {
            let mut entity_weight = get!(world, entity_id, Weight);
            let entity_capacity = get!(world, entity_id, Capacity);
            let entity_quantity = get!(world, entity_id, Quantity);

            let mut inventory = get!(world, entity_id, Inventory);
            assert(inventory.items_key != 0, 'entity has no inventory');

            loop {
                match item_ids.pop_front() {
                    Option::Some(item_id) => {
                        // ensure entity can carry the weight
                        let item_weight = get!(world, *item_id, Weight);
                        assert(item_weight.value > 0, 'no item weight');
                        InternalResourceSystemsImpl::check_capacity(
                            world,
                            entity_capacity,
                            entity_quantity,
                            entity_weight,
                            item_weight.value,
                            true
                        );

                        // update entity weight
                        entity_weight.value += item_weight.value;

                        // add item to inventory
                        let mut inventory = get!(world, entity_id, Inventory);
                        let mut item_fk = inventory.next_item_fk(world);
                        item_fk.entity_id = *item_id;
                        set!(world, (item_fk));

                        // update inventory item count
                        inventory.items_count += 1;
                    },
                    Option::None => { break; }
                }
            };

            // update entity's final weight
            set!(world, (entity_weight));

            // update entity's final inventory
            set!(world, (inventory));
        }

        /// transfer all items from sender inventory to receiver 
        /// inventory until the receiver reaches capacity
        ///
        /// we assume `indexes` is in ascending order
        fn transfer_max_between_inventories(
            world: IWorldDispatcher, sender_inventory: Inventory, receiver_inventory: Inventory
        ) -> Span<u128> {
            let mut sender_chests_indexes = array![];
            let mut index = 0;
            loop {
                if index == sender_inventory.items_count {
                    break;
                }
                sender_chests_indexes.append(index);

                index += 1;
            };

            let sent_chests_ids = InternalInventorySystemsImpl::transfer_between_inventories(
                world, sender_inventory, receiver_inventory, sender_chests_indexes.span()
            );

            sent_chests_ids
        }


        /// transfer items from sender inventory to receiver inventory
        /// until the receiver reaches capacity
        /// indexes - the indexes of items in sender's inventory to be 
        ///             transferred to receiver
        ///
        /// we assume `indexes` is in ascending order
        fn transfer_between_inventories(
            world: IWorldDispatcher,
            mut sender_inventory: Inventory,
            mut receiver_inventory: Inventory,
            mut indexes_asc: Span<u128>
        ) -> Span<u128> {
            assert(sender_inventory.items_count > 0, 'inventory is empty');

            let mut sent_chest_ids = array![];

            let sender_id = sender_inventory.entity_id;
            let receiver_id = receiver_inventory.entity_id;

            let mut last_selected_index = sender_inventory.items_count;
            let mut sender_weight = get!(world, sender_id, Weight);
            let mut receiver_weight = get!(world, receiver_id, Weight);
            let mut receiver_capacity = get!(world, receiver_id, Capacity);
            let mut receiver_quantity = get!(world, receiver_id, Quantity);

            loop {
                match indexes_asc.pop_back() {
                    Option::Some(index) => {
                        // ensure indexes are in ascending order
                        assert(*index < last_selected_index, 'not ascending order');
                        last_selected_index = *index;

                        // ensure that receiver can carry item
                        let mut sender_item_fk = sender_inventory.item_fk(world, *index);
                        let mut sender_item_id = sender_item_fk.entity_id;
                        let mut sent_item_weight = get!(world, sender_item_id, Weight);
                        let receiver_cant_carry: bool = InternalResourceSystemsImpl::check_capacity(
                            world,
                            receiver_capacity,
                            receiver_quantity,
                            receiver_weight,
                            sent_item_weight.value,
                            false
                        ) == false;

                        if receiver_cant_carry {
                            continue;
                        }

                        // add item to receiver's inventory
                        let mut receiver_item_fk = receiver_inventory
                            .item_fk(world, receiver_inventory.items_count);
                        receiver_item_fk.entity_id = sender_item_fk.entity_id;
                        receiver_inventory.items_count += 1;
                        sent_chest_ids.append(sender_item_fk.entity_id);
                        set!(world, (receiver_item_fk));

                        // remove item from sender's inventory by swapping it with 
                        /// last inventory item and removing the last item
                        sender_item_fk.entity_id = sender_inventory.last_item_id(world);
                        sender_inventory.items_count -= 1;
                        set!(world, (sender_item_fk));

                        // + and - weights of receiver and sender
                        sender_weight.value -= sent_item_weight.value;
                        receiver_weight.value += sent_item_weight.value;
                    },
                    Option::None => { break; }
                }
            };

            // update sender and receiver weights
            set!(world, (sender_weight, receiver_weight));

            // update sender and receiver inventory
            set!(world, (sender_inventory, receiver_inventory));

            sent_chest_ids.span()
        }

        /// Remove an item from an inventory
        fn remove(world: IWorldDispatcher, entity_id: ID, index: u128) -> u128 {
            let mut inventory: Inventory = get!(world, entity_id, Inventory);
            assert(inventory.items_count > 0, 'inventory is empty');

            // remove weight from entity
            let mut entity_weight = get!(world, entity_id, Weight);
            let mut current_item_fk = inventory.item_fk(world, index);
            let mut current_item_id = current_item_fk.entity_id;
            let mut current_item_weight = get!(world, current_item_id, Weight);
            entity_weight.value -= current_item_weight.value;
            set!(world, (entity_weight));

            // swap last item with current item to 
            // then reduce inventory item count by 1

            let last_item_id = inventory.last_item_id(world);
            current_item_fk.entity_id = last_item_id;
            inventory.items_count -= 1;

            set!(world, (current_item_fk));
            set!(world, (inventory));

            current_item_id
        }
    }
}
