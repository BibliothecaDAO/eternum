use core::num::traits::zero::Zero;
use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct Tile {
    #[key]
    pub col: u32,
    #[key]
    pub row: u32,
    pub biome: u8,
    pub occupier_id: ID,
    pub occupier_type: u8,
    pub occupier_is_structure: bool,
}

pub impl TileIntoCoord of Into<Tile, Coord> {
    fn into(self: Tile) -> Coord {
        Coord { x: self.col, y: self.row }
    }
}

#[generate_trait]
pub impl TileImpl of TileTrait {
    fn keys_only(coord: Coord) -> Tile {
        Tile { col: coord.x, row: coord.y, biome: 0, occupier_id: 0, occupier_type: 0, occupier_is_structure: false }
    }

    fn discovered(self: Tile) -> bool {
        self.biome != 0
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
    RealmRegularLevel1,
    RealmWonderLevel1,
    HyperstructureLevel1,
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
    RealmRegularLevel2,
    RealmRegularLevel3,
    RealmRegularLevel4,
    //
    RealmWonderLevel2,
    RealmWonderLevel3,
    RealmWonderLevel4,
    //
    HyperstructureLevel2,
    HyperstructureLevel3,
    //
    RealmRegularLevel1WonderBonus,
    RealmRegularLevel2WonderBonus,
    RealmRegularLevel3WonderBonus,
    RealmRegularLevel4WonderBonus,
    //
    VillageWonderBonus,
}

pub impl TileOccupierIntoU8 of Into<TileOccupier, u8> {
    fn into(self: TileOccupier) -> u8 {
        match self {
            TileOccupier::None => 0,
            TileOccupier::RealmRegularLevel1 => 1,
            TileOccupier::RealmWonderLevel1 => 2,
            TileOccupier::HyperstructureLevel1 => 3,
            TileOccupier::FragmentMine => 4,
            TileOccupier::Village => 5,
            TileOccupier::Bank => 6,
            TileOccupier::ExplorerKnightT1Regular => 7,
            TileOccupier::ExplorerKnightT2Regular => 8,
            TileOccupier::ExplorerKnightT3Regular => 9,
            TileOccupier::ExplorerPaladinT1Regular => 10,
            TileOccupier::ExplorerPaladinT2Regular => 11,
            TileOccupier::ExplorerPaladinT3Regular => 12,
            TileOccupier::ExplorerCrossbowmanT1Regular => 13,
            TileOccupier::ExplorerCrossbowmanT2Regular => 14,
            TileOccupier::ExplorerCrossbowmanT3Regular => 15,
            TileOccupier::ExplorerKnightT1Daydreams => 16,
            TileOccupier::ExplorerKnightT2Daydreams => 17,
            TileOccupier::ExplorerKnightT3Daydreams => 18,
            TileOccupier::ExplorerPaladinT1Daydreams => 19,
            TileOccupier::ExplorerPaladinT2Daydreams => 20,
            TileOccupier::ExplorerPaladinT3Daydreams => 21,
            TileOccupier::ExplorerCrossbowmanT1Daydreams => 22,
            TileOccupier::ExplorerCrossbowmanT2Daydreams => 23,
            TileOccupier::ExplorerCrossbowmanT3Daydreams => 24,
            TileOccupier::RealmRegularLevel2 => 25,
            TileOccupier::RealmRegularLevel3 => 26,
            TileOccupier::RealmRegularLevel4 => 27,
            TileOccupier::RealmWonderLevel2 => 28,
            TileOccupier::RealmWonderLevel3 => 29,
            TileOccupier::RealmWonderLevel4 => 30,
            TileOccupier::HyperstructureLevel2 => 31,
            TileOccupier::HyperstructureLevel3 => 32,
            TileOccupier::RealmRegularLevel1WonderBonus => 33,
            TileOccupier::RealmRegularLevel2WonderBonus => 34,
            TileOccupier::RealmRegularLevel3WonderBonus => 35,
            TileOccupier::RealmRegularLevel4WonderBonus => 36,
            TileOccupier::VillageWonderBonus => 37,
        }
    }
}
