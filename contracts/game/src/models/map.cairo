use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use s1_eternum::utils::map::biomes::Biome;

#[derive(Copy, Drop, Serde, IntrospectPacked)]
#[dojo::model]
pub struct Tile {
    #[key]
    col: u32,
    #[key]
    row: u32,
    explored_at: u64,
    biome: Biome,
}

impl TileIntoCoord of Into<Tile, Coord> {
    fn into(self: Tile) -> Coord {
        Coord { x: self.col, y: self.row }
    }
}
