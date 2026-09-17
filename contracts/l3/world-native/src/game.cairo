use starknet::ContractAddress;
use crate::rules::SliceRules;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub enum GameStatus {
    #[default]
    Created,
    Registration,
    Live,
    Ended,
    Settled,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct GameRegistry {
    pub name: felt252,
    pub series_id: felt252,
    pub game_number_in_series: u16,
    pub preset_id: u32,
    pub creator: ContractAddress,
    pub settled: bool,
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    pub final_trial_id: u128,
    pub seed: felt252,
}

#[derive(Copy, Drop, Serde)]
pub enum PointActivity {
    Exploration,
    RelicChest,
    HyperstructureCapture,
    StructureCapture,
    Hyperstructure,
}

#[derive(Drop, starknet::Event)]
pub struct PointsAwarded {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub player: ContractAddress,
    pub activity: PointActivity,
    pub points: u128,
}

#[starknet::interface]
pub trait IGame<T> {
    fn agent_controller(self: @T) -> ContractAddress;
    fn ownership_rules_ready(self: @T, game_id: u32) -> bool;
    fn game(self: @T, game_id: u32) -> GameRegistry;
    fn rules(self: @T, game_id: u32) -> SliceRules;
    fn create_game(ref self: T, game_id: u32, game: GameRegistry, rules: SliceRules);
    fn allocate_entity(ref self: T, game_id: u32) -> u32;
    fn register_exploration(ref self: T, game_id: u32, actor: ContractAddress);
    fn register_capture(ref self: T, game_id: u32, actor: ContractAddress, category: u8) -> u128;
    fn register_relic_points(ref self: T, game_id: u32, actor: ContractAddress);
    fn register_hyperstructure_points(ref self: T, game_id: u32, actor: ContractAddress, amount: u128);
    fn player_points(self: @T, game_id: u32, actor: ContractAddress) -> u128;
    fn season_points(self: @T, game_id: u32) -> u128;
}

#[starknet::interface]
pub trait ISeasonLifecycle<T> {
    fn configure_season_win(ref self: T, game_id: u32, points: u128);
    fn season_win_threshold(self: @T, game_id: u32) -> u128;
    fn close_season(ref self: T, game_id: u32, actor: ContractAddress, context: crate::commands::ExecutionContext);
}

pub fn status_at(game: GameRegistry, timestamp: u64) -> GameStatus {
    if game.settled {
        GameStatus::Settled
    } else if game.end_at != 0 && timestamp >= game.end_at {
        GameStatus::Ended
    } else if game.dev_mode_on || timestamp >= game.start_main_at {
        GameStatus::Live
    } else {
        GameStatus::Registration
    }
}

pub fn assert_playing(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert!(game.end_at == 0 || now < game.end_at, "game ended");
}

pub fn assert_main_with_grace(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert_grace_end(game, now);
}

pub fn assert_settling_with_grace(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || now >= game.start_settling_at, "settling not started");
    assert_grace_end(game, now);
}

fn assert_grace_end(game: GameRegistry, now: u64) {
    if game.end_at != 0 && now >= game.end_at {
        assert!(now <= game.end_at + game.end_grace_seconds.into(), "game grace period ended");
    }
}

#[starknet::component]
pub mod GameState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{GameRegistry, SliceRules};
    #[storage]
    pub struct Storage {
        pub games: Map<u32, GameRegistry>,
        pub rules: Map<u32, SliceRules>,
        pub exists: Map<u32, bool>,
        pub next_entity: Map<u32, u32>,
        pub player_points: Map<(u32, starknet::ContractAddress), u128>,
        pub season_points: Map<u32, u128>,
        pub ownership_rules_ready: Map<u32, bool>,
        pub win_thresholds: Map<u32, Option<u128>>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        PointsAwarded: super::PointsAwarded,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn register_exploration(
            ref self: ComponentState<TContractState>, game_id: u32, actor: starknet::ContractAddress,
        ) {
            let amount: u128 = self.rules(game_id).victory_points_grant_config.explore_tiles_points.into();
            self.register_points(game_id, actor, amount, super::PointActivity::Exploration);
        }
        fn register_points(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: starknet::ContractAddress,
            amount: u128,
            activity: super::PointActivity,
        ) {
            if amount == 0 {
                return;
            }
            self.emit(super::PointsAwarded { version: 1, game_id, player: actor, activity, points: amount });
            let points = self.player_points.read((game_id, actor)) + amount;
            let total = self.season_points.read(game_id) + amount;
            self.player_points.write((game_id, actor), points);
            self.season_points.write(game_id, total);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerPoints',
                        keys: array![game_id.into(), actor.into()].span(),
                        values: array![points.into()].span(),
                    },
                );
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PointsTotal',
                        keys: array![game_id.into()].span(),
                        values: array![total.into()].span(),
                    },
                );
        }
        fn game(self: @ComponentState<TContractState>, game_id: u32) -> GameRegistry {
            assert!(self.exists.read(game_id), "game does not exist");
            self.games.read(game_id)
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> SliceRules {
            let _ = self.game(game_id);
            self.rules.read(game_id)
        }
        fn create(ref self: ComponentState<TContractState>, game_id: u32, game: GameRegistry, rules: SliceRules) {
            assert!(game_id != 0 && !self.exists.read(game_id), "game already exists or reserved");
            assert!(game.creator != 0.try_into().unwrap() && game.preset_id != 0, "invalid game identity");
            assert!(
                game.start_main_at >= game.start_settling_at && game.end_at > game.start_main_at, "invalid game times",
            );
            assert!(rules.tick_config.armies_tick_in_seconds != 0, "zero army tick");
            if rules.bitcoin_mine_config.enabled {
                assert!(rules.tick_config.bitcoin_phase_in_seconds != 0, "zero Bitcoin phase duration");
                assert!(rules.bitcoin_mine_config.prize_per_phase != 0, "zero Bitcoin prize");
            }
            assert!(rules.bitcoin_mine_config.owner_cut_bps <= 10000, "invalid Bitcoin owner cut");
            self.rules.write(game_id, rules);
            self.ownership_rules_ready.write(game_id, true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'OwnershipRulesReady',
                        keys: array![game_id.into()].span(),
                        values: array![1].span(),
                    },
                );
            self.exists.write(game_id, true);
            self.next_entity.write(game_id, 1);
            self.write_game(game_id, game);
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'SliceRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
            self.emit_counter(game_id, 1);
        }
        fn write_game(ref self: ComponentState<TContractState>, game_id: u32, game: GameRegistry) {
            self.games.write(game_id, game);
            let mut values = array![];
            game.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'GameRegistry', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn allocate(ref self: ComponentState<TContractState>, game_id: u32) -> u32 {
            let _ = self.game(game_id);
            let id = self.next_entity.read(game_id);
            self.next_entity.write(game_id, id + 1);
            self.emit_counter(game_id, id + 1);
            id
        }
        fn emit_counter(ref self: ComponentState<TContractState>, game_id: u32, next: u32) {
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'EntitySequence',
                        keys: array![game_id.into()].span(),
                        values: array![next.into()].span(),
                    },
                );
        }
    }
}
