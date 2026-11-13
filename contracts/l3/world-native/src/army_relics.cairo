use crate::troops::ExplorerKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RelicKind {
    Blade,
    Ward,
    Plunder,
    FarEye,
    Tome,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyRelic {
    pub kind: RelicKind,
    pub rank: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default)]
pub struct ArmyRelics {
    pub first: Option<ArmyRelic>,
    pub second: Option<ArmyRelic>,
    pub third: Option<ArmyRelic>,
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

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RuinReward {
    Chest: crate::relics::SiteChest,
    Relic: ArmyRelic,
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
        RelicKind::FarEye => 3,
        RelicKind::Tome => 4,
    }
}

pub fn kind_at(id: u8) -> RelicKind {
    match id {
        0 => RelicKind::Blade,
        1 => RelicKind::Ward,
        2 => RelicKind::Plunder,
        3 => RelicKind::FarEye,
        4 => RelicKind::Tome,
        _ => panic!("invalid relic kind"),
    }
}

pub fn encode(relic: ArmyRelic) -> u8 {
    assert!(relic.rank > 0 && relic.rank <= 5, "invalid relic rank");
    kind_id(relic.kind) * 5 + relic.rank
}

pub fn decode(value: u8) -> ArmyRelic {
    assert!(value > 0 && value <= 25, "invalid army relic");
    ArmyRelic { kind: kind_at((value - 1) / 5), rank: (value - 1) % 5 + 1 }
}

pub fn slot(loadout: ArmyRelics, index: u8) -> Option<ArmyRelic> {
    match index {
        0 => loadout.first,
        1 => loadout.second,
        2 => loadout.third,
        _ => panic!("invalid relic slot"),
    }
}

pub fn set_slot(ref loadout: ArmyRelics, index: u8, relic: Option<ArmyRelic>) {
    match index {
        0 => loadout.first = relic,
        1 => loadout.second = relic,
        2 => loadout.third = relic,
        _ => panic!("invalid relic slot"),
    }
}

pub fn receive(ref loadout: ArmyRelics, relic: ArmyRelic, replace: Option<u8>) {
    encode(relic);
    if let Some(index) = replace {
        set_slot(ref loadout, index, Some(relic));
        return;
    }
    for index in 0_u8..3 {
        if slot(loadout, index).is_none() {
            set_slot(ref loadout, index, Some(relic));
            return;
        }
    }
    panic!("choose a relic to replace")
}

pub fn bonus_bps(kind: RelicKind, rank: u8) -> u32 {
    assert!(rank <= 5, "invalid relic rank");
    let per_rank = match kind {
        RelicKind::Blade => crate::rules::RELIC_BLADE_BPS,
        RelicKind::Ward => crate::rules::RELIC_WARD_BPS,
        RelicKind::Plunder => crate::rules::RELIC_PLUNDER_BPS,
        RelicKind::Tome => crate::rules::RELIC_TOME_BPS,
        RelicKind::FarEye => 0,
    };
    per_rank * rank.into()
}

pub fn draw(odds: crate::relics::ChestTiers, seed: u256) -> ArmyRelic {
    ArmyRelic {
        kind: kind_at(crate::random::range(seed, 0x52454c4943, 5).try_into().unwrap()),
        rank: crate::relics::roll_tier(odds, seed) + 1,
    }
}
