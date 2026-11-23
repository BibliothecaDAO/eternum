pub const SEASON: u8 = 0;
pub const MAP: u8 = 1;
pub const PLACEMENT: u8 = 2;
pub const CONSTRUCTION: u8 = 3;
pub const PRODUCTION: u8 = 4;
pub const STRUCTURES: u8 = 5;
pub const TROOPS: u8 = 6;
pub const SETTLEMENT: u8 = 7;
pub const RESOURCES: u8 = 8;
pub const ECONOMY: u8 = 9;
pub const PRIZES: u8 = 10;
pub const REGISTRY: u8 = 11;
pub const COMBAT: u8 = 12;
pub const BRIDGE: u8 = 13;
pub const RELICS: u8 = 14;
pub const MOVEMENT: u8 = 15;
pub const FRONTIER_SLOTS: u8 = 16;

pub const GAMEPLAY: u8 = SEASON;
pub const INGRESS: u8 = PLACEMENT;

pub fn required_slots(family: u8) -> u8 {
    assert!(family == crate::game::FRONTIER || family == crate::game::BLITZ, "unknown family");
    FRONTIER_SLOTS
}
