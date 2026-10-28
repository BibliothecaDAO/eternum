use crate::troops::ExplorerKey;

/// XP awards and cumulative point thresholds within each Legendary XP cycle.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ArmyProgressionRules {
    pub reveal_xp: u32,
    pub reveal_xp_per_depth: u32,
    pub fixed_xp: u32,
    pub common_xp: u32,
    pub uncommon_xp: u32,
    pub rare_xp: u32,
    pub epic_xp: u32,
    pub legendary_xp: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum ScoutingKind {
    Camp,
    Rift,
    Beasts,
}

/// A point raises one side, or its named rank is exchanged for stamina alone.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum SkillPointUse {
    Battle,
    Logistics,
    Scouting: ScoutingKind,
    Homecoming,
    Stamina: u8,
}

/// Lifetime XP, unspent points and ranks 0..5. Each Scouting rank owns two choice bits.
#[derive(Copy, Drop, Default, Serde, Debug, PartialEq)]
pub struct ArmyProgress {
    pub xp: u32,
    pub common_points: u32,
    pub uncommon_points: u32,
    pub rare_points: u32,
    pub epic_points: u32,
    pub legendary_points: u32,
    pub battle: u8,
    pub logistics: u8,
    pub scouting: u8,
    pub homecoming: u8,
    pub scouting_kinds: u16,
}

pub impl ProgressPacking of starknet::storage_access::StorePacking<ArmyProgress, felt252> {
    fn pack(value: ArmyProgress) -> felt252 {
        let packed: u256 = Into::<u32, u256>::into(value.xp) * 0x1
            + Into::<u32, u256>::into(value.common_points) * 0x100000000
            + Into::<u32, u256>::into(value.uncommon_points) * 0x10000000000000000
            + Into::<u32, u256>::into(value.rare_points) * 0x1000000000000000000000000
            + Into::<u32, u256>::into(value.epic_points) * 0x100000000000000000000000000000000
            + Into::<u32, u256>::into(value.legendary_points) * 0x10000000000000000000000000000000000000000
            + Into::<u8, u256>::into(value.battle) * 0x1000000000000000000000000000000000000000000000000
            + Into::<u8, u256>::into(value.logistics) * 0x100000000000000000000000000000000000000000000000000
            + Into::<u8, u256>::into(value.scouting) * 0x10000000000000000000000000000000000000000000000000000
            + Into::<u8, u256>::into(value.homecoming) * 0x1000000000000000000000000000000000000000000000000000000
            + Into::<u16, u256>::into(value.scouting_kinds)
                * 0x100000000000000000000000000000000000000000000000000000000;
        packed.try_into().unwrap()
    }
    fn unpack(value: felt252) -> ArmyProgress {
        let packed: u256 = value.into();
        ArmyProgress {
            xp: (packed / 0x1 % 0x100000000).try_into().unwrap(),
            common_points: (packed / 0x100000000 % 0x100000000).try_into().unwrap(),
            uncommon_points: (packed / 0x10000000000000000 % 0x100000000).try_into().unwrap(),
            rare_points: (packed / 0x1000000000000000000000000 % 0x100000000).try_into().unwrap(),
            epic_points: (packed / 0x100000000000000000000000000000000 % 0x100000000).try_into().unwrap(),
            legendary_points: (packed / 0x10000000000000000000000000000000000000000 % 0x100000000).try_into().unwrap(),
            battle: (packed / 0x1000000000000000000000000000000000000000000000000 % 0x100).try_into().unwrap(),
            logistics: (packed / 0x100000000000000000000000000000000000000000000000000 % 0x100).try_into().unwrap(),
            scouting: (packed / 0x10000000000000000000000000000000000000000000000000000 % 0x100).try_into().unwrap(),
            homecoming: (packed / 0x1000000000000000000000000000000000000000000000000000000 % 0x100)
                .try_into()
                .unwrap(),
            scouting_kinds: (packed / 0x100000000000000000000000000000000000000000000000000000000 % 0x10000)
                .try_into()
                .unwrap(),
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SpendSkillPoint {
    pub explorer_id: u64,
    pub choice: SkillPointUse,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SkillPointSpent {
    pub explorer_id: u64,
    pub choice: SkillPointUse,
    pub point_rank: u8,
    pub tier: Option<u8>,
    pub stamina: u64,
}

#[derive(Copy, Drop, Serde)]
pub enum XpAward {
    Reveal: crate::troops::Coord,
    Clear: u128,
}

#[starknet::interface]
pub trait IArmyProgression<T> {
    fn army_progress(self: @T, key: ExplorerKey) -> Option<ArmyProgress>;
    fn army_progression_rules(self: @T, game_id: u32) -> Option<ArmyProgressionRules>;
    fn grant_army_xp(ref self: T, key: ExplorerKey, award: XpAward);
    fn spend_skill_point(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: SpendSkillPoint,
        context: crate::commands::ActionContext,
    );
}

pub fn initial() -> ArmyProgress {
    Default::default()
}

pub fn trained(learned: u64) -> ArmyProgress {
    let scouting = crate::research::tier(learned, crate::research::ROW_SCOUTS_LODGE);
    let mut scouting_kinds: u16 = 0;
    for at in 1_u8..scouting + 1 {
        let kind: u16 = (crate::research::choice(learned, crate::research::ROW_SCOUTS_LODGE, at) + 1).into();
        scouting_kinds += kind * scouting_kind_shift(at);
    }
    ArmyProgress {
        battle: crate::research::tier(learned, crate::research::ROW_WAR_HALL),
        logistics: crate::research::tier(learned, crate::research::ROW_SUPPLY_YARD),
        scouting,
        scouting_kinds,
        homecoming: crate::research::tier(learned, crate::research::ROW_HEARTH),
        ..initial(),
    }
}

pub fn point_threshold(rules: ArmyProgressionRules, rank: u8) -> u32 {
    match rank {
        1 => rules.common_xp,
        2 => rules.uncommon_xp,
        3 => rules.rare_xp,
        4 => rules.epic_xp,
        5 => rules.legendary_xp,
        _ => panic!("invalid point rank"),
    }
}

pub fn points(progress: ArmyProgress, rank: u8) -> u32 {
    match rank {
        1 => progress.common_points,
        2 => progress.uncommon_points,
        3 => progress.rare_points,
        4 => progress.epic_points,
        5 => progress.legendary_points,
        _ => panic!("invalid point rank"),
    }
}

fn set_points(ref progress: ArmyProgress, rank: u8, amount: u32) {
    match rank {
        1 => progress.common_points = amount,
        2 => progress.uncommon_points = amount,
        3 => progress.rare_points = amount,
        4 => progress.epic_points = amount,
        5 => progress.legendary_points = amount,
        _ => panic!("invalid point rank"),
    };
}

fn earned_points(xp: u32, rules: ArmyProgressionRules, rank: u8) -> u32 {
    xp / rules.legendary_xp + if xp % rules.legendary_xp >= point_threshold(rules, rank) {
        1
    } else {
        0
    }
}

/// A jump across several thresholds or cycles awards every crossed point exactly once.
pub fn earn_xp(ref progress: ArmyProgress, rules: ArmyProgressionRules, amount: u32) {
    let next = progress.xp + amount;
    for rank in 1_u8..6 {
        let added = earned_points(next, rules, rank) - earned_points(progress.xp, rules, rank);
        let held = points(progress, rank);
        set_points(ref progress, rank, held + added);
    }
    progress.xp = next;
}

pub fn lowest_fitting_point(progress: ArmyProgress, tier: u8) -> u8 {
    assert!(tier > 0 && tier <= crate::rules::ATTRIBUTE_CAP, "attribute is legendary");
    for rank in tier..6 {
        if points(progress, rank) > 0 {
            return rank;
        }
    }
    panic!("no fitting skill point")
}

pub fn point_refill(rank: u8) -> u8 {
    assert!(rank > 0 && rank <= crate::rules::ATTRIBUTE_CAP, "invalid point rank");
    crate::rules::SKILL_POINT_REFILL_BASE + rank * crate::rules::SKILL_POINT_REFILL_STEP
}

pub fn spend_skill_point(ref progress: ArmyProgress, command: SpendSkillPoint) -> SkillPointSpent {
    let tier = match command.choice {
        SkillPointUse::Battle => Some(progress.battle + 1),
        SkillPointUse::Logistics => Some(progress.logistics + 1),
        SkillPointUse::Scouting(_) => Some(progress.scouting + 1),
        SkillPointUse::Homecoming => Some(progress.homecoming + 1),
        SkillPointUse::Stamina(_) => None,
    };
    let rank = match command.choice {
        SkillPointUse::Stamina(rank) => rank,
        _ => lowest_fitting_point(progress, tier.unwrap()),
    };
    let held = points(progress, rank);
    assert!(held > 0, "no skill point of that rank");
    match command.choice {
        SkillPointUse::Battle => progress.battle = tier.unwrap(),
        SkillPointUse::Logistics => progress.logistics = tier.unwrap(),
        SkillPointUse::Homecoming => progress.homecoming = tier.unwrap(),
        SkillPointUse::Scouting(kind) => {
            let code: u16 = match kind {
                ScoutingKind::Camp => 1,
                ScoutingKind::Rift => 2,
                ScoutingKind::Beasts => 3,
            };
            progress.scouting = tier.unwrap();
            progress.scouting_kinds += code * scouting_kind_shift(tier.unwrap());
        },
        SkillPointUse::Stamina(_) => {},
    }
    set_points(ref progress, rank, held - 1);
    let refill = point_refill(rank) * if tier.is_none() {
        2
    } else {
        1
    };
    SkillPointSpent {
        explorer_id: command.explorer_id, choice: command.choice, point_rank: rank, tier, stamina: refill.into(),
    }
}

fn scouting_kind_shift(tier: u8) -> u16 {
    match tier {
        1 => 1,
        2 => 4,
        3 => 16,
        4 => 64,
        5 => 256,
        _ => panic!("invalid attribute tier"),
    }
}

pub fn scouting_bonus(progress: ArmyProgress) -> (u32, u32, u32) {
    let mut camp = 0;
    let mut rift = 0;
    let mut beasts = 0;
    for tier in 1_u8..progress.scouting + 1 {
        let increment = crate::rules::scouting_increment_bps(tier);
        match progress.scouting_kinds / scouting_kind_shift(tier) % 4 {
            1 => camp += increment,
            2 => rift += increment,
            3 => beasts += increment,
            _ => panic!("missing Scouting kind"),
        }
    }
    (camp, rift, beasts)
}

/// A clear pays 2.5 x the square root of the guard's starting strength in whole troops, rounded down: exactly
/// floor(sqrt(25 x strength)) / 2.
pub fn clear_xp(strength: u128) -> u32 {
    let root: u64 = core::num::traits::Sqrt::sqrt(strength / crate::rules::RESOURCE_PRECISION * 25);
    (root / 2).try_into().unwrap()
}

pub fn stamina_max(
    progress: ArmyProgress, category: crate::troops::TroopType, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    crate::stamina::StaminaImpl::max(category, crate::troops::TroopTier::T1, rules)
        + crate::rules::logistics_stamina(progress.logistics).into()
}
