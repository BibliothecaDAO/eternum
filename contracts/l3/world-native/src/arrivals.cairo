use crate::resources::ResourceAmount;

pub const SLOTS_PER_DAY: u8 = 48;
pub(crate) const INDEX_SCALE: u64 = 0x100000000;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArrivalKey {
    pub game_id: u32,
    pub entity_id: u32,
    pub day: u64,
    pub slot: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Arrival {
    pub resources: Span<ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct OffloadArrival {
    pub entity_id: u32,
    pub day: u64,
    pub slot: u8,
    pub resource_count: u8,
}

pub fn has_arrived(key: ArrivalKey, interval: u64, timestamp: u64) -> bool {
    assert!(key.slot > 0 && key.slot <= SLOTS_PER_DAY, "invalid arrival slot");
    let tick = timestamp / interval;
    let previous = tick - 1;
    let day = previous / SLOTS_PER_DAY.into();
    let slot: u8 = (previous % SLOTS_PER_DAY.into() + 1).try_into().unwrap();
    key.day < day || (key.day == day && key.slot <= slot)
}

pub fn arrival_key(game_id: u32, entity_id: u32, interval: u64, timestamp: u64, travel_time: u64) -> ArrivalKey {
    let tick = (timestamp + travel_time) / interval;
    ArrivalKey {
        game_id,
        entity_id,
        day: tick / SLOTS_PER_DAY.into(),
        slot: (tick % SLOTS_PER_DAY.into() + 1).try_into().unwrap(),
    }
}
