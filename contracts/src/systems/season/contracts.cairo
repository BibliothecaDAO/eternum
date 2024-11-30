use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

#[starknet::interface]
trait ISeasonSystems<T> {
    fn register_to_leaderboard(
        ref self: T, hyperstructures_contributed_to: Span<ID>, hyperstructure_shareholder_epochs: Span<(ID, u16)>
    );
    fn claim_leaderboard_rewards(ref self: T, token: starknet::ContractAddress);
}

#[dojo::contract]
mod season_systems {
    use core::array::ArrayIndex;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use eternum::{
        constants::{HYPERSTRUCTURE_CONFIG_ID, WORLD_CONFIG_ID, DEFAULT_NS}, alias::ID,
        models::{
            config::{HyperstructureConfig, ResourceBridgeFeeSplitConfig},
            season::{Leaderboard, LeaderboardEntryCustomImpl, LeaderboardEntry}
        },
        systems::{
            hyperstructure::contracts::hyperstructure_systems::InternalHyperstructureSystemsImpl,
            config::contracts::config_systems::assert_caller_is_admin,
            resources::contracts::resource_bridge_systems::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait}
        },
    };
    use starknet::ContractAddress;

    pub const SCALING_FACTOR: u256 = 1_000_000;

    #[abi(embed_v0)]
    impl SeasonSystemsImpl of super::ISeasonSystems<ContractState> {
        fn register_to_leaderboard(
            ref self: ContractState,
            hyperstructures_contributed_to: Span<ID>,
            hyperstructure_shareholder_epochs: Span<(ID, u16)>
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);

            assert!(
                leaderboard.registration_end_timestamp > starknet::get_block_timestamp(), "Registration period is over"
            );

            let mut total_points: u128 = 0;

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                    ref world, hyperstructures_contributed_to
                );

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_share_points(world, hyperstructure_shareholder_epochs);

            leaderboard.append(ref world, starknet::get_caller_address(), total_points);
        }

        fn claim_leaderboard_rewards(ref self: ContractState, token: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);

            assert!(
                leaderboard.registration_end_timestamp < starknet::get_block_timestamp(),
                "Claiming period hasn't started yet"
            );

            if leaderboard.total_price_pool.is_none() {
                let resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = world.read_model(WORLD_CONFIG_ID);
                let total_price_pool: u256 = ERC20ABIDispatcher { contract_address: token }
                    .balance_of(resource_bridge_fee_split_config.season_pool_fee_recipient);
                leaderboard.total_price_pool = Option::Some(total_price_pool);
            }

            assert!(
                leaderboard.total_price_pool.is_some(), "If that happens, no one has registered to the leaderboard"
            );

            let caller_address = starknet::get_caller_address();

            let entry: LeaderboardEntry = LeaderboardEntryCustomImpl::get(ref world, caller_address);

            assert!(entry.points > 0, "No points to claim");

            let percentage_scaled: u256 = ((entry.points.into() * SCALING_FACTOR) / leaderboard.total_points.into())
                .into();

            let player_reward: u256 = (leaderboard.total_price_pool.unwrap() * percentage_scaled) / SCALING_FACTOR;
            let resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = world.read_model(WORLD_CONFIG_ID);

            ERC20ABIDispatcher { contract_address: token }
                .transfer_from(
                    resource_bridge_fee_split_config.season_pool_fee_recipient, caller_address, player_reward
                );
        }
    }
}
