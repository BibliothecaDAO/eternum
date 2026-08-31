use dojo::world::WorldStorage;
use crate::alias::ID;
use crate::models::config::WorldConfigUtilImpl;
use crate::models::map::TileOccupier;
use crate::models::position::Coord;
use crate::models::structure::{StructureCategory, StructureMetadata};

#[starknet::interface]
pub trait IStructureCreationlibrary<T> {
    fn make_structure(
        self: @T,
        world: WorldStorage,
        game_id: u32,
        coord: Coord,
        owner: starknet::ContractAddress,
        structure_id: ID,
        category: StructureCategory,
        resources: Span<u8>,
        metadata: StructureMetadata,
        tile_occupier: TileOccupier,
        explore_village_coord: bool,
    );
    fn grant_starting_resources(
        self: @T,
        world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        structure_category: StructureCategory,
        structure_coord: Coord,
    );
    fn grant_starting_non_troop_resources(
        self: @T,
        world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        structure_category: StructureCategory,
        structure_coord: Coord,
    );
    fn grant_starting_troop_resources(
        self: @T,
        world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        structure_category: StructureCategory,
        structure_coord: Coord,
    );
}

#[dojo::library]
pub mod structure_creation_library {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::alias::ID;
    use crate::constants::{DAYDREAMS_AGENT_ID, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{
        StartingResourcesConfig, StructureCapacityConfig, VillageTokenConfig, WorldConfigUtilImpl,
    };
    use crate::models::game::{GameRegistry, GameRegistryImpl};
    use crate::models::map::{Tile, TileImpl, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::resource::resource::{
        ResourceImpl, ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl,
        WeightStoreImpl,
    };
    use crate::models::structure::{
        Structure, StructureBase, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
        StructureMetadataStoreImpl, StructureOwnerStoreImpl, StructureResourcesImpl, StructureTroopExplorerStoreImpl,
        StructureVillageSlots,
    };
    use crate::models::troop::{ExplorerTroops, GuardSlot, TroopsImpl};
    use crate::models::weight::Weight;
    use crate::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
    };
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::troop::iExplorerImpl;
    use crate::systems::utils::village::iVillageImpl;
    use crate::utils::map::biomes::{Biome, get_biome_from_world};
    use crate::utils::village::{IVillagePassDispatcher, IVillagePassDispatcherTrait};


    #[abi(embed_v0)]
    pub impl StructureCreationLibraryImpl of super::IStructureCreationlibrary<ContractState> {
        fn make_structure(
            self: @ContractState,
            world: WorldStorage,
            game_id: u32,
            coord: Coord,
            owner: starknet::ContractAddress,
            structure_id: ID,
            category: StructureCategory,
            resources: Span<u8>,
            metadata: StructureMetadata,
            tile_occupier: TileOccupier,
            explore_village_coord: bool,
        ) {
            // ensure the tile is not occupied
            let mut world = world;
            let tile_opt: TileOpt = world.read_model((game_id, coord.alt, coord.x, coord.y));
            let mut tile: Tile = tile_opt.into();
            if tile.occupied() && (category == StructureCategory::Realm || category == StructureCategory::Village) {
                // ensure occupier is not a structure
                assert!(tile.occupier_is_structure == false, "Tile is occupied by structure");
                // ensure occupier is not a quest
                assert!(tile.occupier_type != TileOccupier::Quest.into(), "Tile is occupied by quest");

                // double check that the tile is occupied by an explorer
                let mut explorer: ExplorerTroops = world.read_model((game_id, tile.occupier_id));
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
                            ref world, game_id, explorer.owner,
                        );
                        let mut explorer_structure_explorers_list: Array<ID> =
                            StructureTroopExplorerStoreImpl::retrieve(
                            ref world, game_id, explorer.owner,
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

            // retrieve tile again and ensure tile is not occupied
            let tile_opt: TileOpt = world.read_model((game_id, coord.alt, coord.x, coord.y));
            let mut tile: Tile = tile_opt.into();
            assert!(tile.not_occupied(), "tile is occupied");

            // explore the tile if biome is not set
            if tile.biome == Biome::None.into() {
                let biome: Biome = get_biome_from_world(world, game_id, coord.alt, coord.x.into(), coord.y.into());
                IMapImpl::explore(ref world, ref tile, biome);
            }

            if _should_explore_surroundings(category, explore_village_coord) {
                _reveal_structure_surroundings(ref world, game_id, coord);
            }

            prepare_village_slots(ref world, game_id, structure_id, coord, metadata, explore_village_coord);

            // save structure model
            let structure_resources_packed: u128 = StructureResourcesImpl::pack_resource_types(resources);
            let structure: Structure = StructureImpl::new(
                game_id, structure_id, category, coord, structure_resources_packed, metadata,
            );
            world.write_model(@structure);
            // call the store function to ensure structure owner stats are updated
            StructureOwnerStoreImpl::store(owner, ref world, game_id, structure_id);

            // set tile occupier
            IMapImpl::occupy(ref world, ref tile, tile_occupier, structure_id);

            // set structure capacity
            let structure_capacity_config: StructureCapacityConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("structure_capacity_config"),
            );
            let capacity: u64 = match category {
                StructureCategory::None => 0,
                StructureCategory::Realm => structure_capacity_config.realm_capacity,
                StructureCategory::Village => structure_capacity_config.village_capacity,
                StructureCategory::Hyperstructure => structure_capacity_config.hyperstructure_capacity,
                StructureCategory::FragmentMine => structure_capacity_config.fragment_mine_capacity,
                StructureCategory::Bank => structure_capacity_config.bank_structure_capacity,
                StructureCategory::HolySite => structure_capacity_config.holysite_capacity,
                StructureCategory::Camp => structure_capacity_config.camp_capacity,
                StructureCategory::BitcoinMine => structure_capacity_config.bitcoin_mine_capacity,
            };
            let capacity: u128 = capacity.into() * RESOURCE_PRECISION;
            let structure_weight: Weight = Weight { capacity, weight: 0 };
            ResourceImpl::initialize(ref world, game_id, structure_id);
            ResourceImpl::write_weight(ref world, game_id, structure_id, structure_weight);
        }


        fn grant_starting_resources(
            self: @ContractState,
            world: WorldStorage,
            game_id: u32,
            structure_id: ID,
            structure_category: StructureCategory,
            structure_coord: Coord,
        ) {
            let mut world = world;
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, structure_id);
            let resources = _fetch_resource_list(ref world, game_id, structure_id);
            _grant_non_troop_resources(ref world, game_id, structure_id, ref structure_weight, resources.span());
            _grant_troop_resources(
                ref world,
                game_id,
                structure_id,
                structure_category,
                structure_coord,
                ref structure_weight,
                resources.span(),
            );
        }

        fn grant_starting_non_troop_resources(
            self: @ContractState,
            world: WorldStorage,
            game_id: u32,
            structure_id: ID,
            structure_category: StructureCategory,
            structure_coord: Coord,
        ) {
            let mut world = world;
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, structure_id);
            let resources = _fetch_resource_list(ref world, game_id, structure_id);
            _grant_non_troop_resources(ref world, game_id, structure_id, ref structure_weight, resources.span());
        }

        fn grant_starting_troop_resources(
            self: @ContractState,
            world: WorldStorage,
            game_id: u32,
            structure_id: ID,
            structure_category: StructureCategory,
            structure_coord: Coord,
        ) {
            let mut world = world;
            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, game_id, structure_id);
            let resources = _fetch_resource_list(ref world, game_id, structure_id);
            _grant_troop_resources(
                ref world,
                game_id,
                structure_id,
                structure_category,
                structure_coord,
                ref structure_weight,
                resources.span(),
            );
        }
    }

    fn _fetch_resource_list(ref world: WorldStorage, game_id: u32, structure_id: ID) -> Array<ResourceList> {
        let game: GameRegistry = world.read_model(game_id);
        let structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
            ref world, game_id, structure_id,
        );
        let starting_resources: StartingResourcesConfig = if structure_metadata.village_realm.is_non_zero() {
            WorldConfigUtilImpl::get_member(world, game_id, selector!("village_start_resources_config"))
        } else {
            WorldConfigUtilImpl::get_member(world, game_id, selector!("realm_start_resources_config"))
        };
        let mut resources: Array<ResourceList> = array![];
        for i in 0..starting_resources.resources_list_count {
            let resource: ResourceList = world.read_model((game.preset_id, starting_resources.resources_list_id, i));
            resources.append(resource);
        }
        resources
    }

    fn prepare_village_slots(
        ref world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        structure_coord: Coord,
        structure_metadata: StructureMetadata,
        enabled: bool,
    ) {
        if !enabled {
            return;
        }

        let available_directions = find_available_village_directions(ref world, game_id, structure_coord);
        if available_directions.len().is_zero() {
            return;
        }

        world
            .write_model(
                @StructureVillageSlots {
                    game_id,
                    connected_realm_entity_id: structure_id,
                    connected_realm_id: structure_metadata.realm_id,
                    connected_realm_coord: structure_coord,
                    directions_left: available_directions.span(),
                },
            );
    }

    fn find_available_village_directions(
        ref world: WorldStorage, game_id: u32, realm_coord: Coord,
    ) -> Array<Direction> {
        let mut available_directions = array![];
        for direction in village_directions() {
            let village_coord = realm_coord.neighbor_after_distance(direction, iVillageImpl::village_realm_distance());
            let village_tile_opt: TileOpt = world
                .read_model((game_id, village_coord.alt, village_coord.x, village_coord.y));
            let mut village_tile: Tile = village_tile_opt.into();
            reveal_village_tile(ref world, game_id, ref village_tile);

            if village_tile.occupier_is_structure || village_tile.occupier_type == TileOccupier::Quest.into() {
                continue;
            }

            mint_village_pass_when_required(world, game_id);
            available_directions.append(direction);
        }
        available_directions
    }

    fn reveal_village_tile(ref world: WorldStorage, game_id: u32, ref village_tile: Tile) {
        if village_tile.discovered() {
            return;
        }
        let village_biome: Biome = get_biome_from_world(
            world, game_id, village_tile.alt, village_tile.col.into(), village_tile.row.into(),
        );
        IMapImpl::explore(ref world, ref village_tile, village_biome);
    }

    fn mint_village_pass_when_required(world: WorldStorage, game_id: u32) {
        if GameRegistryImpl::get(world, game_id).dev_mode_on {
            return;
        }
        let village_token_config: VillageTokenConfig = WorldConfigUtilImpl::get_member(
            world, game_id, selector!("village_token_config"),
        );
        IVillagePassDispatcher { contract_address: village_token_config.token_address }
            .mint(village_token_config.mint_recipient_address);
    }

    fn village_directions() -> Array<Direction> {
        array![
            Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
            Direction::SouthEast,
        ]
    }

    fn _should_explore_surroundings(category: StructureCategory, explore_village_coord: bool) -> bool {
        if explore_village_coord {
            return true;
        }

        category != StructureCategory::Realm
            && category != StructureCategory::FragmentMine
            && category != StructureCategory::Village
    }

    fn _reveal_structure_surroundings(ref world: WorldStorage, game_id: u32, structure_coord: Coord) {
        let structure_surrounding = array![
            Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
            Direction::SouthEast,
        ];

        for direction in structure_surrounding {
            let neighbor_coord: Coord = structure_coord.neighbor(direction);
            let neighbor_tile_opt: TileOpt = world
                .read_model((game_id, neighbor_coord.alt, neighbor_coord.x, neighbor_coord.y));
            let mut neighbor_tile: Tile = neighbor_tile_opt.into();
            if neighbor_tile.discovered() {
                continue;
            }

            let biome: Biome = get_biome_from_world(
                world, game_id, neighbor_coord.alt, neighbor_coord.x.into(), neighbor_coord.y.into(),
            );
            IMapImpl::explore(ref world, ref neighbor_tile, biome);
        }
    }

    fn _grant_non_troop_resources(
        ref world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        ref structure_weight: Weight,
        resources: Span<ResourceList>,
    ) {
        for resource in resources {
            let resource = *resource;
            assert!(resource.resource_type != ResourceTypes::LORDS, "invalid start resource");
            if TroopResourceImpl::is_troop(resource.resource_type) {
                continue;
            }
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, game_id, resource.resource_type);
            let mut realm_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                game_id,
                structure_id,
                resource.resource_type,
                ref structure_weight,
                resource_weight_grams,
                true,
            );
            realm_resource.add(resource.amount, ref structure_weight, resource_weight_grams);
            realm_resource.store(ref world);
            structure_weight.store(ref world, game_id, structure_id);
        };
    }

    fn _grant_troop_resources(
        ref world: WorldStorage,
        game_id: u32,
        structure_id: ID,
        structure_category: StructureCategory,
        structure_coord: Coord,
        ref structure_weight: Weight,
        resources: Span<ResourceList>,
    ) {
        let biome: Biome = get_biome_from_world(
            world, game_id, structure_coord.alt, structure_coord.x.into(), structure_coord.y.into(),
        );
        let (start_troop_resource_type, (start_troop_type, start_troop_tier)) = TroopsImpl::start_troop_type(biome);

        for resource in resources {
            let resource = *resource;
            if !TroopResourceImpl::is_troop(resource.resource_type) {
                continue;
            }
            if resource.resource_type != start_troop_resource_type {
                continue;
            }

            let additional_troop_amount = if structure_category == StructureCategory::Village {
                TroopsImpl::deployed_village_troop_count()
            } else if structure_category == StructureCategory::Realm {
                TroopsImpl::deployed_realm_troop_count()
            } else {
                0
            };
            let resource_amount_granted = resource.amount + additional_troop_amount;
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, game_id, resource.resource_type);
            let mut realm_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                game_id,
                structure_id,
                resource.resource_type,
                ref structure_weight,
                resource_weight_grams,
                true,
            );
            realm_resource.add(resource_amount_granted, ref structure_weight, resource_weight_grams);
            realm_resource.store(ref world);
            structure_weight.store(ref world, game_id, structure_id);

            // create starting guard
            let start_guard_troop_amount = additional_troop_amount;
            if start_guard_troop_amount.is_non_zero() {
                let (troop_management_systems_address, _) = world.dns(@"troop_management_systems").unwrap();
                ITroopManagementSystemsDispatcher { contract_address: troop_management_systems_address }
                    .guard_add(
                        game_id,
                        structure_id,
                        GuardSlot::Delta,
                        start_troop_type,
                        start_troop_tier,
                        start_guard_troop_amount,
                    );

                // refetch structure weight
                structure_weight = WeightStoreImpl::retrieve(ref world, game_id, structure_id);
            }
        };
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IStructureCreationlibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"structure_creation_library_v0_1_18").expect('structure create lib not found');
        super::IStructureCreationlibraryLibraryDispatcher { class_hash }
    }
}
