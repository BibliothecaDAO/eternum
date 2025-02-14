use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use s1_eternum::alias::ID;
use s1_eternum::models::config::{CapacityConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl};
use s1_eternum::models::owner::{Owner};
use s1_eternum::models::position::{Coord, OccupiedBy, Occupier, OccupierImpl, Position};
use s1_eternum::models::resource::resource::{RESOURCE_PRECISION, ResourceImpl};
use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::map::iMapImpl;
use s1_eternum::utils::map::biomes::{Biome, get_biome};

#[generate_trait]
impl iStructureImpl of iStructureTrait {
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
        let occupier: Occupier = Occupier { x: coord.x, y: coord.y, entity: OccupiedBy::Structure(structure_id) };
        assert!(occupier.not_occupied(), "something exists on this coords");

        // save structure model
        let owner: Owner = Owner { entity_id: structure_id, address: owner };
        let structure: Structure = StructureImpl::new(structure_id, category, coord, owner);
        world.write_model(@structure);

        // save occupier model
        world.write_model(@Occupier { x: coord.x, y: coord.y, entity: OccupiedBy::Structure(structure_id) });

        // set structure capacity
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.structure_capacity.into() * RESOURCE_PRECISION;
        let structure_weight: Weight = Weight { capacity, weight: 0 };
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);
    }
}

