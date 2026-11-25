use starknet::storage::StorageMapReadAccess;
#[cfg(not(feature: "blitz"))]
use starknet::storage::StorageMapWriteAccess;

pub fn prepare(game_id: u32, context: crate::commands::ActionContext) {
    let context = crate::commands::execution_context(game_id, context);
    prepare_at(
        game_id,
        context.game.unbox(),
        crate::clock::day_unit_seconds(context.game.unbox()),
        context.timestamp,
        context.raw_root,
    );
}

pub fn initialize(game_id: u32) {
    let game = crate::logic::game::game(game_id);
    let unit = crate::clock::day_unit_seconds(game);
    prepare_at(game_id, game, unit, game.start_main_at, 0);
}

#[cfg(feature: "blitz")]
fn prepare_at(_game_id: u32, _game: crate::game::GameRegistry, _unit: u32, _timestamp: u64, _raw_root: u256) {}

#[cfg(not(feature: "blitz"))]
fn prepare_at(game_id: u32, game: crate::game::GameRegistry, unit: u32, timestamp: u64, raw_root: u256) {
    if timestamp < game.start_main_at {
        return;
    }
    let state = crate::state::write();
    let mut cursor = core::cmp::max(state.banes.next_roll_at.read(game_id), game.start_main_at);
    let mut chance = state.banes.next_chance.read(game_id);
    while cursor <= timestamp && cursor < game.end_at {
        let day = crate::days::day_of(game, unit, cursor);
        let kind = if day.index < crate::balance::banes::QUIET_DAYS || world_stopped(game_id, day.index) {
            0
        } else {
            draw(game_id, day.index, raw_root, chance)
        };
        state.banes.world_days.write((game_id, day.index), Some(kind));
        crate::logic::banes::emit(
            'WorldBane', array![game_id.into(), day.index.into()].span(), array![kind.into()].span(),
        );
        chance = if kind == 0 {
            core::cmp::min(100, chance + crate::balance::banes::CHANCE_STEP_PERCENT)
        } else {
            0
        };
        cursor = day.end;
    }
    state.banes.next_roll_at.write(game_id, cursor);
    state.banes.next_chance.write(game_id, chance);
}

#[cfg(feature: "blitz")]
pub fn kind(_game_id: u32, _day: u64) -> Option<u8> {
    None
}

#[cfg(not(feature: "blitz"))]
pub fn kind(game_id: u32, day: u64) -> Option<u8> {
    if world_stopped(game_id, day) {
        return None;
    }
    let kind = crate::state::read().banes.world_days.read((game_id, day)).expect('world day is not prepared');
    if kind == 0 {
        None
    } else {
        Some(kind)
    }
}

pub fn draw(game_id: u32, day: u64, raw_root: u256, chance: u16) -> u8 {
    assert!(chance <= 100, "invalid world bane chance");
    if chance == 0 {
        return 0;
    }
    let seed: u256 = core::poseidon::poseidon_hash_span(
        array![raw_root.low.into(), raw_root.high.into(), game_id.into(), day.into(), 'world-bane-day'].span(),
    )
        .into();
    if crate::random::range(seed, 0, 100) >= chance.into() {
        return 0;
    }
    let kind: u8 = crate::random::range(seed, 1, 3).try_into().unwrap();
    kind + crate::banes::BLOOD_MOON
}

fn world_stopped(game_id: u32, day: u64) -> bool {
    match crate::state::read().banes.first_team_day.read(game_id) {
        Some(issued_day) => day > issued_day,
        None => false,
    }
}
