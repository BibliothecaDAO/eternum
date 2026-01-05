//! Packed Tile model with a deterministic u128 layout for fast storage and access.
//! This module defines the exact bit ranges for each field so the storage format
//! is stable across contracts and clients. Bits are allocated from least to most
//! significant in fixed-width slices, then the MSB is reserved for `alt`.
//! `reward_extracted` is placed immediately after the `col` slice to ensure new
//! flags expand upward without disturbing lower legacy fields.
//! Field sizes: `occupier_is_structure` (u1), `occupier_type` (u8), `occupier_id` (u32),
//! `biome` (u8), `row` (u32), `col` (u32), `reward_extracted` (u1), `alt` (1 at bit 127).
//! `alt` is intentionally stored at the most significant bit so queries can use
//! a simple `>` comparison on the packed value to distinguish regular vs alt maps
//! without unpacking other fields.
//! Use the helpers below to pack/unpack fields; do not hand-roll shifts or masks
//! to avoid mismatched layouts.

use alexandria_math::BitShift;
use crate::alias::ID;
use crate::models::map::Tile;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct TileOpt {
    #[key]
    pub alt: bool,
    #[key]
    pub col: u32,
    #[key]
    pub row: u32,
    pub data: u128,
}

////////////////////////////////////////////////////////////////////////////////////
// Tile Data Packing Layout and Bit Manipulation Helpers
// Layout (LSB -> MSB): occupier_is_structure, occupier_type, occupier_id, biome, row, col, reward_extracted, ... , alt (bit 127).
const OCCUPIER_IS_STRUCTURE_SHIFT: u8 = 0; // bit 0 [LSB]
const OCCUPIER_IS_STRUCTURE_MASK: u128 = 0x1; // 1 bit

const OCCUPIER_TYPE_SHIFT: u8 = 1; // bits 1..8
const OCCUPIER_TYPE_MASK: u128 = 0xFF; // 8 bits

const OCCUPIER_ID_SHIFT: u8 = 9; // bits 9..40
const OCCUPIER_ID_MASK: u128 = 0xFFFF_FFFF; // 32 bits

const BIOME_SHIFT: u8 = 41; // bits 41..48
const BIOME_MASK: u128 = 0xFF; // 8 bits

const ROW_SHIFT: u8 = 49; // bits 49..80
const ROW_MASK: u128 = 0xFFFF_FFFF; // 32 bits

const COL_SHIFT: u8 = 81; // bits 81..112
const COL_MASK: u128 = 0xFFFF_FFFF; // 32 bits

const REWARD_EXTRACTED_SHIFT: u8 = 113; // bit 113
const REWARD_EXTRACTED_MASK: u128 = 0x1; // 1 bit

const ALT_SHIFT: u8 = 127; // bit 127 [MSB]
const ALT_MASK: u128 = 0x1; // 1 bit
////////////////////////////////////////////////////////////////////////////////////


#[generate_trait]
pub impl TileOptDataWriteImpl of TileOptDataWriteTrait {
    fn with_alt(data: u128, alt: bool) -> u128 {
        let value: u128 = if alt { 1 } else { 0 };
        Self::_set_field(data, value, ALT_SHIFT, ALT_MASK)
    }

    fn with_col(data: u128, col: u32) -> u128 {
        Self::_set_field(data, col.into(), COL_SHIFT, COL_MASK)
    }

    fn with_row(data: u128, row: u32) -> u128 {
        Self::_set_field(data, row.into(), ROW_SHIFT, ROW_MASK)
    }

    fn with_biome(data: u128, biome: u8) -> u128 {
        Self::_set_field(data, biome.into(), BIOME_SHIFT, BIOME_MASK)
    }

    fn with_occupier_id(data: u128, occupier_id: ID) -> u128 {
        Self::_set_field(data, occupier_id.into(), OCCUPIER_ID_SHIFT, OCCUPIER_ID_MASK)
    }

    fn with_occupier_type(data: u128, occupier_type: u8) -> u128 {
        Self::_set_field(data, occupier_type.into(), OCCUPIER_TYPE_SHIFT, OCCUPIER_TYPE_MASK)
    }

    fn with_occupier_is_structure(data: u128, occupier_is_structure: bool) -> u128 {
        let value: u128 = if occupier_is_structure { 1 } else { 0 };
        Self::_set_field(data, value, OCCUPIER_IS_STRUCTURE_SHIFT, OCCUPIER_IS_STRUCTURE_MASK)
    }

    fn with_reward_extracted(data: u128, reward_extracted: bool) -> u128 {
        let value: u128 = if reward_extracted { 1 } else { 0 };
        Self::_set_field(data, value, REWARD_EXTRACTED_SHIFT, REWARD_EXTRACTED_MASK)
    }

    fn _set_field(data: u128, value: u128, shift: u8, mask: u128) -> u128 {
        let shifted_mask = BitShift::shl(mask, shift.into());
        let cleared = data & ~shifted_mask;
        let shifted_value = BitShift::shl(value & mask, shift.into());
        cleared | shifted_value
    }
}

#[generate_trait]
pub impl TileOptDataReadImpl of TileOptDataReadTrait {
    fn alt(data: u128) -> bool {
        let value = Self::_get_field(data, ALT_SHIFT, ALT_MASK);
        value != 0
    }

    fn col(data: u128) -> u32 {
        Self::_get_field(data, COL_SHIFT, COL_MASK).try_into().unwrap()
    }

    fn row(data: u128) -> u32 {
        Self::_get_field(data, ROW_SHIFT, ROW_MASK).try_into().unwrap()
    }

    fn biome(data: u128) -> u8 {
        Self::_get_field(data, BIOME_SHIFT, BIOME_MASK).try_into().unwrap()
    }

    fn occupier_id(data: u128) -> ID {
        Self::_get_field(data, OCCUPIER_ID_SHIFT, OCCUPIER_ID_MASK).try_into().unwrap()
    }

    fn occupier_type(data: u128) -> u8 {
        Self::_get_field(data, OCCUPIER_TYPE_SHIFT, OCCUPIER_TYPE_MASK).try_into().unwrap()
    }

    fn occupier_is_structure(data: u128) -> bool {
        let value = Self::_get_field(data, OCCUPIER_IS_STRUCTURE_SHIFT, OCCUPIER_IS_STRUCTURE_MASK);
        value != 0
    }

    fn reward_extracted(data: u128) -> bool {
        let value = Self::_get_field(data, REWARD_EXTRACTED_SHIFT, REWARD_EXTRACTED_MASK);
        value != 0
    }

    fn _get_field(data: u128, shift: u8, mask: u128) -> u128 {
        BitShift::shr(data, shift.into()) & mask
    }
}

#[generate_trait]
pub impl TileOptDataPackImpl of TileOptDataPackTrait {
    fn pack(
        alt: bool,
        col: u32,
        row: u32,
        biome: u8,
        occupier_id: ID,
        occupier_type: u8,
        occupier_is_structure: bool,
        reward_extracted: bool,
    ) -> u128 {
        let mut data: u128 = 0;
        data = TileOptDataWriteTrait::with_occupier_is_structure(data, occupier_is_structure);
        data = TileOptDataWriteTrait::with_occupier_type(data, occupier_type);
        data = TileOptDataWriteTrait::with_occupier_id(data, occupier_id);
        data = TileOptDataWriteTrait::with_biome(data, biome);
        data = TileOptDataWriteTrait::with_row(data, row);
        data = TileOptDataWriteTrait::with_col(data, col);
        data = TileOptDataWriteTrait::with_reward_extracted(data, reward_extracted);
        data = TileOptDataWriteTrait::with_alt(data, alt);
        data
    }
}

pub impl TileIntoTileOpt of Into<Tile, TileOpt> {
    fn into(self: Tile) -> TileOpt {
        let data = TileOptDataPackTrait::pack(
            self.alt,
            self.col,
            self.row,
            self.biome,
            self.occupier_id,
            self.occupier_type,
            self.occupier_is_structure,
            self.reward_extracted,
        );
        TileOpt { alt: self.alt, col: self.col, row: self.row, data }
    }
}

pub impl TileOptIntoTile of Into<TileOpt, Tile> {
    fn into(self: TileOpt) -> Tile {
        let col = TileOptDataReadTrait::col(self.data);
        let row = TileOptDataReadTrait::row(self.data);
        let biome = TileOptDataReadTrait::biome(self.data);
        let occupier_id = TileOptDataReadTrait::occupier_id(self.data);
        let occupier_type = TileOptDataReadTrait::occupier_type(self.data);
        let occupier_is_structure = TileOptDataReadTrait::occupier_is_structure(self.data);
        let reward_extracted = TileOptDataReadTrait::reward_extracted(self.data);
        let alt = TileOptDataReadTrait::alt(self.data);

        Tile {
            alt,
            col,
            row,
            biome,
            occupier_id,
            occupier_type,
            occupier_is_structure,
            reward_extracted
        }
    }
}
