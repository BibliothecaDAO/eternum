/// Interface for interacting with the season functionality within the game.
/// This trait provides functions to manage the game's seasons, including
/// closing the current season and claiming season prizes.
#[starknet::interface]
pub trait ISeasonSystems<T> {
    /// Closes the current game season and assigns the caller as the winner.
    ///
    /// This function can only be called when the following conditions are met:
    /// - The season has started and is not yet over
    /// - The calling player has accumulated enough registered points to end the game
    ///   (based on the 'points_for_win' threshold defined in hyperstructure_config)
    ///
    /// # Effects:
    /// - Marks the season as ended
    /// - Records the caller as the winner by emitting a SeasonEnded event
    /// - Grants the 'Warlord' achievement to the winner
    ///
    /// # Errors:
    /// - Fails if the season has not started or is already over
    /// - Fails if the player does not have enough points to end the game
    fn season_close(ref self: T);

    /// Allows players to claim their proportion of the prize pool after a season has ended.
    ///
    /// This function can only be called when the following conditions are met:
    /// - The season has ended
    /// - The claiming period has started (after the registration grace period)
    /// - The caller has not already claimed their reward
    /// - The caller has registered points
    ///
    /// The reward amount is calculated proportionally based on the player's registered points
    /// relative to the total registered points across all players.
    ///
    /// # Formula:
    /// player_reward = (player_registered_points / total_registered_points) * total_lords_pool
    ///
    /// # Effects:
    /// - Transfers LORDS tokens to the player from the season pool
    /// - Marks the player's prize as claimed to prevent double claiming
    ///
    /// # Errors:
    /// - Fails if the season has not ended yet
    /// - Fails if the claiming period has not started yet
    /// - Fails if the player has already claimed their reward
    /// - Fails if the player has no registered points
    /// - Fails if the token transfer fails
    fn season_prize_claim(ref self: T);


    /// Transfers unclaimed LORDS tokens to the velords contract address
    ///
    /// This function can only be called when the following conditions are met:
    /// - The season has ended
    /// - The claiming period has started (after the registration grace period)
    /// - A period of 3 weeks have passed since the claiming period started
    fn season_transfer_unclaimed_lords(ref self: T);
}

#[dojo::contract]
pub mod season_systems {
    use achievement::store::{StoreTrait};
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use s1_eternum::systems::utils::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use s1_eternum::{
        constants::{DEFAULT_NS, WORLD_CONFIG_ID},
        models::{
            config::{
                HyperstructureConfig, ResourceBridgeFeeSplitConfig, SeasonAddressesConfig, SeasonConfigImpl,
                WorldConfigUtilImpl,
            },
            hyperstructure::{PlayerRegisteredPoints}, season::{SeasonPrize},
        },
    };


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct SeasonEnded {
        #[key]
        winner_address: starknet::ContractAddress,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    pub impl SeasonSystemsImpl of super::ISeasonSystems<ContractState> {
        fn season_close(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure the the caller's points are enough to end the game
            let player_address = starknet::get_caller_address();
            let player_points: PlayerRegisteredPoints = world.read_model(player_address);
            let hyperstructure_config: HyperstructureConfig = WorldConfigUtilImpl::get_member(
                world, selector!("hyperstructure_config"),
            );
            assert!(
                player_points.registered_points >= hyperstructure_config.points_for_win,
                "Not enough points to end the game",
            );

            // end the season
            SeasonConfigImpl::end_season(ref world);

            // emit season end event
            let now = starknet::get_block_timestamp();
            world.emit_event(@SeasonEnded { winner_address: player_address, timestamp: now });

            // [Achievement] Win the game
            let player_id: felt252 = player_address.into();
            let task_id: felt252 = Task::Warlord.identifier();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
        }

        fn season_prize_claim(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure the season has ended
            // note: season.end_at must to set to avoid fatal bug
            let season_config = SeasonConfigImpl::get(world);
            assert!(season_config.has_ended(), "Season has not ended");

            // ensure claiming period has started
            let season_prize_registration_end_at = season_config.end_at
                + season_config.registration_grace_seconds.into();
            assert!(
                season_prize_registration_end_at < starknet::get_block_timestamp(),
                "claiming period hasn't started yet",
            );

            // ensure caller has not already claimed their reward
            let player_address = starknet::get_caller_address();
            let mut player_points: PlayerRegisteredPoints = world.read_model(player_address);
            assert!(player_points.prize_claimed == false, "Reward already claimed by caller");

            let season_addresses_config: SeasonAddressesConfig = WorldConfigUtilImpl::get_member(
                world, selector!("season_addresses_config"),
            );

            let mut season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);

            // set total price pool if it hasn't been set yet
            let res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
                world, selector!("res_bridge_fee_split_config"),
            );
            let lords_address = season_addresses_config.lords_address;
            if season_prize.total_lords_pool.is_zero() {
                let total_prize_pool: u256 = ERC20ABIDispatcher { contract_address: lords_address }
                    .balance_of(res_bridge_fee_split_config.season_pool_fee_recipient);
                season_prize.total_lords_pool = total_prize_pool;
                world.write_model(@season_prize);
            }

            assert!(
                season_prize.total_lords_pool.is_non_zero(),
                "distribution finished or no one registered to the leaderboard",
            );
            assert!(player_points.registered_points.is_non_zero(), "Player has no points to claim");

            let player_reward: u256 = (season_prize.total_lords_pool * player_points.registered_points.into())
                / season_prize.total_registered_points.into();
            let sender = res_bridge_fee_split_config.season_pool_fee_recipient;
            let self = starknet::get_contract_address();
            if sender == self {
                assert!(
                    ERC20ABIDispatcher { contract_address: lords_address }.transfer(player_address, player_reward),
                    "Failed to transfer reward",
                );
            } else {
                assert!(
                    ERC20ABIDispatcher { contract_address: lords_address }
                        .transfer_from(
                            res_bridge_fee_split_config.season_pool_fee_recipient, player_address, player_reward,
                        ),
                    "Failed to transfer reward",
                );
            }

            // set claimed to true
            player_points.prize_claimed = true;
            world.write_model(@player_points);
        }


        fn season_transfer_unclaimed_lords(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure the season has ended
            // note: season.end_at must to set to avoid fatal bug
            let season_config = SeasonConfigImpl::get(world);
            assert!(season_config.has_ended(), "Season has not ended");

            // ensure claiming period has started
            let season_prize_registration_end_at = season_config.end_at
                + season_config.registration_grace_seconds.into();
            assert!(
                season_prize_registration_end_at < starknet::get_block_timestamp(),
                "claiming period hasn't started yet",
            );

            // ensure a period of 3 weeks have passed since the claiming period started
            let one_day = 60 * 60 * 24;
            let one_week = one_day * 7;
            let three_weeks = one_week * 3;
            assert!(
                season_prize_registration_end_at + three_weeks < starknet::get_block_timestamp(),
                "3 weeks haven't passed yet",
            );

            let season_addresses_config: SeasonAddressesConfig = WorldConfigUtilImpl::get_member(
                world, selector!("season_addresses_config"),
            );
            let res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
                world, selector!("res_bridge_fee_split_config"),
            );
            let lords_address = season_addresses_config.lords_address;
            let sender = res_bridge_fee_split_config.season_pool_fee_recipient;
            let lords_contract = ERC20ABIDispatcher { contract_address: lords_address };
            let lords_balance = lords_contract.balance_of(sender);
            let velords_address = res_bridge_fee_split_config.velords_fee_recipient;

            let self = starknet::get_contract_address();
            if sender == self {
                assert!(lords_contract.transfer(velords_address, lords_balance), "Failed to transfer LORDS to velords");
            } else {
                assert!(
                    lords_contract.transfer_from(sender, velords_address, lords_balance),
                    "Failed to transfer LORDS to velords",
                );
            }
        }
    }
}
