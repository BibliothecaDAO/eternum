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

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyProgress {
    pub logistics: u8,
    pub oath_slots: u8,
    pub oaths: u16,
    pub oath_pick: u16,
}

pub impl ArmyProgressDefault of Default<ArmyProgress> {
    fn default() -> ArmyProgress {
        ArmyProgress { logistics: 0, oath_slots: crate::research::OATH_SLOTS_BASE, oaths: 0, oath_pick: 0 }
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
        ..Default::default(),
    }
}

pub fn stamina_max(
    progress: ArmyProgress, category: crate::troops::TroopType, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    let bar = crate::stamina::StaminaImpl::max(category, crate::troops::TroopTier::T1, rules);
    bar + crate::rules::logistics_stamina(bar, progress.logistics) + crate::oaths::stamina_bonus(progress.oaths)
}

pub impl ArmyProgressPacking of starknet::storage_access::StorePacking<ArmyProgress, u64> {
    fn pack(value: ArmyProgress) -> u64 {
        assert!(value.logistics <= 5, "invalid logistics");
        assert!(
            value.oath_slots >= 1 && value.oath_slots <= crate::research::OATH_SLOTS_BASE
                + crate::research::OATH_SLOTS_STEPS,
            "invalid oath slots",
        );
        assert!(value.oath_pick < crate::oaths::REROLLED * 2, "invalid oath pick");
        let pick: u64 = value.oath_pick.into();
        value.oaths.into()
            + Into::<u8, u64>::into(value.oath_slots) * 65536
            + pick % 4096 * 524288
            + Into::<u8, u64>::into(value.logistics) * 2147483648
            + pick / 4096 * 17179869184
    }
    fn unpack(value: u64) -> ArmyProgress {
        ArmyProgress {
            oaths: (value % 65536).try_into().unwrap(),
            oath_slots: (value / 65536 % 8).try_into().unwrap(),
            oath_pick: (value / 524288 % 4096 + value / 17179869184 * 4096).try_into().unwrap(),
            logistics: (value / 2147483648 % 8).try_into().unwrap(),
        }
    }
}
