use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::get_resource_tier;
use s1_eternum::{
    constants::{RESOURCE_PRECISION, get_contributable_resources_with_rarity},
    models::{config::HyperstructureResourceConfig, config::HyperstructureResourceConfigTrait, hyperstructure::Access},
};
use starknet::ContractAddress;

const LEADERBOARD_REGISTRATION_PERIOD: u64 = 60 * 60 * 24 * 4; // 4 days

#[starknet::interface]
trait IHyperstructureSystems<T> {
    fn initialize(ref self: T, hyperstructure_id: ID);

    fn contribute_to_construction(
        ref self: T, hyperstructure_entity_id: ID, contributor_entity_id: ID, contributions: Span<(u8, u128)>,
    );
    fn set_co_owners(ref self: T, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>);
    fn end_game(
        ref self: T, hyperstructures_contributed_to: Span<ID>, hyperstructure_shareholder_epochs: Span<(ID, u16)>,
    );
    fn set_access(ref self: T, hyperstructure_entity_id: ID, access: Access);

    fn get_points(
        self: @T,
        player_address: ContractAddress,
        hyperstructures_contributed_to: Span<ID>,
        hyperstructure_shareholder_epochs: Span<(ID, u16)>,
    ) -> (u128, u128, u128, u128);
}


#[dojo::contract]
pub mod hyperstructure_systems {
    use achievement::store::{StoreTrait};
    use core::dict::Felt252Dict;
    use core::num::traits::zero::Zero;
    use core::poseidon::poseidon_hash_span;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{SeasonConfig};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::weight::{Weight, WeightImpl};
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::random::VRFImpl;
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use s1_eternum::{
        alias::ID,
        constants::{
            RESOURCE_PRECISION, ResourceTypes, WORLD_CONFIG_ID, get_contributable_resources_with_rarity,
            get_hyperstructure_construction_resources, get_resource_tier,
        },
        models::{
            config::{
                HyperstructureConfig, HyperstructureResourceConfig, HyperstructureResourceConfigTrait, SeasonConfigImpl,
                WorldConfigUtilImpl,
            },
            guild::{GuildMember},
            hyperstructure::{
                Access, Contribution, Epoch, Hyperstructure, HyperstructureGlobals, HyperstructureImpl, Progress,
            },
            name::{AddressName}, owner::{OwnerAddressTrait}, resource::resource::{}, season::{Leaderboard},
            structure::{StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl},
        },
    };

    use starknet::{ContractAddress};

    use super::{LEADERBOARD_REGISTRATION_PERIOD, calculate_total_contributable_amount};

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
        fn initialize(ref self: ContractState, hyperstructure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns the structure
            let mut structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            structure_owner.assert_caller_owner();

            // ensure structure is a hyperstructure
            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is not initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized == false, "hyperstructure is already initialized");

            // get required shards amount for initialization
            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            let shard_resource_tier: u32 = get_resource_tier(ResourceTypes::EARTHEN_SHARD).into();
            let shards_resource_config = hyperstructure_resource_configs.at(shard_resource_tier - 1);
            let required_shards_amount = shards_resource_config.get_required_amount(0);

            let mut hyperstructure_weight: Weight = WeightStoreImpl::retrieve(ref world, hyperstructure_id);
            let shards_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::EARTHEN_SHARD);
            let mut hyperstructure_shard_resource: SingleResource = SingleResourceStoreImpl::retrieve(
                ref world,
                hyperstructure_id,
                ResourceTypes::EARTHEN_SHARD,
                ref hyperstructure_weight,
                shards_resource_weight_grams,
                true,
            );

            // spend required shards amount for initialization
            hyperstructure_shard_resource
                .spend(required_shards_amount, ref hyperstructure_weight, shards_resource_weight_grams);
            hyperstructure_shard_resource.store(ref world);
            hyperstructure_weight.store(ref world, hyperstructure_id);

            // update hyperstructure initialized
            hyperstructure.initialized = true;
            world.write_model(@hyperstructure);

            // update progress and contribution
            world
                .write_model(
                    @Progress {
                        hyperstructure_entity_id: hyperstructure_id,
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: required_shards_amount,
                    },
                );
            world
                .write_model(
                    @Contribution {
                        hyperstructure_entity_id: hyperstructure_id,
                        player_address: structure_owner,
                        resource_type: ResourceTypes::EARTHEN_SHARD,
                        amount: required_shards_amount,
                    },
                );

            // emit hyperstructure started event
            let id = world.dispatcher.uuid();
            let creator_address_name: AddressName = world.read_model(structure_owner);
            world
                .emit_event(
                    @HyperstructureStarted {
                        id,
                        hyperstructure_entity_id: hyperstructure_id,
                        creator_address_name: creator_address_name.name,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // [Achievement] Hyperstructure Creation
            let player_id: felt252 = structure_owner.into();
            let task_id: felt252 = Task::Builder.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
        }

        fn contribute_to_construction(
            ref self: ContractState,
            hyperstructure_entity_id: ID,
            contributor_entity_id: ID,
            contributions: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure structure is a hyperstructure
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_entity_id);
            assert!(structure_base.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
            assert!(hyperstructure.initialized, "hyperstructure is not initialized");

            // ensure contributor has access to hyperstructure
            let hyperstructure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, hyperstructure_entity_id,
            );
            hyperstructure.assert_access(ref world, hyperstructure_owner);

            // emit hyperstructure contribution event
            let timestamp = starknet::get_block_timestamp();
            world
                .emit_event(
                    @HyperstructureContribution {
                        hyperstructure_entity_id,
                        contributor_entity_id,
                        contributions,
                        timestamp,
                        id: world.dispatcher.uuid(),
                    },
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
                        hyperstructure_resource_configs,
                    );
                i += 1;
            };

            if (resource_was_completed
                && InternalHyperstructureSystemsImpl::check_if_construction_done(
                    world, hyperstructure_entity_id, hyperstructure.randomness, hyperstructure_resource_configs,
                )) {
                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
                hyperstructure.completed = true;
                world.write_model(@hyperstructure);

                let mut hyperstructure_globals: HyperstructureGlobals = world.read_model(WORLD_CONFIG_ID);
                hyperstructure_globals.completed_count += 1;
                world.write_model(@hyperstructure_globals);

                let hyperstructure_owner_name: AddressName = world.read_model(hyperstructure_owner);

                world
                    .emit_event(
                        @HyperstructureFinished {
                            hyperstructure_entity_id,
                            contributor_entity_id,
                            // todo: ?
                            hyperstructure_owner_name: hyperstructure_owner_name.name,
                            timestamp,
                            id: world.dispatcher.uuid(),
                        },
                    );
            }

            // [Achievement] Hyperstructure Contribution
            let player_id: felt252 = starknet::get_caller_address().into();
            let task_id: felt252 = Task::Opportunist.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: timestamp);
        }

        fn set_co_owners(
            ref self: ContractState, hyperstructure_entity_id: ID, co_owners: Span<(ContractAddress, u16)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            assert!(co_owners.len() <= 10, "too many co-owners");

            // ensure the structure is a hyperstructure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, hyperstructure_entity_id,
            );
            structure_owner.assert_caller_owner();

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_entity_id);
            assert!(structure.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
            assert!(hyperstructure.initialized, "hyperstructure is not initialized");

            let caller = starknet::get_caller_address();

            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );

            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);

            let timestamp = starknet::get_block_timestamp();

            if (hyperstructure.last_updated_by == caller) {
                assert!(
                    timestamp
                        - hyperstructure.last_updated_timestamp > hyperstructure_config.time_between_shares_change,
                    "time between shares change not passed",
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
                owners: co_owners,
            };

            hyperstructure.last_updated_timestamp = timestamp;
            hyperstructure.last_updated_by = caller;
            hyperstructure.current_epoch += 1;

            world.write_model(@hyperstructure);
            world.write_model(@epoch);

            world
                .emit_event(
                    @HyperstructureCoOwnersChange {
                        id: world.dispatcher.uuid(), hyperstructure_entity_id, timestamp, co_owners,
                    },
                );
        }

        fn set_access(ref self: ContractState, hyperstructure_entity_id: ID, access: Access) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure the structure is a hyperstructure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, hyperstructure_entity_id,
            );
            structure_owner.assert_caller_owner();

            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_entity_id);
            assert!(structure_base.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
            assert!(hyperstructure.initialized, "hyperstructure is not initialized");

            // update access
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
            hyperstructure_shareholder_epochs: Span<(ID, u16)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let player_address = starknet::get_caller_address();
            let mut total_points: u128 = 0;
            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                    ref world, hyperstructures_contributed_to, hyperstructure_resource_configs, player_address,
                );

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_share_points(
                    world, hyperstructure_shareholder_epochs, player_address,
                );

            // ensure the total points are enough to end the game
            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );
            assert!(
                total_points >= hyperstructure_config.points_for_win,
                "Not enough points to end the game. You have {} points, but need {}",
                total_points,
                hyperstructure_config.points_for_win,
            );

            SeasonConfigImpl::end_season(ref world);

            let winner_address = starknet::get_caller_address();
            world.emit_event(@GameEnded { winner_address, timestamp: starknet::get_block_timestamp() });

            let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
            leaderboard.registration_end_timestamp = starknet::get_block_timestamp() + LEADERBOARD_REGISTRATION_PERIOD;
            world.write_model(@leaderboard);

            // [Achievement] Win the game
            let player_id: felt252 = winner_address.into();
            let task_id: felt252 = Task::Warlord.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
        }


        // todo: ensure this does not save any storage variable
        fn get_points(
            self: @ContractState,
            player_address: ContractAddress,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_shareholder_epochs: Span<(ID, u16)>,
        ) -> (u128, u128, u128, u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let hyperstructure_resource_configs = HyperstructureResourceConfigTrait::get_all(world);
            let contribution_points = InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                ref world, hyperstructures_contributed_to, hyperstructure_resource_configs, player_address,
            );

            let share_points = InternalHyperstructureSystemsImpl::compute_total_share_points(
                world, hyperstructure_shareholder_epochs, player_address,
            );

            let total_points = contribution_points + share_points;
            // ensure the total points are enough to end the game
            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );
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
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>,
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

            // todo: consider sending resources through regular resource system
            Self::add_contribution(ref world, hyperstructure_entity_id, resource_type, max_contributable_amount);
            Self::burn_player_resource(ref world, resource_type, max_contributable_amount, contributor_entity_id);

            Self::update_progress(ref world, hyperstructure_entity_id, resource_type, max_contributable_amount);

            return will_complete_resource;
        }

        fn burn_player_resource(
            ref world: WorldStorage, resource_type: u8, resource_amount: u128, contributor_entity_id: ID,
        ) {
            // obtain structure weight
            let mut creator_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, contributor_entity_id);

            // burn resource
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut creator_resource: SingleResource = SingleResourceStoreImpl::retrieve(
                ref world,
                contributor_entity_id,
                resource_type,
                ref creator_structure_weight,
                resource_weight_grams,
                true,
            );

            creator_resource.spend(resource_amount, ref creator_structure_weight, resource_weight_grams);
            creator_resource.store(ref world);

            // update structure weight
            creator_structure_weight.store(ref world, contributor_entity_id);
        }

        fn get_max_contribution_size(
            world: WorldStorage,
            hyperstructure_entity_id: ID,
            resource_type: u8,
            resource_amount: u128,
            required_contribution_amount: u128,
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
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>,
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
                        hyperstructure_resource_config,
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
            hyperstructure_resource_config: @HyperstructureResourceConfig,
        ) -> bool {
            let resource_progress: Progress = world.read_model((hyperstructure_entity_id, resource_type));
            let required_contribution_amount = hyperstructure_resource_config
                .get_required_amount(hyperstructure_randomness.into());
            resource_progress.amount == required_contribution_amount
        }

        fn compute_total_share_points(
            world: WorldStorage, hyperstructure_shareholder_epochs: Span<(ID, u16)>, player_address: ContractAddress,
        ) -> u128 {
            let mut points = 0;
            let mut i = 0;
            let mut end_point_generation_at = starknet::get_block_timestamp();
            let mut season: SeasonConfig = WorldConfigUtilImpl::get_member(world, selector!("season_config"));
            if season.end_at.is_non_zero() {
                end_point_generation_at = season.end_at;
            }

            let mut points_already_added: Felt252Dict<bool> = Default::default();

            while (i < hyperstructure_shareholder_epochs.len()) {
                let (hyperstructure_entity_id, index) = *hyperstructure_shareholder_epochs.at(i);

                // ensure we don't double count points for the same hyperstructure

                let points_already_added_key: felt252 = poseidon_hash_span(
                    array![hyperstructure_entity_id.into(), index.into()].span(),
                );

                if points_already_added.get(points_already_added_key) {
                    panic!("points already added for hyperstructure {}, epoch {}", hyperstructure_entity_id, index);
                };

                points_already_added.insert(points_already_added_key, true);

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
            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );
            let points_per_cycle = hyperstructure_config.points_per_cycle;

            let points = time_elapsed.into() * points_per_cycle * share_percentage.into() / 10000;
            return points;
        }


        fn compute_total_contribution_points(
            ref world: WorldStorage,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_resource_configs: Span<HyperstructureResourceConfig>,
            player_address: ContractAddress,
        ) -> u128 {
            let resources_with_rarity = get_contributable_resources_with_rarity();

            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );

            let mut points_already_added: Felt252Dict<bool> = Default::default();
            let mut total_points = 0;

            let mut i = 0;

            while (i < hyperstructures_contributed_to.len()) {
                let hyperstructure_entity_id = *hyperstructures_contributed_to.at(i);
                // ensure the structure is a hyperstructure
                let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_entity_id);
                assert!(structure.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);

                if (hyperstructure.completed) {
                    // ensure we don't double count points for the same hyperstructure
                    if points_already_added.get(hyperstructure_entity_id.into()) {
                        panic!("points already added for hyperstructure {}", hyperstructure_entity_id);
                    };
                    points_already_added.insert(hyperstructure_entity_id.into(), true);

                    // calculate the total contributable amount for the hyperstructure
                    let total_contributable_amount = calculate_total_contributable_amount(
                        world, hyperstructure.randomness, hyperstructure_resource_configs,
                    );

                    // calculate the total points for the hyperstructure
                    total_points +=
                        Self::compute_contributions_for_hyperstructure(
                            world,
                            total_contributable_amount,
                            hyperstructure_entity_id,
                            resources_with_rarity,
                            hyperstructure_config.points_on_completion,
                            player_address,
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
            player_address: ContractAddress,
        ) -> u128 {
            let mut total_points = 0;
            let mut i = 0;
            while (i < resources_with_rarity.len()) {
                let (resource_id, resource_rarity) = *resources_with_rarity.at(i);

                let contribution: Contribution = world
                    .read_model((hyperstructure_entity_id, player_address, resource_id));

                total_points +=
                    Self::compute_contribution_points(
                        total_contributable_amount, resource_rarity, contribution.amount, points_on_completion,
                    );

                i += 1;
            };

            return total_points;
        }

        fn compute_contribution_points(
            total_contributable_amount: u128,
            resource_rarity: u128,
            resource_quantity: u128,
            points_on_completion: u128,
        ) -> u128 {
            let percentage = Self::get_total_points_percentage(
                total_contributable_amount, resource_rarity, resource_quantity,
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
    hyperstructure_resource_configs: Span<HyperstructureResourceConfig>,
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
