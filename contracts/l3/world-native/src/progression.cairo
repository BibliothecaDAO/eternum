use crate::troops::ExplorerKey;

// Historical skill receipts retain their original discriminants.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RecordedScoutingKind {
    Camp,
    Rift,
    Beasts,
    Sanctuaries,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum RecordedSkillPointUse {
    Battle,
    Logistics,
    Scouting: RecordedScoutingKind,
    Homecoming,
    Stamina: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SkillPointSpent {
    pub explorer_id: u64,
    pub choice: RecordedSkillPointUse,
    pub point_rank: u8,
    pub tier: Option<u8>,
    pub stamina: u64,
}

/// Logistics captured when the army leaves home.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ArmyProgress {
    pub logistics: u8,
    pub oath_slots: u8,
}

pub impl ArmyProgressDefault of Default<ArmyProgress> {
    fn default() -> ArmyProgress {
        ArmyProgress { logistics: 0, oath_slots: crate::research::OATH_SLOTS_BASE }
    }
}

#[starknet::interface]
pub trait IArmyProgression<T> {
    fn army_progress(self: @T, key: ExplorerKey) -> Option<ArmyProgress>;
}

pub fn trained(learned: u64, category: crate::troops::TroopType) -> ArmyProgress {
    ArmyProgress {
        logistics: crate::research::tier(learned, crate::research::ROW_SUPPLY_YARD),
        oath_slots: crate::research::oath_slots(learned, category),
    }
}

pub fn stamina_max(
    progress: ArmyProgress, category: crate::troops::TroopType, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    crate::stamina::StaminaImpl::max(category, crate::troops::TroopTier::T1, rules)
        + crate::rules::logistics_stamina(progress.logistics).into()
}
