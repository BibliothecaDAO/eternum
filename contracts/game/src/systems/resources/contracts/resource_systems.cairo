use dojo::world::IWorldDispatcher;
use s1_eternum::alias::ID;

#[starknet::interface]
trait IResourceSystems<T> {
    fn approve(ref self: T, caller_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>);
    fn send(
        ref self: T,
        sender_structure_id: ID,
        recipient_structure_id: ID,
        resources: Span<(u8, u128)>,
        recipient_resource_indexes: Span<u8>,
    );
    fn pickup(
        ref self: T,
        recipient_structure_id: ID,
        owner_structure_id: ID,
        resources: Span<(u8, u128)>,
        recipient_resource_indexes: Span<u8>,
    );
    fn offload(ref self: T, from_structure_id: ID, day: u64, slot: u8, resource_count: u8);
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

    use s1_eternum::alias::ID;

    use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use s1_eternum::models::config::{CapacityConfig, SpeedImpl};
    use s1_eternum::models::owner::{EntityOwner, EntityOwnerTrait, Owner, OwnerTrait};
    use s1_eternum::models::position::{Coord, Position};
    use s1_eternum::models::quantity::{Quantity};
    use s1_eternum::models::realm::Realm;
    use s1_eternum::models::resource::arrivals::{ResourceArrival, ResourceArrivalImpl};
    use s1_eternum::models::resource::resource::{ResourceAllowance};
    use s1_eternum::models::resource::resource::{ResourceList};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureTrait};
    use s1_eternum::models::troop::{ExplorerTroops};
    use s1_eternum::models::weight::{Weight, WeightTrait};
    use s1_eternum::systems::utils::distance::{iDistanceImpl};
    use s1_eternum::systems::utils::donkey::{iDonkeyImpl};
    use s1_eternum::systems::utils::resource::{iResourceTransferImpl};


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct Transfer {
        #[key]
        recipient_structure_id: ID,
        #[key]
        sending_realm_id: ID,
        sender_structure_id: ID,
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
        /// * `recipient_structure_id` - The id of the entity being approved.
        /// * `resources` - The resources to approve.
        ///
        fn approve(
            ref self: ContractState, caller_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(caller_structure_id != recipient_structure_id, 'self approval');
            assert(resources.len() != 0, 'no resource to approve');

            let mut caller_structure: Structure = world.read_model(caller_structure_id);
            caller_structure.owner.assert_caller_owner();

            let mut resources = resources;
            loop {
                match resources.pop_front() {
                    Option::Some((
                        resource_type, resource_amount,
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        world
                            .write_model(
                                @ResourceAllowance {
                                    owner_entity_id: caller_structure_id,
                                    approved_entity_id: recipient_structure_id,
                                    resource_type: resource_type,
                                    amount: resource_amount,
                                },
                            );
                    },
                    Option::None(_) => { break; },
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
        /// * `sender_structure_id` - The id of the entity sending the resources.
        /// * `recipient_structure_id` - The id of the entity receiving the resources.
        /// * `resources` - The resources to transfer.
        ///
        /// # Returns
        ///     the resource chest id
        ///
        fn send(
            ref self: ContractState,
            sender_structure_id: ID,
            recipient_structure_id: ID,
            resources: Span<(u8, u128)>,
            recipient_resource_indexes: Span<u8>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(sender_structure_id != recipient_structure_id, 'transfer to self');
            assert(resources.len() != 0, 'no resource to transfer');

            // ensure sender is a structure
            let mut sender_structure: Structure = world.read_model(sender_structure_id);
            sender_structure.owner.assert_caller_owner();

            // ensure recipient is a structure
            let mut recipient_structure: Structure = world.read_model(recipient_structure_id);
            recipient_structure.assert_exists();

            let mut sender_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, sender_structure_id);
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                ref sender_structure,
                ref sender_structure_weight,
                ref recipient_structure,
                recipient_resource_indexes,
                resources,
                false,
                false,
            );
        }


        /// Pick up a resource from another entity which has previously approved
        /// you to collect or spend the resources you want to pick up
        ///
        /// # Arguments
        ///
        /// * `owner_structure_id` - The id of the entity resource owner
        /// * `recipient_structure_id` - The id of the entity receiving resources.
        /// * `resources` - The resources to transfer.
        ///
        /// # Returns
        ///    the resource chest id
        ///
        fn pickup(
            ref self: ContractState,
            recipient_structure_id: ID,
            owner_structure_id: ID,
            resources: Span<(u8, u128)>,
            recipient_resource_indexes: Span<u8>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert(owner_structure_id != recipient_structure_id, 'transfer to owner');
            assert(resources.len() != 0, 'no resource to transfer');

            // ensure sender is a structure
            let mut recipient_structure: Structure = world.read_model(recipient_structure_id);
            recipient_structure.owner.assert_caller_owner();

            // check and update allowance

            let mut resources_clone = resources.clone();
            loop {
                match resources_clone.pop_front() {
                    Option::Some((
                        resource_type, resource_amount,
                    )) => {
                        let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                        let mut approved_allowance: ResourceAllowance = world
                            .read_model((owner_structure_id, recipient_structure_id, resource_type));

                        assert(approved_allowance.amount >= resource_amount, 'insufficient approval');

                        if (approved_allowance.amount != Bounded::MAX) {
                            // spend allowance if they don't have infinite approval
                            approved_allowance.amount -= resource_amount;
                            world.write_model(@approved_allowance);
                        }
                    },
                    Option::None(_) => { break; },
                };
            };

            let mut owner_structure: Structure = world.read_model(owner_structure_id);
            let mut owner_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, owner_structure_id);
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                ref owner_structure,
                ref owner_structure_weight,
                ref recipient_structure,
                recipient_resource_indexes,
                resources,
                false,
                true,
            );
        }


        fn offload(ref self: ContractState, from_structure_id: ID, day: u64, slot: u8, resource_count: u8) {
            let mut world = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            assert!(from_structure_id.is_non_zero(), "from_structure_id does not exist");

            // ensure from_structure is owned by caller
            let mut from_structure: Structure = world.read_model(from_structure_id);
            from_structure.owner.assert_caller_owner();

            // move balance from resource arrivals to structure balance
            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            iResourceTransferImpl::deliver_arrivals(
                ref world, ref from_structure, ref from_structure_weight, day, slot, resource_count,
            );
        }
    }
}
