use crate::troops::Troops;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardKey {
    pub game_id: u32,
    pub structure_id: u32,
    pub slot: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct Guard {
    pub troops: Troops,
    pub destroyed_tick: u32,
}
#[starknet::interface]
pub trait IGuardCombat<T> {
    fn battle_guard(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::commands::Battle,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}
#[starknet::interface]
pub trait IStructureCapture<T> {
    fn capture_structure(
        ref self: T,
        key: crate::resources::ResourceKey,
        capturing_home: u32,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}
#[starknet::interface]
pub trait IGuards<T> {
    fn guard(self: @T, key: GuardKey) -> Guard;
    fn initialize_structure_guards(
        ref self: T,
        key: crate::resources::ResourceKey,
        seed: u256,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
    fn add_starting_guard(
        ref self: T,
        key: crate::resources::ResourceKey,
        category: crate::troops::TroopType,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}
