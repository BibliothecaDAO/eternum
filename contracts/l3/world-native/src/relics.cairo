use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ApplyRelic {
    pub entity_id: u64,
    pub kind: crate::army_relics::RelicKind,
    pub expected_rank: u8,
}
// Five chest tiers, common to legendary: a depth's odds in basis points, or the shares each tier pays.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ChestTiers {
    pub common: u16,
    pub uncommon: u16,
    pub rare: u16,
    pub epic: u16,
    pub legendary: u16,
}

pub fn tier_value(tiers: ChestTiers, tier: u8) -> u16 {
    match tier {
        0 => tiers.common,
        1 => tiers.uncommon,
        2 => tiers.rare,
        3 => tiers.epic,
        4 => tiers.legendary,
        _ => panic!("invalid chest tier"),
    }
}

pub fn roll_tier(odds: ChestTiers, seed: u256) -> u8 {
    let mut draw = crate::random::range(seed, 37, 10000);
    for tier in 0_u8..4 {
        let weight: u128 = tier_value(odds, tier).into();
        if draw < weight {
            return tier;
        }
        draw -= weight;
    }
    4
}

// A realm's withdrawal of whole LORDS, recorded for fulfilment on L2.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LordsWithdrawal {
    pub account: ContractAddress,
    pub amount: u128,
    pub prize_rank: u16,
    pub prize_count: u16,
}

#[starknet::interface]
pub trait ILords<T> {
    fn sweep_lords(ref self: T, game_id: u32, structure_id: u64);
}

#[starknet::interface]
pub trait ICaptureRewards<T> {
    fn grant_capture_rewards(
        ref self: T, site: ResourceKey, explorer_id: u64, clean: bool, context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait IRelics<T> {
    fn apply_relic(
        ref self: T, game_id: u32, actor: ContractAddress, command: ApplyRelic, context: crate::commands::ActionContext,
    );
}
pub fn bonus_active(end_at: u32, timestamp: u64) -> bool {
    timestamp < end_at.into()
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct InteractSite {
    pub explorer_id: u64,
    pub coord: crate::troops::Coord,
}

#[starknet::interface]
pub trait IFrontierSites<T> {
    fn interact_site(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: InteractSite,
        context: crate::commands::ActionContext,
    );
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum SiteBenefit {
    Shrine: u32,
    Well: u64,
    ShrinePoint: u8,
}


#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SiteUsed {
    pub explorer_id: u64,
    pub coord: Coord,
    pub benefit: SiteBenefit,
}
