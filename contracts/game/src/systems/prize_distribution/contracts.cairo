use starknet::ContractAddress;
use crate::models::series_chest_reward::SeriesChestRewardState;

#[starknet::interface]
pub trait IPrizeDistributionSystems<T> {
    fn blitz_get_or_compute_series_chest_reward_state(ref self: T, game_id: u32) -> SeriesChestRewardState;
    fn blitz_prize_player_rank(
        ref self: T,
        game_id: u32,
        trial_id: u128,
        total_player_count_committed: u16,
        players_list: Array<ContractAddress>,
    );
    fn blitz_get_ranked(ref self: T, game_id: u32, rank: u16) -> Span<ContractAddress>;
    fn reset_trial(ref self: T, game_id: u32);
}

#[dojo::contract]
pub mod prize_distribution_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use series_chest_reward_calculator::SeriesChestRewardStateTrait;
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{BlitzRegistrationConfigImpl, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::events::{PrizeDistributionFinalStory, Story, StoryEvent};
    use crate::models::game::{GameRegistryImpl, Series};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::models::ledger::LedgerRegistrationImpl;
    use crate::models::rank::{PlayerRank, PlayersRankTrial, RankList, RankPrize, RankPrizeImpl};
    use crate::models::season::SeasonPrize;
    use crate::models::series_chest_reward::{GameChestReward, SeriesChestRewardState};
    use crate::systems::utils::ranking::competition_rank;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator::SeriesChestRewardStateImpl;
    use super::IPrizeDistributionSystems;

    pub const SYSTEM_TRIAL_ID: u128 = 1000;
    const VICTORY_POINTS_MULTIPLIER: u128 = 1_000_000;
    const GAME_REWARD_CHEST_POINTS_THRESHOLD: u128 = 500 * VICTORY_POINTS_MULTIPLIER;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct LedgerResultRowReady {
        #[key]
        pub game_id: u32,
        #[key]
        pub trial_id: u128,
        #[key]
        pub index: u16,
        pub owner: ContractAddress,
        pub rank: u16,
        pub chests: u16,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct LedgerResultsReady {
        #[key]
        pub game_id: u32,
        #[key]
        pub trial_id: u128,
        pub player_count: u16,
    }

    #[abi(embed_v0)]
    pub impl PrizeDistributionSystemsImpl of IPrizeDistributionSystems<ContractState> {
        fn blitz_get_or_compute_series_chest_reward_state(
            ref self: ContractState, game_id: u32,
        ) -> SeriesChestRewardState {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world, game_id).assert_started_main();
            assert!(is_blitz_game(world, game_id), "Eternum: Not a blitz game");

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

        fn blitz_prize_player_rank(
            ref self: ContractState,
            game_id: u32,
            trial_id: u128,
            total_player_count_committed: u16,
            players_list: Array<ContractAddress>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world, game_id).assert_game_ended_and_points_registration_closed();
            assert!(is_blitz_game(world, game_id), "Eternum: Not a blitz game");
            assert!(trial_id.is_non_zero() && trial_id != SYSTEM_TRIAL_ID, "Eternum: Invalid trial id");
            assert!(!players_list.is_empty(), "Eternum: Players list is empty");

            let mut game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_zero(), "Eternum: rankings already finalized");

            let caller = starknet::get_caller_address();
            let registration = BlitzRegistrationConfigImpl::get(world, game_id);
            let mut trial: PlayersRankTrial = world.read_model(game_id);
            initialize_or_validate_trial(
                ref trial, game_id, trial_id, caller, total_player_count_committed, registration.registration_count,
            );

            rank_players(ref world, ref trial, players_list);
            if trial.total_player_count_revealed == trial.total_player_count_committed {
                let season_prize: SeasonPrize = world.read_model(game_id);
                assert!(
                    trial.total_player_points == season_prize.total_registered_points,
                    "Eternum: ranked points do not match game total",
                );

                game.final_trial_id = trial.nonce;
                world.write_model(@game);
                self.blitz_get_or_compute_series_chest_reward_state(game_id);
                emit_ledger_results(ref world, trial);
                emit_final_story(ref world, game_id, trial.nonce, caller);
            }

            world.write_model(@trial);
        }

        fn blitz_get_ranked(ref self: ContractState, game_id: u32, rank: u16) -> Span<ContractAddress> {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let rank_prize: RankPrize = world.read_model((game_id, rank));
            let mut players: Array<ContractAddress> = array![];
            for index in 0..rank_prize.total_players_same_rank_count {
                let rank_list: RankList = world.read_model((game_id, rank, index));
                players.append(rank_list.player);
            }
            players.span()
        }

        fn reset_trial(ref self: ContractState, game_id: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_registrar(world);
            let game = GameRegistryImpl::get(world, game_id);
            assert!(game.final_trial_id.is_zero(), "Eternum: finalized rankings are immutable");
            clear_unfinalized_trial(ref world, game_id);
        }
    }

    fn initialize_or_validate_trial(
        ref trial: PlayersRankTrial,
        game_id: u32,
        trial_id: u128,
        caller: ContractAddress,
        committed_count: u16,
        registered_count: u16,
    ) {
        if trial.owner.is_non_zero() {
            assert!(trial.nonce == trial_id, "Eternum: Trial ID already used");
            assert!(trial.owner == caller, "Eternum: Trial ID already used by someone else");
            return;
        }

        assert!(committed_count > 0, "Eternum: total_player_count_committed must be > 0");
        assert!(committed_count == registered_count, "Eternum: ranked roster does not match registrations");
        trial.game_id = game_id;
        trial.nonce = trial_id;
        trial.owner = caller;
        trial.total_player_count_committed = committed_count;
    }

    fn rank_players(ref world: WorldStorage, ref trial: PlayersRankTrial, players: Array<ContractAddress>) {
        for player in players {
            let player_points: PlayerRegisteredPoints = world.read_model((trial.game_id, player));
            let rank = competition_rank(
                trial.last_player_points, player_points.registered_points, trial.total_player_count_revealed,
            );
            if rank != 0 {
                trial.last_rank = rank;
            }

            let player_rank: PlayerRank = world.read_model((trial.game_id, player));
            assert!(player_rank.rank.is_zero(), "Eternum: Player already ranked");

            trial.last_player_points = player_points.registered_points;
            trial.total_player_points += player_points.registered_points;
            trial.total_player_count_revealed += 1;
            write_player_rank(ref world, trial.game_id, player, trial.last_rank, trial);
        }
    }

    fn write_player_rank(
        ref world: WorldStorage, game_id: u32, player: ContractAddress, rank: u16, trial: PlayersRankTrial,
    ) {
        world.write_model(@PlayerRank { game_id, player, rank, chests: 0 });

        let mut rank_prize: RankPrize = world.read_model((game_id, rank));
        rank_prize.total_players_same_rank_count += 1;
        rank_prize.check_grant_elite_nft(trial.total_player_count_revealed, trial.total_player_count_committed);
        world.write_model(@rank_prize);
        world.write_model(@RankList { game_id, rank, index: rank_prize.total_players_same_rank_count - 1, player });
    }

    fn emit_ledger_results(ref world: WorldStorage, trial: PlayersRankTrial) {
        let mut game_chests: GameChestReward = world.read_model(trial.game_id);
        let season_prize: SeasonPrize = world.read_model(trial.game_id);
        let mut result_index = 0;
        let mut rank = 1;

        while rank <= trial.last_rank {
            let rank_prize: RankPrize = world.read_model((trial.game_id, rank));
            let mut rank_index = 0;
            while rank_index < rank_prize.total_players_same_rank_count {
                let ranked: RankList = world.read_model((trial.game_id, rank, rank_index));
                let chests = allocate_chests(world, trial.game_id, ranked.player, season_prize, ref game_chests);
                let mut player_rank: PlayerRank = world.read_model((trial.game_id, ranked.player));
                player_rank.chests = chests;
                world.write_model(@player_rank);

                let owner = resolve_result_owner(world, trial.game_id, ranked.player);
                world
                    .emit_event(
                        @LedgerResultRowReady {
                            game_id: trial.game_id, trial_id: trial.nonce, index: result_index, owner, rank, chests,
                        },
                    );
                result_index += 1;
                rank_index += 1;
            }
            rank += 1;
        }

        assert!(result_index == trial.total_player_count_committed, "Eternum: result roster is incomplete");
        world.write_model(@game_chests);
        world
            .emit_event(
                @LedgerResultsReady { game_id: trial.game_id, trial_id: trial.nonce, player_count: result_index },
            );
    }

    fn allocate_chests(
        world: WorldStorage,
        game_id: u32,
        player: ContractAddress,
        season_prize: SeasonPrize,
        ref game_chests: GameChestReward,
    ) -> u16 {
        if game_chests.distributed_chests >= game_chests.allocated_chests {
            return 0;
        }

        let player_points: PlayerRegisteredPoints = world.read_model((game_id, player));
        let mut chests = 0;
        if player_points.registered_points >= GAME_REWARD_CHEST_POINTS_THRESHOLD {
            chests += 1;
            game_chests.distributed_chests += 1;
        }

        if game_chests.distributed_chests >= game_chests.allocated_chests
            || season_prize.total_registered_points.is_zero() {
            return chests;
        }

        let proportional: u128 = (game_chests.allocated_chests.into() * player_points.registered_points)
            / season_prize.total_registered_points;
        let chests_left = game_chests.allocated_chests - game_chests.distributed_chests;
        let proportional: u16 = if proportional > chests_left.into() {
            chests_left
        } else {
            proportional.try_into().unwrap()
        };
        game_chests.distributed_chests += proportional;
        chests + proportional
    }

    fn emit_final_story(ref world: WorldStorage, game_id: u32, trial_id: u128, caller: ContractAddress) {
        world
            .emit_event(
                @StoryEvent {
                    game_id,
                    id: world.dispatcher.uuid(),
                    owner: Option::Some(caller),
                    entity_id: Option::Some(0),
                    tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                    story: Story::PrizeDistributionFinalStory(PrizeDistributionFinalStory { trial_id }),
                    timestamp: starknet::get_block_timestamp(),
                },
            );
    }

    fn is_blitz_game(world: WorldStorage, game_id: u32) -> bool {
        WorldConfigUtilImpl::get_member(world, game_id, selector!("blitz_mode_on"))
    }

    fn resolve_result_owner(world: WorldStorage, game_id: u32, player: ContractAddress) -> ContractAddress {
        if SeasonConfigImpl::get(world, game_id).dev_mode_on {
            return player;
        }
        LedgerRegistrationImpl::owner_for_account(world, player)
    }

    fn assert_caller_is_registrar(world: WorldStorage) {
        let (registrar, _) = world.dns(@"registrar_systems").expect('registrar not found');
        assert!(starknet::get_caller_address() == registrar, "Eternum: caller is not the registrar");
    }

    fn clear_unfinalized_trial(ref world: WorldStorage, game_id: u32) {
        let trial: PlayersRankTrial = world.read_model(game_id);
        let mut rank = 1;
        while rank <= trial.last_rank {
            clear_rank(ref world, game_id, rank);
            rank += 1;
        }
        world.erase_model(@trial);
    }

    fn clear_rank(ref world: WorldStorage, game_id: u32, rank: u16) {
        let rank_prize: RankPrize = world.read_model((game_id, rank));
        let mut index = 0;
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
}
