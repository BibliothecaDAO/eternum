use starknet::Event as EventTrait;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::events::RowSet;
use crate::game::{GameOverrides, GameRegistry};
use crate::rules::SliceRules;

#[derive(Drop, starknet::Event)]
pub enum Event {
    RowSet: RowSet,
}

#[inline(never)]
pub fn game(game_id: u32) -> GameRegistry {
    let state = crate::state::read();
    let game = state.games.games.read(game_id);
    assert!(game.family != 0, "game does not exist");
    game
}
pub fn rules(game_id: u32) -> SliceRules {
    rules_of(game_id, game(game_id))
}
pub fn rules_of(game_id: u32, game: GameRegistry) -> SliceRules {
    let switches = crate::balance::rules::SWITCHES;
    let overrides = crate::state::read().games.overrides.read(game_id);
    SliceRules {
        battle_config: crate::balance::rules::BATTLE_CONFIG,
        map_config: overrides.map.unwrap_or(crate::balance::rules::MAP_CONFIG),
        biome_climate_config: overrides.biome_climate,
        tick_config: crate::clock::tick_config(game),
        troop_damage_config: crate::balance::rules::TROOP_DAMAGE_CONFIG,
        troop_stamina_config: crate::balance::rules::TROOP_STAMINA_CONFIG,
        troop_limit_config: crate::balance::rules::TROOP_LIMIT_CONFIG,
        capacity_config: crate::balance::rules::CAPACITY_CONFIG,
        structure_capacity_config: crate::balance::rules::STRUCTURE_CAPACITY_CONFIG,
        building_config: crate::balance::rules::BUILDING_CONFIG,
        map_center_offset: overrides.map_center_offset,
        spire_travel_essence_cost: crate::balance::rules::SPIRE_TRAVEL_ESSENCE_COST,
        command_mask: switches.command_mask,
        mode_rules: switches.mode_rules,
        day_unit_seconds: crate::clock::day_unit_seconds(game),
        entry_rule: switches.entry_rule,
        speed_config: crate::balance::rules::SPEED_CONFIG,
        relic_seconds_per_rank: crate::clock::relic_seconds_per_rank(game),
    }
}
pub fn create(game_id: u32, game: GameRegistry, overrides: GameOverrides) {
    let state = crate::state::write();
    assert!(game_id != 0 && !game_exists(game_id), "game already exists or reserved");
    assert!(game.family != 0, "invalid game identity");
    assert!(game.start_main_at >= game.start_settling_at && game.end_at > game.start_main_at, "invalid game times");
    state.games.overrides.write(game_id, overrides);
    state.games.next_entity.write(game_id, 1);
    write_game(game_id, game);
    let mut values = array![];
    overrides.serialize(ref values);
    emit_game_fact(
        RowSet { version: 1, model: 'GameOverrides', keys: array![game_id.into()].span(), values: values.span() },
    );
}
pub fn write_game(game_id: u32, game: GameRegistry) {
    assert!(game.end_at <= game.scheduled_end_at, "season end exceeds its calendar");
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
pub fn allocate_setup_entity(game_id: u32) -> u32 {
    let state = crate::state::write();
    let id = state.games.next_entity.read(game_id);
    assert!(id != 0, "game does not exist");
    assert!(id < 0xfffffff9, "setup entity space exhausted");
    state.games.next_entity.write(game_id, id + 1);
    id
}

fn emit_game_fact(row: RowSet) {
    let event = crate::logic::registry::RegistryLogic::Event::GameEvent(Event::RowSet(row));
    let mut keys = array![];
    let mut data = array![];
    event.append_keys_and_data(ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

pub fn game_exists(game_id: u32) -> bool {
    crate::state::read().games.games.entry(game_id).family.read() != 0
}

pub fn emit_release(game_id: u32, release_id: u32) {
    // Zero identifies games created before creation releases were recorded.
    let created_release_id = crate::state::read().game_creation_releases.read(game_id);
    emit_game_fact(
        RowSet {
            version: 1,
            model: 'GameRelease',
            keys: array![game_id.into()].span(),
            values: array![release_id.into(), created_release_id.into()].span(),
        },
    );
}
