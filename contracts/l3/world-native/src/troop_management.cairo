use crate::rules::{RESOURCE_PRECISION, SliceRules};
use crate::stamina::StaminaTrait;
use crate::troops::{TroopTier, TroopType, Troops};

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardSlot {
    pub structure_id: u32,
    pub slot: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Army {
    Explorer: u32,
    Guard: GuardSlot,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecruitGuard {
    pub guard: GuardSlot,
    pub category: TroopType,
    pub tier: TroopTier,
    pub amount: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RecruitExplorer {
    pub explorer_id: u32,
    pub amount: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TransferTroops {
    pub source: Army,
    pub target: Army,
    pub amount: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum ManageTroops {
    RecruitGuard: RecruitGuard,
    RemoveGuard: GuardSlot,
    RecruitExplorer: RecruitExplorer,
    RemoveExplorer: u32,
    Transfer: TransferTroops,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerCreated {
    pub explorer_id: u32,
    pub structure_id: u32,
    pub category: TroopType,
    pub tier: TroopTier,
    pub amount: u128,
    pub spawn_direction: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerRemoved {
    pub explorer_id: u32,
}

pub fn management_story(command: ManageTroops) -> (u32, crate::ownership::Story) {
    use crate::ownership::{GuardAddStory, Story};
    match command {
        ManageTroops::RecruitGuard(value) => (
            value.guard.structure_id,
            Story::GuardAddStory(
                GuardAddStory {
                    structure_id: value.guard.structure_id,
                    slot: value.guard.slot,
                    category: value.category.into(),
                    tier: match value.tier {
                        TroopTier::T1 => 0,
                        TroopTier::T2 => 1,
                        TroopTier::T3 => 2,
                    },
                    amount: value.amount,
                },
            ),
        ),
        ManageTroops::RemoveGuard(value) => (value.structure_id, Story::GuardDeleteStory(value)),
        ManageTroops::RecruitExplorer(value) => (value.explorer_id, Story::ExplorerAddStory(value)),
        ManageTroops::RemoveExplorer(id) => (id, Story::ExplorerDeleteStory(ExplorerRemoved { explorer_id: id })),
        ManageTroops::Transfer(value) => (
            match value.source {
                Army::Explorer(id) => id,
                Army::Guard(slot) => slot.structure_id,
            },
            Story::TroopsTransferred(value),
        ),
    }
}

#[starknet::interface]
pub trait ITroopManagement<T> {
    fn manage_troops(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ManageTroops,
        context: crate::commands::ExecutionContext,
    );
}

pub fn assert_amount(amount: u128) {
    assert!(amount != 0 && amount % RESOURCE_PRECISION == 0, "invalid troop amount");
}
pub fn refill(ref troops: Troops, rules: SliceRules, timestamp: u64) {
    troops
        .stamina
        .refill(
            ref troops.boosts,
            troops.category,
            troops.tier,
            rules.troop_stamina_config,
            timestamp / rules.tick_config.armies_tick_in_seconds,
        );
}
pub fn merge_timers(ref source: Troops, ref target: Troops, rules: SliceRules, timestamp: u64) {
    refill(ref source, rules, timestamp);
    refill(ref target, rules, timestamp);
    if source.stamina.amount < target.stamina.amount {
        target.stamina.amount = source.stamina.amount;
        target.stamina.updated_tick = timestamp / rules.tick_config.armies_tick_in_seconds;
    }
    target.battle_cooldown_end = core::cmp::max(source.battle_cooldown_end, target.battle_cooldown_end);
}
pub fn assert_matching(source: Troops, target: Troops) {
    assert!(source.category == target.category && source.tier == target.tier, "different troop category or tier");
}
pub fn assert_size(troops: Troops, level: u8, rules: SliceRules) {
    assert!(
        troops.count <= crate::troops::max_army_size(rules.troop_limit_config, level, troops.tier).into()
            * RESOURCE_PRECISION,
        "army size limit",
    );
}
