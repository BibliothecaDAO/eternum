use starknet::ContractAddress;
use crate::alias::ID;

#[starknet::interface]
pub trait IFaithPrizeSystems<T> {
    /// Distribute faith prizes to winning wonders.
    /// Takes the total balance of reward token in this contract and splits evenly among winners.
    /// Can only be called after season ends.
    fn distribute_wonder_prizes(ref self: T);

    /// Claim a player's share of the wonder's prize based on their points_claimed.
    /// Anyone can call this on behalf of a player.
    fn claim_player_prize(ref self: T, player: ContractAddress, wonder_id: ID);
}

#[dojo::contract]
pub mod faith_prize_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use crate::models::config::{FaithConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::faith::{
        PlayerFaithPoints, PlayerFaithPrizeClaimed, WonderFaith, WonderFaithPrize, WonderFaithWinners,
    };
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};
    use crate::systems::realm::utils::contracts::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[abi(embed_v0)]
    impl FaithPrizeSystemsImpl of super::IFaithPrizeSystems<ContractState> {
        fn distribute_wonder_prizes(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_game_ended_and_points_registration_closed();

            // Get winners
            let winners: WonderFaithWinners = world.read_model(WORLD_CONFIG_ID);
            assert!(winners.wonder_ids.len() > 0, "No winners to distribute prizes to");

            // Check if prizes already distributed (first winner has amount_won > 0)
            let first_winner_id = *winners.wonder_ids.at(0);
            let first_prize: WonderFaithPrize = world.read_model(first_winner_id);
            assert!(first_prize.amount_won == 0, "Prizes already distributed");

            // Get reward token from faith config
            let faith_config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));
            assert!(faith_config.reward_token.is_non_zero(), "Reward token not configured");

            let reward_token = IERC20Dispatcher { contract_address: faith_config.reward_token };
            let this = starknet::get_contract_address();
            let total_prize_balance: u256 = reward_token.balance_of(this);
            assert!(total_prize_balance > 0, "No prize balance to distribute");

            // Get faith systems dispatcher to update wonder points
            let (faith_systems_addr, _) = world.dns(@"faith_systems").unwrap();
            let faith_systems = IFaithSystemsDispatcher { contract_address: faith_systems_addr };

            // Split evenly among winners
            let num_winners: u256 = winners.wonder_ids.len().into();
            let prize_per_wonder: u128 = (total_prize_balance / num_winners).try_into().unwrap();

            // Update each winner's WonderFaith to season end time and record prize
            for wonder_id in winners.wonder_ids.span() {
                // Call claim_wonder_points to ensure wonder's last_updated_at is at season end
                faith_systems.claim_wonder_points(*wonder_id);

                // Record the prize amount for this wonder
                let wonder_prize = WonderFaithPrize { wonder_id: *wonder_id, amount_won: prize_per_wonder };
                world.write_model(@wonder_prize);
            }
        }

        fn claim_player_prize(ref self: ContractState, player: ContractAddress, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_game_ended_and_points_registration_closed();

            assert!(player.is_non_zero(), "Invalid player address");

            // Check if player already claimed for this wonder
            let mut player_claimed: PlayerFaithPrizeClaimed = world.read_model((player, wonder_id));
            assert!(!player_claimed.claimed, "Player already claimed prize for this wonder");

            // Check if this wonder has a prize
            let wonder_prize: WonderFaithPrize = world.read_model(wonder_id);
            assert!(wonder_prize.amount_won > 0, "No prize for this wonder");

            // Get faith systems dispatcher to update player points
            let (faith_systems_addr, _) = world.dns(@"faith_systems").unwrap();
            let faith_systems = IFaithSystemsDispatcher { contract_address: faith_systems_addr };

            // Call claim_player_points to ensure player's last_updated_at is at season end
            faith_systems.claim_player_points(player, wonder_id);

            // Re-read player's faith points after update
            let player_fp: PlayerFaithPoints = world.read_model((player, wonder_id));

            // Check player has points for this wonder
            if player_fp.points_claimed == 0 {
                return;
            }

            // Get total points for this wonder
            let wonder_faith: WonderFaith = world.read_model(wonder_id);
            assert!(wonder_faith.claimed_points > 0, "Wonder has no claimed points");

            // Calculate player's share: (player_points / total_wonder_points) * wonder_prize
            let player_share: u128 = (player_fp.points_claimed * wonder_prize.amount_won) / wonder_faith.claimed_points;

            if player_share > 0 {
                // Mark as claimed
                player_claimed.claimed = true;
                world.write_model(@player_claimed);

                // Transfer prize to player
                let faith_config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));
                let reward_token = IERC20Dispatcher { contract_address: faith_config.reward_token };
                assert!(reward_token.transfer(player, player_share.into()), "Failed to transfer prize");
            }
        }
    }
}
