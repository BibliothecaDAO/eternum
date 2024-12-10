use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::alias::ID;
use s0_eternum::constants::get_resource_tier;
use s0_eternum::{
    models::{
        position::Coord, config::HyperstructureResourceConfigTrait, config::HyperstructureResourceConfig,
        hyperstructure::Access
    },
    constants::{get_contributable_resources_with_rarity, RESOURCE_PRECISION}
};
use starknet::ContractAddress;

const LEADERBOARD_REGISTRATION_PERIOD: u64 = 60 * 60 * 24 * 4; // one week

#[starknet::interface]
trait IHyperstructureSystems<T> {
    fn get_points(
        ref self: T,
        player_address: ContractAddress,
        hyperstructures_contributed_to: Span<ID>,
        hyperstructure_shareholder_epochs: Span<(ID, u16)>
    ) -> (u128, u128, u128, u128);

    fn create(ref self: T, creator_entity_id: ID, coord: Coord) -> ID;
    fn contribute_to_construction(
        ref self: T, hyperstructure_entity_id: ID, contributor_entity_id: ID, contributions: Span<(u8, u128)>
    );
    fn set_co_owners(ref self: T, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>);
    fn end_game(
        ref self: T, hyperstructures_contributed_to: Span<ID>, hyperstructure_shareholder_epochs: Span<(ID, u16)>
    );
    fn set_access(ref self: T, hyperstructure_entity_id: ID, access: Access);
}


#[dojo::contract]
mod hyperstructure_systems {
    use achievement::store::{Store, StoreTrait};
    use core::array::ArrayIndex;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::models::season::{Season, SeasonImpl};
    use s0_eternum::utils::random::VRFImpl;
    use s0_eternum::utils::tasks::index::{Task, TaskTrait};
    use s0_eternum::{
        alias::ID,
        constants::{
            WORLD_CONFIG_ID, HYPERSTRUCTURE_CONFIG_ID, ResourceTypes, get_hyperstructure_construction_resources,
            get_contributable_resources_with_rarity, RESOURCE_PRECISION, get_resource_tier
        },
        models::{
            config::{
                HyperstructureResourceConfigTrait, HyperstructureConfig, HyperstructureResourceConfig, VRFConfigImpl,
                CapacityConfigCategory
            },
            capacity::{CapacityCategory},
            hyperstructure::{Progress, Contribution, Hyperstructure, HyperstructureImpl, Epoch, Access},
            owner::{Owner, OwnerTrait, EntityOwner, EntityOwnerTrait}, season::{Leaderboard},
            position::{Coord, Position, PositionIntoCoord}, realm::{Realm},
            resources::{Resource, ResourceImpl, ResourceCost},
            structure::{Structure, StructureCount, StructureCountTrait, StructureCategory}, guild::{GuildMember},
            name::{AddressName}
        },
        systems::{transport::contracts::travel_systems::travel_systems::InternalTravelSystemsImpl},
    };

    use starknet::{ContractAddress, contract_address_const};

    use super::{calculate_total_contributable_amount, LEADERBOARD_REGISTRATION_PERIOD};

    const SCALE_FACTOR: u128 = 1_000_000;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct HyperstructureStarted {
        #[key]
        id: ID,
        hyperstructure_entity_id: ID,
        creator_address_name: felt252,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct HyperstructureFinished {
        #[key]
        id: ID,
        #[key]
        hyperstructure_entity_id: ID,
        contributor_entity_id: ID,
        timestamp: u64,
        hyperstructure_owner_name: felt252,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct HyperstructureCoOwnersChange {
        #[key]
        id: ID,
        #[key]
        hyperstructure_entity_id: ID,
        co_owners: Span<(ContractAddress, u16)>,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
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
    #[dojo::event(historical: false)]
    struct GameEnded {
        #[key]
        winner_address: ContractAddress,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    impl HyperstructureSystemsImpl of super::IHyperstructureSystems<ContractState> {
        fn create(ref self: ContractState, creator_entity_id: ID, coord: Coord) -> ID {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let creator_owner: Owner = world.read_model(creator_entity_id);
            creator_owner.assert_caller_owner();

            InternalTravelSystemsImpl::assert_tile_explored(world, coord);

            // assert no structure is already built on the coords
            let structure_count: StructureCount = world.read_model(coord);
            structure_count.assert_none();

            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            let shard_resource_tier: u32 = get_resource_tier(ResourceTypes::EARTHEN_SHARD).into();
            let shards_resource_config = hyperstructure_resource_configs.at(shard_resource_tier - 1);
            let required_shards_amount = shards_resource_config.get_required_amount(0);

            let mut creator_resources = ResourceImpl::get(ref world, (creator_entity_id, ResourceTypes::EARTHEN_SHARD));

            creator_resources.burn(required_shards_amount);
            creator_resources.save(ref world);

            let new_uuid: ID = world.dispatcher.uuid();

            let current_time = starknet::get_block_timestamp();

            let vrf_provider: ContractAddress = VRFConfigImpl::get_provider_address(ref world);
            let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
            world
                .write_model(
                    @Structure {
                        entity_id: new_uuid, category: StructureCategory::Hyperstructure, created_at: current_time
                    }
                );

            world
                .write_model(
                    @Hyperstructure {
                        entity_id: new_uuid,
                        current_epoch: 0,
                        completed: false,
                        last_updated_by: contract_address_const::<0>(),
                        last_updated_timestamp: current_time,
                        access: Access::Public,
                        randomness: vrf_seed.try_into().unwrap()
                    }
                );

            world.write_model(@CapacityCategory { entity_id: new_uuid, category: CapacityConfigCategory::Structure },);
            world.write_model(@StructureCount { coord, count: 1 },);
            world.write_model(@Position { entity_id: new_uuid, x: coord.x, y: coord.y },);
            world.write_model(@Owner { entity_id: new_uuid, address: starknet::get_caller_address() },);
            world.write_model(@EntityOwner { entity_id: new_uuid, entity_owner_id: new_uuid },);
            world
                .write_model(
                    @Progress {
                        hyperstructure_entity_id: new_uuid,
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: required_shards_amount
                    },
                );
            world
                .write_model(
                    @Contribution {
                        hyperstructure_entity_id: new_uuid,
                        player_address: starknet::get_caller_address(),
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: required_shards_amount
                    },
                );

            let id = world.dispatcher.uuid();
            let creator_address_name: AddressName = world.read_model(starknet::get_caller_address());
            world
                .emit_event(
                    @HyperstructureStarted {
                        id,
                        hyperstructure_entity_id: new_uuid,
                        creator_address_name: creator_address_name.name,
                        timestamp: current_time
                    }
                );

            // [Achievement] Hyperstructure Creation
            let player_id: felt252 = creator_owner.address.into();
            let task_id: felt252 = Task::Builder.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: current_time,);

            new_uuid
        }

        fn contribute_to_construction(
            ref self: ContractState,
            hyperstructure_entity_id: ID,
            contributor_entity_id: ID,
            contributions: Span<(u8, u128)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let contributor_owner: Owner = world.read_model(contributor_entity_id);
            contributor_owner.assert_caller_owner();

            let structure: Structure = world.read_model(hyperstructure_entity_id);
            assert!(structure.category == StructureCategory::Hyperstructure, "not a hyperstructure");

            let hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
            hyperstructure.assert_access(ref world);

            let timestamp = starknet::get_block_timestamp();
            world
                .emit_event(
                    @HyperstructureContribution {
                        hyperstructure_entity_id,
                        contributor_entity_id,
                        contributions,
                        timestamp,
                        id: world.dispatcher.uuid()
                    }
                );

            let mut i = 0;
            let mut resource_was_completed = false;
            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            while (i < contributions.len()) {
                let contribution = *contributions.at(i);

                resource_was_completed = resource_was_completed
                    | InternalHyperstructureSystemsImpl::handle_contribution(
                        ref world,
                        hyperstructure_entity_id,
                        contribution,
                        contributor_entity_id,
                        hyperstructure.randomness,
                        hyperstructure_resource_configs
                    );
                i += 1;
            };

            if (resource_was_completed
                && InternalHyperstructureSystemsImpl::check_if_construction_done(
                    world, hyperstructure_entity_id, hyperstructure.randomness, hyperstructure_resource_configs
                )) {
                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
                hyperstructure.completed = true;
                world.write_model(@hyperstructure);

                let hyperstructure_owner: Owner = world.read_model(hyperstructure_entity_id);
                let hyperstructure_owner_name: AddressName = world.read_model(hyperstructure_owner.address);

                world
                    .emit_event(
                        @HyperstructureFinished {
                            hyperstructure_entity_id,
                            contributor_entity_id,
                            hyperstructure_owner_name: hyperstructure_owner_name.name,
                            timestamp,
                            id: world.dispatcher.uuid()
                        }
                    );
            }

            // [Achievement] Hyperstructure Contribution
            let player_id: felt252 = contributor_owner.address.into();
            let task_id: felt252 = Task::Opportunist.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: timestamp,);
        }

        fn set_co_owners(
            ref self: ContractState, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            assert!(co_owners.len() <= 10, "too many co-owners");

            // ensure the structure is a hyperstructure
            let structure: Structure = world.read_model(hyperstructure_entity_id);
            assert!(structure.category == StructureCategory::Hyperstructure, "not a hyperstructure");

            let caller = starknet::get_caller_address();

            let owner: Owner = world.read_model(hyperstructure_entity_id);
            owner.assert_caller_owner();

            let hyperstructure_config: HyperstructureConfig = world.read_model(HYPERSTRUCTURE_CONFIG_ID);

            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);

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

            world.write_model(@hyperstructure);
            world.write_model(@epoch);

            world
                .emit_event(
                    @HyperstructureCoOwnersChange {
                        id: world.dispatcher.uuid(), hyperstructure_entity_id, timestamp, co_owners
                    }
                );
        }

        fn set_access(ref self: ContractState, hyperstructure_entity_id: ID, access: Access) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let owner: Owner = world.read_model(hyperstructure_entity_id);
            owner.assert_caller_owner();

            // ensure the structure is a hyperstructure
            let structure: Structure = world.read_model(hyperstructure_entity_id);
            assert!(structure.category == StructureCategory::Hyperstructure, "not a hyperstructure");

            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
            hyperstructure.access = access;

            if (access == Access::GuildOnly) {
                let caller_address = starknet::get_caller_address();
                let caller_guild_member: GuildMember = world.read_model(caller_address);
                assert!(caller_guild_member.guild_entity_id != 0, "caller is not in a guild");
            }

            world.write_model(@hyperstructure);
        }

        fn end_game(
            ref self: ContractState,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_shareholder_epochs: Span<(ID, u16)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let player_address = starknet::get_caller_address();
            let mut total_points: u128 = 0;
            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                    ref world, hyperstructures_contributed_to, hyperstructure_resource_configs, player_address
                );

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_share_points(
                    world, hyperstructure_shareholder_epochs, player_address
                );

            // ensure the total points are enough to end the game
            let hyperstructure_config: HyperstructureConfig = world.read_model(HYPERSTRUCTURE_CONFIG_ID);
            assert!(
                total_points >= hyperstructure_config.points_for_win,
                "Not enough points to end the game. You have {} points, but need {}",
                total_points,
                hyperstructure_config.points_for_win
            );

            SeasonImpl::end_season(ref world);

            let winner_address = starknet::get_caller_address();
            world.emit_event(@GameEnded { winner_address, timestamp: starknet::get_block_timestamp() });

            let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
            leaderboard.registration_end_timestamp = starknet::get_block_timestamp() + LEADERBOARD_REGISTRATION_PERIOD;
            world.write_model(@leaderboard);

            // [Achievement] Win the game
            let player_id: felt252 = winner_address.into();
            let task_id: felt252 = Task::Warlord.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp(),);
        }


        fn get_points(
            ref self: ContractState,
            player_address: ContractAddress,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_shareholder_epochs: Span<(ID, u16)>
        ) -> (u128, u128, u128, u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            let contribution_points = InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                ref world, hyperstructures_contributed_to, hyperstructure_resource_configs, player_address
            );

            let share_points = InternalHyperstructureSystemsImpl::compute_total_share_points(
                world, hyperstructure_shareholder_epochs, player_address
            );

            let total_points = contribution_points + share_points;
            // ensure the total points are enough to end the game
            let hyperstructure_config: HyperstructureConfig = world.read_model(HYPERSTRUCTURE_CONFIG_ID);
            let points_for_win = hyperstructure_config.points_for_win;

            (contribution_points, share_points, total_points, points_for_win)
        }
    }

    #[generate_trait]
    pub impl InternalHyperstructureSystemsImpl of InternalHyperstructureSystemsTrait {
        fn handle_contribution(
            ref world: WorldStorage,
            hyperstructure_entity_id: ID,
            contribution: (u8, u128),
            contributor_entity_id: ID,
            hyperstructure_randomness: felt252,
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>
        ) -> bool {
            let (resource_type, contribution_amount) = contribution;

            let resource_tier: u32 = get_resource_tier(resource_type).into();
            let hyperstructure_resource_config = hyperstructure_resource_configs.at(resource_tier - 1);
            let required_contribution_amount = hyperstructure_resource_config
                .get_required_amount(hyperstructure_randomness.into());
            let (max_contributable_amount, will_complete_resource) = Self::get_max_contribution_size(
                world, hyperstructure_entity_id, resource_type, contribution_amount, required_contribution_amount,
            );

            if (max_contributable_amount == 0) {
                return false;
            }

            Self::add_contribution(ref world, hyperstructure_entity_id, resource_type, max_contributable_amount,);
            Self::burn_player_resources(ref world, resource_type, max_contributable_amount, contributor_entity_id);

            Self::update_progress(ref world, hyperstructure_entity_id, resource_type, max_contributable_amount);

            return will_complete_resource;
        }

        fn burn_player_resources(
            ref world: WorldStorage, resource_type: u8, resource_amount: u128, contributor_entity_id: ID
        ) {
            let mut creator_resources = ResourceImpl::get(ref world, (contributor_entity_id, resource_type));

            creator_resources.burn(resource_amount);
            creator_resources.save(ref world);
        }

        fn get_max_contribution_size(
            world: WorldStorage,
            hyperstructure_entity_id: ID,
            resource_type: u8,
            resource_amount: u128,
            required_contribution_amount: u128
        ) -> (u128, bool) {
            let resource_progress: Progress = world.read_model((hyperstructure_entity_id, resource_type));

            let amount_left_for_completion = required_contribution_amount - resource_progress.amount;

            let max_contributable_amount = core::cmp::min(amount_left_for_completion, resource_amount);

            let will_complete_resource = resource_amount >= amount_left_for_completion;
            (max_contributable_amount, will_complete_resource)
        }

        fn add_contribution(
            ref world: WorldStorage, hyperstructure_entity_id: ID, resource_type: u8, resource_amount: u128,
        ) {
            let player_address = starknet::get_caller_address();
            let mut contribution: Contribution = world
                .read_model((hyperstructure_entity_id, player_address, resource_type));
            contribution.amount += resource_amount;

            world.write_model(@contribution);
        }

        fn update_progress(
            ref world: WorldStorage, hyperstructure_entity_id: ID, resource_type: u8, resource_amount: u128,
        ) {
            let mut resource_progress: Progress = world.read_model((hyperstructure_entity_id, resource_type));
            resource_progress.amount += resource_amount;
            world.write_model(@resource_progress);
        }

        fn check_if_construction_done(
            world: WorldStorage,
            hyperstructure_entity_id: ID,
            hyperstructure_randomness: felt252,
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>
        ) -> bool {
            let mut done = true;
            let all_resources = get_hyperstructure_construction_resources();

            let mut i = 0;
            while (i < all_resources.len()) {
                let resource_tier: u32 = get_resource_tier(*all_resources.at(i)).into();
                let hyperstructure_resource_config = hyperstructure_resource_configs.at(resource_tier - 1);
                done =
                    Self::check_if_resource_completed(
                        world,
                        hyperstructure_entity_id,
                        *all_resources.at(i),
                        hyperstructure_randomness,
                        hyperstructure_resource_config
                    );
                if (done == false) {
                    break;
                }
                i += 1;
            };

            return done;
        }

        fn check_if_resource_completed(
            world: WorldStorage,
            hyperstructure_entity_id: ID,
            resource_type: u8,
            hyperstructure_randomness: felt252,
            hyperstructure_resource_config: @HyperstructureResourceConfig
        ) -> bool {
            let resource_progress: Progress = world.read_model((hyperstructure_entity_id, resource_type));
            let required_contribution_amount = hyperstructure_resource_config
                .get_required_amount(hyperstructure_randomness.into());
            resource_progress.amount == required_contribution_amount
        }

        fn compute_total_share_points(
            world: WorldStorage, hyperstructure_shareholder_epochs: Span<(ID, u16)>, player_address: ContractAddress
        ) -> u128 {
            let mut points = 0;
            let mut i = 0;
            let mut end_point_generation_at = starknet::get_block_timestamp();
            let mut season: Season = world.read_model(WORLD_CONFIG_ID);
            if season.ended_at.is_non_zero() {
                end_point_generation_at = season.ended_at;
            }

            let mut points_already_added: Felt252Dict<bool> = Default::default();

            while (i < hyperstructure_shareholder_epochs.len()) {
                let (hyperstructure_entity_id, index) = *hyperstructure_shareholder_epochs.at(i);

                // ensure we don't double count points for the same hyperstructure
                if points_already_added.get(hyperstructure_entity_id.into()) {
                    panic!("points already added for hyperstructure {}", hyperstructure_entity_id);
                };
                points_already_added.insert(hyperstructure_entity_id.into(), true);

                let epoch: Epoch = world.read_model((hyperstructure_entity_id, index));
                let next_epoch: Epoch = world.read_model((hyperstructure_entity_id, index + 1));

                let next_epoch_start_timestamp = if (next_epoch.owners.len() == 0) {
                    end_point_generation_at
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

        fn compute_share_points(world: WorldStorage, time_elapsed: u64, share_percentage: u16) -> u128 {
            let hyperstructure_config: HyperstructureConfig = world.read_model(HYPERSTRUCTURE_CONFIG_ID);
            let points_per_cycle = hyperstructure_config.points_per_cycle;

            let points = time_elapsed.into() * points_per_cycle * share_percentage.into() / 10000;
            return points;
        }


        fn compute_total_contribution_points(
            ref world: WorldStorage,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>,
            player_address: ContractAddress
        ) -> u128 {
            let resources_with_rarity = get_contributable_resources_with_rarity();

            let hyperstructure_config: HyperstructureConfig = world.read_model(HYPERSTRUCTURE_CONFIG_ID);

            let mut points_already_added: Felt252Dict<bool> = Default::default();
            let mut total_points = 0;

            let mut i = 0;

            while (i < hyperstructures_contributed_to.len()) {
                let hyperstructure_entity_id = *hyperstructures_contributed_to.at(i);
                // ensure the structure is a hyperstructure
                let structure: Structure = world.read_model(hyperstructure_entity_id);
                assert!(structure.category == StructureCategory::Hyperstructure, "not a hyperstructure");

                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);

                if (hyperstructure.completed) {
                    // ensure we don't double count points for the same hyperstructure
                    if points_already_added.get(hyperstructure_entity_id.into()) {
                        panic!("points already added for hyperstructure {}", hyperstructure_entity_id);
                    };
                    points_already_added.insert(hyperstructure_entity_id.into(), true);

                    // calculate the total contributable amount for the hyperstructure
                    let total_contributable_amount = calculate_total_contributable_amount(
                        world, hyperstructure.randomness, hyperstructure_resource_configs
                    );

                    // calculate the total points for the hyperstructure
                    total_points +=
                        Self::compute_contributions_for_hyperstructure(
                            world,
                            total_contributable_amount,
                            hyperstructure_entity_id,
                            resources_with_rarity,
                            hyperstructure_config.points_on_completion,
                            player_address
                        );
                }

                i += 1;
            };

            return total_points;
        }

        fn compute_contributions_for_hyperstructure(
            world: WorldStorage,
            total_contributable_amount: u128,
            hyperstructure_entity_id: ID,
            resources_with_rarity: Span<(u8, u128)>,
            points_on_completion: u128,
            player_address: ContractAddress
        ) -> u128 {
            let mut total_points = 0;
            let mut i = 0;
            while (i < resources_with_rarity.len()) {
                let (resource_id, resource_rarity) = *resources_with_rarity.at(i);

                let contribution: Contribution = world
                    .read_model((hyperstructure_entity_id, player_address, resource_id));

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
            percentage * points_on_completion / SCALE_FACTOR
        }

        fn get_total_points_percentage(
            total_contributable_amount: u128, resource_rarity: u128, resource_quantity: u128,
        ) -> u128 {
            // resource rarity already has a x100 factor in
            let effective_contribution = (resource_quantity * resource_rarity) / RESOURCE_PRECISION;
            (effective_contribution * SCALE_FACTOR) / total_contributable_amount
        }
    }
}

fn calculate_total_contributable_amount(
    world: WorldStorage,
    hyperstructure_randomness: felt252,
    hyperstructure_resource_configs: Span<HyperstructureResourceConfig>
) -> u128 {
    let resources_with_rarity = get_contributable_resources_with_rarity();
    let mut total: u128 = 0;

    let mut i = 0;
    loop {
        if i >= resources_with_rarity.len() {
            break;
        }

        let (resource_type, rarity) = *resources_with_rarity.at(i);
        let resource_tier: u32 = get_resource_tier(resource_type).into();
        let hyperstructure_resource_config = hyperstructure_resource_configs.at(resource_tier - 1);
        let required_contribution_amount = hyperstructure_resource_config
            .get_required_amount(hyperstructure_randomness.into());

        total += (required_contribution_amount * rarity) / RESOURCE_PRECISION;

        i += 1;
    };

    total
}
