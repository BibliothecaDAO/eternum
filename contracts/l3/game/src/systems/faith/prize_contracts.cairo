use starknet::ContractAddress;
use crate::alias::ID;

#[starknet::interface]
pub trait IFaithPrizeSystems<T> {
    /// Reserve a token deposit for this game's prize pool.
    fn fund_prizes(ref self: T, game_id: u32, amount: u128);
    /// Settle every wonder through season end, then freeze winners and allocations once.
    fn distribute_wonder_prizes(ref self: T, game_id: u32);
    fn claim_player_prize(ref self: T, game_id: u32, player: ContractAddress, wonder_id: ID);
}

#[dojo::contract]
pub mod faith_prize_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{FaithConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::faith::{
        FaithPrizePool, FaithWonders, PlayerFaithPoints, PlayerFaithPrizeClaimed, WonderFaith, WonderFaithPrize,
        WonderFaithWinners,
    };
    use crate::systems::faith::contracts::{IFaithSystemsDispatcher, IFaithSystemsDispatcherTrait};
    use crate::systems::realm::utils::contracts::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::systems::utils::faith::FaithAccrualImpl;

    #[abi(embed_v0)]
    impl FaithPrizeSystemsImpl of super::IFaithPrizeSystems<ContractState> {
        fn fund_prizes(ref self: ContractState, game_id: u32, amount: u128) {
            let mut world = self.world(DEFAULT_NS());
            WorldConfigUtilImpl::assert_eternum_mode(world, game_id);
            let season = SeasonConfigImpl::get(world, game_id);
            assert!(!season.has_ended(), "Season is over");
            assert!(amount > 0, "Faith prize funding must be positive");
            let config: FaithConfig = WorldConfigUtilImpl::get_member(world, game_id, selector!("faith_config"));
            assert!(config.enabled && config.reward_token.is_non_zero(), "Reward token not configured");
            let token = IERC20Dispatcher { contract_address: config.reward_token };
            let recipient = starknet::get_contract_address();
            let before = token.balance_of(recipient);
            assert!(
                token.transfer_from(starknet::get_caller_address(), recipient, amount.into()),
                "Faith prize funding failed",
            );
            assert!(token.balance_of(recipient) == before + amount.into(), "Faith prize funding amount mismatch");
            let mut pool: FaithPrizePool = world.read_model(game_id);
            assert!(!pool.distributed, "Prizes already distributed");
            pool.funded_amount += amount;
            world.write_model(@pool);
        }

        fn distribute_wonder_prizes(ref self: ContractState, game_id: u32) {
            let mut world = self.world(DEFAULT_NS());
            WorldConfigUtilImpl::assert_eternum_mode(world, game_id);
            let season = SeasonConfigImpl::get(world, game_id);
            season.assert_ended();
            let mut pool: FaithPrizePool = world.read_model(game_id);
            assert!(!pool.distributed, "Prizes already distributed");
            settle_all_wonders(ref world, game_id, season.end_at);
            let winners: WonderFaithWinners = world.read_model(game_id);
            pool.distributed = true;
            world.write_model(@pool);
            if winners.wonder_ids.is_empty() {
                return;
            }
            let prize_per_wonder = pool.funded_amount / winners.wonder_ids.len().into();
            for wonder_id in winners.wonder_ids.span() {
                world.write_model(@WonderFaithPrize { game_id, wonder_id: *wonder_id, amount_won: prize_per_wonder });
            }
        }

        fn claim_player_prize(ref self: ContractState, game_id: u32, player: ContractAddress, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            WorldConfigUtilImpl::assert_eternum_mode(world, game_id);
            let season_config = SeasonConfigImpl::get(world, game_id);
            season_config.assert_ended();

            assert!(player.is_non_zero(), "Invalid player address");

            // Check if player already claimed for this wonder
            let mut player_claimed: PlayerFaithPrizeClaimed = world.read_model((game_id, player, wonder_id));
            assert!(!player_claimed.claimed, "Player already claimed prize for this wonder");

            // Check if this wonder has a prize
            let wonder_prize: WonderFaithPrize = world.read_model((game_id, wonder_id));
            assert!(wonder_prize.amount_won > 0, "No prize for this wonder");

            // Get faith systems dispatcher to update player points
            let (faith_systems_addr, _) = world.dns(@"faith_systems").unwrap();
            let faith_systems = IFaithSystemsDispatcher { contract_address: faith_systems_addr };

            // Call claim_player_points to ensure player's last_updated_at is at season end
            faith_systems.claim_player_points(game_id, player, wonder_id);

            // Re-read player's faith points after update
            let player_fp: PlayerFaithPoints = world.read_model((game_id, player, wonder_id));

            // Check player has points for this wonder
            if player_fp.points_claimed == 0 {
                return;
            }

            // Get total points for this wonder
            let wonder_faith: WonderFaith = world.read_model((game_id, wonder_id));
            assert!(wonder_faith.claimed_points > 0, "Wonder has no claimed points");

            // Calculate player's share: (player_points / total_wonder_points) * wonder_prize
            let player_share: u256 = Into::<u128, u256>::into(player_fp.points_claimed)
                * wonder_prize.amount_won.into()
                / wonder_faith.claimed_points.into();

            if player_share > 0 {
                // Mark as claimed
                player_claimed.claimed = true;
                world.write_model(@player_claimed);

                // Transfer prize to player
                let faith_config: FaithConfig = WorldConfigUtilImpl::get_member(
                    world, game_id, selector!("faith_config"),
                );
                let reward_token = IERC20Dispatcher { contract_address: faith_config.reward_token };
                assert!(reward_token.transfer(player, player_share.into()), "Failed to transfer prize");
            }
        }
    }
    fn settle_all_wonders(ref world: WorldStorage, game_id: u32, end_at: u64) {
        let wonders: FaithWonders = world.read_model(game_id);
        for wonder_id in wonders.wonder_ids.span() {
            let mut wonder: WonderFaith = world.read_model((game_id, *wonder_id));
            FaithAccrualImpl::settle_wonder(ref world, game_id, ref wonder, end_at, end_at);
        }
    }
}
