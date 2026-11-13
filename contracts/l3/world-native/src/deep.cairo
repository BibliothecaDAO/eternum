use crate::troops::Coord;

pub fn center(spacing: u32) -> Coord {
    assert!(spacing >= crate::rules::DEEP_MAP_SIZE * 2, "Deep needs a full expedition region");
    Coord { alt: false, x: spacing / 2, y: spacing * 3 + spacing / 2 }
}

pub fn contains(coord: Coord, spacing: u32) -> bool {
    if coord.alt || spacing < crate::rules::DEEP_MAP_SIZE * 2 {
        return false;
    }
    let center = center(spacing);
    let half = crate::rules::DEEP_MAP_SIZE / 2;
    coord.x >= center.x - half && coord.x < center.x + half && coord.y >= center.y - half && coord.y < center.y + half
}

pub fn arrival(spacing: u32) -> Coord {
    let center = center(spacing);
    Coord { y: center.y - crate::rules::DEEP_MAP_SIZE / 2 + crate::rules::DEEP_ARRIVAL_Y, ..center }
}


#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepRules {
    pub foundation: Coord,
    pub quarry: Coord,
    pub altar: Coord,
    pub beast_count: u128,
    pub loss_per_tick: u128,
    pub quarry_per_tick: u128,
    pub altar_per_tick: u32,
    pub altar_threshold: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepSite {
    pub kind: u8,
    pub day: u64,
}

pub fn site_coord(rules: DeepRules, kind: u8, spacing: u32) -> Coord {
    let local = local_coord(rules, kind);
    let center = center(spacing);
    let half = crate::rules::DEEP_MAP_SIZE / 2;
    Coord { alt: false, x: center.x - half + local.x, y: center.y - half + local.y }
}

fn local_coord(rules: DeepRules, kind: u8) -> Coord {
    if kind == crate::rules::DEEP_FOUNDATION {
        rules.foundation
    } else if kind == crate::rules::DEEP_QUARRY {
        rules.quarry
    } else if kind == crate::rules::DEEP_ALTAR {
        rules.altar
    } else {
        panic!("invalid Deep site")
    }
}

pub fn validate(rules: DeepRules, spacing: u32) {
    assert!(rules.beast_count != 0, "empty Deep beast");
    assert!(rules.quarry_per_tick != 0, "empty Quarry payment");
    assert!(
        rules.altar_per_tick != 0 && rules.altar_threshold != 0 && rules.altar_threshold % rules.altar_per_tick == 0,
        "invalid Altar charge",
    );
    assert!(
        rules.loss_per_tick != 0 && rules.loss_per_tick % crate::rules::RESOURCE_PRECISION == 0,
        "invalid Deep troop loss",
    );
    assert!(rules.beast_count % crate::rules::RESOURCE_PRECISION == 0, "fractional Deep beast");
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let local = local_coord(rules, kind);
        assert!(
            !local.alt && local.x < crate::rules::DEEP_MAP_SIZE && local.y < crate::rules::DEEP_MAP_SIZE,
            "Deep site outside map",
        );
        let coord = site_coord(rules, kind, spacing);
        assert!(coord != arrival(spacing), "Deep site blocks arrival");
        for other in 0..kind {
            assert!(coord != site_coord(rules, other, spacing), "duplicate Deep site");
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DeepGuard {
    pub site_id: u64,
    pub slot: u8,
}

#[starknet::interface]
pub trait IDeepSites<T> {
    fn join_deep_site(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::relics::InteractSite,
        context: crate::commands::ActionContext,
    );
    fn initialize_deep(ref self: T, game_id: u32);
    fn settle_deep(ref self: T, game_id: u32, context: crate::commands::ActionContext);
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepArmy {
    pub last_tick: u64,
}

pub fn troops_after_ticks(count: u128, last_tick: u64, tick: u64, loss_per_tick: u128) -> u128 {
    let elapsed = tick - core::cmp::min(tick, last_tick);
    let loss: u256 = Into::<u64, u256>::into(elapsed) * Into::<u128, u256>::into(loss_per_tick);
    if loss >= count.into() {
        0
    } else {
        count - loss.try_into().unwrap()
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct DeepShare {
    pub home: u64,
    pub troops: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AltarBar {
    pub charge: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TeamBaneKey {
    pub game_id: u32,
    pub aspect: u8,
    pub day: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TeamBane {
    pub source: u8,
    pub issued_day: u64,
    pub quest: u8,
}

#[starknet::interface]
pub trait IDeepRewards<T> {
    fn pay_deep_tick(ref self: T, game_id: u32, kind: u8, aspect: u8, shares: Span<DeepShare>, timestamp: u64);
}
