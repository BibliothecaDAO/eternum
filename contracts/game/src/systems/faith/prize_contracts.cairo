use starknet::ContractAddress;
use crate::alias::ID;

/// # Faith Prize Systems Interface
///
/// Handles end-of-season prize distribution for the Faith leaderboard.
/// The prize pool (in $LORDS or configured reward token) is distributed to
/// the top-ranking wonders and their faithful followers.
///
/// ## Overview
///
/// The faith prize system operates in two phases:
///
/// 1. **Distribution Phase** (`distribute_wonder_prizes`)
///    - Called once after season ends
///    - Splits prize pool evenly among winning wonders (those tied for highest FP)
///    - Records each winner's prize amount in `WonderFaithPrize`
///
/// 2. **Claim Phase** (`claim_player_prize`)
///    - Called by/for each player who holds FP in a winning wonder
///    - Calculates player's share: `(player_points / total_wonder_points) * wonder_prize`
///    - Transfers reward tokens directly to player
///
/// ## Prize Distribution Formula
///
/// For each winning wonder:
/// ```
/// wonder_prize = total_prize_pool / number_of_winners
/// player_share = (player_points_claimed / wonder_claimed_points) * wonder_prize
/// ```
///
/// ## Prerequisites
///
/// Before calling these functions:
///
/// 1. **Deposit reward tokens** into this contract's address
/// 2. **Configure `FaithConfig.reward_token`** with the ERC20 token address
/// 3. **Wait for season to end** (and grace period to close)
/// 4. **Ensure all players have claimed their FP** (`claim_player_points`)
///
/// ## Client Integration Workflow
///
/// ### Admin/DAO Setup (before season end)
/// ```
/// // 1. Transfer prize tokens to this contract
/// lords_token.transfer(faith_prize_systems_address, prize_amount);
/// ```
///
/// ### After Season End
/// ```
/// // 2. Distribute prizes to winning wonders (call once)
/// faith_prize_systems.distribute_wonder_prizes();
///
/// // 3. Each player claims their share (or anyone can claim for them)
/// for player in all_players_with_fp:
///     for wonder_id in winning_wonders:
///         faith_prize_systems.claim_player_prize(player, wonder_id);
/// ```
///
/// ## Data Models
///
/// | Model | Key | Description |
/// |-------|-----|-------------|
/// | `WonderFaithPrize` | `wonder_id` | Tracks prize amount won by each wonder |
/// | `PlayerFaithPrizeClaimed` | `(player, wonder_id)` | Tracks if player claimed their share |
/// | `WonderFaithWinners` | `WORLD_CONFIG_ID` | List of winning wonder IDs and high score |
///
/// ## Security Notes
///
/// - Prize distribution can only happen once (checks `amount_won == 0`)
/// - Player claims are idempotent (checks `claimed` flag)
/// - All functions are permissionless but have proper state guards
#[starknet::interface]
pub trait IFaithPrizeSystems<T> {
    /// Distribute the prize pool to winning wonders.
    ///
    /// # Description
    ///
    /// Takes the total balance of the reward token held by this contract and splits
    /// it evenly among all wonders that achieved the highest faith point score.
    /// This function should be called exactly once after the season ends.
    ///
    /// # When to Call
    ///
    /// - After season ends AND points registration grace period closes
    /// - After all wonder and player points have been claimed/settled
    /// - Before any player attempts to claim their prize share
    ///
    /// # What It Does
    ///
    /// 1. Verifies season has ended and registration is closed
    /// 2. Gets the list of winning wonders from `WonderFaithWinners`
    /// 3. Checks the contract's balance of the reward token
    /// 4. Calculates `prize_per_wonder = total_balance / num_winners`
    /// 5. For each winning wonder:
    ///    - Calls `claim_wonder_points` to finalize their score
    ///    - Records the prize amount in `WonderFaithPrize`
    ///
    /// # Requirements
    ///
    /// - Season must be ended with grace period closed
    /// - At least one wonder must have accumulated FP (winners list not empty)
    /// - Prizes must not have been distributed yet (`WonderFaithPrize.amount_won == 0`)
    /// - Reward token must be configured in `FaithConfig`
    /// - Contract must hold a non-zero balance of reward tokens
    ///
    /// # Authorization
    ///
    /// **Permissionless** - Anyone can call this after conditions are met.
    /// This allows for automated/decentralized prize distribution.
    ///
    /// # Errors
    ///
    /// - `"No winners to distribute prizes to"` - No wonders accumulated FP
    /// - `"Prizes already distributed"` - Function was already called
    /// - `"Reward token not configured"` - `FaithConfig.reward_token` is zero
    /// - `"No prize balance to distribute"` - Contract holds no reward tokens
    ///
    /// # Example
    ///
    /// ```
    /// // After season ends and all points are settled
    /// faith_prize_systems.distribute_wonder_prizes();
    ///
    /// // Check distribution result
    /// let prize: WonderFaithPrize = world.read_model(winning_wonder_id);
    /// assert!(prize.amount_won > 0, "Prize should be set");
    /// ```
    fn distribute_wonder_prizes(ref self: T);

    /// Claim a player's share of a wonder's prize based on their faith points.
    ///
    /// # Description
    ///
    /// Calculates and transfers a player's proportional share of a winning wonder's
    /// prize pool. The share is based on the ratio of the player's `points_claimed`
    /// to the wonder's total `claimed_points`.
    ///
    /// # Parameters
    ///
    /// * `player` - The address of the player claiming the prize
    /// * `wonder_id` - The ID of the winning wonder to claim prize from
    ///
    /// # Formula
    ///
    /// ```
    /// player_share = (player_fp.points_claimed * wonder_prize.amount_won) / wonder_faith.claimed_points
    /// ```
    ///
    /// # When to Call
    ///
    /// - After `distribute_wonder_prizes` has been called
    /// - After the player's FP has been fully settled (`claim_player_points`)
    /// - Can be called multiple times for different wonders if player has FP in several
    ///
    /// # What It Does
    ///
    /// 1. Verifies season ended and registration closed
    /// 2. Checks player hasn't already claimed for this wonder
    /// 3. Verifies wonder has a prize (`amount_won > 0`)
    /// 4. Calls `claim_player_points` to settle any pending FP
    /// 5. Calculates player's proportional share
    /// 6. If share > 0:
    ///    - Marks claim as complete (`PlayerFaithPrizeClaimed.claimed = true`)
    ///    - Transfers reward tokens to player
    ///
    /// # Authorization
    ///
    /// **Permissionless** - Anyone can call this on behalf of any player.
    /// This allows batch claiming for gas efficiency or helping inactive players.
    ///
    /// # Requirements
    ///
    /// - Season must be ended with grace period closed
    /// - Player address must be non-zero
    /// - Player must not have already claimed for this wonder
    /// - Wonder must have a prize (be in winners list and `distribute_wonder_prizes` called)
    /// - Wonder must have accumulated points (`claimed_points > 0`)
    ///
    /// # Returns Early (No Transfer)
    ///
    /// - If player has no `points_claimed` for this wonder
    /// - If calculated share is 0 (due to rounding)
    ///
    /// # Errors
    ///
    /// - `"Invalid player address"` - Zero address provided
    /// - `"Player already claimed prize for this wonder"` - Double-claim attempt
    /// - `"No prize for this wonder"` - Wonder didn't win or prizes not distributed
    /// - `"Wonder has no claimed points"` - Division by zero guard
    /// - `"Failed to transfer prize"` - ERC20 transfer failed
    ///
    /// # Example
    ///
    /// ```
    /// // Claim your own prize
    /// faith_prize_systems.claim_player_prize(my_address, winning_wonder_id);
    ///
    /// // Claim on behalf of another player (permissionless)
    /// faith_prize_systems.claim_player_prize(inactive_player, winning_wonder_id);
    ///
    /// // Batch claim for multiple players (client code)
    /// for player in players_with_fp_in_wonder:
    ///     faith_prize_systems.claim_player_prize(player, wonder_id);
    /// ```
    ///
    /// # Multi-Wonder Scenario
    ///
    /// A player can have FP in multiple wonders. They need to claim separately for each:
    /// ```
    /// faith_prize_systems.claim_player_prize(player, wonder_a_id);
    /// faith_prize_systems.claim_player_prize(player, wonder_b_id);
    /// ```
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
