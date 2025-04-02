use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::{
    constants::{RESOURCE_PRECISION, get_contributable_resources_with_rarity},
    models::{config::HyperstructureResourceConfig, config::HyperstructureResourceConfigTrait, hyperstructure::Access},
};
use starknet::ContractAddress;

const LEADERBOARD_REGISTRATION_PERIOD: u64 = 60 * 60 * 24 * 4; // 4 days

#[starknet::interface]
trait IHyperstructureSystems<T> {
    fn initialize(ref self: T, hyperstructure_id: ID);
    fn contribute(
        ref self: T,            
        hyperstructure_id: ID,
        from_structure_id: ID,
        contribution: Span<(u8, u128)>,
    );

    fn allocate_shares(ref self: T, hyperstructure_id: ID, shareholders: Span<(ContractAddress, u16)>);
    fn claim_construction_points(ref self: T, hyperstructure_id: ID);
    fn claim_share_points(ref self: T, hyperstructure_id: ID);
    fn end_game(
        ref self: T, hyperstructures_contributed_to: Span<ID>, hyperstructure_shareholder_epochs: Span<(ID, u16)>,
    );
    fn set_access(ref self: T, hyperstructure_entity_id: ID, access: Access);
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
    use s1_eternum::models::owner::OwnerAddressImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::random::VRFImpl;
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use s1_eternum::{
        alias::ID,
        utils::math::PercentageValueImpl,
        constants::{get_hyperstructure_point_multiplier,
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
                HyperstructureRequirementsImpl, PlayerConstructionPoints, PlayerTotalPoints, HyperstructureShareholders,
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
            // spend shards from hyperstructure's balance
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


            // set total needed amount 
            // note: we assume that only the first 23 resources are used 
            let mut total_needed_amount = 0;
            for i in 1..(23 + 1) {
                total_needed_amount += 
                    HyperstructureRequirementsImpl::get_amount_needed(
                        ref world, hyperstructure, i);
            };
            HyperstructureRequirementsImpl::write_needed_resource_total(
                ref world, hyperstructure_id, total_needed_amount);


            // set hyperstructure as initialized
            hyperstructure.initialized = true;
            world.write_model(@hyperstructure);

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

        fn contribute(
            ref self: ContractState,
            hyperstructure_id: ID,
            from_structure_id: ID,
            contribution: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();
            
            // ensure caller structure is owned by caller
            let from_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            from_structure_owner.assert_caller_owner();

            // ensure structure is a hyperstructure
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure_base.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized, "hyperstructure is not initialized");

            // ensure hyperstructure is not completed
            assert!(hyperstructure.completed == false, "hyperstructure has been completed");

            // ensure contributor has access to contribute to the hyperstructure
            let hyperstructure_owner: ContractAddress 
                = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            hyperstructure.assert_access(ref world, hyperstructure_owner);

            // contribute to hyperstructure
            let mut total_resource_amount_contributed_by_structure = 0;
            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            for (resource_type, resource_amount) in contribution {
                let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                assert!(resource_amount.is_non_zero(), "contributed amount must be greater than zero"); 

                // ensure that resource amount does not exceed max contributable
                let current_contributed_amount 
                    = HyperstructureRequirementsImpl::read_current_amount(
                        ref world, hyperstructure_id, resource_type);
                let needed_contribution_amount 
                        = HyperstructureRequirementsImpl::get_amount_needed(
                            ref world, hyperstructure, resource_type);
                let max_contributable_amount = needed_contribution_amount - current_contributed_amount;
                assert!(max_contributable_amount.is_non_zero(), "contribution for a specified resource is complete"); 

                // burn caller structure's resource
                let resource_amount = core::cmp::min(max_contributable_amount, resource_amount);
                assert!(resource_amount % RESOURCE_PRECISION == 0, "amount not multiplier of RESOURCE_PRECISION"); 

                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                let mut from_structure_resource: SingleResource = SingleResourceStoreImpl::retrieve(
                    ref world,
                    from_structure_id,
                    resource_type,
                    ref from_structure_weight,
                    resource_weight_grams,
                    true,
                );
                from_structure_resource.spend(resource_amount, ref from_structure_weight, resource_weight_grams);
                from_structure_resource.store(ref world);

                // update current contributable amount
                HyperstructureRequirementsImpl::write_current_amount(
                    ref world, hyperstructure_id, resource_type, current_contributed_amount + resource_amount);
                total_resource_amount_contributed_by_structure += resource_amount;
               
                // add points to from_structure_owner
                let mut player_construction_points: PlayerConstructionPoints 
                    = world.read_model((from_structure_owner, hyperstructure_id)); 
                player_construction_points.points += (resource_amount / RESOURCE_PRECISION) * HyperstructureRequirementsImpl::get_resource_points(ref world, resource_type);
                world.write_model(@player_construction_points);
            };

            // update structure weight
            from_structure_weight.store(ref world, from_structure_id);

            // update resource amount contributed by all
            let total_resource_amount_contributed_by_all 
            = HyperstructureRequirementsImpl::read_current_resource_total(ref world, hyperstructure_id);
            let new_total_resource_amount_contributed_by_all 
                = (total_resource_amount_contributed_by_all + total_resource_amount_contributed_by_structure);
            HyperstructureRequirementsImpl::write_current_resource_total(
                ref world, hyperstructure_id, new_total_resource_amount_contributed_by_all);
            let neeeded_total_resource_amount_contributed_by_all 
            = HyperstructureRequirementsImpl::read_needed_resource_total(ref world, hyperstructure_id);

            // mark hyperstructure as completed, if completed
            if new_total_resource_amount_contributed_by_all ==  neeeded_total_resource_amount_contributed_by_all {
                hyperstructure.completed = true;
                world.write_model(@hyperstructure);
            }

            // [Achievement] Hyperstructure Contribution
            let player_id: felt252 = starknet::get_caller_address().into();
            let task_id: felt252 = Task::Opportunist.identifier();
            let store = StoreTrait::new(world);
            let timestamp = starknet::get_block_timestamp();
            store.progress(player_id, task_id, count: 1, time: timestamp);
        }

        fn allocate_shares(
            ref self: ContractState, hyperstructure_id: ID, shareholders: Span<(ContractAddress, u16)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure there are never more than 10 shareholders at a time
            assert!(shareholders.len() <= 10, "too many shareholders, maximum of 10");

            // ensure the structure is owned by caller
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            structure_owner.assert_caller_owner();

            // ensure the structure is a hyperstructure
            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized and completed
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized, "hyperstructure is not initialized");
            assert!(hyperstructure.completed, "hyperstructure has not been completed");

            // ensure the allocated percentage does not exceed 100%
            let mut allocated_percentage: u16 = 0;
            for i in 0..shareholders.len() {
                let (address, percentage) = *shareholders.at(i);
                assert!(address.is_non_zero(), "zero address shareholders");
                allocated_percentage += percentage;
            };
            assert!(
                allocated_percentage.into() == PercentageValueImpl::_100(), 
                "total allocated percentage must be {}", PercentageValueImpl::_100()
            );

            //todo: ensure cant change call this function after game ends

            let hyperstructure_shareholders: HyperstructureShareholders = world.read_model(hyperstructure_id);
            let current_shareholders = hyperstructure_shareholders.shareholders;
            let hyperstructure_config: HyperstructureConfig 
                = WorldConfigUtilImpl::get_member(world, selector!("hyperstructure_config"));
            for i in 0..current_shareholders.len() {
                let (shareholder_address, shareholder_percentage) = current_shareholders.at(i);
                if shareholder_address.is_non_zero() {
                    let mut shareholder_points: PlayerTotalPoints = world.read_model(shareholder_address);
                    let time_elapsed = starknet::get_block_timestamp() - hyperstructure_shareholders.start_at;
                    let generated_points: u128 
                        = time_elapsed.into() 
                            * hyperstructure_config.points_per_cycle.into()
                            * (*shareholder_percentage).into() / PercentageValueImpl::_100().into();
                    shareholder_points.points+= generated_points;
                    world.write_model(@shareholder_points);
                }
            };
            

            let hyperstructure_shareholders = HyperstructureShareholders {
                hyperstructure_id,
                start_at: starknet::get_block_timestamp(),
                shareholders,
            };
            world.write_model(@hyperstructure_shareholders);
        }

        fn claim_construction_points(ref self: ContractState, hyperstructure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over(); //?????????? todo

            let hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            let mut player_construction_points: PlayerConstructionPoints 
                = world.read_model((starknet::get_caller_address(), hyperstructure_id));
            if hyperstructure.completed && !player_construction_points.claimed {
                let mut player_points: PlayerTotalPoints = world.read_model(starknet::get_caller_address());
                player_points.points += player_construction_points.points;
                world.write_model(@player_points);

                player_construction_points.claimed = true;
                world.write_model(@player_construction_points);
            }            
        }

        fn claim_share_points(ref self: ContractState, hyperstructure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            assert!(season_config.has_ended(), "season must have ended to call this");
            
            let hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            if hyperstructure.completed {
                let hyperstructure_shareholders: HyperstructureShareholders = world.read_model(hyperstructure_id);
                let current_shareholders = hyperstructure_shareholders.shareholders;
                let hyperstructure_config: HyperstructureConfig 
                    = WorldConfigUtilImpl::get_member(world, selector!("hyperstructure_config"));
                for i in 0..current_shareholders.len() {
                    let (shareholder_address, shareholder_percentage) = current_shareholders.at(i);
                    if shareholder_address.is_non_zero() {
                        let mut shareholder_points: PlayerTotalPoints = world.read_model(shareholder_address);
                        // note: time elapsed stops count at season end
                        let time_elapsed = season_config.end_at - hyperstructure_shareholders.start_at;
                        let generated_points: u128 
                            = time_elapsed.into() 
                                * hyperstructure_config.points_per_cycle.into()
                                * (*shareholder_percentage).into() / PercentageValueImpl::_100().into();
                        shareholder_points.points+= generated_points;
                        world.write_model(@shareholder_points);
                    }
                };

                world.erase_model(@hyperstructure_shareholders);
            }            
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
