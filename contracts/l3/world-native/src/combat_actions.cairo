use crate::commands::ExecutionContext;
use crate::resources::{ResourceAmount, ResourceKey};
use crate::troop_management::GuardSlot;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AttackExplorer {
    pub attacker_id: u32,
    pub defender_id: u32,
    pub steal_resources: Span<ResourceAmount>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardAttack {
    pub guard: GuardSlot,
    pub explorer_id: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Raid {
    pub explorer_id: u32,
    pub structure_id: u32,
    pub steal_resources: Span<ResourceAmount>,
}
#[derive(Copy, Drop, Serde)]
pub struct BattleSide {
    pub player: starknet::ContractAddress,
    pub category: crate::troops::TroopType,
    pub tier: crate::troops::TroopTier,
    pub before: u128,
    pub after: u128,
    pub roll: u8,
}

pub fn battle_side(
    player: starknet::ContractAddress, before: u128, after: crate::troops::Troops, roll: u8,
) -> BattleSide {
    BattleSide { player, category: after.category, tier: after.tier, before, after: after.count, roll }
}
#[starknet::interface]
pub trait ICombatActions<T> {
    fn battle(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::combat_actions::AttackExplorer,
        context: ExecutionContext,
    );

    fn guard_attack(
        ref self: T, game_id: u32, actor: starknet::ContractAddress, command: GuardAttack, context: ExecutionContext,
    );
    fn raid(ref self: T, game_id: u32, actor: starknet::ContractAddress, command: Raid, context: ExecutionContext);
    fn village_last_raided(self: @T, key: ResourceKey) -> u64;
}

#[derive(Drop, starknet::Event)]
pub struct RaidEvent {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub explorer_id: u32,
    #[key]
    pub structure_id: u32,
    pub success: bool,
    pub player: starknet::ContractAddress,
    pub target_owner: starknet::ContractAddress,
    pub troops_before: u128,
    pub troops_after: u128,
    pub requested_loot: Span<ResourceAmount>,
    pub timestamp: u64,
}
