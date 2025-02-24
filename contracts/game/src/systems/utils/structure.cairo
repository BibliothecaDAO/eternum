use dojo::model::ModelStorage;
use dojo::world::{WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION};
use s1_eternum::models::config::{CapacityConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl};
use s1_eternum::models::position::{Coord, Occupied, OccupiedBy, OccupiedImpl};
use s1_eternum::models::resource::resource::{ResourceImpl};
use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::map::iMapImpl;
use s1_eternum::utils::map::biomes::{Biome, get_biome};

#[generate_trait]
pub impl iStructureImpl of iStructureTrait {
    fn create(
        ref world: WorldStorage,
        coord: Coord,
        owner: starknet::ContractAddress,
        structure_id: ID,
        category: StructureCategory,
        assert_tile_explored: bool,
    ) {
        // ensure tile has already been explored
        let mut tile: Tile = world.read_model((coord.x, coord.y));
        if assert_tile_explored {
            // ensure tile is explored
            assert!(tile.discovered(), "tile not explored");
        } else {
            // ensure tile is not explored
            assert!(!tile.discovered(), "tile already explored");

            // explore the tile
            let biome: Biome = get_biome(coord.x.into(), coord.y.into());
            iMapImpl::explore(ref world, ref tile, biome);
        }

        // ensure the coord is not occupied
        let occupied: Occupied = world.read_model((coord.x, coord.y));
        assert!(occupied.not_occupied(), "something exists on this coords");

        // save structure model
        let structure: Structure = StructureImpl::new(structure_id, category, coord, owner);
        world.write_model(@structure);

        // save occupier model
        world.write_model(@Occupied { x: coord.x, y: coord.y, by_id: structure_id, by_type: OccupiedBy::Structure });

        // set structure capacity
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.structure_capacity.into() * RESOURCE_PRECISION;
        let structure_weight: Weight = Weight { capacity, weight: 0 };
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);
    }
}

