use crate::troops::Coord;
// Terrain views carry coordinates and biome; occupants have their own canonical fact.
pub const REWARD_EXTRACTED_FLAG: u128 = 0x20000000000000000000000000000;
const LAYER_FLAG: u128 = 0x80000000000000000000000000000000;
const COL_SCALE: u128 = 0x200000000000000000000;
const ROW_SCALE: u128 = 0x2000000000000;
pub const BIOME_SCALE: u128 = 0x20000000000;
pub const OCCUPIER_SCALE: u128 = 0x200;
pub const BYTE_RANGE: u128 = 0x100;

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
    pub entity_id: u64,
    pub category: u8,
    pub is_structure: bool,
}

pub fn occupancy_bits(occupancy: TileOccupancy) -> u128 {
    occupancy.entity_id.into() * OCCUPIER_SCALE
        + occupancy.category.into() * 2
        + if occupancy.is_structure {
            1
        } else {
            0
        }
}

pub fn occupancy_from_bits(data: u128) -> Option<TileOccupancy> {
    if data == 0 {
        return None;
    }
    Some(
        TileOccupancy {
            entity_id: (data / OCCUPIER_SCALE).try_into().unwrap(),
            category: (data / 2 % BYTE_RANGE).try_into().unwrap(),
            is_structure: data % 2 == 1,
        },
    )
}

// Zero is absent; adding one preserves both layers and every u32 coordinate, including the origin.
pub fn position_bits(coord: Coord) -> u128 {
    coord.x.into() * 2 + coord.y.into() * 0x200000000 + if coord.alt {
        2
    } else {
        1
    }
}

pub fn position_from_bits(data: u128) -> Option<Coord> {
    if data == 0 {
        return None;
    }
    let bits = data - 1;
    Some(
        Coord {
            alt: bits % 2 == 1,
            x: (bits / 2 % 0x100000000).try_into().unwrap(),
            y: (bits / 0x200000000).try_into().unwrap(),
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
    fn expedition_home_ring(self: @T, game_id: u32, region_id: u32, timestamp: u64) -> Span<(Coord, u8)>;
}

pub fn coordinate_bits(key: TileKey) -> u128 {
    (if key.alt {
        LAYER_FLAG
    } else {
        0
    }) + key.col.into() * COL_SCALE + key.row.into() * ROW_SCALE
}

pub fn structure_occupant(key: TileKey) -> Option<u64> {
    match crate::logic::map::occupancy(key) {
        Some(occupancy) => if occupancy.is_structure {
            Some(occupancy.entity_id)
        } else {
            None
        },
        None => None,
    }
}
