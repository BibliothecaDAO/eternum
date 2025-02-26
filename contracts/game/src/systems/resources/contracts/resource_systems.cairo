use s1_eternum::alias::ID;

#[starknet::interface]
pub trait IResourceSystems<T> {
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
pub mod resource_systems {
    use core::array::SpanTrait;
    use core::num::traits::Bounded;
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use s1_eternum::alias::ID;

    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{SpeedImpl};
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};
    use s1_eternum::models::resource::resource::{ResourceAllowance};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureOwnerStoreImpl,
    };
    use s1_eternum::models::weight::{Weight};
    use s1_eternum::systems::utils::distance::{iDistanceImpl};
    use s1_eternum::systems::utils::donkey::{iDonkeyImpl};
    use s1_eternum::systems::utils::resource::{iResourceTransferImpl};
    use starknet::ContractAddress;


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

            // ensure caller owns the structure
            let caller_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, caller_structure_id,
            );
            caller_structure_owner.assert_caller_owner();

            // ensure recipient is a structure
            let recipient_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, recipient_structure_id,
            );
            recipient_structure_owner.assert_non_zero();

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

            // ensure sender owns the structure
            let sender_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, sender_structure_id,
            );
            sender_structure_owner.assert_caller_owner();

            // ensure recipient is a structure
            let mut recipient_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, recipient_structure_id,
            );
            recipient_structure_base.assert_exists();

            let mut sender_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, sender_structure_id);
            let mut sender_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, sender_structure_id,
            );
            let mut recipient_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, recipient_structure_id);
            let recipient_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, recipient_structure_id,
            );
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                sender_structure_id,
                sender_structure_owner,
                sender_structure_base,
                ref sender_structure_weight,
                recipient_structure_id,
                recipient_structure_owner,
                recipient_structure_base.coord(),
                ref recipient_structure_weight,
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

            // ensure recipient (caller ) owns the structure
            let recipient_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, recipient_structure_id,
            );
            recipient_structure_owner.assert_caller_owner();

            // ensure owner is a structure
            let owner_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, owner_structure_id);
            owner_structure_base.assert_exists();

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

            let mut owner_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, owner_structure_id,
            );
            let mut owner_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, owner_structure_id);
            let recipient_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, recipient_structure_id,
            );
            let mut recipient_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, recipient_structure_id);
            iResourceTransferImpl::structure_to_structure_delayed(
                ref world,
                owner_structure_id,
                owner_structure_owner,
                owner_structure_base,
                ref owner_structure_weight,
                recipient_structure_id,
                recipient_structure_owner,
                recipient_structure_base.coord(),
                ref recipient_structure_weight,
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
            let from_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            from_structure_owner.assert_caller_owner();

            // move balance from resource arrivals to structure balance
            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            iResourceTransferImpl::deliver_arrivals(
                ref world, from_structure_id, ref from_structure_weight, day, slot, resource_count,
            );
        }
    }
}
