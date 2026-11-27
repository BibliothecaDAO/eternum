use crate::troops::ExplorerKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RelicKind {
    Blade,
    Ward,
    Plunder,
    StaminaRegen,
    Antidote,
}

pub const RELIC_KIND_COUNT: u8 = 5;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyRelic {
    pub kind: RelicKind,
    pub rank: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RelicCollectOutcome {
    Collected,
    Replaced,
    Merged,
    Discarded,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RelicCollected {
    pub explorer_id: u64,
    pub site_id: u64,
    pub kind: RelicKind,
    pub found_rank: u8,
    pub previous_rank: u8,
    pub result_rank: u8,
    pub outcome: RelicCollectOutcome,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default)]
pub struct ArmyRelics {
    pub blade: u8,
    pub ward: u8,
    pub plunder: u8,
    pub stamina_regen: u8,
    pub antidote: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyRelicEffectKey {
    pub game_id: u32,
    pub explorer_id: u64,
    pub kind: RelicKind,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyRelicEffect {
    pub rank: u8,
    pub expires_at: u64,
}


#[starknet::interface]
pub trait IArmyRelics<T> {
    fn army_relics(self: @T, key: ExplorerKey) -> ArmyRelics;
    fn army_relic_effect(self: @T, key: ArmyRelicEffectKey) -> Option<ArmyRelicEffect>;
    fn ruin_relic(self: @T, key: crate::resources::ResourceKey) -> Option<ArmyRelic>;
}

pub fn kind_id(kind: RelicKind) -> u8 {
    match kind {
        RelicKind::Blade => 0,
        RelicKind::Ward => 1,
        RelicKind::Plunder => 2,
        RelicKind::StaminaRegen => 3,
        RelicKind::Antidote => 4,
    }
}

pub fn kind_at(id: u8) -> RelicKind {
    match id {
        0 => RelicKind::Blade,
        1 => RelicKind::Ward,
        2 => RelicKind::Plunder,
        3 => RelicKind::StaminaRegen,
        4 => RelicKind::Antidote,
        _ => panic!("invalid relic kind"),
    }
}

pub fn encode(relic: ArmyRelic) -> u8 {
    let cap = crate::rules::ATTRIBUTE_CAP;
    assert!(relic.rank > 0 && relic.rank <= cap, "invalid relic rank");
    kind_id(relic.kind) * cap + relic.rank
}

pub fn decode(value: u8) -> ArmyRelic {
    let cap = crate::rules::ATTRIBUTE_CAP;
    assert!(value > 0 && value <= RELIC_KIND_COUNT * cap, "invalid army relic");
    ArmyRelic { kind: kind_at((value - 1) / cap), rank: (value - 1) % cap + 1 }
}

pub fn rank_of(loadout: ArmyRelics, kind: RelicKind) -> u8 {
    match kind {
        RelicKind::Blade => loadout.blade,
        RelicKind::Ward => loadout.ward,
        RelicKind::Plunder => loadout.plunder,
        RelicKind::StaminaRegen => loadout.stamina_regen,
        RelicKind::Antidote => loadout.antidote,
    }
}

pub fn set_rank(ref loadout: ArmyRelics, kind: RelicKind, rank: u8) {
    assert!(rank <= crate::rules::ATTRIBUTE_CAP, "invalid relic rank");
    match kind {
        RelicKind::Blade => loadout.blade = rank,
        RelicKind::Ward => loadout.ward = rank,
        RelicKind::Plunder => loadout.plunder = rank,
        RelicKind::StaminaRegen => loadout.stamina_regen = rank,
        RelicKind::Antidote => loadout.antidote = rank,
    }
}

pub fn collect(ref loadout: ArmyRelics, relic: ArmyRelic) -> (u8, u8, RelicCollectOutcome) {
    encode(relic);
    let previous = rank_of(loadout, relic.kind);
    if previous == 0 {
        set_rank(ref loadout, relic.kind, relic.rank);
        return (previous, relic.rank, RelicCollectOutcome::Collected);
    }
    if previous == relic.rank && previous < crate::rules::ATTRIBUTE_CAP {
        let merged = previous + 1;
        set_rank(ref loadout, relic.kind, merged);
        return (previous, merged, RelicCollectOutcome::Merged);
    }
    if relic.rank > previous {
        set_rank(ref loadout, relic.kind, relic.rank);
        return (previous, relic.rank, RelicCollectOutcome::Replaced);
    }
    (previous, previous, RelicCollectOutcome::Discarded)
}

pub fn bonus_bps(kind: RelicKind, rank: u8) -> u32 {
    assert!(rank <= crate::rules::ATTRIBUTE_CAP, "invalid relic rank");
    let per_rank = match kind {
        RelicKind::Blade => crate::rules::RELIC_BLADE_BPS,
        RelicKind::Ward => crate::rules::RELIC_WARD_BPS,
        RelicKind::Plunder => crate::rules::RELIC_PLUNDER_BPS,
        RelicKind::StaminaRegen => crate::rules::STAMINA_REGEN_RELIC_STEP_PERCENT * 100,
        RelicKind::Antidote => crate::rules::RELIC_ANTIDOTE_BPS,
    };
    per_rank * rank.into()
}

pub fn deep_loss_for_army(oaths: u16, base_loss: u128, antidote_rank: u8) -> u128 {
    let vitriol_bps: u32 = if crate::oaths::held(oaths, crate::oaths::VITRIOL) {
        Into::<u16, u32>::into(crate::oaths::VITRIOL_REDUCTION_PERCENT) * 100
    } else {
        0
    };
    let antidote_bps = bonus_bps(RelicKind::Antidote, antidote_rank);
    let reduction_bps = core::cmp::min(vitriol_bps + antidote_bps, 10_000);
    base_loss * (10_000 - reduction_bps).into() / 10_000
}

pub fn deep_troops_after_ticks(
    count: u128, oaths: u16, base_loss: u128, antidote_rank: u8, last_tick: u64, expiry_tick: u64, tick: u64,
) -> u128 {
    let oath_loss = crate::oaths::deep_loss_per_tick(oaths, base_loss);
    if antidote_rank == 0 {
        return crate::deep::troops_after_ticks(count, last_tick, tick, oath_loss);
    }
    let covered = core::cmp::min(tick, expiry_tick);
    if covered > last_tick {
        let reduced = deep_loss_for_army(oaths, base_loss, antidote_rank);
        let mid = crate::deep::troops_after_ticks(count, last_tick, covered, reduced);
        crate::deep::troops_after_ticks(mid, covered, tick, oath_loss)
    } else {
        crate::deep::troops_after_ticks(count, last_tick, tick, oath_loss)
    }
}

pub fn draw(odds: crate::relics::ChestTiers, seed: u256) -> ArmyRelic {
    ArmyRelic {
        kind: kind_at(crate::random::range(seed, 0x52454c4943, RELIC_KIND_COUNT.into()).try_into().unwrap()),
        rank: crate::relics::roll_tier(odds, seed) + 1,
    }
}

pub const RUIN_GUARD_SPREAD_PERCENT: u128 = 10;
pub const RUIN_GUARD_STEP: u128 = 50;

pub const RELICS_PER_LAYER: u8 = 3;

pub fn ruin_strength(rank: u8, depth: u8) -> u128 {
    assert!(rank > depth && rank <= depth + RELICS_PER_LAYER, "relic outside its layer");
    let base: u128 = match rank - 1 - depth {
        0 => 1000,
        1 => 1500,
        _ => 2500,
    };
    base * core::num::traits::Pow::pow(2_u128, depth.into())
}
