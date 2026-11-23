use crate::banes::MIST_TIDE;
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
    rate_bps: u32,
    request: StaminaRefill,
) {
    let since: u64 = stamina.settled_at.into();
    if since == request.timestamp {
        return;
    }
    if since == 0 || !crate::rules::DAYS_IN_PLAY || crate::logic::expeditions::depth_at(home.game_id, coord) == 3 {
        settle(ref stamina, ref boosts, maximum, request, request.timestamp, rate_bps);
        return;
    }
    let effects = crate::logic::banes::effects(home, since, request.timestamp);
    let wind = second_wind(home);
    for window in effects.windows {
        if *window.kind != MIST_TIDE {
            continue;
        }
        settle_with_wind(ref stamina, ref boosts, maximum, request, *window.start, rate_bps, wind);
        settle_with_wind(
            ref stamina,
            ref boosts,
            maximum,
            request,
            *window.end,
            rate_bps * Into::<u16, u32>::into(effects.stamina_percent) / 100,
            wind,
        );
    }
    settle_with_wind(ref stamina, ref boosts, maximum, request, request.timestamp, rate_bps, wind);
}

#[cfg(feature: "blitz")]
fn second_wind(_home: ResourceKey) -> Option<Wind> {
    None
}

#[cfg(not(feature: "blitz"))]
fn second_wind(home: ResourceKey) -> Option<Wind> {
    let rules = crate::logic::race::rules();
    let period = crate::logic::triumphs::period(home, crate::race::SECOND_WIND_STAGE)?;
    Some(
        Wind {
            start: period.start, end: period.end, rate_bps: Into::<u16, u32>::into(rules.second_wind_percent) * 100,
        },
    )
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
    ref stamina: Stamina, ref boosts: TroopBoosts, maximum: u64, request: StaminaRefill, until: u64, rate_bps: u32,
) {
    stamina.refill_to_max(ref boosts, maximum, request.stamina_config, request.armies_tick_in_seconds, until, rate_bps);
}
