const BPS: u128 = 10000;
const EXPECTED_PLAYERS: u128 = 24;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SeriesRules {
    pub num_games: u32,
    pub total_chests: u128,
    pub cap_ratio_bps: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SeriesState {
    pub game_index: u32,
    pub ema_players_scaled: u128,
    pub recent_first: u128,
    pub recent_second: u128,
    pub recent_third: u128,
    pub recent_count: u8,
    pub anchor_first: u128,
    pub anchor_second: u128,
    pub anchor_count: u8,
    pub last_rate_bps: u128,
    pub soft_supply: u128,
    pub overspend_remaining: u128,
}
pub fn initial_state(rules: SeriesRules) -> SeriesState {
    SeriesState {
        game_index: 0,
        ema_players_scaled: EXPECTED_PLAYERS * BPS,
        recent_first: 0,
        recent_second: 0,
        recent_third: 0,
        recent_count: 0,
        anchor_first: 0,
        anchor_second: 0,
        anchor_count: 0,
        last_rate_bps: 0,
        soft_supply: rules.total_chests,
        overspend_remaining: rules.total_chests * (rules.cap_ratio_bps - BPS) / BPS,
    }
}
pub fn validate_rules(rules: SeriesRules) {
    assert!(rules.num_games > 0 && rules.num_games <= 65535, "invalid series game count");
    assert!(rules.cap_ratio_bps >= BPS, "invalid series cap ratio");
    if rules.total_chests != 0 {
        assert!(rules.cap_ratio_bps <= 65535 * BPS / rules.total_chests, "series chest allocation exceeds u16");
    }
}
pub fn allocate(ref state: SeriesState, rules: SeriesRules, players: u16) -> u16 {
    if players < 2 {
        state.game_index += 1;
        return 0;
    }
    if state.game_index >= rules.num_games || state.soft_supply + state.overspend_remaining == 0 {
        if state.game_index < rules.num_games {
            state.game_index += 1;
        }
        return 0;
    }
    let observed: u128 = players.into();
    state.ema_players_scaled = round(5000 * observed * BPS + 5000 * state.ema_players_scaled, BPS);
    push_recent(ref state, observed);
    let rate = rate_for_attendance(state, rules);
    let pot = core::cmp::min(round(observed * rate, BPS), state.soft_supply + state.overspend_remaining);
    let soft = core::cmp::min(pot, state.soft_supply);
    state.soft_supply -= soft;
    state.overspend_remaining -= pot - soft;
    push_anchor(ref state, round(pot * BPS, observed));
    state.last_rate_bps = rate;
    state.game_index += 1;
    pot.try_into().unwrap()
}
fn rate_for_attendance(state: SeriesState, rules: SeriesRules) -> u128 {
    let expected_now = core::cmp::max(
        1, round(6000 * EXPECTED_PLAYERS + round(4000 * state.ema_players_scaled, BPS), BPS),
    );
    let remaining: u128 = (rules.num_games - state.game_index).into();
    let forecast = core::cmp::max(
        1, round(6000 * EXPECTED_PLAYERS * remaining + round(4000 * state.ema_players_scaled * remaining, BPS), BPS),
    );
    let growth = round(
        (state.recent_first + state.recent_second + state.recent_third) * BPS,
        Into::<u8, u128>::into(state.recent_count) * expected_now,
    );
    let scale = if growth > 0 && growth < BPS {
        core::cmp::min(16000, core::cmp::max(6250, round(BPS * BPS, growth)))
    } else {
        BPS
    };
    let budget = state.soft_supply * scale / forecast;
    let anchor = if state.anchor_count == 0 {
        budget
    } else {
        round(state.anchor_first + state.anchor_second, state.anchor_count.into())
    };
    let weight = core::cmp::min(
        BPS, if growth >= BPS {
            round(6000 * growth, BPS)
        } else {
            round(6000 * growth * growth, BPS * BPS)
        },
    );
    let blend = round(weight * anchor + (BPS - weight) * budget, BPS);
    if state.anchor_count == 0 {
        blend
    } else {
        core::cmp::max(
            round(state.last_rate_bps * 9400, BPS), core::cmp::min(round(state.last_rate_bps * 10600, BPS), blend),
        )
    }
}
fn push_recent(ref state: SeriesState, value: u128) {
    if state.recent_count == 0 {
        state.recent_first = value;
    } else if state.recent_count == 1 {
        state.recent_second = value;
    } else if state.recent_count == 2 {
        state.recent_third = value;
    } else {
        state.recent_first = state.recent_second;
        state.recent_second = state.recent_third;
        state.recent_third = value;
    }
    state.recent_count = core::cmp::min(3, state.recent_count + 1);
}
fn push_anchor(ref state: SeriesState, value: u128) {
    if state.anchor_count == 0 {
        state.anchor_first = value;
    } else if state.anchor_count == 1 {
        state.anchor_second = value;
    } else {
        state.anchor_first = state.anchor_second;
        state.anchor_second = value;
    }
    state.anchor_count = core::cmp::min(2, state.anchor_count + 1);
}
fn round(numerator: u128, denominator: u128) -> u128 {
    (numerator + denominator / 2) / denominator
}
pub fn tied_chests(points: u128, total: u128, allocated: u16, count: u16, ref remaining: u16) -> u16 {
    assert!(count > 0, "empty chest allocation group");
    let base: u256 = if points >= 500000000 {
        1
    } else {
        0
    };
    let proportion: u256 = if total == 0 {
        0
    } else {
        Into::<u16, u256>::into(allocated) * points.into() / total.into()
    };
    let requested = (base + proportion) * count.into();
    let reserved = if requested > remaining.into() {
        remaining
    } else {
        requested.try_into().unwrap()
    };
    remaining -= reserved;
    reserved / count
}
