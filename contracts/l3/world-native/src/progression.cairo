use crate::troops::ExplorerKey;

/// A game's XP rules: what a reveal and a fixed award pay, and the price of each tier above common.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ArmyProgressionRules {
    pub reveal_xp: u32,
    pub fixed_xp: u32,
    pub uncommon_xp: u32,
    pub rare_xp: u32,
    pub epic_xp: u32,
    pub legendary_xp: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Attribute {
    Battle,
    Logistics,
    Scouting,
    Homecoming,
}

/// What a Scouting tier raises: the find rate of one kind of site. Ruins, shrines and wells never change.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum ScoutingKind {
    Camp,
    Rift,
    Stragglers,
}

/// An army's unspent XP and its tier in each attribute, from 1 (common) to 5 (legendary). `scouting_kinds` holds the
/// kind each Scouting tier above common applies to, two bits per tier from uncommon up: 1 camp, 2 rift, 3 stragglers.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyProgress {
    pub xp: u32,
    pub battle: u8,
    pub logistics: u8,
    pub scouting: u8,
    pub scouting_kinds: u8,
    pub homecoming: u8,
}

// Tiers start at common, so a stored zero word means no progress.
pub impl ProgressPacking of starknet::storage_access::StorePacking<ArmyProgress, u128> {
    fn pack(value: ArmyProgress) -> u128 {
        value.xp.into()
            + Into::<u8, u128>::into(value.battle) * 0x100000000
            + Into::<u8, u128>::into(value.logistics) * 0x10000000000
            + Into::<u8, u128>::into(value.scouting) * 0x1000000000000
            + Into::<u8, u128>::into(value.homecoming) * 0x100000000000000
            + Into::<u8, u128>::into(value.scouting_kinds) * 0x10000000000000000
    }
    fn unpack(value: u128) -> ArmyProgress {
        ArmyProgress {
            xp: (value % 0x100000000).try_into().unwrap(),
            battle: (value / 0x100000000 % 256).try_into().unwrap(),
            logistics: (value / 0x10000000000 % 256).try_into().unwrap(),
            scouting: (value / 0x1000000000000 % 256).try_into().unwrap(),
            homecoming: (value / 0x100000000000000 % 256).try_into().unwrap(),
            scouting_kinds: (value / 0x10000000000000000 % 256).try_into().unwrap(),
        }
    }
}

/// An Upgrade; a Scouting tier names the kind it applies to, every other attribute none.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuyTier {
    pub explorer_id: u64,
    pub attribute: Attribute,
    pub kind: Option<ScoutingKind>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TierBought {
    pub explorer_id: u64,
    pub attribute: Attribute,
    pub kind: Option<ScoutingKind>,
    pub tier: u8,
    pub price: u32,
}

#[derive(Copy, Drop, Serde)]
pub enum XpAward {
    Reveal,
    /// A clear, by the guard's starting strength in resource precision.
    Clear: u128,
}

#[starknet::interface]
pub trait IArmyProgression<T> {
    fn army_progress(self: @T, key: ExplorerKey) -> Option<ArmyProgress>;
    fn army_progression_rules(self: @T, game_id: u32) -> Option<ArmyProgressionRules>;
    fn grant_army_xp(ref self: T, key: ExplorerKey, award: XpAward);
    fn buy_tier(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: BuyTier,
        context: crate::commands::ActionContext,
    );
}

pub fn initial() -> ArmyProgress {
    ArmyProgress { xp: 0, battle: 1, logistics: 1, scouting: 1, scouting_kinds: 0, homecoming: 1 }
}

// A new army starts each attribute at its realm's trained tier, common being level 1: the War hall's Battle, the
// Supply yard's Logistics, the Scouts' lodge's Scouting and the Hearth's Homecoming.
pub fn trained(learned: u64) -> ArmyProgress {
    let scouting = 1 + crate::research::tier(learned, crate::research::ROW_SCOUTS_LODGE);
    let mut scouting_kinds = 0;
    for at in 1_u8..scouting {
        let kind = crate::research::choice(learned, crate::research::ROW_SCOUTS_LODGE, at) + 1;
        scouting_kinds += kind * scouting_kind_shift(at + 1);
    }
    ArmyProgress {
        battle: 1 + crate::research::tier(learned, crate::research::ROW_WAR_HALL),
        logistics: 1 + crate::research::tier(learned, crate::research::ROW_SUPPLY_YARD),
        scouting,
        scouting_kinds,
        homecoming: 1 + crate::research::tier(learned, crate::research::ROW_HEARTH),
        ..initial(),
    }
}

pub fn attribute_tier(progress: ArmyProgress, attribute: Attribute) -> u8 {
    match attribute {
        Attribute::Battle => progress.battle,
        Attribute::Logistics => progress.logistics,
        Attribute::Scouting => progress.scouting,
        Attribute::Homecoming => progress.homecoming,
    }
}

/// The XP the next tier above `tier` costs.
pub fn tier_price(rules: ArmyProgressionRules, tier: u8) -> u32 {
    match tier {
        0 => panic!("invalid attribute tier"),
        1 => rules.uncommon_xp,
        2 => rules.rare_xp,
        3 => rules.epic_xp,
        4 => rules.legendary_xp,
        _ => panic!("attribute is legendary"),
    }
}

/// Spends the next tier's price and raises the attribute by one tier.
pub fn buy_tier(ref progress: ArmyProgress, rules: ArmyProgressionRules, command: BuyTier) -> TierBought {
    let price = tier_price(rules, attribute_tier(progress, command.attribute));
    assert!(progress.xp >= price, "not enough XP");
    progress.xp -= price;
    let tier = attribute_tier(progress, command.attribute) + 1;
    match command.attribute {
        Attribute::Battle => progress.battle = tier,
        Attribute::Logistics => progress.logistics = tier,
        Attribute::Scouting => progress.scouting = tier,
        Attribute::Homecoming => progress.homecoming = tier,
    }
    if command.attribute == Attribute::Scouting {
        let code: u8 = match command.kind.expect('Scouting needs a kind') {
            ScoutingKind::Camp => 1,
            ScoutingKind::Rift => 2,
            ScoutingKind::Stragglers => 3,
        };
        progress.scouting_kinds += code * scouting_kind_shift(tier);
    } else {
        assert!(command.kind.is_none(), "only Scouting takes a kind");
    }
    TierBought { explorer_id: command.explorer_id, attribute: command.attribute, kind: command.kind, tier, price }
}

/// The place of a Scouting tier's kind in `scouting_kinds`: two bits per tier from uncommon (tier 2) up.
fn scouting_kind_shift(tier: u8) -> u8 {
    match tier {
        2 => 1,
        3 => 4,
        4 => 16,
        5 => 64,
        _ => panic!("invalid attribute tier"),
    }
}

/// What the army's Scouting tiers add to camp, rift and straggler find rates, in basis points of each kind's base rate.
pub fn scouting_bonus(progress: ArmyProgress) -> (u32, u32, u32) {
    let mut camp = 0;
    let mut rift = 0;
    let mut stragglers = 0;
    let mut tier = 2;
    while tier <= progress.scouting {
        let increment = crate::rules::scouting_increment_bps(tier);
        match progress.scouting_kinds / scouting_kind_shift(tier) % 4 {
            1 => camp += increment,
            2 => rift += increment,
            3 => stragglers += increment,
            _ => panic!("missing Scouting kind"),
        }
        tier += 1;
    }
    (camp, rift, stragglers)
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
