use starknet::ContractAddress;
use crate::models::series_chest_reward::SeriesChestRewardState;

// Cross-world factory series lookup is retired in favor of the persistent Series model (D13).
// #[starknet::interface]
// pub trait IWorldFactorySeries<T> {
//     fn get_series_game_data(self: @T, addr: ContractAddress) -> (felt252, u16);
//     fn get_series_game_address_by_class_hash(
//         self: @T, name: felt252, game_number: u16, class_hash: ClassHash,
//     ) -> ContractAddress;
// }

#[starknet::interface]
pub trait IPrizeDistributionSystems<T> {
    fn blitz_get_or_compute_series_chest_reward_state(ref self: T, game_id: u32) -> SeriesChestRewardState;
    fn blitz_prize_claim_no_game(ref self: T, game_id: u32, registered_player: ContractAddress);
    fn blitz_prize_claim(ref self: T, game_id: u32, players: Array<ContractAddress>);
    fn blitz_prize_player_rank(
        ref self: T,
        game_id: u32,
        trial_id: u128,
        total_player_count_committed: u16,
        players_list: Array<ContractAddress>,
    );
    fn blitz_get_ranked(ref self: T, game_id: u32, rank: u16) -> Span<ContractAddress>;
    fn blitz_get_winner(ref self: T, game_id: u32) -> Option<u256>;
    fn reset_trial(ref self: T, game_id: u32);
    fn blitz_sweep_remaining_escrow(ref self: T, game_id: u32);
}


// todo: fee split
// todo: release entry token
#[dojo::contract]
pub mod prize_distribution_systems {
    use core::num::traits::zero::Zero;
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use series_chest_reward_calculator::SeriesChestRewardStateTrait;
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, VELORDS_BURNER_ADDRESS};
    use crate::models::config::{BlitzRegistrationConfigImpl, BlitzSettlement, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::events::{PrizeDistributedStory, PrizeDistributionFinalStory, Story, StoryEvent};
    use crate::models::game::{GameRegistryImpl, Series};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::models::rank::{PlayerRank, PlayersRankTrial, RankList, RankPrize, RankPrizeImpl};
    use crate::models::record::{BlitzFeeSplitRecord, BlitzFeeSplitRecordImpl, WorldRecordImpl};
    use crate::models::season::SeasonPrize;
    use crate::models::series_chest_reward::{GameChestReward, SeriesChestRewardState};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::realm::utils::contracts::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::systems::utils::prize::iPrizeDistributionCalcImpl;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator::SeriesChestRewardStateImpl;
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::interfaces::collectibles::{ICollectibleDispatcher, ICollectibleDispatcherTrait};
    use super::IPrizeDistributionSystems;

    pub const SYSTEM_TRIAL_ID: u128 = 1000;
    const VICTORY_POINTS_MULTIPLIER: u128 = 1_000_000;
    const GAME_REWARD_CHEST_POINTS_THRESHOLD: u128 = 500 * VICTORY_POINTS_MULTIPLIER;


    #[abi(embed_v0)]
    pub impl PrizeDistributionSystemsImpl of IPrizeDistributionSystems<ContractState> {
        fn blitz_get_or_compute_series_chest_reward_state(
            ref self: ContractState, game_id: u32,
        ) -> SeriesChestRewardState {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world, game_id).assert_started_main();
            assert!(
                WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on")),
                "Eternum: Not a blitz game",
            );

            let game = GameRegistryImpl::get(world, game_id);
            if game.series_id.is_zero() {
                return initialize_standalone_chest_reward(ref world, game_id);
            }
            let series: Series = world.read_model(game.series_id);
            let mut state: SeriesChestRewardState = world.read_model(game.series_id);
            if state.series_id.is_zero() {
                state = SeriesChestRewardStateImpl::new(game.series_id, series.total_chests, series.cap_ratio_bps);
            }
            if state.game_index >= game.game_number_in_series.into() {
                return state;
            }
            assert!(
                state.game_index + 1 == game.game_number_in_series.into(), "Eternum: Series games must settle in order",
            );

            let registration = BlitzRegistrationConfigImpl::get(world, game_id);
            let allocated_chests = if registration.registration_count < 2 {
                state.game_index += 1;
                0
            } else {
                state.allocate_chests(series, registration.registration_count.into())
            };

            world.write_model(@state);
            world
                .write_model(
                    @GameChestReward {
                        game_id, allocated_chests: allocated_chests.try_into().unwrap(), distributed_chests: 0,
                    },
                );
            state
        }


        fn blitz_prize_claim_no_game(ref self: ContractState, game_id: u32, registered_player: ContractAddress) {
            // ensure the main game has started (so registration has closed)
            // but there is only 1 registered player
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world, game_id);
            season_config.assert_started_main();

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure there is no finalized player rank
            let mut game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_zero(), "Eternum: rankings already finalized");

            // ensure there is only 1 registered player
            let blitz_registration_config = BlitzRegistrationConfigImpl::get(world, game_id);
            assert!(blitz_registration_config.registration_count == 1, "Eternum: More than 1 registered player");

            // ensure the registered_player parameter is the registered player
            let settled_player: BlitzSettlement = world.read_model((game_id, registered_player));
            assert!(settled_player.structure_ids.len() > 0, "Eternum: Player not settled");

            // create a trial with the registered player and finalize the rankings
            let prize_amount: u128 = blitz_registration_config.fee_amount.try_into().unwrap();
            let player_rank_trial: PlayersRankTrial = PlayersRankTrial {
                game_id,
                nonce: SYSTEM_TRIAL_ID,
                owner: starknet::get_contract_address(),
                last_rank: 1,
                last_player_points: 0,
                total_player_points: 0,
                total_player_count_committed: 1,
                total_player_count_revealed: 1,
                total_prize_amount: prize_amount,
                total_prize_amount_calculated: prize_amount,
            };

            GameRegistryImpl::debit_fees(ref world, game_id, prize_amount.into());
            game = GameRegistryImpl::get(world, game_id);
            game.final_trial_id = SYSTEM_TRIAL_ID;

            let player_rank = PlayerRank { game_id, player: registered_player, rank: 1, paid: true };

            let rank_prize = RankPrize {
                game_id,
                rank: 1,
                total_players_same_rank_count: 1,
                total_prize_amount: prize_amount,
                grant_elite_nft: false,
            };

            let rank_list = RankList { game_id, rank: 1, index: 0, player: registered_player };

            world.write_model(@player_rank_trial);
            world.write_model(@game);
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
                        game_id,
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(registered_player),
                        entity_id: Option::Some(0),
                        tx_hash,
                        story: Story::PrizeDistributedStory(
                            PrizeDistributedStory {
                                to_player_address: registered_player,
                                amount: prize_amount,
                                decimals: reward_token_decimals,
                            },
                        ),
                        timestamp: now,
                    },
                );
        }

        fn blitz_prize_claim(ref self: ContractState, game_id: u32, players: Array<ContractAddress>) {
            // ensure game has ended and points registration is closed
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world, game_id);
            season_config.assert_game_ended_and_points_registration_closed();

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure there is a finalized player rank
            let game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let now = starknet::get_block_timestamp();
            let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
            let blitz_registration_config = BlitzRegistrationConfigImpl::get(world, game_id);
            let reward_token = IERC20Dispatcher { contract_address: blitz_registration_config.fee_token };
            let reward_token_decimals = reward_token.decimals();

            let caller = starknet::get_caller_address();
            let mut game_chest_reward: GameChestReward = world.read_model(game_id);
            let lootchest_erc721_dispatcher = ICollectibleDispatcher {
                contract_address: blitz_registration_config.collectibles_lootchest_address,
            };
            let elite_nft_erc721_dispatcher = ICollectibleDispatcher {
                contract_address: blitz_registration_config.collectibles_elitenft_address,
            };
            let season_prize: SeasonPrize = world.read_model(game_id);

            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let mut _random_number = rng_library_dispatcher.get_random_number(game_id, Source::Nonce(caller), world);
            for player in players {
                // ensure player is eligible for prize
                let mut player_rank: PlayerRank = world.read_model((game_id, player));
                assert!(player_rank.rank > 0, "Eternum: Player is not ranked");

                // ensure player has not previously been paid
                assert!(!player_rank.paid, "Eternum: Player has already been paid");

                // set player paid status
                player_rank.paid = true;
                world.write_model(@player_rank);

                // split the rank prize based on the number of players with the same rank
                let rank_prize: RankPrize = world.read_model((game_id, player_rank.rank));
                let amount: u128 = rank_prize.total_prize_amount / rank_prize.total_players_same_rank_count.into();

                // transfer ERC20 prize to player
                GameRegistryImpl::debit_fees(ref world, game_id, amount.into());
                assert!(reward_token.transfer(player, amount.into()), "Eternum: Failed to transfer prize");

                // transfer 1 Game Chest to players above 500 points
                let mut player_points: PlayerRegisteredPoints = world.read_model((game_id, player));
                if lootchest_erc721_dispatcher.contract_address.is_non_zero()
                    && player_points.registered_points >= GAME_REWARD_CHEST_POINTS_THRESHOLD
                    && game_chest_reward.distributed_chests < game_chest_reward.allocated_chests {
                    game_chest_reward.distributed_chests += 1;
                    lootchest_erc721_dispatcher
                        .mint(player, blitz_registration_config.collectibles_lootchest_attrs_raw());
                }

                // transfer ERC721 Chest prize to player
                if lootchest_erc721_dispatcher.contract_address.is_non_zero()
                    && game_chest_reward.allocated_chests > game_chest_reward.distributed_chests {
                    let mut received_num_chests: u128 = (game_chest_reward.allocated_chests.into()
                        * player_points.registered_points)
                        / season_prize.total_registered_points;

                    // should be impossible but who knows
                    let chests_left = game_chest_reward.allocated_chests - game_chest_reward.distributed_chests;
                    if chests_left.into() < received_num_chests {
                        received_num_chests = chests_left.into()
                    }

                    lootchest_erc721_dispatcher
                        .mint_many(
                            player,
                            array![
                                (
                                    blitz_registration_config.collectibles_lootchest_attrs_raw(),
                                    received_num_chests.try_into().unwrap(),
                                ),
                            ]
                                .span(),
                        );
                    game_chest_reward.distributed_chests += received_num_chests.try_into().unwrap();
                }

                // transfer ERC721 Elite Invite NFT prize to player
                if rank_prize.grant_elite_nft && elite_nft_erc721_dispatcher.contract_address.is_non_zero() {
                    elite_nft_erc721_dispatcher
                        .mint(player, blitz_registration_config.collectibles_elitenft_attrs_raw());
                }

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            game_id,
                            id: world.dispatcher.uuid(),
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
            game_id: u32,
            trial_id: u128,
            total_player_count_committed: u16,
            players_list: Array<ContractAddress>,
        ) {
            // ensure game has ended and points registration is closed
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season_config = SeasonConfigImpl::get(world, game_id);
            season_config.assert_game_ended_and_points_registration_closed();

            assert!(trial_id != SYSTEM_TRIAL_ID, "Eternum: Invalid trial id");

            // ensure blitz game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == true, "Eternum: Not a blitz game");

            // ensure players_list is not empty
            assert!(players_list.len() > 0, "Eternum: Players list is empty");

            // ensure there is no finalized rank for this game
            let mut game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_zero(), "Eternum: rankings already finalized");

            // ensure the trial id is non zero
            assert!(trial_id > 0, "Eternum: Invalid trial id");

            // ensure the trial id can be used
            let caller = starknet::get_caller_address();
            let mut blitz_fee_split_record: BlitzFeeSplitRecord = WorldRecordImpl::get_member(
                world, game_id, selector!("blitz_fee_split_record"),
            );
            let mut trial: PlayersRankTrial = world.read_model(game_id);
            let blitz_registration_config = BlitzRegistrationConfigImpl::get(world, game_id);
            assert!(
                blitz_registration_config.registration_count != 1,
                "Eternum: use the blitz_prize_claim_no_game function",
            );

            if trial.owner.is_non_zero() {
                assert!(trial.nonce == trial_id, "Eternum: Trial ID already used");
                assert!(trial.owner == caller, "Eternum: Trial ID already used by someone else");
            } else {
                assert!(trial.total_player_count_committed == 0, "Eternum: data already exists");
                assert!(total_player_count_committed > 0, "Eternum: total_player_count_committed must be > 0");

                // split fees and send game creator fees
                if !blitz_fee_split_record.already_split_fees() {
                    // split the fees
                    let reward_token = IERC20Dispatcher { contract_address: blitz_registration_config.fee_token };
                    let total_player_entry_cost_amount: u128 = game.fees_collected.try_into().unwrap();
                    // Sponsorship is not inferred from this contract's pooled balance (D11). A
                    // future explicit per-game sponsorship credit can extend GameRegistry.
                    blitz_fee_split_record.split_fees(total_player_entry_cost_amount, 0);

                    let protocol_fees = blitz_fee_split_record.creator_receives_amount
                        + blitz_fee_split_record.velords_receives_amount;
                    game.fees_paid_out += protocol_fees.into();
                    assert!(game.fees_paid_out <= game.fees_collected, "Eternum: game escrow exhausted");
                    world.write_model(@game);

                    // send the creator fees
                    assert!(
                        reward_token
                            .transfer(
                                blitz_registration_config.fee_recipient,
                                blitz_fee_split_record.creator_receives_amount.into(),
                            ),
                        "Eternum: Failed to transfer creator fees",
                    );

                    // todo: fix: send velords to correct address
                    // send the velords fees
                    assert!(
                        reward_token
                            .transfer(
                                VELORDS_BURNER_ADDRESS.try_into().unwrap(),
                                blitz_fee_split_record.velords_receives_amount.into(),
                            ),
                        "Eternum: Failed to transfer velords fees",
                    );

                    WorldRecordImpl::set_member(
                        ref world, game_id, selector!("blitz_fee_split_record"), blitz_fee_split_record,
                    );
                }

                // update trial data
                trial.owner = caller;
                trial.game_id = game_id;
                trial.nonce = trial_id;
                trial.total_player_count_committed = total_player_count_committed;
                trial.total_prize_amount = blitz_fee_split_record.players_receive_amount;
            }

            // loop through the player list and assign ranks
            let registered_player_count: u16 = blitz_registration_config.registration_count;
            let prize_pool_amount: u128 = trial.total_prize_amount;
            let calc_prize_pool: Fixed = FixedTrait::new(prize_pool_amount, false);
            let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
                registered_player_count,
                trial.total_player_count_committed,
                blitz_fee_split_record.total_entry_cost_less_fees(),
                prize_pool_amount,
            );
            let calc_s_parameter: Fixed = iPrizeDistributionCalcImpl::get_s_parameter(registered_player_count);
            let calc_sum_position_weights: Fixed = iPrizeDistributionCalcImpl::get_sum_rank_weights(
                calc_winner_count, calc_s_parameter,
            );

            for player in players_list {
                // ensure that the list is ordered based on points from first (winner, highest point)
                // to last (descending order)
                let mut player_points: PlayerRegisteredPoints = world.read_model((game_id, player));
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
                let mut player_rank: PlayerRank = world.read_model((game_id, player));
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
                    calc_winner_count,
                );
                trial.total_prize_amount_calculated += position_prize_amount;

                // prevent over-distributing funds due to tiny rounding errors
                if trial.total_prize_amount_calculated > trial.total_prize_amount {
                    let difference = trial.total_prize_amount_calculated - trial.total_prize_amount;
                    position_prize_amount -= difference;
                    trial.total_prize_amount_calculated -= difference;
                }

                // update rank prize model
                let mut rank_prize: RankPrize = world.read_model((game_id, player_rank.rank));
                rank_prize.total_players_same_rank_count += 1;
                rank_prize.total_prize_amount += position_prize_amount;
                rank_prize.check_grant_elite_nft(trial.total_player_count_revealed, trial.total_player_count_committed);
                world.write_model(@rank_prize);

                // update rank list model
                world
                    .write_model(
                        @RankList {
                            game_id,
                            rank: player_rank.rank,
                            index: rank_prize.total_players_same_rank_count - 1,
                            player,
                        },
                    );
            }

            // ensure all the players with points were included in the players_list
            assert!(trial.total_player_points > 0, "Eternum: No points registered");

            // finalize the rankings if all players with points have been ranked
            let mut season_prize: SeasonPrize = world.read_model(game_id);
            let players_list_complete = season_prize.total_registered_points == trial.total_player_points;
            if players_list_complete {
                // ensure the number of players revealed matches the number committed
                assert!(
                    trial.total_player_count_revealed == trial.total_player_count_committed,
                    "Eternum: Bad
                total_player_count_committed",
                );

                // finalize the rankings
                game.final_trial_id = trial.nonce;
                world.write_model(@game);

                //////////////////////////////////////////
                ///  finalize allocation of chests
                //////////////////////////////////////////

                // compute reward chest allocations for this game
                self.blitz_get_or_compute_series_chest_reward_state(game_id);

                //////////////////////////////////////////
                ///  MMR updates are claim-based
                ///  (client/keepers call commit + per-player claims)
                //////////////////////////////////////////

                // emit event
                world
                    .emit_event(
                        @StoryEvent {
                            game_id,
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(caller),
                            entity_id: Option::Some(0),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::PrizeDistributionFinalStory(
                                PrizeDistributionFinalStory { trial_id: trial.nonce },
                            ),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }

            // update the trial with the new last rank and points
            world.write_model(@trial);
        }

        fn blitz_get_ranked(ref self: ContractState, game_id: u32, rank: u16) -> Span<ContractAddress> {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_non_zero(), "Eternum: rankings not finalized");
            let mut players: Array<ContractAddress> = array![];

            let rank_prize: RankPrize = world.read_model((game_id, rank));
            for index in 0..rank_prize.total_players_same_rank_count {
                let rank_list: RankList = world.read_model((game_id, rank, index));
                players.append(rank_list.player);
            }
            return players.span();
        }

        fn blitz_get_winner(ref self: ContractState, game_id: u32) -> Option<u256> {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let game = GameRegistryImpl::get(world, game_id);
            if game.final_trial_id.is_zero() {
                return Option::None;
            }

            let winner_rank: u16 = 1;
            let rank_prize: RankPrize = world.read_model((game_id, winner_rank));
            if rank_prize.total_players_same_rank_count == 1 {
                let winner_index: u16 = 0;
                let rank_list: RankList = world.read_model((game_id, winner_rank, winner_index));
                let winner_felt: felt252 = rank_list.player.into();
                assert!(winner_felt != 0, "Eternum: Invalid winner address");

                return Option::Some(winner_felt.into());
            }

            return Option::None;
        }

        fn reset_trial(ref self: ContractState, game_id: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_registrar(world);
            let game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_zero(), "Eternum: finalized rankings are immutable");

            clear_unfinalized_trial(ref world, game_id);
        }

        fn blitz_sweep_remaining_escrow(ref self: ContractState, game_id: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_registrar(world);

            let remainder = GameRegistryImpl::available_fees(world, game_id);
            if remainder.is_zero() {
                return;
            }
            let registration = BlitzRegistrationConfigImpl::get(world, game_id);
            let reward_token = IERC20Dispatcher { contract_address: registration.fee_token };
            GameRegistryImpl::debit_fees(ref world, game_id, remainder);
            assert!(
                reward_token.transfer(registration.fee_recipient, remainder), "Eternum: failed to sweep game escrow",
            );
        }
    }

    fn assert_caller_is_registrar(world: WorldStorage) {
        let (registrar, _) = world.dns(@"registrar_systems").expect('registrar not found');
        assert!(starknet::get_caller_address() == registrar, "Eternum: caller is not the registrar");
    }

    fn clear_unfinalized_trial(ref world: WorldStorage, game_id: u32) {
        let trial: PlayersRankTrial = world.read_model(game_id);
        let mut rank: u16 = 1;
        while rank <= trial.last_rank {
            clear_rank(ref world, game_id, rank);
            rank += 1;
        }
        world.erase_model(@trial);
    }

    fn clear_rank(ref world: WorldStorage, game_id: u32, rank: u16) {
        let rank_prize: RankPrize = world.read_model((game_id, rank));
        let mut index: u16 = 0;
        while index < rank_prize.total_players_same_rank_count {
            let rank_list: RankList = world.read_model((game_id, rank, index));
            let player_rank: PlayerRank = world.read_model((game_id, rank_list.player));
            world.erase_model(@player_rank);
            world.erase_model(@rank_list);
            index += 1;
        }
        world.erase_model(@rank_prize);
    }

    fn initialize_standalone_chest_reward(ref world: WorldStorage, game_id: u32) -> SeriesChestRewardState {
        world.write_model(@GameChestReward { game_id, allocated_chests: 0, distributed_chests: 0 });
        SeriesChestRewardStateImpl::new(0, 0, 10_000)
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IPrizeDistributionSystemsDispatcher {
        let (addr, _) = world.dns(@"prize_distribution_systems").unwrap();
        super::IPrizeDistributionSystemsDispatcher { contract_address: addr }
    }
}
