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
        self.occupier_type != 0 && self.occupier_id != 0
    }

    fn not_occupied(self: Tile) -> bool {
        self.occupier_type == 0 || self.occupier_id == 0
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
    ExplorerKnightT1,
    ExplorerKnightT2,
    ExplorerKnightT3,
    ExplorerPaladinT1,
    ExplorerPaladinT2,
    ExplorerPaladinT3,
    ExplorerCrossbowmanT1,
    ExplorerCrossbowmanT2,
    ExplorerCrossbowmanT3,
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
            TileOccupier::ExplorerKnightT1 => 7,
            TileOccupier::ExplorerKnightT2 => 8,
            TileOccupier::ExplorerKnightT3 => 9,
            TileOccupier::ExplorerPaladinT1 => 10,
            TileOccupier::ExplorerPaladinT2 => 11,
            TileOccupier::ExplorerPaladinT3 => 12,
            TileOccupier::ExplorerCrossbowmanT1 => 13,
            TileOccupier::ExplorerCrossbowmanT2 => 14,
            TileOccupier::ExplorerCrossbowmanT3 => 15,
            TileOccupier::RealmRegularLevel2 => 16,
            TileOccupier::RealmRegularLevel3 => 17,
            TileOccupier::RealmRegularLevel4 => 18,
            TileOccupier::RealmWonderLevel2 => 19,
            TileOccupier::RealmWonderLevel3 => 20,
            TileOccupier::RealmWonderLevel4 => 21,
            TileOccupier::HyperstructureLevel2 => 22,
            TileOccupier::HyperstructureLevel3 => 23,
        }
    }
}
