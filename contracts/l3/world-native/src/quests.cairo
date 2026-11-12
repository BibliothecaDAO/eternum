use core::poseidon::poseidon_hash_span;

pub const HUNT: u8 = 0;
pub const CAMPS: u8 = 1;
pub const RIFTS: u8 = 2;
pub const RELICS: u8 = 3;
pub const VETERANS: u8 = 4;
pub const FINDS: u8 = 5;
pub const REVEALS: u8 = 6;
pub const QUEST_COUNT: u8 = 7;

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

pub fn validate(rules: QuestRules) {
    assert!(rules.base_counts.len() == QUEST_COUNT.into(), "daily quest bag must contain seven quests");
    for count in rules.base_counts {
        assert!(*count != 0, "empty quest target");
    }
    assert!(rules.labor != 0 && rules.essence != 0, "empty quest reward");
    assert!(rules.bonus_percent >= 100, "quest bonus reduces reward");
}

pub fn daily_quest(seed: felt252, day: u64) -> u8 {
    let week = day / QUEST_COUNT.into();
    let bag = shuffled_bag(seed, week);
    let index: u32 = (day % QUEST_COUNT.into()).try_into().unwrap();
    if week != 0 && index < 2 {
        let previous = shuffled_bag(seed, week - 1);
        if *previous.at(6) == *bag.at(0) {
            return *bag.at(1 - index);
        }
    }
        * bag.at(index)
}

fn shuffled_bag(seed: felt252, week: u64) -> Array<u8> {
    let mut bag = array![HUNT, CAMPS, RIFTS, RELICS, VETERANS, FINDS, REVEALS];
    let seed: u256 = poseidon_hash_span(array![seed, week.into(), 'daily-quest'].span()).into();
    let mut remaining: u32 = QUEST_COUNT.into();
    while remaining > 1 {
        let chosen: u32 = crate::random::range(seed, remaining.into(), remaining.into()).try_into().unwrap();
        let last = remaining - 1;
        let mut next = array![];
        for index in 0..QUEST_COUNT.into() {
            next.append(*bag.at(if index == chosen {
                last
            } else if index == last {
                chosen
            } else {
                index
            }));
        }
        bag = next;
        remaining -= 1;
    }
    bag
}

pub fn reward(labor: u128, essence: u128, labor_percent: u16, level: u8) -> (u128, u128) {
    assert!(level >= 1 && level <= 4, "invalid quest reward level");
    let mut multiplier = 1_u128;
    for _ in 1..level {
        multiplier *= 2;
    }
    (labor * multiplier * Into::<u16, u128>::into(labor_percent) / 100, essence * multiplier)
}
