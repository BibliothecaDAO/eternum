use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::models::map::{Tile, TileOccupier};
use s1_eternum::utils::map::biomes::Biome;

#[generate_trait]
pub impl iMapImpl of iMapTrait {
    fn explore(ref world: WorldStorage, ref tile: Tile, biome: Biome) {
        tile.biome = biome.into();
        world.write_model(@tile);
        // todo add event {if not already explored}
    }

    fn occupy(ref world: WorldStorage, ref tile: Tile, category: TileOccupier, id: ID) {
        tile.occupier_type = category.into();
        tile.occupier_id = id;
        tile.occupier_is_structure = match category {
            TileOccupier::None => false,
            TileOccupier::Explorer => false,
            _ => true,
        };
        world.write_model(@tile);
        // todo add event {if not already explored}
    }
}

