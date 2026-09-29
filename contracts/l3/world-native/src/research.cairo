use crate::resources::ResourceKey;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RealmKnowledge {
    pub learned: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum MapContentKind {
    Shrine,
    Well,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum ResearchEffect {
    BuildingTier: (u8, u8),
    MapContent: MapContentKind,
    Depth: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResearchNode {
    pub prerequisites: u16,
    pub essence_cost: u128,
    pub effect: ResearchEffect,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResearchNodeConfig {
    pub node: u8,
    pub rule: ResearchNode,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BuildingTierRule {
    pub labor_upgrade_cost: u128,
    pub output_multiplier_bps: u32,
    pub capacity_multiplier_bps: u32,
    pub population_multiplier_bps: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingTierConfig {
    pub category: u8,
    pub tier: u8,
    pub rule: BuildingTierRule,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Research {
    pub structure_id: u32,
    pub node: u8,
}

pub const NODE_COUNT: u8 = 13;

pub fn node_bit(node: u8) -> u16 {
    assert!(node < NODE_COUNT, "invalid research node");
    let mut bit = 1;
    for _ in 0..node {
        bit *= 2;
    }
    bit
}

#[starknet::interface]
pub trait IResearch<T> {
    fn research(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: Research,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
    fn realm_knowledge(self: @T, key: ResourceKey) -> Option<RealmKnowledge>;
    #[cfg(test)]
    fn research_node(self: @T, game_id: u32, node: u8) -> ResearchNode;
    #[cfg(test)]
    fn building_tier_rule(self: @T, game_id: u32, category: u8, tier: u8) -> BuildingTierRule;
}
