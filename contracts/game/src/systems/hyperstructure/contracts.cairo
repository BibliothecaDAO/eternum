use s1_eternum::alias::ID;
use s1_eternum::models::hyperstructure::ConstructionAccess;
use starknet::ContractAddress;

#[starknet::interface]
trait IHyperstructureSystems<T> {
    fn initialize(ref self: T, hyperstructure_id: ID);
    fn contribute(ref self: T, hyperstructure_id: ID, from_structure_id: ID, contribution: Span<(u8, u128)>);
    fn allocate_shares(ref self: T, hyperstructure_id: ID, shareholders: Span<(ContractAddress, u16)>);
    fn update_construction_access(ref self: T, hyperstructure_id: ID, access: ConstructionAccess);
    fn claim_construction_points(ref self: T, hyperstructure_ids: Span<ID>, player: ContractAddress);
    fn claim_share_points(ref self: T, hyperstructure_ids: Span<ID>);
}


#[dojo::contract]
pub mod hyperstructure_systems {
    use achievement::store::{StoreTrait};
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use s1_eternum::models::owner::OwnerAddressImpl;
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::weight::{Weight, WeightImpl};
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::random::VRFImpl;
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use s1_eternum::{
        alias::ID, constants::{RESOURCE_PRECISION, ResourceTypes},
        models::{
            config::{HyperstructureConfig, HyperstructureCostConfig, SeasonConfigImpl, WorldConfigUtilImpl},
            guild::{GuildMember},
            hyperstructure::{
                ConstructionAccess, Hyperstructure, HyperstructureConstructionAccessImpl,
                HyperstructureRequirementsImpl, HyperstructureShareholders, PlayerConstructionPoints,
                PlayerRegisteredPoints,
            },
            owner::{OwnerAddressTrait}, resource::resource::{}, season::{SeasonPrize},
            structure::{StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl},
        },
        utils::math::PercentageValueImpl,
    };
    use starknet::{ContractAddress};


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

            // ensure hyperstructure has not been initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized == false, "hyperstructure is already initialized");

            // spend shards from hyperstructure's balance
            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );
            let required_shards_amount = hyperstructure_config.initialize_shards_amount;
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
            let mut construction_total_needed_amount = 0;
            let hyperstructure_cost_config: HyperstructureCostConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_cost_config"),
            );
            for i in 0..hyperstructure_cost_config.construction_resources_ids.len() {
                let resource_type = *hyperstructure_cost_config.construction_resources_ids.at(i);
                construction_total_needed_amount +=
                    HyperstructureRequirementsImpl::get_amount_needed(ref world, hyperstructure, resource_type);
            };
            HyperstructureRequirementsImpl::initialize(ref world, hyperstructure_id);
            HyperstructureRequirementsImpl::write_needed_resource_total(
                ref world, hyperstructure_id, construction_total_needed_amount,
            );

            // set hyperstructure as initialized
            hyperstructure.initialized = true;
            world.write_model(@hyperstructure);

            // [Achievement] Hyperstructure Creation
            let player_id: felt252 = structure_owner.into();
            let task_id: felt252 = Task::Builder.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
        }

        fn contribute(
            ref self: ContractState, hyperstructure_id: ID, from_structure_id: ID, contribution: Span<(u8, u128)>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller structure is owned by caller
            let from_structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            from_structure_owner.assert_caller_owner();

            // ensure structure is a hyperstructure
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure_base.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized and not completed
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized, "hyperstructure has not been initialized");
            assert!(hyperstructure.completed == false, "hyperstructure has been completed");

            // ensure contributor has access to contribute to the hyperstructure
            let hyperstructure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            hyperstructure.assert_caller_construction_access(ref world, hyperstructure_owner);

            // contribute to hyperstructure
            let mut total_resource_amount_contributed_by_structure = 0;
            let mut from_structure_weight: Weight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            for (resource_type, resource_amount) in contribution {
                let (resource_type, resource_amount) = (*resource_type, *resource_amount);
                assert!(resource_amount.is_non_zero(), "contributed amount must be greater than zero");

                // ensure that resource amount does not exceed max contributable
                let current_contributed_amount = HyperstructureRequirementsImpl::read_current_amount(
                    ref world, hyperstructure_id, resource_type,
                );
                let needed_contribution_amount = HyperstructureRequirementsImpl::get_amount_needed(
                    ref world, hyperstructure, resource_type,
                );
                let max_contributable_amount = needed_contribution_amount - current_contributed_amount;
                assert!(
                    max_contributable_amount.is_non_zero(), "contribution for resource ({})is complete", resource_type,
                );

                // ensure resource amount is a multiplier of RESOURCE_PRECISION
                let resource_amount = core::cmp::min(max_contributable_amount, resource_amount);
                assert!(resource_amount % RESOURCE_PRECISION == 0, "amount not multiplier of RESOURCE_PRECISION");

                // burn caller structure's resource
                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
                let mut from_structure_resource: SingleResource = SingleResourceStoreImpl::retrieve(
                    ref world, from_structure_id, resource_type, ref from_structure_weight, resource_weight_grams, true,
                );
                from_structure_resource.spend(resource_amount, ref from_structure_weight, resource_weight_grams);
                from_structure_resource.store(ref world);

                // update current contributable amount
                HyperstructureRequirementsImpl::write_current_amount(
                    ref world, hyperstructure_id, resource_type, current_contributed_amount + resource_amount,
                );
                total_resource_amount_contributed_by_structure += resource_amount;

                // add points to from_structure_owner
                let mut player_construction_points: PlayerConstructionPoints = world
                    .read_model((from_structure_owner, hyperstructure_id));
                player_construction_points.unregistered_points += (resource_amount / RESOURCE_PRECISION)
                    * HyperstructureRequirementsImpl::get_resource_points(ref world, resource_type)
                    / (needed_contribution_amount / RESOURCE_PRECISION);
                world.write_model(@player_construction_points);
            };

            // update structure weight
            from_structure_weight.store(ref world, from_structure_id);

            // update resource amount contributed by all
            let total_resource_amount_contributed_by_all = HyperstructureRequirementsImpl::read_current_resource_total(
                ref world, hyperstructure_id,
            );
            let new_total_resource_amount_contributed_by_all = (total_resource_amount_contributed_by_all
                + total_resource_amount_contributed_by_structure);
            HyperstructureRequirementsImpl::write_current_resource_total(
                ref world, hyperstructure_id, new_total_resource_amount_contributed_by_all,
            );
            let needed_total_resource_amount_contributed_by_all =
                HyperstructureRequirementsImpl::read_needed_resource_total(
                ref world, hyperstructure_id,
            );

            // mark hyperstructure as completed, if completed
            if new_total_resource_amount_contributed_by_all == needed_total_resource_amount_contributed_by_all {
                hyperstructure.completed = true;
                world.write_model(@hyperstructure);

                // make hyperstructure owner start receiving points
                world
                    .write_model(
                        @HyperstructureShareholders {
                            hyperstructure_id,
                            start_at: starknet::get_block_timestamp(),
                            shareholders: array![
                                (hyperstructure_owner, PercentageValueImpl::_100().try_into().unwrap()),
                            ]
                                .span(),
                        },
                    );
            }

            // [Achievement] Hyperstructure Contribution
            let player_id: felt252 = starknet::get_caller_address().into();
            let task_id: felt252 = Task::Opportunist.identifier();
            let store = StoreTrait::new(world);
            let timestamp = starknet::get_block_timestamp();
            store.progress(player_id, task_id, count: 1, time: timestamp);
        }

        fn allocate_shares(ref self: ContractState, hyperstructure_id: ID, shareholders: Span<(ContractAddress, u16)>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // todo: test gas for 20 shareholders
            // ensure there are never more than 20 shareholders at a time
            assert!(shareholders.len() <= 20, "too many shareholders, maximum of 20");

            // ensure the structure is owned by caller
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            structure_owner.assert_caller_owner();

            // ensure the structure is a hyperstructure
            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized and completed
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized, "hyperstructure has not been initialized");
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
                "total allocated percentage must be {}",
                PercentageValueImpl::_100(),
            );

            // claim points for current shareholders
            self.claim_share_points(array![hyperstructure_id].span());

            let hyperstructure_shareholders = HyperstructureShareholders {
                hyperstructure_id, start_at: starknet::get_block_timestamp(), shareholders,
            };
            world.write_model(@hyperstructure_shareholders);
        }

        // claim construction points for any player
        fn claim_construction_points(ref self: ContractState, hyperstructure_ids: Span<ID>, player: ContractAddress) {
            // ensure function can only be called before point registration grace ends
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_point_registration_grace_not_elapsed();

            assert!(player.is_non_zero(), "zero player address");

            let mut season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);
            let mut player_points: PlayerRegisteredPoints = world.read_model(player);
            for hyperstructure_id in hyperstructure_ids {
                // ensure hyperstructure is initialized and completed
                let hyperstructure_id = *hyperstructure_id;
                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
                assert!(hyperstructure.initialized, "hyperstructure has not been initialized");
                assert!(hyperstructure.completed, "hyperstructure has not been completed");

                let mut player_construction_points: PlayerConstructionPoints = world
                    .read_model((player, hyperstructure_id));
                assert!(player_construction_points.unregistered_points.is_non_zero(), "no points to register");

                // add points to player's registered points
                player_points.registered_points += player_construction_points.unregistered_points;
                season_prize.total_registered_points += player_construction_points.unregistered_points;

                world.erase_model(@player_construction_points);
            };

            world.write_model(@player_points);
            world.write_model(@season_prize);
        }

        // claim share points for any player
        fn claim_share_points(ref self: ContractState, hyperstructure_ids: Span<ID>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure function can only be called before point registration grace ends
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_main_game_started_and_point_registration_grace_not_elapsed();

            let mut season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);

            for hyperstructure_id in hyperstructure_ids {
                // ensure hyperstructure is initialized and completed
                let hyperstructure_id = *hyperstructure_id;
                let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
                assert!(hyperstructure.initialized, "hyperstructure has not been initialized");
                assert!(hyperstructure.completed, "hyperstructure has not been completed");

                let mut hyperstructure_shareholders: HyperstructureShareholders = world.read_model(hyperstructure_id);
                let ts = starknet::get_block_timestamp();
                let time_elapsed = if season_config.has_ended() {
                    season_config.end_at - hyperstructure_shareholders.start_at
                } else {
                    ts - hyperstructure_shareholders.start_at
                };
                assert!(time_elapsed.is_non_zero(), "zero time elapsed");

                let current_shareholders = hyperstructure_shareholders.shareholders;
                let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                    world, selector!("hyperstructure_config"),
                );
                for i in 0..current_shareholders.len() {
                    let (shareholder_address, shareholder_percentage) = current_shareholders.at(i);
                    if shareholder_address.is_non_zero() {
                        let mut shareholder_points: PlayerRegisteredPoints = world.read_model(*shareholder_address);
                        // todo: ensure generated points is non zero. not by panicking though
                        // we just want to make sure that when shareholder_percentage is taken into account,
                        // generated points does not round out to zero.
                        let generated_points: u128 = time_elapsed.into()
                            * hyperstructure_config.points_per_second.into()
                            * (*shareholder_percentage).into()
                            / PercentageValueImpl::_100().into();
                        shareholder_points.registered_points += generated_points;
                        world.write_model(@shareholder_points);

                        // increase global total registered points
                        season_prize.total_registered_points += generated_points;
                    }
                };

                // update global total registered points
                world.write_model(@season_prize);

                // reset hyperstructure shareholding start time
                let mut start_at = ts;
                if season_config.has_ended() {
                    start_at = season_config.end_at
                };
                hyperstructure_shareholders.start_at = start_at;
                world.write_model(@hyperstructure_shareholders);
            }
        }

        fn update_construction_access(ref self: ContractState, hyperstructure_id: ID, access: ConstructionAccess) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure the structure is a hyperstructure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, hyperstructure_id);
            structure_owner.assert_caller_owner();

            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, hyperstructure_id);
            assert!(structure_base.category == StructureCategory::Hyperstructure.into(), "not a hyperstructure");

            // ensure hyperstructure is initialized
            let mut hyperstructure: Hyperstructure = world.read_model(hyperstructure_id);
            assert!(hyperstructure.initialized, "hyperstructure has not been initialized");

            // ensure owner has a guild if set to guild only
            if (access == ConstructionAccess::GuildOnly) {
                let structure_owner_guild_member: GuildMember = world.read_model(structure_owner);
                assert!(structure_owner_guild_member.guild_id.is_non_zero(), "you are not a member of any guild");
            }

            // update construction access
            hyperstructure.access = access;
            world.write_model(@hyperstructure);
        }
    }
}
