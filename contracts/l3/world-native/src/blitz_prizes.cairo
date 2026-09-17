use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::series_chests::{SeriesRules, SeriesState};
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct GameChests {
    pub allocated: u16,
    pub distributed: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RankingTrial {
    pub trial_id: u128,
    pub committed: u16,
    pub processed: u16,
    pub last_rank: u16,
    pub last_points: u128,
    pub total_points: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerRank {
    pub rank: u16,
    pub chests: u16,
    pub elite: bool,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RankPlayers {
    pub trial_id: u128,
    pub committed: u16,
    pub players: Span<ContractAddress>,
}
#[starknet::interface]
pub trait IBlitzPrizes<T> {
    fn configure_series_chests(ref self: T, series_id: felt252, rules: SeriesRules);
    fn series_chest_rules(self: @T, series_id: felt252) -> SeriesRules;
    fn series_chest_state(self: @T, series_id: felt252) -> SeriesState;
    fn game_chests(self: @T, game_id: u32) -> Option<GameChests>;
    fn ranking_trial(self: @T, game_id: u32) -> RankingTrial;
    fn player_rank(self: @T, game_id: u32, player: ContractAddress) -> Option<PlayerRank>;
    fn ranked_players(self: @T, game_id: u32, rank: u16) -> Span<ContractAddress>;
    fn allocate_game_chests(ref self: T, game_id: u32, actor: ContractAddress, context: ExecutionContext);
    fn rank_players(ref self: T, game_id: u32, actor: ContractAddress, command: RankPlayers, context: ExecutionContext);
    fn reset_ranking(ref self: T, game_id: u32, actor: ContractAddress, context: ExecutionContext);
}
#[starknet::interface]
pub trait IPrizeSeason<T> {
    fn checkpoint_prize_points(ref self: T, game_id: u32, timestamp: u64) -> bool;
    fn finalize_ranking(ref self: T, game_id: u32, trial_id: u128);
    fn prize_recipient(self: @T, player: ContractAddress) -> ContractAddress;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PrizeResult {
    pub trial_id: u128,
    pub index: u16,
    pub player: ContractAddress,
    pub owner: ContractAddress,
    pub rank: u16,
    pub chests: u16,
}
#[starknet::component]
pub mod BlitzPrizeState {
    use core::num::traits::Zero;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use crate::commands::ExecutionContext;
    use crate::entry::{ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait};
    use crate::events::{RowDeleted, RowSet};
    use crate::game::{GameRegistry, IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle::{DomainImpl, InternalTrait as LifeInternal};
    use crate::lifecycle::{IDomain, Lifecycle};
    use crate::ownership::{Story, StoryEvent};
    use crate::series_chests::{SeriesRules, SeriesState};
    use crate::settlement::{ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait};
    use super::{
        GameChests, IPrizeSeasonDispatcher, IPrizeSeasonDispatcherTrait, PlayerRank, PrizeResult, RankPlayers,
        RankingTrial,
    };
    #[storage]
    pub struct Storage {
        pub series_rules: Map<felt252, Option<SeriesRules>>,
        pub series_state: Map<felt252, SeriesState>,
        pub chests: Map<u32, Option<GameChests>>,
        pub trials: Map<u32, RankingTrial>,
        pub ranks: Map<(u32, ContractAddress), PlayerRank>,
        pub players: Map<(u32, u16), ContractAddress>,
        pub group_counts: Map<(u32, u16), u16>,
        pub award_cursor: Map<u32, u16>,
        pub award_remaining: Map<u32, u16>,
        pub resetting: Map<u32, bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
        StoryEvent: StoryEvent,
    }
    #[embeddable_as(BlitzPrizesImpl)]
    pub impl Commands<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IBlitzPrizes<ComponentState<TContractState>> {
        fn configure_series_chests(ref self: ComponentState<TContractState>, series_id: felt252, rules: SeriesRules) {
            get_dep_component!(@self, Life).assert_configurator();
            assert!(series_id != 0, "zero series id");
            assert!(self.series_rules.read(series_id).is_none(), "series already configured");
            crate::series_chests::validate_rules(rules);
            self.series_rules.write(series_id, Some(rules));
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'SeriesChestRules', keys: array![series_id].span(), values: values.span(),
                    },
                );
            self.write_series(series_id, crate::series_chests::initial_state(rules));
        }
        fn series_chest_rules(self: @ComponentState<TContractState>, series_id: felt252) -> SeriesRules {
            self.series_rules.read(series_id).expect('missing series chest rules')
        }
        fn series_chest_state(self: @ComponentState<TContractState>, series_id: felt252) -> SeriesState {
            self.series_chest_rules(series_id);
            self.series_state.read(series_id)
        }
        fn game_chests(self: @ComponentState<TContractState>, game_id: u32) -> Option<GameChests> {
            self.chests.read(game_id)
        }
        fn ranking_trial(self: @ComponentState<TContractState>, game_id: u32) -> RankingTrial {
            self.trials.read(game_id)
        }
        fn player_rank(
            self: @ComponentState<TContractState>, game_id: u32, player: ContractAddress,
        ) -> Option<PlayerRank> {
            let value = self.ranks.read((game_id, player));
            if value.rank == 0 {
                None
            } else {
                Some(value)
            }
        }
        fn ranked_players(self: @ComponentState<TContractState>, game_id: u32, rank: u16) -> Span<ContractAddress> {
            assert!(self.games().game(game_id).final_trial_id != 0, "rankings not finalized");
            let mut players = array![];
            for index in 0..self.trials.read(game_id).processed {
                let player = self.players.read((game_id, index));
                if self.ranks.read((game_id, player)).rank == rank {
                    players.append(player);
                }
            }
            players.span()
        }
        fn allocate_game_chests(
            ref self: ComponentState<TContractState>, game_id: u32, actor: ContractAddress, context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            assert!(game.dev_mode_on || context.timestamp >= game.start_main_at, "game not started");
            self.allocate_chests(game_id, game);
        }
        fn rank_players(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: RankPlayers,
            context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            self.require_admin(actor);
            self.require_ended(game, context.timestamp);
            assert!(game.final_trial_id == 0, "rankings already finalized");
            assert!(command.trial_id != 0 && command.trial_id != 1000, "invalid trial id");
            assert!(!self.resetting.read(game_id), "ranking reset incomplete");
            let mut trial = self.trials.read(game_id);
            if trial.trial_id != 0 && trial.processed == trial.committed {
                assert!(command.trial_id == trial.trial_id && command.players.is_empty(), "ranking already complete");
                self.finalize(game_id, game, trial, actor, context.timestamp);
                return;
            }
            assert!(!command.players.is_empty(), "players list is empty");
            if trial.trial_id == 0 {
                let registered = self.settlements().settlement_progress(game_id).registered;
                assert!(
                    command.committed > 0 && command.committed == registered, "roster does not match registrations",
                );
                if !self.season().checkpoint_prize_points(game_id, context.timestamp) {
                    return;
                }
                trial.trial_id = command.trial_id;
                trial.committed = command.committed;
            } else {
                assert!(trial.trial_id == command.trial_id, "different trial already active");
            }
            assert!(
                Into::<u16, u32>::into(trial.processed) + command.players.len() <= trial.committed.into(),
                "too many ranked players",
            );
            for player in command.players {
                self.rank_player(game_id, *player, ref trial);
            }
            if trial.processed == trial.committed {
                self.finalize(game_id, game, trial, actor, context.timestamp);
            }
            self.write_trial(game_id, trial);
        }
        fn reset_ranking(
            ref self: ComponentState<TContractState>, game_id: u32, actor: ContractAddress, context: ExecutionContext,
        ) {
            let game = self.authorize(game_id, context.timestamp);
            self.require_admin(actor);
            assert!(game.final_trial_id == 0, "finalized rankings are immutable");
            assert!(self.award_cursor.read(game_id) == 0, "prize distribution already started");
            self.resetting.write(game_id, true);
            let mut trial = self.trials.read(game_id);
            let start = trial.processed - core::cmp::min(trial.processed, 8);
            for index in start..trial.processed {
                let player = self.players.read((game_id, index));
                let rank = self.ranks.read((game_id, player)).rank;
                self.group_counts.write((game_id, rank), 0);
                self.ranks.write((game_id, player), PlayerRank { rank: 0, chests: 0, elite: false });
                self.players.write((game_id, index), 0.try_into().unwrap());
                self
                    .emit(
                        RowDeleted {
                            version: 1, model: 'PlayerRank', keys: array![game_id.into(), player.into()].span(),
                        },
                    );
            }
            if start != 0 {
                trial.processed = start;
                self.write_trial(game_id, trial);
                return;
            }
            self.resetting.write(game_id, false);
            self
                .trials
                .write(
                    game_id,
                    RankingTrial {
                        trial_id: 0, committed: 0, processed: 0, last_rank: 0, last_points: 0, total_points: 0,
                    },
                );
            self.emit(RowDeleted { version: 1, model: 'RankingTrial', keys: array![game_id.into()].span() });
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn games(self: @ComponentState<TContractState>) -> IGameDispatcher {
            IGameDispatcher { contract_address: get_dep_component!(self, Life).require_active().season }
        }
        fn season(self: @ComponentState<TContractState>) -> IPrizeSeasonDispatcher {
            IPrizeSeasonDispatcher { contract_address: get_dep_component!(self, Life).require_active().season }
        }
        fn settlements(self: @ComponentState<TContractState>) -> ISettlementViewsDispatcher {
            ISettlementViewsDispatcher { contract_address: get_dep_component!(self, Life).require_active().settlement }
        }
        fn uses_ledger(self: @ComponentState<TContractState>) -> bool {
            ILedgerOperatorDispatcher { contract_address: get_dep_component!(self, Life).require_active().registry }
                .ledger_operator()
                .is_non_zero()
        }
        fn authorize(self: @ComponentState<TContractState>, game_id: u32, timestamp: u64) -> GameRegistry {
            assert!(
                get_caller_address() == get_dep_component!(self, Life).require_active().season,
                "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert!(self.games().rules(game_id).blitz_mode_on, "requires Blitz");
            self.games().game(game_id)
        }
        fn require_admin(self: @ComponentState<TContractState>, actor: ContractAddress) {
            assert!(actor == get_dep_component!(self, Life).domain_state().authority, "only domain authority");
        }
        fn require_ended(self: @ComponentState<TContractState>, game: GameRegistry, timestamp: u64) {
            assert!(game.end_at != 0 && timestamp >= game.end_at, "game not ended");
        }
        fn allocate_chests(ref self: ComponentState<TContractState>, game_id: u32, game: GameRegistry) {
            if self.chests.read(game_id).is_some() {
                return;
            }
            let allocated = if game.series_id == 0 {
                0
            } else {
                let rules = self.series_chest_rules(game.series_id);
                let mut state = self.series_state.read(game.series_id);
                assert!(state.game_index + 1 == game.game_number_in_series.into(), "series games must settle in order");
                let count = self.settlements().settlement_progress(game_id).registered;
                let result = crate::series_chests::allocate(ref state, rules, count);
                self.write_series(game.series_id, state);
                result
            };
            self.write_chests(game_id, GameChests { allocated, distributed: 0 });
        }
        fn rank_player(
            ref self: ComponentState<TContractState>, game_id: u32, player: ContractAddress, ref trial: RankingTrial,
        ) {
            assert!(self.settlements().player_has_settled(game_id, player), "ranked player is not settled");
            assert!(self.ranks.read((game_id, player)).rank == 0, "player already ranked");
            let points = self.games().player_points(game_id, player);
            if trial.processed == 0 {
                trial.last_rank = 1;
            } else {
                assert!(trial.last_points >= points, "players not ordered by points");
                if trial.last_points > points {
                    trial.last_rank = trial.processed + 1;
                }
            }
            let group = (game_id, trial.last_rank);
            self.group_counts.write(group, self.group_counts.read(group) + 1);
            self.players.write((game_id, trial.processed), player);
            trial.processed += 1;
            trial.last_points = points;
            trial.total_points += points;
            self.write_rank(game_id, player, PlayerRank { rank: trial.last_rank, chests: 0, elite: false });
        }
        fn finalize(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            game: GameRegistry,
            trial: RankingTrial,
            actor: ContractAddress,
            timestamp: u64,
        ) {
            assert!(trial.total_points == self.games().season_points(game_id), "ranked points do not match game total");
            self.allocate_chests(game_id, game);
            let mut chests = self.chests.read(game_id).unwrap();
            let complete = self.award_batch(game_id, trial, ref chests, timestamp);
            self.write_chests(game_id, chests);
            if !complete {
                return;
            }
            self.season().finalize_ranking(game_id, trial.trial_id);
            self.story(game_id, actor, Story::PrizeDistributionFinal(trial.trial_id), timestamp);
        }
        fn award_batch(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            trial: RankingTrial,
            ref chests: GameChests,
            timestamp: u64,
        ) -> bool {
            let start = self.award_cursor.read(game_id);
            let end = start + core::cmp::min(8, trial.processed - start);
            let mut remaining = if start == 0 {
                chests.allocated
            } else {
                self.award_remaining.read(game_id)
            };
            for index in start..end {
                let player = self.players.read((game_id, index));
                let rank = self.ranks.read((game_id, player)).rank;
                let count = self.group_counts.read((game_id, rank));
                let reward = if index == rank - 1 {
                    crate::series_chests::tied_chests(
                        self.games().player_points(game_id, player),
                        trial.total_points,
                        chests.allocated,
                        count,
                        ref remaining,
                    )
                } else {
                    let first = self.players.read((game_id, rank - 1));
                    self.ranks.read((game_id, first)).chests
                };
                let elite = rank - 1 + count <= core::cmp::min(trial.committed / 2, 66);
                self.write_rank(game_id, player, PlayerRank { rank, chests: reward, elite });
                let owner = if self.uses_ledger() {
                    self.season().prize_recipient(player)
                } else {
                    player
                };
                self
                    .story(
                        game_id,
                        owner,
                        Story::PrizeResult(
                            PrizeResult { trial_id: trial.trial_id, index, player, owner, rank, chests: reward },
                        ),
                        timestamp,
                    );
                chests.distributed += reward;
            }
            self.award_remaining.write(game_id, remaining);
            self.award_cursor.write(game_id, end);
            end == trial.processed
        }
        fn story(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            story: Story,
            timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        owner: Some(actor),
                        entity_id: None,
                        tx_hash: get_tx_info().unbox().transaction_hash,
                        story,
                        timestamp,
                    },
                );
        }
        fn write_rank(
            ref self: ComponentState<TContractState>, game_id: u32, player: ContractAddress, rank: PlayerRank,
        ) {
            self.ranks.write((game_id, player), rank);
            let mut values = array![];
            rank.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerRank',
                        keys: array![game_id.into(), player.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn write_trial(ref self: ComponentState<TContractState>, game_id: u32, trial: RankingTrial) {
            self.trials.write(game_id, trial);
            let mut values = array![];
            trial.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'RankingTrial', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn write_chests(ref self: ComponentState<TContractState>, game_id: u32, chests: GameChests) {
            self.chests.write(game_id, Some(chests));
            let mut values = array![];
            chests.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'GameChestReward',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn write_series(ref self: ComponentState<TContractState>, series_id: felt252, state: SeriesState) {
            self.series_state.write(series_id, state);
            let mut values = array![];
            state.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'SeriesChestState', keys: array![series_id].span(), values: values.span(),
                    },
                );
        }
    }
}
