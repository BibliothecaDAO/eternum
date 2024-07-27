use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::utils::map::biomes::Biome;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Tile {
    #[key]
    col: u32,
    #[key]
    row: u32,
    explored_by_id: ID,
    explored_at: u64,
    biome: Biome,
}

impl TileIntoCoord of Into<Tile, Coord> {
    fn into(self: Tile) -> Coord {
        Coord { x: self.col, y: self.row }
    }
}
