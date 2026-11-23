use crate::race::{IRaceDispatcherTrait, IRaceLibraryDispatcher, TriumphKey};
use crate::resources::ResourceKey;

#[derive(Copy, Drop)]
pub struct Period {
    pub start: u64,
    pub end: u64,
}

pub fn period(home: ResourceKey, stage: u8) -> Option<Period> {
    if !crate::rules::DAYS_IN_PLAY {
        return None;
    }
    let race = IRaceLibraryDispatcher {
        class_hash: crate::logic::release::class_of(home.game_id, crate::slots::ECONOMY),
    };
    let aspect = crate::logic::aspects::home_aspect(home);
    let index = race.triumph_day(TriumphKey { game_id: home.game_id, aspect, stage })?;
    let game = crate::logic::game::game(home.game_id);
    let planned = crate::game::GameRegistry { end_at: game.scheduled_end_at, ..game };
    let day = crate::days::day_at_index(planned, crate::clock::day_unit_seconds(planned), index);
    let end = core::cmp::min(day.end, game.end_at);
    if day.start >= end {
        return None;
    }
    Some(Period { start: day.start, end })
}

pub fn effects(home: ResourceKey, timestamp: u64) -> crate::race::ExpeditionEffects {
    IRaceLibraryDispatcher { class_hash: crate::logic::release::class_of(home.game_id, crate::slots::ECONOMY) }
        .expedition_effects(home, timestamp)
}

#[cfg(feature: "blitz")]
pub fn read_effects(_home: ResourceKey, _timestamp: u64) -> crate::race::ExpeditionEffects {
    crate::race::ExpeditionEffects { find_percent: 100, beast_bps: 10000, spoils_percent: 100 }
}

#[cfg(not(feature: "blitz"))]
pub fn read_effects(home: ResourceKey, timestamp: u64) -> crate::race::ExpeditionEffects {
    let rules = crate::logic::race::rules();
    let mut effects = crate::race::ExpeditionEffects {
        find_percent: active_percent(home, crate::race::CLEAR_MIST_STAGE, rules.clear_mist_percent, timestamp),
        beast_bps: Into::<
            u16, u32,
        >::into(active_percent(home, crate::race::PALE_MOON_STAGE, rules.pale_moon_percent, timestamp))
            * 100,
        spoils_percent: active_percent(home, crate::race::SPOILS_STAGE, rules.spoils_percent, timestamp),
    };
    let bane = crate::logic::banes::effects(home, timestamp, timestamp + 1);
    for window in bane.windows {
        if *window.kind == crate::banes::BLOOD_MOON {
            effects.beast_bps = effects.beast_bps * Into::<u16, u32>::into(bane.beast_percent) / 100;
        }
    }
    effects
}

fn active_percent(home: ResourceKey, stage: u8, percent: u16, timestamp: u64) -> u16 {
    let Some(period) = period(home, stage) else {
        return 100;
    };
    if timestamp >= period.start && timestamp < period.end {
        percent
    } else {
        100
    }
}

pub fn site_beast_bps(key: ResourceKey, home: u64, timestamp: u64) -> u32 {
    let Some(site) = crate::logic::expeditions::expedition_site(key) else {
        return 10000;
    };
    let coord = crate::troops::Coord { alt: site.alt, x: site.col, y: site.row };
    if crate::logic::expeditions::depth_at(key.game_id, coord) == 3 {
        return 10000;
    }
    let home = ResourceKey { game_id: key.game_id, entity_id: home };
    read_effects(home, timestamp).beast_bps
}
