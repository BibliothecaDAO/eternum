use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::constants::{DAYDREAMS_AGENT_ID, RESOURCE_PRECISION, ResourceTypes, WONDER_STARTING_RESOURCES_BOOST};
use s1_eternum::models::config::{CapacityConfig, StartingResourcesConfig, VillageTokenConfig, WorldConfigUtilImpl};
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction};
use s1_eternum::models::resource::resource::{
    ResourceImpl, ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    Structure, StructureBase, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl, StructureResourcesImpl, StructureTroopExplorerStoreImpl,
    StructureVillageSlots,
};
use s1_eternum::models::troop::{ExplorerTroops};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::utils::map::IMapImpl;
use s1_eternum::systems::utils::troop::iExplorerImpl;
use s1_eternum::systems::utils::village::{iVillageImpl};
use s1_eternum::utils::map::biomes::{Biome, get_biome};
use s1_eternum::utils::village::{IVillagePassDispatcher, IVillagePassDispatcherTrait};

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
        if category == StructureCategory::Realm || category == StructureCategory::Village {
            if tile.occupied() {
                // ensure occupier is not a structure
                assert!(tile.occupier_is_structure == false, "Tile is occupied by structure");

                // double check that the tile is occupied by an explorer
                let mut explorer: ExplorerTroops = world.read_model(tile.occupier_id);
                assert!(explorer.owner.is_non_zero(), "explorer occupying tile should have owner");

                // attempt to move the troop
                iExplorerImpl::attempt_move_to_adjacent_tile(ref world, ref explorer, ref tile);

                // delete explorer if tile is still occupied
                if tile.occupied() {
                    // set explorer troop count to zero
                    explorer.troops.count = 0;

                    if explorer.owner == DAYDREAMS_AGENT_ID {
                        iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer);
                    } else {
                        let mut explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                            ref world, explorer.owner,
                        );
                        let mut explorer_structure_explorers_list: Array<ID> =
                            StructureTroopExplorerStoreImpl::retrieve(
                            ref world, explorer.owner,
                        )
                            .into();
                        iExplorerImpl::explorer_from_structure_delete(
                            ref world,
                            ref explorer,
                            explorer_structure_explorers_list,
                            ref explorer_owner_structure,
                            explorer.owner,
                        );
                    }
                }
            }
        }

        // retrieve tile again and ensure tile is not occupied
        let mut tile: Tile = world.read_model((coord.x, coord.y));
        assert!(tile.not_occupied(), "tile is occupied");

        // explore the tile if biome is not set
        if tile.biome == Biome::None.into() {
            let biome: Biome = get_biome(coord.x.into(), coord.y.into());
            IMapImpl::explore(ref world, ref tile, biome);
        }

        // explore all tiles around the structure, as well as village spots
        let structure_surrounding = array![
            Direction::East,
            Direction::NorthEast,
            Direction::NorthWest,
            Direction::West,
            Direction::SouthWest,
            Direction::SouthEast,
        ];
        let mut possible_village_slots: Array<Direction> = array![];
        let village_pass_config: VillageTokenConfig = WorldConfigUtilImpl::get_member(
            world, selector!("village_pass_config"),
        );

        for direction in structure_surrounding {
            let neighbor_coord: Coord = coord.neighbor(direction);
            let mut neighbor_tile: Tile = world.read_model((neighbor_coord.x, neighbor_coord.y));
            if !neighbor_tile.discovered() {
                let biome: Biome = get_biome(neighbor_coord.x.into(), neighbor_coord.y.into());
                IMapImpl::explore(ref world, ref neighbor_tile, biome);
            }

            // only do village settings when category is realm
            if category == StructureCategory::Realm {
                // explore village tile so that no structure can be built on it
                let village_coord = coord.neighbor_after_distance(direction, iVillageImpl::village_realm_distance());
                let mut village_tile: Tile = world.read_model((village_coord.x, village_coord.y));
                if !village_tile.discovered() {
                    let village_biome: Biome = get_biome(village_coord.x.into(), village_coord.y.into());
                    IMapImpl::explore(ref world, ref village_tile, village_biome);
                }

                // ensure village tile is only useable if no structure is on it and tile is not a quest tile
                if !village_tile.occupier_is_structure && village_tile.occupier_type != TileOccupier::Quest.into() {
                    // mint village nft
                    IVillagePassDispatcher { contract_address: village_pass_config.token_address }
                        .mint(village_pass_config.mint_recipient_address);
                    // append village slot
                    possible_village_slots.append(direction);
                }
            }
        };

        if possible_village_slots.len().is_non_zero() {
            assert!(category == StructureCategory::Realm, "category should be realm");
            let structure_village_slots = StructureVillageSlots {
                connected_realm_entity_id: structure_id,
                connected_realm_id: metadata.realm_id,
                connected_realm_coord: coord,
                directions_left: possible_village_slots.span(),
            };
            world.write_model(@structure_village_slots);
        }

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

