use starknet::Event as EventTrait;
use starknet::storage::{
    StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
};
use crate::events::RowSet;
use crate::game::GameRegistry;
use crate::rules::SliceRules;

#[derive(Drop, starknet::Event)]
pub enum Event {
    RowSet: RowSet,
}

pub fn game(game_id: u32) -> GameRegistry {
    let state = crate::state::read();
    let game = state.games.games.read(game_id);
    assert!(game.creator != 0.try_into().unwrap(), "game does not exist");
    game
}
pub fn rules(game_id: u32) -> SliceRules {
    let state = crate::state::read();
    let _ = game(game_id);
    state.games.rules.read(game_id)
}
pub fn create(game_id: u32, game: GameRegistry, rules: SliceRules) {
    let state = crate::state::write();
    assert!(game_id != 0 && !game_exists(game_id), "game already exists or reserved");
    assert!(game.creator != 0.try_into().unwrap() && game.preset_id != 0, "invalid game identity");
    assert!(game.start_main_at >= game.start_settling_at && game.end_at > game.start_main_at, "invalid game times");
    assert!(rules.tick_config.armies_tick_in_seconds != 0, "zero army tick");
    if rules.bitcoin_mine_config.enabled {
        assert!(rules.tick_config.bitcoin_phase_in_seconds != 0, "zero Bitcoin phase duration");
        assert!(rules.bitcoin_mine_config.prize_per_phase != 0, "zero Bitcoin prize");
    }
    assert!(rules.bitcoin_mine_config.owner_cut_bps <= 10000, "invalid Bitcoin owner cut");
    state.games.rules.write(game_id, rules);
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
    emit_game(game_id, game);
}
fn emit_game(game_id: u32, game: GameRegistry) {
    let mut values = array![];
    game.serialize(ref values);
    emit_game_fact(
        RowSet { version: 1, model: 'GameRegistry', keys: array![game_id.into()].span(), values: values.span() },
    );
}
pub fn allocate_entity(game_id: u32) -> u32 {
    let state = crate::state::write();
    let id = state.games.next_entity.read(game_id);
    assert!(id != 0, "game does not exist");
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
    crate::state::read().games.games.entry(game_id).creator.read() != 0.try_into().unwrap()
}

pub fn start_blitz(game_id: u32, context: crate::commands::ExecutionContext) {
    assert!(context.rules.unbox().entry_rule == crate::rules::ENTRY_ROSTER, "fixed roster required");
    let mut game = game(game_id);
    assert!(!game.ready, "roster already ready");
    let duration = game.end_at - game.start_main_at;
    game.start_main_at = core::cmp::max(game.start_main_at, context.timestamp);
    game.end_at = game.start_main_at + duration;
    game.ready = true;
    let stored = crate::state::write().games.games.entry(game_id);
    stored.start_main_at.write(game.start_main_at);
    stored.end_at.write(game.end_at);
    stored.ready.write(game.ready);
    emit_game(game_id, game);
}

/// The preset id is immutable; every game keeps the definition it launched with.
pub fn preset_commitment(game_id: u32) -> felt252 {
    let commitment = crate::state::read().registrar.presets.read(game(game_id).preset_id);
    assert!(commitment != 0, "game has no preset");
    commitment
}

pub fn emit_release(game_id: u32, release_id: u32, preset_commitment: felt252) {
    emit_game_fact(
        RowSet {
            version: 1,
            model: 'GameRelease',
            keys: array![game_id.into()].span(),
            values: array![release_id.into(), preset_commitment].span(),
        },
    );
}
