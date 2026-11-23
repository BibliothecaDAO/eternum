pub const BLOOD_MOON: u8 = 1;
pub const MIST_TIDE: u8 = 2;
pub const ASH_FALL: u8 = 3;

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

#[derive(Copy, Drop, Serde, Debug)]
pub struct BaneEffects {
    pub windows: Span<BaneWindow>,
    pub beast_percent: u16,
    pub stamina_percent: u16,
    pub production_percent: u16,
}

#[starknet::interface]
pub trait IBaneEffects<T> {
    fn bane_effects(self: @T, home: crate::resources::ResourceKey, from: u64, until: u64) -> BaneEffects;
}

pub fn required(active: u32, percent: u16) -> u32 {
    ((Into::<u32, u64>::into(active) * Into::<u16, u64>::into(percent) + 99) / 100).try_into().unwrap()
}

pub fn quest_kind(kind: u8) -> u8 {
    if kind == BLOOD_MOON {
        BLOOD_MOON_QUEST
    } else if kind == MIST_TIDE {
        MIST_TIDE_QUEST
    } else if kind == ASH_FALL {
        ASH_FALL_QUEST
    } else {
        panic!("invalid world bane")
    }
}

pub const BLOOD_MOON_QUEST: u8 = crate::quests::STAND;

pub const MIST_TIDE_QUEST: u8 = crate::quests::LIGHTS;

pub const ASH_FALL_QUEST: u8 = crate::quests::CULL;

#[starknet::interface]
pub trait IWorldBanes<T> {
    fn initialize_bane_calendar(ref self: T, game_id: u32);
    fn prepare_bane_day(ref self: T, game_id: u32, context: crate::commands::ActionContext);
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WorldBane {
    pub kind: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FirstTeamBane {
    pub issued_day: u64,
}
