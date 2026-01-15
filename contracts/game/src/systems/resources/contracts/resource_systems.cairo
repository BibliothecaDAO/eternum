use crate::alias::ID;

#[starknet::interface]
pub trait IResourceSystems<T> {
    fn approve(ref self: T, caller_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>);
    fn send(ref self: T, sender_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>);
    fn pickup(ref self: T, recipient_structure_id: ID, owner_structure_id: ID, resources: Span<(u8, u128)>);
    fn arrivals_offload(ref self: T, from_structure_id: ID, day: u64, slot: u8, resource_count: u8);
    fn troop_troop_adjacent_transfer(
        ref self: T, from_explorer_id: ID, to_explorer_id: ID, resources: Span<(u8, u128)>,
    );
    fn troop_structure_adjacent_transfer(
        ref self: T, from_explorer_id: ID, to_structure_id: ID, resources: Span<(u8, u128)>,
    );
    fn structure_troop_adjacent_transfer(
        ref self: T, from_structure_id: ID, to_troop_id: ID, resources: Span<(u8, u128)>,
    );
    fn troop_burn(ref self: T, explorer_id: ID, resources: Span<(u8, u128)>);
    fn structure_burn(ref self: T, structure_id: ID, resources: Span<(u8, u128)>);
    fn structure_regularize_weight(ref self: T, structure_ids: Array<ID>);
}

#[dojo::contract]
pub mod resource_systems {
    use core::array::SpanTrait;
    use core::num::traits::Bounded;
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{SeasonConfigImpl, SpeedImpl};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::TravelTrait;
    use crate::models::resource::arrivals::ResourceArrivalImpl;
    use crate::models::resource::resource::{
        ResourceAllowance, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureImpl, StructureOwnerStoreImpl,
    };
    use crate::models::troop::ExplorerTroops;
    use crate::models::weight::Weight;
    use crate::systems::utils::distance::iDistanceKmImpl;
    use crate::systems::utils::donkey::iDonkeyImpl;
    use crate::systems::utils::resource::iResourceTransferImpl;
    use crate::systems::utils::troop::iExplorerImpl;
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

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplicitResourceBurn {
        #[key]
        pub entity_id: ID,
        #[key]
        pub entity_owner_id: ID,
        pub resources: Span<(u8, u128)>,
        pub timestamp: u64,
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

            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

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
            ref self: ContractState, sender_structure_id: ID, recipient_structure_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

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
                recipient_structure_base,
                ref recipient_structure_weight,
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
            ref self: ContractState, recipient_structure_id: ID, owner_structure_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

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
            }

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
                recipient_structure_base,
                ref recipient_structure_weight,
                resources,
                false,
                true,
            );
        }

        fn troop_troop_adjacent_transfer(
            ref self: ContractState, from_explorer_id: ID, to_explorer_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            assert!(from_explorer_id.is_non_zero(), "from_explorer_id does not exist");
            assert!(to_explorer_id.is_non_zero(), "from_explorer_id does not exist");

            // ensure from explorer is owned by caller
            let from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            from_explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure to explorer exists
            let to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
            assert!(to_explorer.owner.is_non_zero(), "to_explorer does not exist");

            // ensure troop and stucture are adjacent to each other
            assert!(from_explorer.coord.is_adjacent(to_explorer.coord), "troops are not adjacent to each other");

            let mut from_explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, from_explorer_id);
            let mut to_explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, to_explorer_id);
            iResourceTransferImpl::troop_to_troop_instant(
                ref world, from_explorer, ref from_explorer_weight, to_explorer, ref to_explorer_weight, resources,
            );
        }


        fn troop_structure_adjacent_transfer(
            ref self: ContractState, from_explorer_id: ID, to_structure_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            assert!(from_explorer_id.is_non_zero(), "from_explorer_id does not exist");
            assert!(to_structure_id.is_non_zero(), "to_structure_id does not exist");

            // ensure explorer is owned by caller
            let explorer: ExplorerTroops = world.read_model(from_explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure to_structure is a structure
            let to_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, to_structure_id);
            to_structure.assert_exists();

            // ensure to_structure is owned by caller
            // let to_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, to_structure_id);
            // to_structure_owner.assert_caller_owner();

            // ensure troop and stucture are adjacent to each other
            assert!(explorer.coord.is_adjacent(to_structure.coord()), "troop and structure are not adjacent");

            let mut from_explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, from_explorer_id);
            let mut to_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, to_structure_id);
            iResourceTransferImpl::troop_to_structure_instant(
                ref world,
                from_explorer_id,
                ref from_explorer_weight,
                to_structure_id,
                ref to_structure_weight,
                resources,
            );
        }

        fn structure_troop_adjacent_transfer(
            ref self: ContractState, from_structure_id: ID, to_troop_id: ID, resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            assert!(from_structure_id.is_non_zero(), "from_structure_id does not exist");
            assert!(to_troop_id.is_non_zero(), "to_troop_id does not exist");

            // ensure from_structure is owned by caller
            let from_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            from_structure_owner.assert_caller_owner();

            // ensure to_troop is owned by caller
            // let to_troop_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, to_troop.owner);
            // to_troop_owner.assert_caller_owner();

            // ensure from_structure and to_troop are adjacent to each other
            let to_troop: ExplorerTroops = world.read_model(to_troop_id);
            let from_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            assert!(from_structure.coord().is_adjacent(to_troop.coord), "from_structure and to_troop are not adjacent");

            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            let mut to_troop_weight: Weight = WeightStoreImpl::retrieve(ref world, to_troop_id);
            iResourceTransferImpl::structure_to_troop_instant(
                ref world, from_structure_id, ref from_structure_weight, to_troop_id, ref to_troop_weight, resources,
            );
        }

        fn troop_burn(ref self: ContractState, explorer_id: ID, resources: Span<(u8, u128)>) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            assert!(explorer_id.is_non_zero(), "from_explorer_id does not exist");

            // ensure from explorer is owned by caller
            let explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // burn resources
            let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
            iResourceTransferImpl::troop_burn_instant(ref world, explorer, ref explorer_weight, resources);

            world
                .emit_event(
                    @ExplicitResourceBurn {
                        entity_id: explorer_id,
                        entity_owner_id: explorer.owner,
                        resources: resources,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn structure_burn(ref self: ContractState, structure_id: ID, resources: Span<(u8, u128)>) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

            // ensure structure is owned by caller
            assert!(structure_id.is_non_zero(), "structure_id does not exist");
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // burn resources
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            iResourceTransferImpl::structure_burn_instant(ref world, structure_id, ref structure_weight, resources);

            world
                .emit_event(
                    @ExplicitResourceBurn {
                        entity_id: structure_id,
                        entity_owner_id: 0,
                        resources: resources,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }

        fn structure_regularize_weight(ref self: ContractState, structure_ids: Array<ID>) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_grace_period_not_elapsed();

            assert!(structure_ids.len() != 0, "structure_ids is empty");
            // regularize weight
            iResourceTransferImpl::structure_weight_regularize(ref world, structure_ids);
        }

        fn arrivals_offload(ref self: ContractState, from_structure_id: ID, day: u64, slot: u8, resource_count: u8) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

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
