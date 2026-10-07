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
    Support,
}

/// An army's unspent XP and its tier in each attribute, from 1 (common) to 5 (legendary).
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArmyProgress {
    pub xp: u32,
    pub battle: u8,
    pub logistics: u8,
    pub scouting: u8,
    pub support: u8,
}

// Tiers start at common, so a stored zero word means no progress.
pub impl ProgressPacking of starknet::storage_access::StorePacking<ArmyProgress, u128> {
    fn pack(value: ArmyProgress) -> u128 {
        value.xp.into()
            + Into::<u8, u128>::into(value.battle) * 0x100000000
            + Into::<u8, u128>::into(value.logistics) * 0x10000000000
            + Into::<u8, u128>::into(value.scouting) * 0x1000000000000
            + Into::<u8, u128>::into(value.support) * 0x100000000000000
    }
    fn unpack(value: u128) -> ArmyProgress {
        ArmyProgress {
            xp: (value % 0x100000000).try_into().unwrap(),
            battle: (value / 0x100000000 % 256).try_into().unwrap(),
            logistics: (value / 0x10000000000 % 256).try_into().unwrap(),
            scouting: (value / 0x1000000000000 % 256).try_into().unwrap(),
            support: (value / 0x100000000000000 % 256).try_into().unwrap(),
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuyTier {
    pub explorer_id: u32,
    pub attribute: Attribute,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TierBought {
    pub explorer_id: u32,
    pub attribute: Attribute,
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
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

pub fn initial() -> ArmyProgress {
    ArmyProgress { xp: 0, battle: 1, logistics: 1, scouting: 1, support: 1 }
}

pub fn attribute_tier(progress: ArmyProgress, attribute: Attribute) -> u8 {
    match attribute {
        Attribute::Battle => progress.battle,
        Attribute::Logistics => progress.logistics,
        Attribute::Scouting => progress.scouting,
        Attribute::Support => progress.support,
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
        Attribute::Support => progress.support = tier,
    }
    TierBought { explorer_id: command.explorer_id, attribute: command.attribute, tier, price }
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
