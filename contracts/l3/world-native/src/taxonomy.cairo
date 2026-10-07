// The one definition of every structure category and tile occupier id. Stored rows hold these numbers, so a value
// never changes once a game has written it; every other file and layer reads these names.

pub const REALM_CATEGORY: u8 = 1;
pub const HYPERSTRUCTURE_CATEGORY: u8 = 2;
pub const BANK_CATEGORY: u8 = 3;
pub const MINE_CATEGORY: u8 = 4;
pub const VILLAGE_CATEGORY: u8 = 5;
pub const CAMP_CATEGORY: u8 = 7;
pub const BITCOIN_MINE_CATEGORY: u8 = 8;

pub const NONE_OCCUPIER: u8 = 0;
// A realm's occupier is its first one plus its level, so each run of four follows the realm levels.
pub const REALM_REGULAR_LEVEL_1_OCCUPIER: u8 = 1;
pub const REALM_REGULAR_LEVEL_2_OCCUPIER: u8 = 2;
pub const REALM_REGULAR_LEVEL_3_OCCUPIER: u8 = 3;
pub const REALM_REGULAR_LEVEL_4_OCCUPIER: u8 = 4;
pub const REALM_WONDER_LEVEL_1_OCCUPIER: u8 = 5;
pub const REALM_WONDER_LEVEL_2_OCCUPIER: u8 = 6;
pub const REALM_WONDER_LEVEL_3_OCCUPIER: u8 = 7;
pub const REALM_WONDER_LEVEL_4_OCCUPIER: u8 = 8;
pub const HYPERSTRUCTURE_OCCUPIER: u8 = 9;
pub const MINE_OCCUPIER: u8 = 12;
pub const VILLAGE_OCCUPIER: u8 = 13;
pub const BANK_OCCUPIER: u8 = 14;
// An army's occupier is its troop type's first one plus its tier.
pub const EXPLORER_KNIGHT_T1_OCCUPIER: u8 = 15;
pub const EXPLORER_KNIGHT_T2_OCCUPIER: u8 = 16;
pub const EXPLORER_KNIGHT_T3_OCCUPIER: u8 = 17;
pub const EXPLORER_PALADIN_T1_OCCUPIER: u8 = 18;
pub const EXPLORER_PALADIN_T2_OCCUPIER: u8 = 19;
pub const EXPLORER_PALADIN_T3_OCCUPIER: u8 = 20;
pub const EXPLORER_CROSSBOWMAN_T1_OCCUPIER: u8 = 21;
pub const EXPLORER_CROSSBOWMAN_T2_OCCUPIER: u8 = 22;
pub const EXPLORER_CROSSBOWMAN_T3_OCCUPIER: u8 = 23;
pub const CHEST_OCCUPIER: u8 = 34;
pub const SPIRE_OCCUPIER: u8 = 35;
pub const CAMP_OCCUPIER: u8 = 37;
pub const BITCOIN_MINE_OCCUPIER: u8 = 38;
pub const RESERVED_HYPERSTRUCTURE_OCCUPIER: u8 = 39;
pub const SHRINE_OCCUPIER: u8 = 40;
pub const WELL_OCCUPIER: u8 = 41;
