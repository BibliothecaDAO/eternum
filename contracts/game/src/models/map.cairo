use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use s1_eternum::utils::map::biomes::Biome;

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct Tile {
    #[key]
    col: u32,
    #[key]
    row: u32,
    biome: Biome,
}

impl TileIntoCoord of Into<Tile, Coord> {
    fn into(self: Tile) -> Coord {
        Coord { x: self.col, y: self.row }
    }
}

#[generate_trait]
impl TileImpl of TileTrait {
    fn discovered(self: Tile) -> bool {
        self.biome != Biome::None
    }
}
