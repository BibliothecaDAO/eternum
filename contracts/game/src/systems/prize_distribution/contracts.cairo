use starknet::ContractAddress;

#[starknet::interface]
pub trait IPrizeDistributionSystems<T> {
    fn blitz_prize_claim(ref self: T, players: Array<ContractAddress>);
    fn blitz_prize_player_rank(
        ref self: T, trial_id: u128, total_player_count_committed: u16, players_list: Array<ContractAddress>,
    );
}

#[dojo::contract]
pub mod prize_distribution_systems {
    use core::num::traits::zero::Zero;
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use s1_eternum::models::config::{BlitzRegistrationConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use s1_eternum::models::events::{PrizeDistributedStory, PrizeDistributionFinalStory, Story, StoryEvent};
    use s1_eternum::models::rank::{PlayerRank, PlayersRankFinal, PlayersRankTrial, RankPrize};
    use s1_eternum::models::season::{SeasonPrize};
    use s1_eternum::systems::realm::utils::contracts::{IERC20Dispatcher, IERC20DispatcherTrait};
    use s1_eternum::systems::utils::prize::iPrizeDistributionCalcImpl;
    use s1_eternum::{models::{hyperstructure::{PlayerRegisteredPoints}}};
    use starknet::ContractAddress;


    #[abi(embed_v0)]
    pub impl PrizeDistributionSystemsImpl of super::IPrizeDistributionSystems<ContractState> {
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

                // transfer prize to player
                assert!(reward_token.transfer(player, amount.into()), "Eternum: Failed to transfer prize");

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            owner: Option::Some(player),
                            entity_id: Option::None,
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
        }

        // Permissionless
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
            if trial.owner.is_non_zero() {
                assert!(trial.owner == caller, "Eternum: Trial ID already used by someone else");
            } else {
                assert!(trial.total_player_count_committed == 0, "Eternum: data already exists");
                assert!(total_player_count_committed > 0, "Eternum: total_player_count_committed must be > 0");

                // fetch total prize amount
                let this = starknet::get_contract_address();
                let total_prize_amount: u128 = IERC20Dispatcher {
                    contract_address: blitz_registration_config.fee_token,
                }
                    .balance_of(this)
                    .try_into()
                    .unwrap();
                assert!(total_prize_amount > 0, "Eternum: No prize to distribute");

                trial.owner = caller;
                trial.total_player_count_committed = total_player_count_committed;
                trial.total_prize_amount = total_prize_amount;
            }

            // loop through the player list and assign ranks
            let registered_player_count: u16 = blitz_registration_config.registration_count;
            let entry_cost_amount: u128 = blitz_registration_config.fee_amount.try_into().unwrap();
            let prize_pool_amount: u128 = trial.total_prize_amount;
            let calc_entry_cost: Fixed = FixedTrait::new(entry_cost_amount, false);
            let calc_prize_pool: Fixed = FixedTrait::new(prize_pool_amount, false);
            let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
                registered_player_count, trial.total_player_count_committed,
            )
                .into();
            let calc_s_parameter: Fixed = iPrizeDistributionCalcImpl::get_s_parameter(registered_player_count);
            let calc_total_baseline: Fixed = iPrizeDistributionCalcImpl::get_total_baseline(
                calc_entry_cost, calc_winner_count.into(),
            );
            let calc_remainder: Fixed = iPrizeDistributionCalcImpl::get_remainder(calc_prize_pool, calc_total_baseline);
            let calc_sum_position_weights: Fixed = iPrizeDistributionCalcImpl::get_sum_rank_weights(
                calc_winner_count, calc_s_parameter,
            );

            for player in players_list {
                // ensure that the list is ordered based on points from first to last
                let mut player_points: PlayerRegisteredPoints = world.read_model(player);
                assert!(player_points.registered_points > 0, "Eternum: Player {:?} has no points", player);
                assert!(
                    player_points.registered_points >= trial.last_player_points,
                    "Eternum: Players list not
                ordered by points",
                );

                // accumulate total points and determine rank
                if player_points.registered_points > trial.last_player_points {
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

                // update rank prize
                let mut rank_prize: RankPrize = world.read_model((trial.trial_id, player_rank.rank));
                rank_prize.total_players_same_rank_count += 1;
                rank_prize
                    .total_prize_amount +=
                        iPrizeDistributionCalcImpl::get_position_prize_amount(
                            calc_entry_cost,
                            trial.total_player_count_revealed, // not player.rank
                            calc_remainder,
                            calc_sum_position_weights,
                            calc_s_parameter,
                        );
                world.write_model(@rank_prize);
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

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            owner: Option::Some(caller),
                            entity_id: Option::None,
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
    }
}
