use crate::troops::Coord;
// TileOpt preserves the original packed wire layout.
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


#[starknet::interface]
pub trait IMapLogic<T> {
    fn biome(self: @T, key: TileKey) -> u8;
    fn discovery(
        self: @T, key: TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
    ) -> crate::discovery::Discovery;
    fn reveal_structure_surroundings(ref self: T, game_id: u32, coord: Coord);
    /// The tile a command moves onto. A home-ring tile that storage has not revealed yet is revealed first, so it is
    /// written as explored before the command occupies it.
    fn reveal_destination_tile(ref self: T, key: TileKey) -> Option<TileOpt>;
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
