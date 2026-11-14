use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};

pub fn prepare(game_id: u32, context: crate::commands::ActionContext) {
    let context = crate::commands::execution_context(game_id, context);
    let timestamp = context.timestamp;
    let Some((step, _, _, _, _)) = crate::logic::preset_record::for_game(game_id).bane_rules.read() else {
        return;
    };
    let game = context.game.unbox();
    if timestamp < game.start_main_at {
        return;
    }
    let unit = context.rules.unbox().day_unit_seconds;
    let state = crate::state::write();
    let mut cursor = core::cmp::max(state.banes.next_roll_at.read(game_id), game.start_main_at);
    let mut chance = state.banes.next_chance.read(game_id);
    while cursor <= timestamp && cursor < game.end_at {
        let day = crate::days::day_of(game, unit, cursor);
        let kind = if world_stopped(game_id, day.index) { 0 } else { draw(game_id, day.index, context.raw_root, chance) };
        state.banes.world_days.write((game_id, day.index), Some(kind));
        crate::logic::banes::emit(
            'WorldBane', array![game_id.into(), day.index.into()].span(), array![kind.into()].span(),
        );
        chance = if kind == 0 { core::cmp::min(100, chance + step) } else { 0 };
        cursor = day.end;
    }
    state.banes.next_roll_at.write(game_id, cursor);
    state.banes.next_chance.write(game_id, chance);
}

pub fn kind(game_id: u32, day: u64) -> Option<u8> {
    if crate::logic::preset_record::for_game(game_id).bane_rules.read().is_none() || world_stopped(game_id, day) {
        return None;
    }
    let kind = crate::state::read().banes.world_days.read((game_id, day)).expect('world day is not prepared');
    if kind == 0 { None } else { Some(kind) }
}

pub fn draw(game_id: u32, day: u64, raw_root: u256, chance: u16) -> u8 {
    assert!(chance <= 100, "invalid world bane chance");
    if chance == 0 { return 0; }
    let seed: u256 = core::poseidon::poseidon_hash_span(
        array![raw_root.low.into(), raw_root.high.into(), game_id.into(), day.into(), 'world-bane-day'].span(),
    ).into();
    if crate::random::range(seed, 0, 100) >= chance.into() { return 0; }
    let kind: u8 = crate::random::range(seed, 1, 3).try_into().unwrap();
    kind + crate::banes::BLOOD_MOON
}

fn world_stopped(game_id: u32, day: u64) -> bool {
    match crate::state::read().banes.first_team_day.read(game_id) {
        Some(issued_day) => day > issued_day,
        None => false,
    }
}
