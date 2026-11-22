use starknet::ContractAddress;
use crate::resources::{ESSENCE, LABOR, ResourceKey};

// A dormant spire pays a flat Essence jackpot before the active Exploration relic bonus.
pub const SPIRE_ESSENCE_AMOUNT: u128 = 1000 * crate::rules::RESOURCE_PRECISION;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExtractedReward {
    pub explorer_id: u64,
    pub receiver: u64,
    pub coord: crate::troops::Coord,
    pub resource_type: u8,
    pub amount: u128,
}
#[starknet::interface]
pub trait IExtraction<T> {
    fn extract_exploration_reward(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        explorer_id: u64,
        coord: crate::troops::Coord,
        context: crate::commands::ActionContext,
    );
}
#[starknet::interface]
pub trait IExplorationGrant<T> {
    fn grant_exploration_reward(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
}

/// The strength every exploration reward pays on: the army's troops, each weighted by its tier, up to the preset's cap
/// when it sets one. Troop counts carry resource precision, so the reward strength does.
fn reward_strength(troops: crate::troops::Troops, limits: crate::rules::TroopLimitConfig) -> u128 {
    let tier_strength: u128 = match troops.tier {
        crate::troops::TroopTier::T1 => limits.t1_tier_strength.into(),
        crate::troops::TroopTier::T2 => limits.t2_tier_strength.into(),
        crate::troops::TroopTier::T3 => limits.t3_tier_strength.into(),
    };
    let strength = troops.count * tier_strength;
    let cap: u128 = limits.explore_reward_strength_cap.into();
    if cap == 0 {
        strength
    } else {
        core::cmp::min(strength, cap * crate::rules::RESOURCE_PRECISION)
    }
}

/// A Frontier reveal: its depth's percent of the reward strength, in Essence or labor, never boosted.
pub fn reveal_reward(
    troops: crate::troops::Troops, limits: crate::rules::TroopLimitConfig, percent: u16, seed: u256,
) -> crate::resources::ResourceAmount {
    crate::resources::ResourceAmount {
        resource_type: if crate::random::range(seed, 18, 2) == 0 {
            ESSENCE
        } else {
            LABOR
        },
        amount: reward_strength(troops, limits) * percent.into() / 100,
    }
}
#[cfg(feature: "blitz")]
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorationReward {
    pub resource_type: u8,
    pub percent: u128,
    pub weight: u128,
}

#[cfg(feature: "blitz")]
pub fn pool_reward(
    rewards: Span<ExplorationReward>,
    troops: crate::troops::Troops,
    limits: crate::rules::TroopLimitConfig,
    timestamp: u64,
    seed: u256,
) -> crate::resources::ResourceAmount {
    let drawn = draw(rewards, seed);
    let amount = reward_strength(troops, limits) * drawn.percent / 100;
    let boosts = troops.boosts;
    crate::resources::ResourceAmount {
        resource_type: drawn.resource_type,
        amount: if crate::relics::bonus_active(boosts.incr_explore_reward_end_at, timestamp) {
            amount + amount * boosts.incr_explore_reward_percent_num.into() / 10000
        } else {
            amount
        },
    }
}

#[cfg(feature: "blitz")]
fn draw(rewards: Span<ExplorationReward>, seed: u256) -> ExplorationReward {
    let mut total: u128 = 0;
    for reward in rewards {
        total += *reward.weight;
    }
    let mut roll = crate::random::range(seed, 18, total);
    for reward in rewards {
        if roll < *reward.weight {
            return *reward;
        }
        roll -= *reward.weight;
    }
    panic!("invalid exploration draw")
}

pub fn receiver(explorer_id: u64, home: u64, resource_type: u8) -> u64 {
    if resource_type >= 39 && resource_type <= 56 {
        explorer_id
    } else {
        home
    }
}
