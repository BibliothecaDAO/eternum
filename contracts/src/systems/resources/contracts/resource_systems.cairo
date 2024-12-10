use dojo::world::IWorldDispatcher;
use s0_eternum::alias::ID;

#[starknet::interface]
trait IResourceSystems<T> {
    fn approve(ref self: T, entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn send(ref self: T, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn pickup(ref self: T, recipient_entity_id: ID, owner_entity_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod resource_systems {
    use core::array::ArrayTrait;
    use core::array::SpanTrait;
    use core::num::traits::Bounded;
    use core::poseidon::poseidon_hash_span as hash;
    use core::zeroable::Zeroable;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use s0_eternum::alias::ID;

    use s0_eternum::constants::{WORLD_CONFIG_ID, DEFAULT_NS};
    use s0_eternum::models::config::{
        WeightConfig, WeightConfigImpl, CapacityConfig, CapacityConfigImpl, CapacityConfigCategory
    };
    use s0_eternum::models::movable::{ArrivalTime, ArrivalTimeTrait};
    use s0_eternum::models::owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait};
    use s0_eternum::models::position::{Position, Coord};
    use s0_eternum::models::quantity::{Quantity,};
    use s0_eternum::models::realm::Realm;
    use s0_eternum::models::resources::{
        Resource, ResourceImpl, ResourceTrait, ResourceAllowance, ResourceTransferLock, ResourceTransferLockTrait
    };
    use s0_eternum::models::resources::{DetachedResource};
    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s0_eternum::models::weight::Weight;
    use s0_eternum::models::weight::WeightTrait;
    use s0_eternum::systems::transport::contracts::donkey_systems::donkey_systems::{
        InternalDonkeySystemsImpl as donkey
    };
    use s0_eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl as travel
    };

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct Transfer {
        #[key]
        recipient_entity_id: ID,
        #[key]
        sending_realm_id: ID,
        sender_entity_id: ID,
        resources: Span<(u8, u128)>,
        timestamp: u64,
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
        fn approve(ref self: ContractState, entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(entity_id != recipient_entity_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            let entity_owner: EntityOwner = world.read_model(entity_id);
            entity_owner.assert_caller_owner(world);

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        world
                            .write_model(
                                @ResourceAllowance {
                                    owner_entity_id: entity_id,
                                    approved_entity_id: recipient_entity_id,
                                    resource_type: resource_type,
                                    amount: resource_amount
                                }
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
        fn send(ref self: ContractState, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(sender_entity_id != recipient_entity_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            let entity_owner: EntityOwner = world.read_model(sender_entity_id);
            entity_owner.assert_caller_owner(world);

            InternalResourceSystemsImpl::transfer(
                ref world, sender_entity_id, recipient_entity_id, resources, sender_entity_id, true, true
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
        fn pickup(ref self: ContractState, recipient_entity_id: ID, owner_entity_id: ID, resources: Span<(u8, u128)>) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(owner_entity_id != recipient_entity_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            let entity_owner: EntityOwner = world.read_model(recipient_entity_id);
            entity_owner.assert_caller_owner(world);

            // check and update allowance

            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance: ResourceAllowance = world
                            .read_model((owner_entity_id, recipient_entity_id, resource_type));

                        assert(approved_allowance.amount >= resource_amount, 'insufficient approval');

                        if (approved_allowance.amount != Bounded::MAX) {
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            world.write_model(@approved_allowance);
                        }
                    },
                    Option::None(_) => { break; }
                };
            };

            InternalResourceSystemsImpl::transfer(
                ref world, owner_entity_id, recipient_entity_id, resources, recipient_entity_id, true, true
            );
        }
    }

    #[generate_trait]
    pub impl InternalResourceSystemsImpl of InternalResourceSystemsTrait {
        // send resources to a bank's location but retain ownership of the resources
        fn send_to_bank(ref world: WorldStorage, owner_id: ID, bank_id: ID, resource: (u8, u128),) -> ID {
            // ensure owner and bank are stationary
            let arrival_time: ArrivalTime = world.read_model(owner_id);
            arrival_time.assert_not_travelling();
            let arrival_time: ArrivalTime = world.read_model(bank_id);
            arrival_time.assert_not_travelling();

            // ensure bank_id is a valid bank
            let bank_structure: Structure = world.read_model(bank_id);
            bank_structure.assert_is_structure();
            assert!(bank_structure.category == StructureCategory::Bank, "structure is not a bank");

            // ensure owner and bank are not in the same location
            let owner_position: Position = world.read_model(owner_id);
            let owner_coord: Coord = owner_position.into();
            let bank_position: Position = world.read_model(bank_id);
            let bank_coord: Coord = bank_position.into();
            assert!(owner_coord != bank_coord, "owner and bank are in the same location");

            // ensure resource spending is not locked
            let owner_resource_lock: ResourceTransferLock = world.read_model(owner_id);
            owner_resource_lock.assert_not_locked();

            //
            // Allow sending resources to the bank even with battle resource lock
            // This is so as not to block bridge withdrawals at any point
            //

            // // ensure bank has no resource lock
            // let bank_resource_lock: ResourceTransferLock = world.read_model(bank_id);
            // bank_resource_lock.assert_not_locked();

            // burn resources from sender's balance
            let (resource_type, resource_amount) = resource;
            let mut owner_resource = ResourceImpl::get(ref world, (owner_id, resource_type));
            owner_resource.burn(resource_amount);
            world.write_model(@owner_resource);

            // add resources to donkey going to bank
            let donkey_to_bank_id = world.dispatcher.uuid();
            let mut donkey_to_bank_resource = ResourceImpl::get(ref world, (donkey_to_bank_id, resource_type));
            donkey_to_bank_resource.add(resource_amount);
            donkey_to_bank_resource.save(ref world);

            // update total weight
            let mut total_resources_weight = WeightConfigImpl::get_weight_grams(
                ref world, resource_type, resource_amount
            );

            // increase donkey's weight
            let mut donkey_to_bank_weight: Weight = world.read_model(donkey_to_bank_id);
            donkey_to_bank_weight.value = total_resources_weight;
            world.write_model(@donkey_to_bank_weight);

            // decrease owner's weight
            let mut owner_weight: Weight = world.read_model(owner_id);
            let owner_capacity: CapacityConfig = CapacityConfigImpl::get_from_entity(ref world, owner_id);
            owner_weight.deduct(owner_capacity, total_resources_weight);
            world.write_model(@owner_weight);

            // create donkey that can carry weight
            donkey::create_donkey(ref world, false, donkey_to_bank_id, owner_id, owner_coord, bank_coord);
            donkey::burn_donkey(ref world, owner_id, total_resources_weight, true);

            // emit transfer event
            Self::emit_transfer_event(ref world, owner_id, donkey_to_bank_id, array![resource].span());

            donkey_to_bank_id
        }

        fn transfer(
            ref world: WorldStorage,
            owner_id: ID,
            recipient_id: ID,
            mut resources: Span<(u8, u128)>,
            transport_provider_id: ID,
            transport_resource_burn: bool,
            enforce_owner_payment: bool
        ) -> (ID, felt252, u128) {
            let arrival_time: ArrivalTime = world.read_model(owner_id);
            arrival_time.assert_not_travelling();
            let arrival_time: ArrivalTime = world.read_model(recipient_id);
            arrival_time.assert_not_travelling();

            let owner_position: Position = world.read_model(owner_id);
            let owner_coord: Coord = owner_position.into();
            let recipient_position: Position = world.read_model(recipient_id);
            let recipient_coord: Coord = recipient_position.into();
            let mut actual_recipient_id: ID = recipient_id;
            let transport_is_needed: bool = owner_coord.is_non_zero() && owner_coord != recipient_coord;
            if transport_is_needed {
                actual_recipient_id = world.dispatcher.uuid()
            };

            // transfer resources from sender to recipient
            let mut total_resources_weight = 0;
            let mut resources_felt_arr: Array<felt252> = array![];
            let mut resources_clone = resources.clone();

            // ensure resource spending is not locked
            if enforce_owner_payment {
                let owner_resource_lock: ResourceTransferLock = world.read_model(owner_id);
                owner_resource_lock.assert_not_locked();
            }

            // ensure resource receipt is not locked
            let recipient_resource_lock: ResourceTransferLock = world.read_model(actual_recipient_id);
            recipient_resource_lock.assert_not_locked();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        if enforce_owner_payment {
                            // burn resources from sender's balance
                            let mut owner_resource = ResourceImpl::get(ref world, (owner_id, resource_type));
                            owner_resource.burn(resource_amount);
                            owner_resource.save(ref world);
                        }

                        // add resources to recipient's balance
                        let mut recipient_resource = ResourceImpl::get(ref world, (actual_recipient_id, resource_type));
                        recipient_resource.add(resource_amount);
                        recipient_resource.save(ref world);

                        // update total weight
                        total_resources_weight +=
                            WeightConfigImpl::get_weight_grams(ref world, resource_type, resource_amount);

                        // update resources hash
                        resources_felt_arr.append(resource_type.into());
                        resources_felt_arr.append(resource_amount.into());
                    },
                    Option::None => { break; }
                }
            };

            // increase recipient weight
            let mut recipient_weight: Weight = world.read_model(actual_recipient_id);
            let recipient_capacity: CapacityConfig = if !transport_is_needed {
                CapacityConfigImpl::get_from_entity(ref world, actual_recipient_id)
            } else {
                world.read_model(CapacityConfigCategory::Donkey)
            };
            if !transport_is_needed {
                let recipient_quantity: Quantity = world.read_model(actual_recipient_id);
                recipient_weight.add(recipient_capacity, recipient_quantity, total_resources_weight);
                world.write_model(@recipient_weight);
            } else {
                recipient_weight.value = total_resources_weight;
                world.write_model(@recipient_weight);
            }

            if enforce_owner_payment {
                // decrease sender weight
                let mut owner_weight: Weight = world.read_model(owner_id);
                let owner_capacity: CapacityConfig = CapacityConfigImpl::get_from_entity(ref world, owner_id);
                owner_weight.deduct(owner_capacity, total_resources_weight);
                world.write_model(@owner_weight);
            }

            if transport_is_needed {
                // create donkey that can carry weight
                let is_round_trip = transport_provider_id == recipient_id;
                donkey::create_donkey(
                    ref world, is_round_trip, actual_recipient_id, recipient_id, owner_coord, recipient_coord
                );
                if transport_resource_burn {
                    donkey::burn_donkey(ref world, transport_provider_id, total_resources_weight, true);
                }
            }

            // emit transfer event
            Self::emit_transfer_event(ref world, owner_id, actual_recipient_id, resources);

            (actual_recipient_id, hash(resources_felt_arr.span()), total_resources_weight)
        }

        fn mint_if_adequate_capacity(
            ref world: WorldStorage, recipient_id: ID, resource: (u8, u128), check_lock: bool
        ) -> (u128, bool) {
            // ensure recipient is not travelling
            let arrival_time: ArrivalTime = world.read_model(recipient_id);
            arrival_time.assert_not_travelling();

            let mut success = false;

            // only add to balance if receiver can carry weight
            let (resource_type, resource_amount) = resource;
            let mut total_resources_weight = 0;
            total_resources_weight += WeightConfigImpl::get_weight_grams(ref world, resource_type, resource_amount);
            let mut recipient_weight: Weight = world.read_model(recipient_id);
            let recipient_capacity: CapacityConfig = CapacityConfigImpl::get_from_entity(ref world, recipient_id);
            let recipient_quantity: Quantity = world.read_model(recipient_id);

            recipient_weight.value += total_resources_weight;
            if !recipient_capacity.is_capped() || recipient_capacity.can_carry(recipient_quantity, recipient_weight) {
                recipient_weight.value -= total_resources_weight;
                recipient_weight.add(recipient_capacity, recipient_quantity, total_resources_weight);
                world.write_model(@recipient_weight);

                // ensure resource recepient is not locked from receiving
                if check_lock {
                    let recipient_resource_lock: ResourceTransferLock = world.read_model(recipient_id);
                    recipient_resource_lock.assert_not_locked();
                }

                // add resource to recipient's balance
                let mut recipient_resource = ResourceImpl::get(ref world, (recipient_id, resource_type));
                recipient_resource.add(resource_amount);
                recipient_resource.save(ref world);

                // emit transfer event
                Self::emit_transfer_event(ref world, 0, recipient_id, array![resource].span());

                success = true;
            }

            (total_resources_weight, success)
        }

        fn emit_transfer_event(
            ref world: WorldStorage, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            let mut sending_realm_id = 0;

            let sending_realm: Realm = world.read_model(sender_entity_id);
            if sending_realm.realm_id != 0 {
                sending_realm_id = sending_realm.realm_id;
            } else {
                let sending_entity_owner: EntityOwner = world.read_model(sender_entity_id);
                sending_realm_id = sending_entity_owner.get_realm_id(world);
            }

            world
                .emit_event(
                    @Transfer {
                        recipient_entity_id,
                        sending_realm_id,
                        sender_entity_id,
                        resources,
                        timestamp: starknet::get_block_timestamp()
                    }
                );
        }
    }
}
