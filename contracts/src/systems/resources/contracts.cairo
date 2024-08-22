use dojo::world::IWorldDispatcher;
use eternum::alias::ID;

#[dojo::interface]
trait IResourceSystems {
    fn approve(ref world: IWorldDispatcher, entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn send(ref world: IWorldDispatcher, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>);
    fn pickup(ref world: IWorldDispatcher, recipient_entity_id: ID, owner_entity_id: ID, resources: Span<(u8, u128)>);
}

#[dojo::contract]
mod resource_systems {
    use core::array::ArrayTrait;
    use core::array::SpanTrait;

    use core::num::traits::Bounded;
    use core::poseidon::poseidon_hash_span as hash;
    use core::zeroable::Zeroable;
    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID};
    use eternum::models::capacity::{Capacity, CapacityCustomTrait};
    use eternum::models::config::{WeightConfig, WeightConfigCustomImpl};
    use eternum::models::metadata::ForeignKey;
    use eternum::models::movable::{ArrivalTime, ArrivalTimeCustomTrait};
    use eternum::models::owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::{Quantity, QuantityCustomTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{
        Resource, ResourceCustomImpl, ResourceCustomTrait, ResourceAllowance, ResourceTransferLock,
        ResourceTransferLockCustomTrait
    };
    use eternum::models::resources::{DetachedResource};
    use eternum::models::road::RoadCustomImpl;
    use eternum::models::weight::Weight;
    use eternum::models::weight::WeightCustomTrait;
    use eternum::systems::transport::contracts::donkey_systems::donkey_systems::{InternalDonkeySystemsImpl as donkey};

    use eternum::systems::transport::contracts::travel_systems::travel_systems::{InternalTravelSystemsImpl as travel};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct Transfer {
        #[key]
        recipient_entity_id: ID,
        #[key]
        sending_realm_id: ID,
        sender_entity_id: ID,
        resources: Span<(u8, u128)>
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
        fn approve(ref world: IWorldDispatcher, entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>) {
            assert(entity_id != recipient_entity_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            get!(world, entity_id, EntityOwner).assert_caller_owner(world);

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
            ref world: IWorldDispatcher, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            assert(sender_entity_id != recipient_entity_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            get!(world, sender_entity_id, EntityOwner).assert_caller_owner(world);

            InternalResourceSystemsImpl::transfer(
                world, sender_entity_id, recipient_entity_id, resources, sender_entity_id, true, true
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
            ref world: IWorldDispatcher, recipient_entity_id: ID, owner_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            assert(owner_entity_id != recipient_entity_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            get!(world, recipient_entity_id, EntityOwner).assert_caller_owner(world);

            // check and update allowance

            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance = get!(
                            world, (owner_entity_id, recipient_entity_id, resource_type), ResourceAllowance
                        );

                        assert(approved_allowance.amount >= resource_amount, 'insufficient approval');

                        if (approved_allowance.amount != Bounded::MAX) {
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            set!(world, (approved_allowance));
                        }
                    },
                    Option::None(_) => { break; }
                };
            };

            InternalResourceSystemsImpl::transfer(
                world, owner_entity_id, recipient_entity_id, resources, recipient_entity_id, true, true
            );
        }
    }

    #[generate_trait]
    pub impl InternalResourceSystemsImpl of InternalResourceSystemsTrait {
        fn transfer(
            world: IWorldDispatcher,
            owner_id: ID,
            recipient_id: ID,
            mut resources: Span<(u8, u128)>,
            transport_provider_id: ID,
            transport_resource_burn: bool,
            enforce_owner_payment: bool
        ) -> (ID, felt252, u128) {
            get!(world, owner_id, ArrivalTime).assert_not_travelling();
            get!(world, recipient_id, ArrivalTime).assert_not_travelling();

            let owner_coord: Coord = get!(world, owner_id, Position).into();
            let recipient_coord: Coord = get!(world, recipient_id, Position).into();
            let mut actual_recipient_id: ID = recipient_id;
            let transport_is_needed: bool = owner_coord.is_non_zero() && owner_coord != recipient_coord;
            if transport_is_needed {
                actual_recipient_id = world.uuid()
            };

            // transfer resources from sender to recipient
            let mut total_resources_weight = 0;
            let mut resources_felt_arr: Array<felt252> = array![];
            let mut resources_clone = resources.clone();

            // ensure resource spending is not locked
            let owner_resource_lock: ResourceTransferLock = get!(world, owner_id, ResourceTransferLock);
            owner_resource_lock.assert_not_locked();

            // ensure resource receipt is not locked
            let recipient_resource_lock: ResourceTransferLock = get!(world, actual_recipient_id, ResourceTransferLock);
            recipient_resource_lock.assert_not_locked();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);

                        if enforce_owner_payment {
                            // burn resources from sender's balance
                            let mut owner_resource = ResourceCustomImpl::get(world, (owner_id, resource_type));
                            owner_resource.burn(resource_amount);
                            owner_resource.save(world);
                        }

                        // add resources to recipient's balance
                        let mut recipient_resource = ResourceCustomImpl::get(
                            world, (actual_recipient_id, resource_type)
                        );
                        recipient_resource.add(resource_amount);
                        recipient_resource.save(world);

                        // update total weight
                        total_resources_weight +=
                            WeightConfigCustomImpl::get_weight(world, resource_type, resource_amount);

                        // update resources hash
                        resources_felt_arr.append(resource_type.into());
                        resources_felt_arr.append(resource_amount.into());
                    },
                    Option::None => { break; }
                }
            };

            // increase recipient weight
            let mut recipient_weight: Weight = get!(world, actual_recipient_id, Weight);
            let recipient_capacity: Capacity = get!(world, actual_recipient_id, Capacity);
            let recipient_quantity: Quantity = get!(world, actual_recipient_id, Quantity);
            recipient_weight.add(recipient_capacity, recipient_quantity, total_resources_weight);
            set!(world, (recipient_weight));

            if enforce_owner_payment {
                // decrease sender weight
                let mut owner_weight: Weight = get!(world, owner_id, Weight);
                let owner_capacity: Capacity = get!(world, owner_id, Capacity);
                owner_weight.deduct(owner_capacity, total_resources_weight);
                set!(world, (owner_weight));
            }

            if transport_is_needed {
                // create donkey that can carry weight
                let is_round_trip = transport_provider_id == recipient_id;
                donkey::create_donkey(
                    world, is_round_trip, actual_recipient_id, recipient_id, owner_coord, recipient_coord
                );

                if transport_resource_burn {
                    donkey::burn_donkey(world, transport_provider_id, total_resources_weight);
                }
            }

            // emit transfer event
            Self::emit_transfer_event(world, owner_id, actual_recipient_id, resources);

            (actual_recipient_id, hash(resources_felt_arr.span()), total_resources_weight)
        }

        fn mint_if_adequate_capacity(
            world: IWorldDispatcher, recipient_id: ID, resource: (u8, u128), check_lock: bool
        ) -> (u128, bool) {
            // ensure recipient is not travelling
            get!(world, recipient_id, ArrivalTime).assert_not_travelling();

            let mut success = false;

            // only add to balance if receiver can carry weight
            let (resource_type, resource_amount) = resource;
            let mut total_resources_weight = 0;
            total_resources_weight += WeightConfigCustomImpl::get_weight(world, resource_type, resource_amount);
            let mut recipient_weight: Weight = get!(world, recipient_id, Weight);
            let recipient_capacity: Capacity = get!(world, recipient_id, Capacity);
            let recipient_quantity: Quantity = get!(world, recipient_id, Quantity);

            recipient_weight.value += total_resources_weight;
            if !recipient_capacity.is_capped() || recipient_capacity.can_carry(recipient_quantity, recipient_weight) {
                recipient_weight.value -= total_resources_weight;
                recipient_weight.add(recipient_capacity, recipient_quantity, total_resources_weight);
                set!(world, (recipient_weight));

                // ensure resource recepient is not locked from receiving
                if check_lock {
                    let recipient_resource_lock: ResourceTransferLock = get!(world, recipient_id, ResourceTransferLock);
                    recipient_resource_lock.assert_not_locked();
                }

                // add resource to recipient's balance
                let mut recipient_resource = ResourceCustomImpl::get(world, (recipient_id, resource_type));
                recipient_resource.add(resource_amount);
                recipient_resource.save(world);

                // emit transfer event
                Self::emit_transfer_event(world, 0, recipient_id, array![resource].span());

                success = true;
            }

            (total_resources_weight, success)
        }

        fn emit_transfer_event(
            world: IWorldDispatcher, sender_entity_id: ID, recipient_entity_id: ID, resources: Span<(u8, u128)>
        ) {
            let mut sending_realm_id = 0;

            let sending_realm = get!(world, sender_entity_id, Realm);
            if sending_realm.realm_id != 0 {
                sending_realm_id = sending_realm.realm_id;
            } else {
                let sending_entity_owner = get!(world, sender_entity_id, EntityOwner);
                sending_realm_id = sending_entity_owner.get_realm_id(world);
            }

            emit!(world, (Transfer { recipient_entity_id, sending_realm_id, sender_entity_id, resources }));
        }
    }
}
