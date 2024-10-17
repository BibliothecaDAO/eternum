use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::{
    models::{position::Coord, config::HyperstructureResourceConfigCustomTrait, hyperstructure::Access},
    constants::{get_contributable_resources_with_rarity, RESOURCE_PRECISION}
};
use starknet::ContractAddress;

#[dojo::interface]
trait IHyperstructureSystems {
    fn create(ref world: IWorldDispatcher, creator_entity_id: ID, coord: Coord) -> ID;
    fn contribute_to_construction(
        ref world: IWorldDispatcher,
        hyperstructure_entity_id: ID,
        contributor_entity_id: ID,
        contributions: Span<(u8, u128)>
    );
    fn set_co_owners(
        ref world: IWorldDispatcher, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>
    );
    fn end_game(
        ref world: IWorldDispatcher,
        hyperstructures_contributed_to: Span<ID>,
        hyperstructure_shareholder_epochs: Span<(ID, u16)>
    );
    fn set_access(ref world: IWorldDispatcher, hyperstructure_entity_id: ID, access: Access);
}


#[dojo::contract]
mod hyperstructure_systems {
    use core::array::ArrayIndex;
    use eternum::models::hyperstructure::SeasonCustomImpl;
    use eternum::{
        alias::ID,
        constants::{
            HYPERSTRUCTURE_CONFIG_ID, ResourceTypes, get_resources_without_earthenshards,
            get_contributable_resources_with_rarity, RESOURCE_PRECISION
        },
        models::{
            config::{HyperstructureResourceConfigCustomTrait, HyperstructureConfig, CapacityConfigCategory},
            capacity::{CapacityCategory},
            hyperstructure::{Progress, Contribution, Hyperstructure, HyperstructureCustomImpl, Epoch, Access},
            owner::{Owner, OwnerCustomTrait, EntityOwner, EntityOwnerCustomTrait},
            position::{Coord, Position, PositionIntoCoord}, realm::{Realm},
            resources::{Resource, ResourceCustomImpl, ResourceCost},
            structure::{Structure, StructureCount, StructureCountCustomTrait, StructureCategory}, guild::{GuildMember}
        },
        systems::{transport::contracts::travel_systems::travel_systems::InternalTravelSystemsImpl},
    };

    use starknet::{ContractAddress, contract_address_const};

    use super::calculate_total_contributable_amount;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct HyperstructureFinished {
        #[key]
        id: ID,
        #[key]
        hyperstructure_entity_id: ID,
        contributor_entity_id: ID,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct HyperstructureCoOwnersChange {
        #[key]
        id: ID,
        #[key]
        hyperstructure_entity_id: ID,
        co_owners: Span<(ContractAddress, u16)>,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct HyperstructureContribution {
        #[key]
        id: ID,
        #[key]
        hyperstructure_entity_id: ID,
        contributor_entity_id: ID,
        contributions: Span<(u8, u128)>,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct GameEnded {
        #[key]
        winner_address: ContractAddress,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    impl HyperstructureSystemsImpl of super::IHyperstructureSystems<ContractState> {
        fn create(ref world: IWorldDispatcher, creator_entity_id: ID, coord: Coord) -> ID {
            SeasonCustomImpl::assert_season_is_not_over(world);

            get!(world, creator_entity_id, Owner).assert_caller_owner();

            InternalTravelSystemsImpl::assert_tile_explored(world, coord);

            // assert no structure is already built on the coords
            let structure_count: StructureCount = get!(world, coord, StructureCount);
            structure_count.assert_none();

            let hyperstructure_shards_config = HyperstructureResourceConfigCustomTrait::get(
                world, ResourceTypes::EARTHEN_SHARD
            );

            let mut creator_resources = ResourceCustomImpl::get(
                world, (creator_entity_id, ResourceTypes::EARTHEN_SHARD)
            );

            creator_resources.burn(hyperstructure_shards_config.amount_for_completion);
            creator_resources.save(world);

            let new_uuid: ID = world.uuid();

            let current_time = starknet::get_block_timestamp();

            set!(
                world,
                (
                    Structure {
                        entity_id: new_uuid, category: StructureCategory::Hyperstructure, created_at: current_time
                    },
                    Hyperstructure {
                        entity_id: new_uuid,
                        current_epoch: 0,
                        completed: false,
                        last_updated_by: contract_address_const::<0>(),
                        last_updated_timestamp: current_time,
                        access: Access::Public,
                    },
                    CapacityCategory { entity_id: new_uuid, category: CapacityConfigCategory::Structure },
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
            hyperstructure_entity_id: ID,
            contributor_entity_id: ID,
            contributions: Span<(u8, u128)>
        ) {
            SeasonCustomImpl::assert_season_is_not_over(world);

            get!(world, contributor_entity_id, Owner).assert_caller_owner();

            let structure = get!(world, hyperstructure_entity_id, Structure);
            assert!(structure.category == StructureCategory::Hyperstructure, "not a hyperstructure");

            let hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);
            hyperstructure.assert_access(world);

            let timestamp = starknet::get_block_timestamp();

            emit!(
                world,
                (HyperstructureContribution {
                    hyperstructure_entity_id, contributor_entity_id, contributions, timestamp, id: world.uuid()
                }),
            );

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
                && InternalHyperstructureSystemsImpl::check_if_construction_done(world, hyperstructure_entity_id)) {
                let mut hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);
                hyperstructure.completed = true;
                set!(world, (hyperstructure,));

                emit!(
                    world,
                    (HyperstructureFinished {
                        hyperstructure_entity_id, contributor_entity_id, timestamp, id: world.uuid()
                    }),
                );
            }
        }

        fn set_co_owners(
            ref world: IWorldDispatcher, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>
        ) {
            SeasonCustomImpl::assert_season_is_not_over(world);

            assert!(co_owners.len() <= 10, "too many co-owners");

            let caller = starknet::get_caller_address();

            let owner = get!(world, hyperstructure_entity_id, Owner);
            owner.assert_caller_owner();

            let hyperstructure_config = get!(world, HYPERSTRUCTURE_CONFIG_ID, HyperstructureConfig);

            let mut hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);

            let timestamp = starknet::get_block_timestamp();

            if (hyperstructure.last_updated_by == caller) {
                assert!(
                    timestamp
                        - hyperstructure.last_updated_timestamp > hyperstructure_config.time_between_shares_change,
                    "time between shares change not passed"
                );
            }

            let mut total: u16 = 0;
            let mut i = 0;
            while (i < co_owners.len()) {
                let (_, percentage) = *co_owners.at(i);
                total += percentage;
                i += 1;
            };
            assert!(total == 10000, "total percentage must be 10000");

            let epoch = Epoch {
                hyperstructure_entity_id,
                index: hyperstructure.current_epoch,
                start_timestamp: timestamp,
                owners: co_owners
            };

            hyperstructure.last_updated_timestamp = timestamp;
            hyperstructure.last_updated_by = caller;
            hyperstructure.current_epoch += 1;

            set!(world, (hyperstructure, epoch,));

            emit!(
                world,
                (HyperstructureCoOwnersChange { id: world.uuid(), hyperstructure_entity_id, timestamp, co_owners })
            );
        }

        fn set_access(ref world: IWorldDispatcher, hyperstructure_entity_id: ID, access: Access) {
            let owner = get!(world, hyperstructure_entity_id, Owner);
            owner.assert_caller_owner();

            let mut hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);
            hyperstructure.access = access;

            if (access == Access::GuildOnly) {
                let caller_address = starknet::get_caller_address();
                let caller_guild_member = get!(world, caller_address, GuildMember);
                assert!(caller_guild_member.guild_entity_id != 0, "caller is not in a guild");
            }

            set!(world, (hyperstructure,));
        }

        fn end_game(
            ref world: IWorldDispatcher,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_shareholder_epochs: Span<(ID, u16)>
        ) {
            SeasonCustomImpl::assert_season_is_not_over(world);

            let mut total_points: u128 = 0;
            let hyperstructure_config = get!(world, HYPERSTRUCTURE_CONFIG_ID, HyperstructureConfig);

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                    world, hyperstructures_contributed_to
                );

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_share_points(world, hyperstructure_shareholder_epochs);

            assert!(total_points >= hyperstructure_config.points_for_win, "Not enough points to end the game");

            SeasonCustomImpl::end_season(world);

            emit!(
                world,
                (GameEnded {
                    winner_address: starknet::get_caller_address(), timestamp: starknet::get_block_timestamp()
                }),
            );
        }
    }

    #[generate_trait]
    pub impl InternalHyperstructureSystemsImpl of InternalHyperstructureSystemsTrait {
        fn handle_contribution(
            world: IWorldDispatcher, hyperstructure_entity_id: ID, contribution: (u8, u128), contributor_entity_id: ID
        ) -> bool {
            let (resource_type, contribution_amount) = contribution;

            let (max_contributable_amount, will_complete_resource) = Self::get_max_contribution_size(
                world, hyperstructure_entity_id, resource_type, contribution_amount
            );

            if (max_contributable_amount == 0) {
                return false;
            }

            Self::add_contribution(world, hyperstructure_entity_id, resource_type, max_contributable_amount,);
            Self::burn_player_resources(world, resource_type, max_contributable_amount, contributor_entity_id);

            Self::update_progress(world, hyperstructure_entity_id, resource_type, max_contributable_amount);

            return will_complete_resource;
        }

        fn burn_player_resources(
            world: IWorldDispatcher, resource_type: u8, resource_amount: u128, contributor_entity_id: ID
        ) {
            let mut creator_resources = ResourceCustomImpl::get(world, (contributor_entity_id, resource_type));

            creator_resources.burn(resource_amount);
            creator_resources.save(world);
        }

        fn get_max_contribution_size(
            world: IWorldDispatcher, hyperstructure_entity_id: ID, resource_type: u8, resource_amount: u128
        ) -> (u128, bool) {
            let resource_progress = get!(world, (hyperstructure_entity_id, resource_type), Progress);
            let hyperstructure_resource_config = HyperstructureResourceConfigCustomTrait::get(world, resource_type);
            let resource_amount_for_completion = hyperstructure_resource_config.amount_for_completion;

            let amount_left_for_completion = resource_amount_for_completion - resource_progress.amount;

            let max_contributable_amount = core::cmp::min(amount_left_for_completion, resource_amount);

            let will_complete_resource = resource_amount >= amount_left_for_completion;
            (max_contributable_amount, will_complete_resource)
        }

        fn add_contribution(
            world: IWorldDispatcher, hyperstructure_entity_id: ID, resource_type: u8, resource_amount: u128,
        ) {
            let player_address = starknet::get_caller_address();
            let mut contribution = get!(world, (hyperstructure_entity_id, player_address, resource_type), Contribution);
            contribution.amount += resource_amount;

            set!(world, (contribution,));
        }

        fn update_progress(
            world: IWorldDispatcher, hyperstructure_entity_id: ID, resource_type: u8, resource_amount: u128,
        ) {
            let mut resource_progress = get!(world, (hyperstructure_entity_id, resource_type), Progress);
            resource_progress.amount += resource_amount;
            set!(world, (resource_progress,));
        }

        fn check_if_construction_done(world: IWorldDispatcher, hyperstructure_entity_id: ID) -> bool {
            let mut done = true;
            let all_resources = get_resources_without_earthenshards();

            let mut i = 0;
            while (i < all_resources.len()) {
                done = Self::check_if_resource_completed(world, hyperstructure_entity_id, *all_resources.at(i));
                if (done == false) {
                    break;
                }
                i += 1;
            };

            return done;
        }

        fn check_if_resource_completed(
            world: IWorldDispatcher, hyperstructure_entity_id: ID, resource_type: u8
        ) -> bool {
            let mut resource_progress = get!(world, (hyperstructure_entity_id, resource_type), Progress);

            let hyperstructure_resource_config = HyperstructureResourceConfigCustomTrait::get(world, resource_type);
            let resource_amount_for_completion = hyperstructure_resource_config.amount_for_completion;

            resource_progress.amount == resource_amount_for_completion
        }

        fn compute_total_share_points(
            world: IWorldDispatcher, hyperstructure_shareholder_epochs: Span<(ID, u16)>,
        ) -> u128 {
            let mut points = 0;
            let mut i = 0;

            let timestamp = starknet::get_block_timestamp();

            let player_address = starknet::get_caller_address();
            while (i < hyperstructure_shareholder_epochs.len()) {
                let (hyperstructure_entity_id, index) = *hyperstructure_shareholder_epochs.at(i);

                let epoch = get!(world, (hyperstructure_entity_id, index), Epoch);
                let next_epoch = get!(world, (hyperstructure_entity_id, index + 1), Epoch);

                let next_epoch_start_timestamp = if (next_epoch.owners.len() == 0) {
                    timestamp
                } else {
                    next_epoch.start_timestamp
                };

                let time_elapsed = next_epoch_start_timestamp - epoch.start_timestamp;

                let mut j = 0;
                while (j < epoch.owners.len()) {
                    let (owner_address, share_percentage) = *epoch.owners.at(j);
                    if (owner_address == player_address) {
                        points += Self::compute_share_points(world, time_elapsed, share_percentage);
                    }
                    j += 1;
                };
                i += 1;
            };

            return points;
        }

        fn compute_share_points(world: IWorldDispatcher, time_elapsed: u64, share_percentage: u16) -> u128 {
            let hyperstructure_config = get!(world, HYPERSTRUCTURE_CONFIG_ID, HyperstructureConfig);
            let points_per_cycle = hyperstructure_config.points_per_cycle;

            let points = time_elapsed.into() * points_per_cycle * share_percentage.into() / 10000;
            return points;
        }


        fn compute_total_contribution_points(
            world: IWorldDispatcher, hyperstructures_contributed_to: Span<ID>
        ) -> u128 {
            let resources_with_rarity = get_contributable_resources_with_rarity();

            let hyperstructure_config = get!(world, HYPERSTRUCTURE_CONFIG_ID, HyperstructureConfig);

            let total_contributable_amount = calculate_total_contributable_amount(world);

            let mut total_points = 0;

            let mut i = 0;

            while (i < hyperstructures_contributed_to.len()) {
                let hyperstructure_entity_id = *hyperstructures_contributed_to.at(i);

                let mut hyperstructure = get!(world, hyperstructure_entity_id, Hyperstructure);

                if (!hyperstructure.completed) {
                    continue;
                }

                total_points +=
                    Self::compute_contributions_for_hyperstructure(
                        world,
                        total_contributable_amount,
                        hyperstructure_entity_id,
                        resources_with_rarity,
                        hyperstructure_config.points_on_completion
                    );

                i += 1;
            };

            return total_points;
        }

        fn compute_contributions_for_hyperstructure(
            world: IWorldDispatcher,
            total_contributable_amount: u128,
            hyperstructure_entity_id: ID,
            resources_with_rarity: Span<(u8, u128)>,
            points_on_completion: u128
        ) -> u128 {
            let player_address = starknet::get_caller_address();

            let mut total_points = 0;
            let mut i = 0;
            while (i < resources_with_rarity.len()) {
                let (resource_id, resource_rarity) = *resources_with_rarity.at(i);

                let contribution = get!(world, (hyperstructure_entity_id, player_address, resource_id), Contribution);

                total_points +=
                    Self::compute_contribution_points(
                        total_contributable_amount, resource_rarity, contribution.amount, points_on_completion
                    );

                i += 1;
            };

            return total_points;
        }

        fn compute_contribution_points(
            total_contributable_amount: u128, resource_rarity: u128, resource_quantity: u128, points_on_completion: u128
        ) -> u128 {
            let percentage = Self::get_total_points_percentage(
                total_contributable_amount, resource_rarity, resource_quantity
            );
            percentage * points_on_completion / 1_000_000
        }

        fn get_total_points_percentage(
            total_contributable_amount: u128, resource_rarity: u128, resource_quantity: u128,
        ) -> u128 {
            // resource rarity already has a x100 factor in
            let effective_contribution = (resource_quantity / RESOURCE_PRECISION) * (resource_rarity);
            effective_contribution * 1_000_000 / total_contributable_amount
        }
    }
}


fn calculate_total_contributable_amount(world: IWorldDispatcher) -> u128 {
    let resources_with_rarity = get_contributable_resources_with_rarity();
    let mut total: u128 = 0;

    let mut i = 0;
    loop {
        if i >= resources_with_rarity.len() {
            break;
        }

        let (resource_type, rarity) = *resources_with_rarity.at(i);
        let hyperstructure_resource_config = HyperstructureResourceConfigCustomTrait::get(world, resource_type);
        let amount = hyperstructure_resource_config.amount_for_completion;

        total += (amount / RESOURCE_PRECISION) * rarity.into();

        i += 1;
    };

    total
}
