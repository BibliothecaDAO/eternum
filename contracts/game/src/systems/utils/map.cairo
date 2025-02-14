use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::models::map::{Biome, Tile};

#[generate_trait]
pub impl iMapImpl of iMapTrait {
    fn explore(ref world: WorldStorage, ref tile: Tile, biome: Biome) {
        tile.biome = biome;
        world.write_model(@tile);
        // todo add event
    }
}

