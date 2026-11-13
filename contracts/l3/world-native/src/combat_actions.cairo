use crate::resources::ResourceAmount;
use crate::troop_management::GuardSlot;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AttackExplorer {
    pub attacker_id: u64,
    pub defender_id: u64,
    pub steal_resources: Span<ResourceAmount>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardAttack {
    pub guard: GuardSlot,
    pub explorer_id: u64,
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
pub trait IBattles<T> {
    fn battle(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::combat_actions::AttackExplorer,
        context: crate::commands::ActionContext,
    );
    fn guard_attack(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::combat_actions::GuardAttack,
        context: crate::commands::ActionContext,
    );
}
