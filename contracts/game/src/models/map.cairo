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
        Tile { 
            col: coord.x, 
            row: coord.y, 
            biome: 0, 
            occupier_id: 0, 
            occupier_type: 0,
            occupier_is_structure: false,
        }
    }

    fn discovered(self: Tile) -> bool {
        self.biome != 0
    }

    #[inline(always)]
    fn occupied(self: Tile) -> bool {
        self.occupier_type != 0 && self.occupier_id != 0
    }

    #[inline(always)]
    fn not_occupied(self: Tile) -> bool {
        self.occupier_type == 0 || self.occupier_id == 0
    }
}

#[derive(Copy, Drop, Serde, PartialEq)]
pub enum TileOccupier {
    None,
    RealmRegular,
    RealmWonder,
    Hyperstructure,
    FragmentMine,
    Village,
    Bank,
    Explorer,
}

pub impl TileOccupierIntoU8 of Into<TileOccupier, u8> {
    fn into(self: TileOccupier) -> u8 {
        match self {
            TileOccupier::None => 0,
            TileOccupier::RealmRegular => 1,
            TileOccupier::RealmWonder => 2,
            TileOccupier::Hyperstructure => 3,
            TileOccupier::FragmentMine => 4,
            TileOccupier::Village => 5,
            TileOccupier::Bank => 6,
            TileOccupier::Explorer => 7,
        }
    }
}
