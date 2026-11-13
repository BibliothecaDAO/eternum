pub const HUNT: u8 = 0;
pub const CAMPS: u8 = 1;
pub const RIFTS: u8 = 2;
pub const RELICS: u8 = 3;
pub const VETERANS: u8 = 4;
pub const FINDS: u8 = 5;
pub const REVEALS: u8 = 6;
pub const QUEST_COUNT: u8 = 7;
pub const STAND: u8 = 7;
pub const LIGHTS: u8 = 8;
pub const CULL: u8 = 9;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct QuestRules {
    pub base_counts: Span<u32>,
    pub labor: u128,
    pub essence: u128,
    pub bonus_percent: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ClaimDailyQuest {
    pub home: u64,
    pub day: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct QuestProgress {
    pub progress: u128,
    pub completed_level: u8,
}

#[starknet::interface]
pub trait IDailyQuest<T> {
    fn claim_daily_quest(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: ClaimDailyQuest,
        context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait IQuestProgress<T> {
    fn record_quest_progress(ref self: T, home: crate::resources::ResourceKey, kind: u8, amount: u128, timestamp: u64);
}

pub fn reward(labor: u128, essence: u128, labor_percent: u16, level: u8) -> (u128, u128) {
    assert!(level >= 1 && level <= 4, "invalid quest reward level");
    let mut multiplier = 1_u128;
    for _ in 1..level {
        multiplier *= 2;
    }
    (labor * multiplier * Into::<u16, u128>::into(labor_percent) / 100, essence * multiplier)
}
