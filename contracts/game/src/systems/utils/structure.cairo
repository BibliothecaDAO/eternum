use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{DAYDREAMS_AGENT_ID, RESOURCE_PRECISION, ResourceTypes, WONDER_STARTING_RESOURCES_BOOST};
use s1_eternum::models::config::{CapacityConfig, StartingResourcesConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction};
use s1_eternum::models::resource::resource::{
    ResourceImpl, ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    Structure, StructureBase, StructureCategory, StructureImpl, StructureMetadata, StructureMetadataStoreImpl,
    StructureOwnerStoreImpl, StructureResourcesImpl,
};
use s1_eternum::models::troop::{ExplorerTroops};
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
        resources: Span<u8>,
        metadata: StructureMetadata,
        tile_occupier: TileOccupier,
    ) {
        // ensure the tile is not occupied
        let mut tile: Tile = world.read_model((coord.x, coord.y));
        assert!(tile.not_occupied(), "something exists on this coords");

        // explore the tile if biome is not set
        if tile.biome == Biome::None.into() {
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


    fn claim(
        ref world: WorldStorage, ref structure_base: StructureBase, ref explorer: ExplorerTroops, structure_id: ID,
    ) {
        if explorer.owner != DAYDREAMS_AGENT_ID {
            if structure_base.category != StructureCategory::Village.into() {
                let explorer_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                    ref world, explorer.owner,
                );
                StructureOwnerStoreImpl::store(explorer_owner, ref world, structure_id);
            }
        }
    }


    fn grant_starting_resources(ref world: WorldStorage, structure_id: ID) {
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(ref world, structure_id);
        let starting_resources: StartingResourcesConfig = if structure_metadata.village_realm.is_non_zero() {
            WorldConfigUtilImpl::get_member(world, selector!("village_start_resources_config"))
        } else {
            WorldConfigUtilImpl::get_member(world, selector!("realm_start_resources_config"))
        };

        for i in 0..starting_resources.resources_list_count {
            let resource: ResourceList = world.read_model((starting_resources.resources_list_id, i));
            assert!(resource.resource_type != ResourceTypes::LORDS, "invalid start resource");

            let mut resource_type = resource.resource_type;
            let mut resource_amount = resource.amount;
            if structure_metadata.has_wonder {
                resource_amount *= WONDER_STARTING_RESOURCES_BOOST.into();
            }
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut realm_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, resource_type, ref structure_weight, resource_weight_grams, true,
            );
            realm_resource.add(resource_amount, ref structure_weight, resource_weight_grams);
            realm_resource.store(ref world);
        };
        structure_weight.store(ref world, structure_id);
    }
}

