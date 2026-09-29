use starknet::ContractAddress;
use crate::resources::ResourceAmount;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SettleVillage {
    pub pass_id: u16,
    pub connected_realm_entity_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct VillageResource {
    pub resource_type: u8,
    pub weight: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct VillageRules {
    pub troop_delay_ticks: u16,
    pub resources: Span<ResourceAmount>,
    pub resource_pool: Span<VillageResource>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct VillagePassKey {
    pub game_id: u32,
    pub pass_id: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct VillagePass {
    pub owner: ContractAddress,
    pub village_id: u32,
}

#[starknet::interface]
pub trait IVillages<T> {
    #[cfg(test)]
    fn village_rules(self: @T, game_id: u32) -> VillageRules;
    fn register_village_pass(ref self: T, key: VillagePassKey, owner: ContractAddress);
    #[cfg(test)]
    fn village_pass(self: @T, key: VillagePassKey) -> Option<VillagePass>;
    fn settle_village(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: SettleVillage,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

#[starknet::interface]
pub trait IVillageArmy<T> {
    fn receive_village_army(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        village_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}

pub fn select_resource(pool: Span<VillageResource>, seed: u256, timestamp: u64) -> u8 {
    assert!(pool.len() == 22, "incomplete village resource pool");
    let mut total = 0_u128;
    for choice in pool {
        total += *choice.weight;
    }
    assert!(total > 0, "empty village resource pool");
    let draw = crate::random::range(seed, timestamp.into() + 18, total);
    let mut cumulative = 0;
    for choice in pool {
        cumulative += *choice.weight;
        if draw < cumulative {
            return *choice.resource_type;
        }
    }
    panic!("village resource draw outside pool")
}
