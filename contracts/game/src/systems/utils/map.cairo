use dojo::world::WorldStorage;
use dojo::model::ModelStorage;
use s1_eternum::models::map::{Tile, Biome};

#[generate_trait]
pub impl iMapImpl of iMapTrait {
    fn explore(ref world: WorldStorage, ref tile: Tile, biome: Biome) {
        tile.explored_at = starknet::get_block_timestamp();
        tile.biome = biome;
        world.write_model(@tile);
        // todo add event
    }
}
             