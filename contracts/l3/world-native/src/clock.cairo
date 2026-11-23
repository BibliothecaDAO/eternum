use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::game::GameRegistry;
use crate::rules::TickConfig;

pub fn day_unit_seconds(game: GameRegistry) -> u32 {
    crate::balance::rules::SWITCHES.day_unit_seconds / game.clock_scale.into()
}

pub fn tick_config(game: GameRegistry) -> TickConfig {
    let scale: u64 = game.clock_scale.into();
    let tick = crate::balance::rules::TICK_CONFIG;
    TickConfig {
        armies_tick_in_seconds: tick.armies_tick_in_seconds / scale,
        delivery_tick_in_seconds: tick.delivery_tick_in_seconds,
    }
}

pub fn armies_tick_seconds(game: GameRegistry) -> u64 {
    tick_config(game).armies_tick_in_seconds
}

pub fn relic_seconds_per_rank(game: GameRegistry) -> u32 {
    crate::balance::rules::RELIC_SECONDS_PER_RANK / game.clock_scale.into()
}

pub fn per_second(game_id: u32, rate: u64) -> u64 {
    rate * crate::state::read().games.games.entry(game_id).clock_scale.read().into()
}

pub fn validate_scale(scale: u8, dev_mode_on: bool) {
    assert!(scale != 0, "clock scale is zero");
    assert!(scale == 1 || dev_mode_on, "a scaled clock needs a dev-mode game");
    let narrow: u32 = scale.into();
    let wide: u64 = scale.into();
    let tick = crate::balance::rules::TICK_CONFIG;
    assert!(
        crate::balance::rules::SWITCHES.day_unit_seconds % narrow == 0
            && crate::balance::rules::RELIC_SECONDS_PER_RANK % narrow == 0
            && tick.armies_tick_in_seconds % wide == 0,
        "clocks do not divide by the scale",
    );
}
