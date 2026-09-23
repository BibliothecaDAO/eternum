use starknet::Event as EventTrait;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::events::RowSet;
use crate::game::GameRegistry;
use crate::rules::SliceRules;

#[derive(Drop, starknet::Event)]
pub enum Event {
    RowSet: RowSet,
}

pub fn game(game_id: u32) -> GameRegistry {
    let state = crate::state::read();
    assert!(state.games.ownership_rules_ready.read(game_id), "game does not exist");
    state.games.games.read(game_id)
}
pub fn rules(game_id: u32) -> SliceRules {
    let state = crate::state::read();
    let _ = game(game_id);
    state.games.rules.read(game_id)
}
pub fn create(game_id: u32, game: GameRegistry, rules: SliceRules) {
    let state = crate::state::write();
    assert!(game_id != 0 && !state.games.ownership_rules_ready.read(game_id), "game already exists or reserved");
    assert!(game.creator != 0.try_into().unwrap() && game.preset_id != 0, "invalid game identity");
    assert!(game.start_main_at >= game.start_settling_at && game.end_at > game.start_main_at, "invalid game times");
    assert!(rules.tick_config.armies_tick_in_seconds != 0, "zero army tick");
    if rules.bitcoin_mine_config.enabled {
        assert!(rules.tick_config.bitcoin_phase_in_seconds != 0, "zero Bitcoin phase duration");
        assert!(rules.bitcoin_mine_config.prize_per_phase != 0, "zero Bitcoin prize");
    }
    assert!(rules.bitcoin_mine_config.owner_cut_bps <= 10000, "invalid Bitcoin owner cut");
    state.games.rules.write(game_id, rules);
    state.games.ownership_rules_ready.write(game_id, true);
    emit_game_fact(
        RowSet {
            version: 1, model: 'OwnershipRulesReady', keys: array![game_id.into()].span(), values: array![1].span(),
        },
    );
    state.games.next_entity.write(game_id, 1);
    write_game(game_id, game);
    let mut values = array![];
    rules.serialize(ref values);
    emit_game_fact(
        RowSet { version: 1, model: 'SliceRules', keys: array![game_id.into()].span(), values: values.span() },
    );
    emit_counter(game_id, 1);
}
pub fn write_game(game_id: u32, game: GameRegistry) {
    let state = crate::state::write();
    state.games.games.write(game_id, game);
    let mut values = array![];
    game.serialize(ref values);
    emit_game_fact(
        RowSet { version: 1, model: 'GameRegistry', keys: array![game_id.into()].span(), values: values.span() },
    );
}
pub fn allocate_entity(game_id: u32) -> u32 {
    let state = crate::state::write();
    let _ = game(game_id);
    let id = state.games.next_entity.read(game_id);
    state.games.next_entity.write(game_id, id + 1);
    emit_counter(game_id, id + 1);
    id
}
fn emit_counter(game_id: u32, next: u32) {
    emit_game_fact(
        RowSet {
            version: 1,
            model: 'EntitySequence',
            keys: array![game_id.into()].span(),
            values: array![next.into()].span(),
        },
    );
}

fn emit_game_fact(row: RowSet) {
    let event = crate::logic::registry::RegistryLogic::Event::GameEvent(Event::RowSet(row));
    let mut keys = array![];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

pub fn game_exists(game_id: u32) -> bool {
    crate::state::read().games.ownership_rules_ready.read(game_id)
}

pub fn start_blitz(game_id: u32, timestamp: u64) {
    assert!(rules(game_id).entry_rule == crate::rules::ENTRY_ROSTER, "fixed roster required");
    let mut game = game(game_id);
    assert!(!game.ready, "roster already ready");
    let duration = game.end_at - game.start_main_at;
    game.start_main_at = core::cmp::max(game.start_main_at, timestamp);
    game.end_at = game.start_main_at + duration;
    game.ready = true;
    write_game(game_id, game);
}

pub fn rules_commitment(rules: crate::rules::SliceRules) -> felt252 {
    let mut values = array!['ETERNUM_RULES', 1];
    rules.serialize(ref values);
    core::poseidon::poseidon_hash_span(values.span())
}
