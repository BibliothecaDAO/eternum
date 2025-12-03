use starknet::ContractAddress;
use crate::models::series_chest_reward::{SeriesChestRewardState};

#[starknet::interface]
pub trait IPrizeDistributionSystems<T> {
    fn blitz_get_or_compute_series_chest_reward_state(ref self: T) -> SeriesChestRewardState;
    fn blitz_prize_claim_no_game(ref self: T, registered_player: ContractAddress);
    fn blitz_prize_claim(ref self: T, players: Array<ContractAddress>);
    fn blitz_prize_player_rank(
        ref self: T, trial_id: u128, total_player_count_committed: u16, players_list: Array<ContractAddress>,
    );
    fn blitz_get_ranked(ref self: T, rank: u16) -> Span<ContractAddress>;
    fn blitz_get_winner(ref self: T) -> Option<u256>;

}


// todo: fee split
// todo: release entry token
#[dojo::contract]
pub mod prize_distribution_systems {
    use series_chest_reward_calculator::SeriesChestRewardStateTrait;
    use core::result::ResultTrait;
use core::num::traits::zero::Zero;
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorageTrait, WorldStorage};
    use crate::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use crate::models::config::{BlitzRegistrationConfig, BlitzRegistrationConfigImpl, SeasonConfigImpl, WorldConfigUtilImpl, BlitzRealmPlayerRegister, BlitzPreviousGame};
    use crate::models::events::{PrizeDistributedStory, PrizeDistributionFinalStory, Story, StoryEvent};
    use crate::models::rank::{PlayerRank, PlayersRankFinal, PlayersRankTrial, RankPrize, RankPrizeImpl, RankList};
    use crate::models::season::{SeasonPrize};
    use crate::models::record::{BlitzFeeSplitRecord, BlitzFeeSplitRecordImpl, WorldRecordImpl};
    use crate::systems::realm::utils::contracts::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::systems::utils::prize::iPrizeDistributionCalcImpl;
    use crate::{models::{hyperstructure::{PlayerRegisteredPoints}}};
    use crate::models::series_chest_reward::{SeriesChestRewardState, GameChestReward};
    use crate::utils::world::CustomDojoWorldImpl;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator::{SeriesChestRewardStateImpl};
    use starknet::ContractAddress;
    use super::{IPrizeDistributionSystems, IPrizeDistributionSystemsSafeDispatcher, IPrizeDistributionSystemsSafeDispatcherTrait};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::utils::interfaces::collectibles::{ICollectibleDispatcher, ICollectibleDispatcherTrait};

    const SYSTEM_TRIAL_ID: u128 = 1000;


    #[abi(embed_v0)]
    pub impl PrizeDistributionSystemsImpl of IPrizeDistributionSystems<ContractState> {

        fn blitz_get_or_compute_series_chest_reward_state(ref self: ContractState) -> SeriesChestRewardState {

            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // return early if the new state has already been calculated
            let mut current_game_series_chest_reward_state: SeriesChestRewardState 
                = world.read_model(WORLD_CONFIG_ID);
            if current_game_series_chest_reward_state.game_index.is_non_zero() {
                return current_game_series_chest_reward_state;
            }

            // ensure the main game has started (so registration has closed)
            let mut season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_main();

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            let last_game: BlitzPreviousGame = world.read_model(WORLD_CONFIG_ID);
            let mut last_game_series_chest_reward_state : SeriesChestRewardState 
                = if last_game.last_prize_distribution_systems.is_non_zero() {
                    IPrizeDistributionSystemsSafeDispatcher{
                        contract_address: last_game.last_prize_distribution_systems
                    }.blitz_get_or_compute_series_chest_reward_state().unwrap_or(SeriesChestRewardStateImpl::new())
            } else {
                SeriesChestRewardStateImpl::new()
            };

            // intialize if not previously initialized
            if last_game_series_chest_reward_state.game_index.is_zero() {
                last_game_series_chest_reward_state = SeriesChestRewardStateImpl::new();
            };


            if current_game_series_chest_reward_state.game_index > last_game_series_chest_reward_state.game_index {
                return current_game_series_chest_reward_state;
            } else {
                current_game_series_chest_reward_state = last_game_series_chest_reward_state;
                let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                    world, selector!("blitz_registration_config"),
                );

                // return early if there were less than 2 players in the game
                let n_obs = blitz_registration_config.registration_count;
                if n_obs < 2 {
                    world.write_model(@current_game_series_chest_reward_state);
                    return current_game_series_chest_reward_state;
                }


                let num_chests_allocated 
                    = current_game_series_chest_reward_state
                        .allocate_chests(n_obs.into());
            
                // save the series_chest_reward_state in this world so it can be used in future worlds
                world.write_model(@current_game_series_chest_reward_state);
                world.write_model(
                    @GameChestReward {
                        world_id: WORLD_CONFIG_ID,
                        allocated_chests: num_chests_allocated.try_into().unwrap(),
                        distributed_chests: 0
                    });

                return current_game_series_chest_reward_state;
            }
        }


        fn blitz_prize_claim_no_game(ref self: ContractState, registered_player: ContractAddress) {
            // ensure the main game has started (so registration has closed)
            // but there is only 1 registered player
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_main();

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure there is no finalized player rank
            let mut players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_zero(), "Eternum: rankings not finalized");

            // ensure there is only 1 registered player
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            assert!(blitz_registration_config.registration_count == 1, "Eternum: More than 1 registered player");

            // ensure the registered_player parameter is the registered player
            let mut blitz_player_register: BlitzRealmPlayerRegister = world.read_model(registered_player);
            assert!(blitz_player_register.once_registered, "Eternum: Player not registered");
            
            
            // create a trial with the registered player and finalize the rankings
            let prize_amount = blitz_registration_config.fee_amount.try_into().unwrap();
            let player_rank_trial: PlayersRankTrial = PlayersRankTrial {
                trial_id: SYSTEM_TRIAL_ID,
                owner: starknet::get_contract_address(),
                last_rank: 1,
                last_player_points: 0,
                total_player_points: 0,
                total_player_count_committed: 1,
                total_player_count_revealed: 1,
                total_prize_amount: prize_amount,
                total_prize_amount_calculated: prize_amount,
            };

            let player_rank_final = PlayersRankFinal {
                world_id: WORLD_CONFIG_ID.into(),
                trial_id: SYSTEM_TRIAL_ID,
            };

            let player_rank = PlayerRank {
                trial_id: SYSTEM_TRIAL_ID,
                player: registered_player,
                rank: 1,
                paid: true,
            };

            let rank_prize = RankPrize {
                trial_id: SYSTEM_TRIAL_ID,
                rank: 1,
                total_players_same_rank_count: 1,
                total_prize_amount: prize_amount,
                grant_elite_nft: false,
            };
            
            let rank_list = RankList {
                trial_id: SYSTEM_TRIAL_ID,
                rank: 1,
                index: 0,
                player: registered_player,
            };

            world.write_model(@player_rank_trial);
            world.write_model(@player_rank_final);
            world.write_model(@player_rank);
            world.write_model(@rank_prize);
            world.write_model(@rank_list);


            // transfer full amount that player paid to register
            let reward_token = IERC20Dispatcher { contract_address: blitz_registration_config.fee_token };
            assert!(reward_token.transfer(registered_player, prize_amount.into()), "Eternum: Failed to transfer prize");

            // emit event
            let now = starknet::get_block_timestamp();
            let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
            let reward_token_decimals = reward_token.decimals();
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(registered_player),
                        entity_id: Option::Some(0),
                        tx_hash,
                        story: Story::PrizeDistributedStory(
                            PrizeDistributedStory {
                                to_player_address: registered_player, amount: prize_amount, decimals: reward_token_decimals,
                            },
                        ),
                        timestamp: now,
                    },
                );
            
        }

        fn blitz_prize_claim(ref self: ContractState, players: Array<ContractAddress>) {
            // ensure game has ended and points registration is closed
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world);
            season_config.assert_game_ended_and_points_registration_closed();

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure there is a finalized player rank
            let mut players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let now = starknet::get_block_timestamp();
            let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            let reward_token = IERC20Dispatcher { contract_address: blitz_registration_config.fee_token };
            let reward_token_decimals = reward_token.decimals();

            let final_trial_id = players_rank_final.trial_id;
            let caller = starknet::get_caller_address();
            let mut game_chest_reward: GameChestReward = world.read_model(WORLD_CONFIG_ID);
            let lootchest_erc721_dispatcher = ICollectibleDispatcher {
                contract_address: blitz_registration_config.collectibles_lootchest_address,
            };
            let elite_nft_erc721_dispatcher = ICollectibleDispatcher {
                contract_address: blitz_registration_config.collectibles_elitenft_address,
            };
            let season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);

            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let mut random_number = rng_library_dispatcher.get_random_number(caller, world);
            for player in players {
                // ensure player is eligible for prize
                let mut player_rank: PlayerRank = world.read_model((final_trial_id, player));
                assert!(player_rank.rank > 0, "Eternum: Player is not ranked");

                // ensure player has not previously been paid
                assert!(!player_rank.paid, "Eternum: Player has already been paid");

                // set player paid status
                player_rank.paid = true;
                world.write_model(@player_rank);

                // split the rank prize based on the number of players with the same rank
                let rank_prize: RankPrize = world.read_model((final_trial_id, player_rank.rank));
                let amount: u128 = rank_prize.total_prize_amount / rank_prize.total_players_same_rank_count.into();

                // transfer ERC20 prize to player
                assert!(reward_token.transfer(player, amount.into()), "Eternum: Failed to transfer prize");

                // transfer ERC721 Chest prize to player
                if game_chest_reward.allocated_chests > game_chest_reward.distributed_chests {

                    let mut player_points: PlayerRegisteredPoints = world.read_model(player);
                    let success: bool = rng_library_dispatcher
                        .get_weighted_choice_bool_simple(
                            player_points.registered_points.into(), 
                            season_prize.total_registered_points.into(), 
                            random_number
                        );
                    random_number += 1;

                    if success {
                        game_chest_reward.distributed_chests += 1;
                        lootchest_erc721_dispatcher.mint(player, blitz_registration_config.collectibles_lootchest_attrs_raw());
                    }
                }

                // transfer ERC721 Elite Invite NFT prize to player
                if rank_prize.grant_elite_nft 
                    && elite_nft_erc721_dispatcher.contract_address.is_non_zero() {

                    elite_nft_erc721_dispatcher.mint(player, blitz_registration_config.collectibles_elitenft_attrs_raw());
                }

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            owner: Option::Some(player),
                            entity_id: Option::Some(0),
                            tx_hash,
                            story: Story::PrizeDistributedStory(
                                PrizeDistributedStory {
                                    to_player_address: player, amount, decimals: reward_token_decimals,
                                },
                            ),
                            timestamp: now,
                        },
                    );
            }

            world.write_model(@game_chest_reward);

        }

        // Permissionless
        /// Creator fees get sent after the first successful call to this function
        fn blitz_prize_player_rank(
            ref self: ContractState,
            trial_id: u128,
            total_player_count_committed: u16,
            players_list: Array<ContractAddress>,
        ) {
            // ensure game has ended and points registration is closed
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world);
            season_config.assert_game_ended_and_points_registration_closed();

            assert!(trial_id != SYSTEM_TRIAL_ID, "Eternum: Invalid trial id");

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure players_list is not empty
            assert!(players_list.len() > 0, "Eternum: Players list is empty");

            // ensure there is no finalized rank for this world and trial
            let mut players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_zero(), "Eternum: rankings already finalized");

            // ensure the trial id is non zero
            assert!(trial_id > 0, "Eternum: Invalid trial id");

            // ensure the trial id can be used
            let caller = starknet::get_caller_address();
            let mut trial: PlayersRankTrial = world.read_model(trial_id);
            let mut blitz_registration_config: BlitzRegistrationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_registration_config"),
            );
            assert!(blitz_registration_config.registration_count != 1, "Eternum: use the blitz_prize_claim_no_game function");

            if trial.owner.is_non_zero() {
                assert!(trial.owner == caller, "Eternum: Trial ID already used by someone else");
            } else {
                assert!(trial.total_player_count_committed == 0, "Eternum: data already exists");
                assert!(total_player_count_committed > 0, "Eternum: total_player_count_committed must be > 0");

                // split fees and send game creator fees
                let mut blitz_fee_split_record: BlitzFeeSplitRecord = WorldRecordImpl::get_member(world, selector!("blitz_fee_split_record"));
                if !blitz_fee_split_record.already_split_fees() {
                    // split the fees
                    let this = starknet::get_contract_address();
                    let entry_token = ICollectibleDispatcher {contract_address: blitz_registration_config.entry_token_address};
                    let reward_token = IERC20Dispatcher { contract_address: blitz_registration_config.fee_token };
                
                    let single_player_entry_cost_amount: u128 = blitz_registration_config.fee_amount.try_into().unwrap();
                    let total_player_entry_cost_amount: u128 = single_player_entry_cost_amount * entry_token.total_supply().try_into().unwrap();
                    let total_prize_balance: u128 = reward_token.balance_of(this).try_into().unwrap();
                    let total_bonus_amount: u128 = total_prize_balance - total_player_entry_cost_amount;
                    blitz_fee_split_record.split_fees(total_player_entry_cost_amount, total_bonus_amount);

                    // send the creator fees
                    assert!(
                        reward_token.transfer(blitz_registration_config.fee_recipient, blitz_fee_split_record.creator_receives_amount.into()), 
                            "Eternum: Failed to transfer creator fees"
                    );

                    WorldRecordImpl::set_member(ref world, selector!("blitz_fee_split_record"), blitz_fee_split_record);
                }

                // update trial data
                trial.owner = caller;
                trial.total_player_count_committed = total_player_count_committed;
                trial.total_prize_amount = blitz_fee_split_record.players_receive_amount;
            }

            // loop through the player list and assign ranks
            let registered_player_count: u16 = blitz_registration_config.registration_count;
            let prize_pool_amount: u128 = trial.total_prize_amount;
            let calc_prize_pool: Fixed = FixedTrait::new(prize_pool_amount, false);
            let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
                registered_player_count, trial.total_player_count_committed,
            );
            let calc_s_parameter: Fixed = iPrizeDistributionCalcImpl::get_s_parameter(registered_player_count);
            let calc_sum_position_weights: Fixed = iPrizeDistributionCalcImpl::get_sum_rank_weights(
                calc_winner_count, calc_s_parameter,
            );

            for player in players_list {
                // ensure that the list is ordered based on points from first (winner, highest point)
                // to last (descending order)
                let mut player_points: PlayerRegisteredPoints = world.read_model(player);
                assert!(player_points.registered_points > 0, "Eternum: Player {:?} has no points", player);
                assert!(
                    trial.last_player_points == 0 || (trial.last_player_points >= player_points.registered_points),
                    "Eternum: Players list not ordered by points",
                );

                // accumulate total points and determine rank
                if trial.last_player_points == 0 || (trial.last_player_points > player_points.registered_points) {
                    trial.last_rank += 1;
                }
                trial.last_player_points = player_points.registered_points;
                trial.total_player_points += player_points.registered_points;
                trial.total_player_count_revealed += 1;

                // ensure player wasn't previously ranked
                let mut player_rank: PlayerRank = world.read_model((trial.trial_id, player));
                assert!(
                    player_rank.rank.is_zero(), "Eternum: Player {:?} already ranked, cannot be ranked twice", player,
                );

                // assign rank to player
                player_rank.rank = trial.last_rank;
                world.write_model(@player_rank);

                // calculate and assign prize for the player's position
                let mut position_prize_amount = iPrizeDistributionCalcImpl::get_position_prize_amount(
                            calc_prize_pool,
                            trial.total_player_count_revealed, // not player.rank
                            calc_sum_position_weights,
                            calc_s_parameter,
                            calc_winner_count
                        );
                trial.total_prize_amount_calculated += position_prize_amount;

                // prevent over-distributing funds due to tiny rounding errors
                if trial.total_prize_amount_calculated > trial.total_prize_amount {
                    let difference = trial.total_prize_amount_calculated - trial.total_prize_amount;
                    position_prize_amount -= difference;
                    trial.total_prize_amount_calculated -= difference;
                }

                // update rank prize model
                let mut rank_prize: RankPrize = world.read_model((trial.trial_id, player_rank.rank));
                rank_prize.total_players_same_rank_count += 1;
                rank_prize.total_prize_amount += position_prize_amount;
                rank_prize.check_grant_elite_nft(trial.total_player_count_revealed, trial.total_player_count_committed);
                world.write_model(@rank_prize);

                // update rank list model
                world.write_model(
                    @RankList {
                        trial_id: trial.trial_id,
                        rank: player_rank.rank,
                        index: rank_prize.total_players_same_rank_count - 1,
                        player,
                    }
                );
            };

            // ensure all the players with points were included in the players_list
            assert!(trial.total_player_points > 0, "Eternum: No points registered");

            // finalize the rankings if all players with points have been ranked
            let mut season_prize: SeasonPrize = world.read_model(WORLD_CONFIG_ID);
            let players_list_complete = season_prize.total_registered_points == trial.total_player_points;
            if players_list_complete {
                // ensure the number of players revealed matches the number committed
                assert!(
                    trial.total_player_count_revealed == trial.total_player_count_committed,
                    "Eternum: Bad
                total_player_count_committed",
                );

                // finalize the rankings
                players_rank_final.trial_id = trial.trial_id;
                world.write_model(@players_rank_final);

                //////////////////////////////////////////
                ///  finalize allocation of chests
                //////////////////////////////////////////
                 
                // compute reward chest allocations for this game
                self.blitz_get_or_compute_series_chest_reward_state();

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            owner: Option::Some(caller),
                            entity_id: Option::Some(0),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::PrizeDistributionFinalStory(
                                PrizeDistributionFinalStory { trial_id: trial.trial_id },
                            ),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            };

            // update the trial with the new last rank and points
            world.write_model(@trial);
        }

        fn blitz_get_ranked(ref self: ContractState, rank: u16) -> Span<ContractAddress> {

            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let final_trial_id = players_rank_final.trial_id;
            let mut players: Array<ContractAddress> = array![];

            let rank_prize: RankPrize = world.read_model((final_trial_id, rank));
            for index in 0..rank_prize.total_players_same_rank_count {
                let rank_list: RankList = world.read_model((final_trial_id, rank, index));
                players.append(rank_list.player);
            }
            return players.span();
        }

        fn blitz_get_winner(ref self: ContractState) -> Option<u256> {

            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let final_trial_id = players_rank_final.trial_id;
            let winner_rank: u16 = 1;
            let rank_prize: RankPrize = world.read_model((final_trial_id, winner_rank));
            if rank_prize.total_players_same_rank_count == 1 {
                let winner_index: u16 = 0;
                let rank_list: RankList = world.read_model((final_trial_id, winner_rank, winner_index));
                let winner_felt: felt252 = rank_list.player.into();
                assert!(winner_felt != 0, "Eternum: Invalid winner address");

                return Option::Some(winner_felt.into());
            }
    
            return Option::None;
        }

    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IPrizeDistributionSystemsDispatcher {
        let (addr, _) = world.dns(@"prize_distribution_systems").unwrap();
        super::IPrizeDistributionSystemsDispatcher { contract_address: addr}
    }
}
