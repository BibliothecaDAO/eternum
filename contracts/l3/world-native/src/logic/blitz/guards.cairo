use crate::troops::{TroopTier, TroopType, Troops};

pub fn light_guard(seed: u256, rules: crate::rules::SliceRules, timestamp: u64) -> Troops {
    let limits = rules.troop_limit_config;
    let lower: u128 = limits.light_guard_lower_bound.into();
    let upper: u128 = limits.light_guard_upper_bound.into();
    let category = match crate::random::range(seed, 2, 3) {
        0 => TroopType::Knight,
        1 => TroopType::Paladin,
        _ => TroopType::Crossbowman,
    };
    crate::troops::discovered_guard(
        category, TroopTier::T1, lower + crate::random::range(seed, 1, upper - lower + 1), rules, timestamp,
    )
}

pub fn hyperstructure_guards(seed: u256, rules: crate::rules::SliceRules, timestamp: u64) -> Span<Troops> {
    let limits = rules.troop_limit_config;
    let lower: u128 = limits.heavy_guard_lower_bound.into();
    let upper: u128 = limits.heavy_guard_upper_bound.into();
    let categories = array![TroopType::Paladin, TroopType::Knight, TroopType::Crossbowman];
    let mut guards = array![];
    for slot in 0..categories.len() {
        let count = lower + crate::random::range(seed + slot.into(), 1, upper - lower + 1);
        guards.append(crate::troops::discovered_guard(*categories.at(slot), TroopTier::T2, count, rules, timestamp));
    }
    guards.span()
}
