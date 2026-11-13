use core::poseidon::poseidon_hash_span;

pub const BLOOD_MOON: u8 = 1;
pub const MIST_TIDE: u8 = 2;
pub const ASH_FALL: u8 = 3;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BaneRules {
    pub chance_step: u16,
    pub quorum_percent: u16,
    pub beast_percent: u16,
    pub stamina_percent: u16,
    pub production_percent: u16,
    pub quest_counts: Span<u128>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BaneWindow {
    pub kind: u8,
    pub start: u64,
    pub end: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BaneProgress {
    pub completed: u32,
    pub ended_at: u64,
}

#[starknet::interface]
pub trait IAspectActivity<T> {
    fn record_aspect_activity(ref self: T, home: crate::resources::ResourceKey, day: u64);
}

pub fn validate(rules: BaneRules) {
    assert!(rules.chance_step > 0 && rules.chance_step <= 100, "invalid world bane chance");
    assert!(rules.quorum_percent > 0 && rules.quorum_percent <= 100, "invalid bane quorum");
    assert!(rules.beast_percent >= 100, "world bane weakens beasts");
    assert!(rules.stamina_percent > 0 && rules.stamina_percent <= 100, "invalid bane stamina rate");
    assert!(rules.production_percent > 0 && rules.production_percent <= 100, "invalid bane production rate");
    assert!(rules.quest_counts.len() == 12, "bane quests need all four Realm levels");
    for count in rules.quest_counts {
        assert!(*count > 0, "empty bane quest");
    }
    for index in 8_u32..12 {
        let _ = *rules.quest_counts.at(index) * crate::rules::RESOURCE_PRECISION;
    }
}

pub fn world_kind(seed: felt252, day: u64, first_team_day: Option<u64>, chance_step: u16) -> Option<u8> {
    if day == 0 {
        return None;
    }
    if let Some(issued) = first_team_day {
        if day > issued {
            return None;
        }
    }
    let mut chance = chance_step;
    let mut kind = None;
    for index in 1..day + 1 {
        let root: u256 = poseidon_hash_span(array![seed, 'world-bane', index.into()].span()).into();
        kind =
            if crate::random::range(root, 0, 100) < chance.into() {
                Some((crate::random::range(root, 1, 3) + 1).try_into().unwrap())
            } else {
                None
            };
        chance = if kind.is_some() {
            0
        } else {
            core::cmp::min(100, chance + chance_step)
        };
    }
    kind
}

pub fn required(active: u32, percent: u16) -> u32 {
    ((Into::<u32, u64>::into(active) * Into::<u16, u64>::into(percent) + 99) / 100).try_into().unwrap()
}

pub fn quest_kind(kind: u8) -> u8 {
    if kind == BLOOD_MOON {
        crate::quests::STAND
    } else if kind == MIST_TIDE {
        crate::quests::LIGHTS
    } else if kind == ASH_FALL {
        crate::quests::CULL
    } else {
        panic!("invalid world bane")
    }
}
