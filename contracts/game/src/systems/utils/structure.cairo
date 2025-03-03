use dojo::model::ModelStorage;
use dojo::world::{WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION};
use s1_eternum::models::config::{CapacityConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction};
use s1_eternum::models::resource::resource::{ResourceImpl};
use s1_eternum::models::structure::{
    Structure, StructureCategory, StructureImpl, StructureMetadata, StructureResourcesImpl,
};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::map::IMapImpl;
use s1_eternum::utils::map::biomes::{Biome, get_biome};

#[generate_trait]
pub impl iStructureImpl of IStructureTrait {
    fn create(
        ref world: WorldStorage,
        coord: Coord,
        owner: starknet::ContractAddress,
        structure_id: ID,
        category: StructureCategory,
        assert_tile_explored: bool,
        resources: Span<u8>,
        metadata: StructureMetadata,
        tile_occupier: TileOccupier,
    ) {
        // ensure the tile is not occupied
        let mut tile: Tile = world.read_model((coord.x, coord.y));
        assert!(tile.not_occupied(), "something exists on this coords");

        if assert_tile_explored {
            // ensure tile is explored
            assert!(tile.discovered(), "tile not explored");
        } else {
            // ensure tile is not explored
            assert!(!tile.discovered(), "tile already explored");

            // explore the tile
            let biome: Biome = get_biome(coord.x.into(), coord.y.into());
            IMapImpl::explore(ref world, ref tile, biome);
        }

        // explore all tiles around the structure
        let structure_surrounding = array![
            Direction::East,
            Direction::NorthEast,
            Direction::NorthWest,
            Direction::West,
            Direction::SouthWest,
            Direction::SouthEast,
        ];
        for direction in structure_surrounding {
            let neighbor_coord: Coord = coord.neighbor(direction);
            let mut neighbor_tile: Tile = world.read_model((neighbor_coord.x, neighbor_coord.y));
            if !neighbor_tile.discovered() {
                let biome: Biome = get_biome(neighbor_coord.x.into(), neighbor_coord.y.into());
                IMapImpl::explore(ref world, ref neighbor_tile, biome);
            }
        };

        // save structure model
        let structure_resources_packed: u128 = StructureResourcesImpl::pack_resource_types(resources);
        let structure: Structure = StructureImpl::new(
            structure_id, category, coord, owner, structure_resources_packed, metadata,
        );
        world.write_model(@structure);

        // set tile occupier
        IMapImpl::occupy(ref world, ref tile, tile_occupier, structure_id);

        // set structure capacity
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.structure_capacity.into() * RESOURCE_PRECISION;
        let structure_weight: Weight = Weight { capacity, weight: 0 };
        ResourceImpl::initialize(ref world, structure_id);
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);
    }
}

