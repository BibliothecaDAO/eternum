use core::num::traits::zero::Zero;
use crate::alias::ID;
use crate::models::position::Coord;

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct BiomeDiscovered {
    #[key]
    pub by_address: starknet::ContractAddress,
    #[key]
    pub biome: u8,
    pub discovered: bool,
}


#[derive(Copy, Drop, Serde)]
pub struct Tile {
    pub alt: bool,
    pub col: u32,
    pub row: u32,
    pub biome: u8,
    pub occupier_id: ID,
    pub occupier_type: u8,
    pub occupier_is_structure: bool,
    pub reward_extracted: bool,
}

pub impl TileIntoCoord of Into<Tile, Coord> {
    fn into(self: Tile) -> Coord {
        Coord { alt: self.alt, x: self.col, y: self.row }
    }
}

#[generate_trait]
pub impl TileImpl of TileTrait {
    fn keys_only(coord: Coord) -> Tile {
        Tile { 
            alt: coord.alt,
            col: coord.x, 
            row: coord.y, 
            biome: 0, 
            occupier_id: 0, 
            occupier_type: 0, 
            occupier_is_structure: false,
            reward_extracted: false
        }
    }

    fn discovered(self: Tile) -> bool {
        self.biome != 0
    }

    fn not_discovered(self: Tile) -> bool {
        self.biome == 0
    }

    fn occupied(self: Tile) -> bool {
        self.occupier_type.is_non_zero()
    }

    fn not_occupied(self: Tile) -> bool {
        !self.occupied()
    }
}

#[derive(Copy, Drop, Serde, PartialEq)]
pub enum TileOccupier {
    None,
    //
    RealmRegularLevel1,
    RealmRegularLevel2,
    RealmRegularLevel3,
    RealmRegularLevel4,
    //
    RealmWonderLevel1,
    RealmWonderLevel2,
    RealmWonderLevel3,
    RealmWonderLevel4,
    //
    HyperstructureLevel1,
    HyperstructureLevel2,
    HyperstructureLevel3,
    //
    FragmentMine,
    Village,
    Bank,
    //
    ExplorerKnightT1Regular,
    ExplorerKnightT2Regular,
    ExplorerKnightT3Regular,
    ExplorerPaladinT1Regular,
    ExplorerPaladinT2Regular,
    ExplorerPaladinT3Regular,
    ExplorerCrossbowmanT1Regular,
    ExplorerCrossbowmanT2Regular,
    ExplorerCrossbowmanT3Regular,
    //
    ExplorerKnightT1Daydreams,
    ExplorerKnightT2Daydreams,
    ExplorerKnightT3Daydreams,
    ExplorerPaladinT1Daydreams,
    ExplorerPaladinT2Daydreams,
    ExplorerPaladinT3Daydreams,
    ExplorerCrossbowmanT1Daydreams,
    ExplorerCrossbowmanT2Daydreams,
    ExplorerCrossbowmanT3Daydreams,
    //
    Quest,
    Chest,
    Spire
}

pub impl TileOccupierIntoU8 of Into<TileOccupier, u8> {
    fn into(self: TileOccupier) -> u8 {
        match self {
            TileOccupier::None => 0,
            //
            TileOccupier::RealmRegularLevel1 => 1,
            TileOccupier::RealmRegularLevel2 => 2,
            TileOccupier::RealmRegularLevel3 => 3,
            TileOccupier::RealmRegularLevel4 => 4,
            //
            TileOccupier::RealmWonderLevel1 => 5,
            TileOccupier::RealmWonderLevel2 => 6,
            TileOccupier::RealmWonderLevel3 => 7,
            TileOccupier::RealmWonderLevel4 => 8,
            //
            TileOccupier::HyperstructureLevel1 => 9,
            TileOccupier::HyperstructureLevel2 => 10,
            TileOccupier::HyperstructureLevel3 => 11,
            //
            TileOccupier::FragmentMine => 12,
            TileOccupier::Village => 13,
            TileOccupier::Bank => 14,
            //
            TileOccupier::ExplorerKnightT1Regular => 15,
            TileOccupier::ExplorerKnightT2Regular => 16,
            TileOccupier::ExplorerKnightT3Regular => 17,
            TileOccupier::ExplorerPaladinT1Regular => 18,
            TileOccupier::ExplorerPaladinT2Regular => 19,
            TileOccupier::ExplorerPaladinT3Regular => 20,
            TileOccupier::ExplorerCrossbowmanT1Regular => 21,
            TileOccupier::ExplorerCrossbowmanT2Regular => 22,
            TileOccupier::ExplorerCrossbowmanT3Regular => 23,
            //
            TileOccupier::ExplorerKnightT1Daydreams => 24,
            TileOccupier::ExplorerKnightT2Daydreams => 25,
            TileOccupier::ExplorerKnightT3Daydreams => 26,
            TileOccupier::ExplorerPaladinT1Daydreams => 27,
            TileOccupier::ExplorerPaladinT2Daydreams => 28,
            TileOccupier::ExplorerPaladinT3Daydreams => 29,
            TileOccupier::ExplorerCrossbowmanT1Daydreams => 30,
            TileOccupier::ExplorerCrossbowmanT2Daydreams => 31,
            TileOccupier::ExplorerCrossbowmanT3Daydreams => 32,
            //
            TileOccupier::Quest => 33,
            TileOccupier::Chest => 34,
            TileOccupier::Spire => 35,
        }
    }
}
