use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::models::map::Tile;
use s1_eternum::utils::map::biomes::Biome;
#[generate_trait]
pub impl iMapImpl of iMapTrait {
    fn explore(ref world: WorldStorage, ref tile: Tile, biome: Biome) {
        tile.biome = biome;
        world.write_model(@tile);
        // todo add event {if not already explored}
    }
}

