use eternum::models::position::Coord;

#[dojo::interface]
trait IHyperstructureSystems {
    fn create(ref world: IWorldDispatcher, creator_entity_id: u128, coord: Coord) -> u128;
    fn contribute_to_construction(
        ref world: IWorldDispatcher,
        hyperstructure_entity_id: u128,
        contributor_entity_id: u128,
        contributions: Span<(u8, u128)>
    );
}


#[dojo::contract]
mod hyperstructure_systems {
    use core::array::ArrayIndex;
    use eternum::alias::ID;
    use eternum::constants::{
        HYPERSTRUCTURE_CONFIG_ID, ResourceTypes, get_resources_without_earthenshards
    };
    use eternum::models::config::HyperstructureConfigCustomTrait;
    use eternum::models::hyperstructure::{Progress, Contribution};
    use eternum::models::order::{Orders};
    use eternum::models::owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::position::{Coord, Position, PositionIntoCoord};
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{Resource, ResourceCustomImpl, ResourceCost};
    use eternum::models::structure::{
        Structure, StructureCount, StructureCountCustomTrait, StructureCategory
    };
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    struct HyperstructureFinished {
        hyperstructure_entity_id: u128,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    impl HyperstructureSystemsImpl of super::IHyperstructureSystems<ContractState> {
        fn create(ref world: IWorldDispatcher, creator_entity_id: u128, coord: Coord) -> u128 {
            get!(world, creator_entity_id, Owner).assert_caller_owner();

            InternalTravelSystemsImpl::assert_tile_explored(world, coord);

            // assert no structure is already built on the coords
            let structure_count: StructureCount = get!(world, coord, StructureCount);
            structure_count.assert_none();

            let hyperstructure_shards_config = HyperstructureConfigCustomTrait::get(
                world, ResourceTypes::EARTHEN_SHARD
            );

            let mut creator_resources = ResourceCustomImpl::get(
                world, (creator_entity_id, ResourceTypes::EARTHEN_SHARD)
            );

            creator_resources.burn(hyperstructure_shards_config.amount_for_completion);
            creator_resources.save(world);

            let new_uuid: u128 = world.uuid().into();

            set!(
                world,
                (
                    Structure { entity_id: new_uuid, category: StructureCategory::Hyperstructure },
                    StructureCount { coord, count: 1 },
                    Position { entity_id: new_uuid, x: coord.x, y: coord.y },
                    Owner { entity_id: new_uuid, address: starknet::get_caller_address() },
                    EntityOwner { entity_id: new_uuid, entity_owner_id: new_uuid },
                    Progress {
                        hyperstructure_entity_id: new_uuid,
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: hyperstructure_shards_config.amount_for_completion
                    },
                    Contribution {
                        hyperstructure_entity_id: new_uuid,
                        player_address: starknet::get_caller_address(),
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: hyperstructure_shards_config.amount_for_completion
                    }
                )
            );

            new_uuid
        }

        fn contribute_to_construction(
            ref world: IWorldDispatcher,
            hyperstructure_entity_id: u128,
            contributor_entity_id: u128,
            contributions: Span<(u8, u128)>
        ) {
            get!(world, contributor_entity_id, Owner).assert_caller_owner();

            let structure = get!(world, hyperstructure_entity_id, Structure);
            assert(structure.category == StructureCategory::Hyperstructure, 'not a hyperstructure');

            let mut i = 0;
            let mut resource_was_completed = false;
            while (i < contributions.len()) {
                let contribution = *contributions.at(i);

                resource_was_completed = resource_was_completed
                    | InternalHyperstructureSystemsImpl::handle_contribution(
                        world, hyperstructure_entity_id, contribution, contributor_entity_id
                    );
                i += 1;
            };

            if (resource_was_completed
                && InternalHyperstructureSystemsImpl::check_if_construction_done(
                    world, hyperstructure_entity_id
                )) {
                let timestamp = starknet::get_block_timestamp();
                emit!(world, (HyperstructureFinished { hyperstructure_entity_id, timestamp }),);
            }
        }
    }


    #[generate_trait]
    impl InternalHyperstructureSystemsImpl of InternalHyperstructureSystemsTrait {
        fn handle_contribution(
            world: IWorldDispatcher,
            hyperstructure_entity_id: u128,
            contribution: (u8, u128),
            contributor_entity_id: u128
        ) -> bool {
            let (resource_type, contribution_amount) = contribution;

            let (max_contributable_amount, will_complete_resource) =
                Self::get_max_contribution_size(
                world, hyperstructure_entity_id, resource_type, contribution_amount
            );

            if (max_contributable_amount == 0) {
                return false;
            }

            Self::add_contribution(
                world, hyperstructure_entity_id, resource_type, max_contributable_amount,
            );
            Self::burn_player_resources(
                world, resource_type, max_contributable_amount, contributor_entity_id
            );

            Self::update_progress(
                world, hyperstructure_entity_id, resource_type, max_contributable_amount
            );

            return will_complete_resource;
        }

        fn burn_player_resources(
            world: IWorldDispatcher,
            resource_type: u8,
            resource_amount: u128,
            contributor_entity_id: u128
        ) {
            let mut creator_resources = ResourceCustomImpl::get(
                world, (contributor_entity_id, resource_type)
            );

            creator_resources.burn(resource_amount);
            creator_resources.save(world);
        }

        fn get_max_contribution_size(
            world: IWorldDispatcher,
            hyperstructure_entity_id: u128,
            resource_type: u8,
            resource_amount: u128
        ) -> (u128, bool) {
            let resource_progress = get!(
                world, (hyperstructure_entity_id, resource_type), Progress
            );
            let hyperstructure_resource_config = HyperstructureConfigCustomTrait::get(
                world, resource_type
            );
            let resource_amount_for_completion = hyperstructure_resource_config
                .amount_for_completion;

            let amount_left_for_completion = resource_amount_for_completion
                - resource_progress.amount;

            let max_contributable_amount = core::cmp::min(
                amount_left_for_completion, resource_amount
            );

            let will_complete_resource = resource_amount >= amount_left_for_completion;
            (max_contributable_amount, will_complete_resource)
        }

        fn add_contribution(
            world: IWorldDispatcher,
            hyperstructure_entity_id: u128,
            resource_type: u8,
            resource_amount: u128,
        ) {
            let player_address = starknet::get_caller_address();
            let mut contribution = get!(
                world, (hyperstructure_entity_id, player_address, resource_type), Contribution
            );
            contribution.amount += resource_amount;

            set!(world, (contribution,));
        }

        fn update_progress(
            world: IWorldDispatcher,
            hyperstructure_entity_id: u128,
            resource_type: u8,
            resource_amount: u128,
        ) {
            let mut resource_progress = get!(
                world, (hyperstructure_entity_id, resource_type), Progress
            );
            resource_progress.amount += resource_amount;
            set!(world, (resource_progress,));
        }

        fn check_if_construction_done(
            world: IWorldDispatcher, hyperstructure_entity_id: u128
        ) -> bool {
            let mut done = true;
            let all_resources = get_resources_without_earthenshards();

            let mut i = 0;
            while (i < all_resources.len()) {
                done =
                    Self::check_if_resource_completed(
                        world, hyperstructure_entity_id, *all_resources.at(i)
                    );
                if (done == false) {
                    break;
                }
                i += 1;
            };

            return done;
        }

        fn check_if_resource_completed(
            world: IWorldDispatcher, hyperstructure_entity_id: u128, resource_type: u8
        ) -> bool {
            let mut resource_progress = get!(
                world, (hyperstructure_entity_id, resource_type), Progress
            );

            let hyperstructure_resource_config = HyperstructureConfigCustomTrait::get(
                world, resource_type
            );
            let resource_amount_for_completion = hyperstructure_resource_config
                .amount_for_completion;

            resource_progress.amount == resource_amount_for_completion
        }
    }
}
