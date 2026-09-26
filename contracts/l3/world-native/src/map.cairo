use crate::troops::Coord;
pub const CHEST_OCCUPIER: u8 = 34;
pub const SPIRE_OCCUPIER: u8 = 35;
pub const SHRINE_OCCUPIER: u8 = 40;
pub const WELL_OCCUPIER: u8 = 41;
// Tile views assemble the original packed layout from terrain and occupancy facts.
pub(crate) const REWARD_EXTRACTED_FLAG: u128 = 0x20000000000000000000000000000;
const LAYER_FLAG: u128 = 0x80000000000000000000000000000000;
const COL_SCALE: u128 = 0x200000000000000000000;
const ROW_SCALE: u128 = 0x2000000000000;
pub(crate) const BIOME_SCALE: u128 = 0x20000000000;
pub(crate) const ENTITY_RANGE: u128 = 0x100000000;
pub(crate) const OCCUPIER_SCALE: u128 = 0x200;
pub(crate) const RESERVED_HYPERSTRUCTURE: u128 = 39;
pub(crate) const BYTE_RANGE: u128 = 0x100;

#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct TileKey {
    pub game_id: u32,
    pub alt: bool,
    pub col: u32,
    pub row: u32,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct TileOpt {
    pub data: u128,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct TileOccupancy {
    pub entity_id: u32,
    pub category: u8,
    pub is_structure: bool,
}

pub(crate) fn occupancy_bits(occupancy: TileOccupancy) -> u128 {
    occupancy.entity_id.into() * OCCUPIER_SCALE
        + occupancy.category.into() * 2
        + if occupancy.is_structure {
            1
        } else {
            0
        }
}

pub(crate) fn occupancy_from_bits(data: u64) -> Option<TileOccupancy> {
    if data == 0 {
        return None;
    }
    let data: u128 = data.into();
    Some(
        TileOccupancy {
            entity_id: (data / OCCUPIER_SCALE).try_into().unwrap(),
            category: (data / 2 % BYTE_RANGE).try_into().unwrap(),
            is_structure: data % 2 == 1,
        },
    )
}


#[starknet::interface]
pub trait IMapLogic<T> {
    fn biome(self: @T, key: TileKey, game_context: crate::commands::BiomeContext) -> u8;
    fn discovery(
        self: @T,
        key: TileKey,
        seed: u256,
        hyperstructures: u32,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    ) -> crate::discovery::Discovery;
    fn reveal_structure_surroundings(
        ref self: T, game_id: u32, coord: Coord, game_context: crate::commands::BiomeContext,
    );
    /// The tile a command moves onto. A home-ring tile that storage has not revealed yet is revealed first, so it is
    /// written as explored before the command occupies it.
    fn reveal_destination_tile(
        ref self: T, key: TileKey, game_context: crate::commands::BiomeContext,
    ) -> Option<TileOpt>;
    /// A realm's home ring for the day at `timestamp`: its site and six neighbours, each with its biome.
    fn expedition_home_ring(self: @T, game_id: u32, realm_id: u16, timestamp: u64) -> Span<(Coord, u8)>;
}

pub(crate) fn coordinate_bits(key: TileKey) -> u128 {
    (if key.alt {
        LAYER_FLAG
    } else {
        0
    }) + key.col.into() * COL_SCALE + key.row.into() * ROW_SCALE
}

pub fn structure_occupant(tile: TileOpt) -> Option<u32> {
    if tile.data % 2 == 1 {
        Some(((tile.data / OCCUPIER_SCALE) % ENTITY_RANGE).try_into().unwrap())
    } else {
        None
    }
}
