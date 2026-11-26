use starknet::ContractAddress;
use crate::resources::{ESSENCE, LABOR, ResourceKey};

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

fn reward_strength(troops: crate::troops::Troops, limits: crate::rules::TroopLimitConfig) -> u128 {
    let tier_strength: u128 = match troops.tier {
        crate::troops::TroopTier::T1 => limits.t1_tier_strength.into(),
        crate::troops::TroopTier::T2 => limits.t2_tier_strength.into(),
        crate::troops::TroopTier::T3 => limits.t3_tier_strength.into(),
    };
    troops.count * tier_strength
}

pub fn reveal_reward(
    troops: crate::troops::Troops,
    limits: crate::rules::TroopLimitConfig,
    depth: crate::expeditions::DepthRules,
    seed: u256,
) -> crate::resources::ResourceAmount {
    let uncapped = reward_strength(troops, limits) * depth.reveal_percent.into() / 100;
    let amount = core::cmp::min(uncapped, depth.reveal_cap.into() * crate::rules::RESOURCE_PRECISION);
    crate::resources::ResourceAmount {
        resource_type: if crate::random::range(seed, 18, 2) == 0 {
            ESSENCE
        } else {
            LABOR
        }, amount,
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
    strength_cap: u32,
    timestamp: u64,
    seed: u256,
) -> crate::resources::ResourceAmount {
    let drawn = draw(rewards, seed);
    let capped = core::cmp::min(
        reward_strength(troops, limits), strength_cap.into() * crate::rules::RESOURCE_PRECISION,
    );
    let amount = capped * drawn.percent / 100;
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
