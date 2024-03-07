use eternum::utils::map::biomes::Biome;
use eternum::models::position::Coord;

#[derive(Model, Copy, Drop, Serde)]
struct Tile {
    #[key]
    _col: u128,
    #[key]
    _row: u128,
    col: u128,
    row: u128,
    explored_by_id: u128,
    explored_at: u64,
    biome: Biome,
}

impl TileIntoCoord of Into<Tile, Coord>{
    fn into(self: Tile) -> Coord {
        Coord {x: self.col, y: self.row}
    }
}