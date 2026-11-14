use starknet::storage::StoragePointerReadAccess;
use crate::banes::MIST_TIDE;
use crate::race::{IRaceDispatcherTrait, IRaceLibraryDispatcher, TriumphKey};
use crate::resources::ResourceKey;
use crate::stamina::StaminaTrait;
use crate::troops::{Coord, Stamina, StaminaRefill, TroopBoosts};

#[derive(Copy, Drop)]
struct Wind {
    start: u64,
    end: u64,
    rate_bps: u32,
}

pub fn refill(
    home: ResourceKey,
    coord: Coord,
    ref stamina: Stamina,
    ref boosts: TroopBoosts,
    maximum: u64,
    request: StaminaRefill,
) {
    let since: u64 = stamina.settled_at.into();
    if since == request.timestamp {
        return;
    }
    let unit = crate::logic::preset_record::for_game(home.game_id).rules.day_unit_seconds.read();
    if since == 0 || unit == 0 || crate::logic::expeditions::depth_at(home.game_id, coord) == 3 {
        settle(ref stamina, ref boosts, maximum, request, request.timestamp, 10000);
        return;
    }
    let effects = crate::logic::banes::effects(home, since, request.timestamp);
    let wind = second_wind(home, unit);
    for window in effects.windows {
        if *window.kind != MIST_TIDE {
            continue;
        }
        settle_with_wind(ref stamina, ref boosts, maximum, request, *window.start, 10000, wind);
        settle_with_wind(
            ref stamina, ref boosts, maximum, request, *window.end,
            Into::<u16, u32>::into(effects.stamina_percent) * 100, wind,
        );
    }
    settle_with_wind(ref stamina, ref boosts, maximum, request, request.timestamp, 10000, wind);
}

fn second_wind(home: ResourceKey, unit: u32) -> Option<Wind> {
    let race = IRaceLibraryDispatcher {
        class_hash: crate::logic::release::classes(home.game_id).economy.read(),
    };
    let rules = race.race_rules(home.game_id)?;
    let aspect = crate::logic::aspects::home_aspect(home);
    let index = race.triumph_day(TriumphKey { game_id: home.game_id, aspect, stage: crate::race::SECOND_WIND_STAGE })?;
    let game = crate::logic::game::game(home.game_id);
    let planned = crate::game::GameRegistry { end_at: game.scheduled_end_at, ..game };
    let day = crate::days::day_at_index(planned, unit, index);
    let end = core::cmp::min(day.end, game.end_at);
    if day.start >= end {
        return None;
    }
    Some(Wind { start: day.start, end, rate_bps: Into::<u16, u32>::into(rules.second_wind_percent) * 100 })
}

fn settle_with_wind(
    ref stamina: Stamina,
    ref boosts: TroopBoosts,
    maximum: u64,
    request: StaminaRefill,
    until: u64,
    rate_bps: u32,
    wind: Option<Wind>,
) {
    let since: u64 = stamina.settled_at.into();
    if since >= until {
        return;
    }
    if let Some(wind) = wind {
        let start = core::cmp::max(since, wind.start);
        let end = core::cmp::min(until, wind.end);
        if start < end {
            settle(ref stamina, ref boosts, maximum, request, start, rate_bps);
            settle(ref stamina, ref boosts, maximum, request, end, rate_bps * wind.rate_bps / 10000);
        }
    }
    settle(ref stamina, ref boosts, maximum, request, until, rate_bps);
}

fn settle(
    ref stamina: Stamina,
    ref boosts: TroopBoosts,
    maximum: u64,
    request: StaminaRefill,
    until: u64,
    rate_bps: u32,
) {
    stamina.refill_to_max(
        ref boosts, maximum, request.stamina_config, request.armies_tick_in_seconds, until, rate_bps,
    );
}
