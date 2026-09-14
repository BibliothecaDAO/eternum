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
    pub status: GameStatus,
    pub dev_mode_on: bool,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
    // Reserved for the deployed model layout; point registration no longer uses a grace period.
    pub registration_grace_seconds: u32,
    pub final_trial_id: u128,
    pub seed: felt252,
}

#[starknet::interface]
pub trait IGame<T> {
    fn game(self: @T, game_id: u32) -> GameRegistry;
    fn rules(self: @T, game_id: u32) -> SliceRules;
    fn create_game(ref self: T, game_id: u32, game: GameRegistry, rules: SliceRules);
    fn allocate_entity(ref self: T, game_id: u32) -> u32;
    fn register_exploration(ref self: T, game_id: u32, actor: ContractAddress);
    fn player_points(self: @T, game_id: u32, actor: ContractAddress) -> u128;
    fn season_points(self: @T, game_id: u32) -> u128;
}

pub fn assert_playing(game: GameRegistry, now: u64) {
    assert!(game.dev_mode_on || (now >= game.start_main_at && now >= game.start_settling_at), "game not started");
    assert!(game.end_at == 0 || now < game.end_at, "game ended");
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
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn register_exploration(
            ref self: ComponentState<TContractState>, game_id: u32, actor: starknet::ContractAddress,
        ) {
            let amount: u128 = self.rules(game_id).victory_points_grant_config.explore_tiles_points.into();
            if amount == 0 {
                return;
            }
            let points = self.player_points.read((game_id, actor)) + amount;
            let total = self.season_points.read(game_id) + amount;
            self.player_points.write((game_id, actor), points);
            self.season_points.write(game_id, total);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'PlayerRegisteredPoints',
                        keys: array![game_id.into(), actor.into()].span(),
                        values: array![points.into()].span(),
                    },
                );
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SeasonPrize',
                        keys: array![game_id.into()].span(),
                        values: array![total.into(), 0, 0].span(),
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
            assert!(
                rules.map_config.relic_discovery_interval_sec == 0 && rules.map_config.agent_discovery_prob == 0,
                "unsupported discovery rules",
            );
            self.games.write(game_id, game);
            self.rules.write(game_id, rules);
            self.exists.write(game_id, true);
            self.next_entity.write(game_id, 1);
            let mut values = array![];
            game.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'GameRegistry', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
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
