use crate::rules::{RESOURCE_PRECISION, SliceRules};
use crate::troops::{TroopTier, TroopType};

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct AgentRules {
    pub max_lifetime_count: u16,
    pub max_current_count: u16,
    pub min_spawn_lords: u8,
    pub max_spawn_lords: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct AgentDiscoveryStats {
    pub spawned: u16,
    pub lords_minted: u32,
}
#[starknet::interface]
pub trait IAgents<T> {
    fn configure_agents(ref self: T, game_id: u32, rules: AgentRules);
    fn agent_rules(self: @T, game_id: u32) -> AgentRules;
    fn agent_discovery_stats(self: @T, game_id: u32) -> AgentDiscoveryStats;
    fn can_discover_agent(self: @T, game_id: u32) -> bool;
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AgentDraw {
    pub category: TroopType,
    pub tier: TroopTier,
    pub amount: u128,
    pub lords: u32,
}
pub fn draw(seed: u256, timestamp: u64, game: SliceRules, rules: AgentRules) -> AgentDraw {
    let lower: u128 = game.troop_limit_config.agents_troop_lower_bound.into();
    let upper: u128 = game.troop_limit_config.agents_troop_upper_bound.into();
    let amount = (lower + crate::random::range(seed, 124, upper - lower)) * RESOURCE_PRECISION;
    let category = match crate::random::range(seed, 124, 3) {
        0 => TroopType::Knight,
        1 => TroopType::Crossbowman,
        _ => TroopType::Paladin,
    };
    let tier_roll = crate::random::range(seed + 15, timestamp.into() + 18, 100);
    let tier = if tier_roll < 70 {
        TroopTier::T1
    } else if tier_roll < 90 {
        TroopTier::T2
    } else {
        TroopTier::T3
    };
    let lords_range: u128 = (rules.max_spawn_lords - rules.min_spawn_lords).into();
    let lords = crate::random::range(seed, 124, lords_range + 1) + rules.min_spawn_lords.into();
    AgentDraw { category, tier, amount, lords: lords.try_into().unwrap() }
}
