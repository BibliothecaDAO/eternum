use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::alias::ID;

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

    use s0_eternum::{
        constants::{HYPERSTRUCTURE_CONFIG_ID, WORLD_CONFIG_ID, DEFAULT_NS, ResourceTypes}, alias::ID,
        models::{
            config::{
                HyperstructureConfig, HyperstructureResourceConfigTrait, ResourceBridgeFeeSplitConfig,
                ResourceBridgeWhitelistConfig
            },
            season::{Leaderboard, LeaderboardEntryImpl, LeaderboardEntry, LeaderboardRewardClaimed}
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
        /// Note: This function can only be called once per address
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
            let hyperstructure_tier_configs = HyperstructureResourceConfigTrait::get_all(world);
            let player_address = starknet::get_caller_address();
            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_contribution_points(
                    ref world, hyperstructures_contributed_to, hyperstructure_tier_configs, player_address
                );

            total_points +=
                InternalHyperstructureSystemsImpl::compute_total_share_points(
                    world, hyperstructure_shareholder_epochs, player_address
                );

            leaderboard.register(ref world, starknet::get_caller_address(), total_points);
        }

        fn claim_leaderboard_rewards(ref self: ContractState, token: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure token is whitelisted and it is the lords token
            let resource_bridge_token_whitelist: ResourceBridgeWhitelistConfig = world.read_model(token);
            assert!(
                resource_bridge_token_whitelist.resource_type == ResourceTypes::LORDS, "Token is not the reward token"
            );

            // ensure caller has not already claimed their reward
            let caller_address = starknet::get_caller_address();
            let mut leaderboard_reward_claimed: LeaderboardRewardClaimed = world.read_model(caller_address);
            assert!(leaderboard_reward_claimed.claimed == false, "Reward already claimed by caller");

            // ensure claiming period has started
            let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
            assert!(
                leaderboard.registration_end_timestamp < starknet::get_block_timestamp(),
                "Claiming period hasn't started yet"
            );

            // set total price pool if it hasn't been set yet
            if !leaderboard.distribution_started {
                let resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = world.read_model(WORLD_CONFIG_ID);
                let total_price_pool: u256 = ERC20ABIDispatcher { contract_address: token }
                    .balance_of(resource_bridge_fee_split_config.season_pool_fee_recipient);
                leaderboard.total_price_pool = Option::Some(total_price_pool);
                leaderboard.distribution_started = true;
                world.write_model(@leaderboard);
            }

            assert!(
                leaderboard.total_price_pool.unwrap() > 0,
                "distribution finished or no one registered to the leaderboard"
            );

            let entry: LeaderboardEntry = LeaderboardEntryImpl::get(ref world, caller_address);

            assert!(entry.points > 0, "No points to claim");

            let player_reward: u256 = (leaderboard.total_price_pool.unwrap() * entry.points.into())
                / leaderboard.total_points.into();
            let resource_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = world.read_model(WORLD_CONFIG_ID);

            assert!(
                ERC20ABIDispatcher { contract_address: token }
                    .transfer_from(
                        resource_bridge_fee_split_config.season_pool_fee_recipient, caller_address, player_reward
                    ),
                "Failed to transfer reward"
            );

            // set claimed to true
            leaderboard_reward_claimed.claimed = true;
            world.write_model(@leaderboard_reward_claimed);
        }
    }
}
