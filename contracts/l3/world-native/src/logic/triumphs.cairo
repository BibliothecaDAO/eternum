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

pub fn effects(home: ResourceKey, timestamp: u64) -> crate::race::ExpeditionEffects {
    IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(home.game_id).economy.read() }
        .expedition_effects(home, timestamp)
}

pub fn read_effects(home: ResourceKey, timestamp: u64) -> crate::race::ExpeditionEffects {
    let mut effects = crate::race::ExpeditionEffects { find_percent: 100, beast_bps: 10000, spoils_percent: 100 };
    if let Some(rules) = crate::logic::race::rules(home.game_id) {
        effects.find_percent = active_percent(home, crate::race::CLEAR_MIST_STAGE, rules.clear_mist_percent, timestamp);
        effects.beast_bps = Into::<u16, u32>::into(active_percent(home, crate::race::PALE_MOON_STAGE, rules.pale_moon_percent, timestamp)) * 100;
        effects.spoils_percent = active_percent(home, crate::race::SPOILS_STAGE, rules.spoils_percent, timestamp);
    }
    let bane = crate::logic::banes::effects(home, timestamp, timestamp + 1);
    for window in bane.windows {
        if *window.kind == crate::banes::BLOOD_MOON {
            effects.beast_bps = effects.beast_bps * Into::<u16, u32>::into(bane.beast_percent) / 100;
        }
    }
    effects
}

fn active_percent(home: ResourceKey, stage: u8, percent: u16, timestamp: u64) -> u16 {
    let Some(period) = period(home, stage) else { return 100; };
    if timestamp >= period.start && timestamp < period.end { percent } else { 100 }
}
