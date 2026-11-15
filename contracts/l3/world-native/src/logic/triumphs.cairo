use starknet::storage::StoragePointerReadAccess;
use crate::race::{IRaceDispatcherTrait, IRaceLibraryDispatcher, TriumphKey};
use crate::resources::ResourceKey;

#[derive(Copy, Drop)]
pub struct Period {
    pub start: u64,
    pub end: u64,
}

pub fn period(home: ResourceKey, stage: u8) -> Option<Period> {
    let unit = crate::logic::preset_record::for_game(home.game_id).rules.day_unit_seconds.read();
    if unit == 0 {
        return None;
    }
    let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(home.game_id).economy.read() };
    let aspect = crate::logic::aspects::home_aspect(home);
    let index = race.triumph_day(TriumphKey { game_id: home.game_id, aspect, stage })?;
    let game = crate::logic::game::game(home.game_id);
    let planned = crate::game::GameRegistry { end_at: game.scheduled_end_at, ..game };
    let day = crate::days::day_at_index(planned, unit, index);
    let end = core::cmp::min(day.end, game.end_at);
    if day.start >= end {
        return None;
    }
    Some(Period { start: day.start, end })
}

pub fn clear_mist(home: ResourceKey, timestamp: u64) -> u16 {
    let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(home.game_id).economy.read() };
    let Some(rules) = race.race_rules(home.game_id) else {
        return 100;
    };
    let Some(period) = period(home, crate::race::CLEAR_MIST_STAGE) else {
        return 100;
    };
    if timestamp >= period.start && timestamp < period.end {
        rules.clear_mist_percent
    } else {
        100
    }
}
