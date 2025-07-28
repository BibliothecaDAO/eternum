use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::{WorldStorage, WorldStorageTrait};
use s1_eternum::alias::ID;
use s1_eternum::constants::{DAYDREAMS_AGENT_ID, RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{
    StartingResourcesConfig, StructureCapacityConfig, VictoryPointsGrantConfig, VillageTokenConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::hyperstructure::PlayerRegisteredPointsImpl;
use s1_eternum::models::map::{Tile, TileImpl, TileOccupier};
use s1_eternum::models::position::{Coord, CoordImpl, Direction};
use s1_eternum::models::resource::resource::{
    ResourceImpl, ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, TroopResourceImpl,
    WeightStoreImpl,
};
use s1_eternum::models::structure::{
    Structure, StructureBase, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
    StructureMetadataStoreImpl, StructureOwnerStoreImpl, StructureResourcesImpl, StructureTroopExplorerStoreImpl,
    StructureTroopGuardStoreImpl, StructureVillageSlots,
};
use s1_eternum::models::troop::{ExplorerTroops, GuardSlot, GuardTrait, GuardTroops, TroopsImpl};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::combat::contracts::troop_management::{
    ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
};
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
        explore_village_coord: bool,
    ) {
        // ensure the tile is not occupied
        let mut tile: Tile = world.read_model((coord.x, coord.y));
        if category == StructureCategory::Realm || category == StructureCategory::Village {
            if tile.occupied() {
                // ensure occupier is not a structure
                assert!(tile.occupier_is_structure == false, "Tile is occupied by structure");
                // ensure occupier is not a quest
                assert!(tile.occupier_type != TileOccupier::Quest.into(), "Tile is occupied by quest");

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

        if (category != StructureCategory::FragmentMine.into() && category != StructureCategory::Village.into())
            || explore_village_coord {
            for direction in structure_surrounding {
                let neighbor_coord: Coord = coord.neighbor(direction);
                let mut neighbor_tile: Tile = world.read_model((neighbor_coord.x, neighbor_coord.y));
                if !neighbor_tile.discovered() {
                    let biome: Biome = get_biome(neighbor_coord.x.into(), neighbor_coord.y.into());
                    IMapImpl::explore(ref world, ref neighbor_tile, biome);
                }

                // only do village settings when category is realm
                if explore_village_coord {
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
        };

        if possible_village_slots.len().is_non_zero() {
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
            structure_id, category, coord, structure_resources_packed, metadata,
        );
        world.write_model(@structure);
        // call the store function to ensure structure owner stats are updated
        StructureOwnerStoreImpl::store(owner, ref world, structure_id);

        // set tile occupier
        IMapImpl::occupy(ref world, ref tile, tile_occupier, structure_id);

        // set structure capacity
        let structure_capacity_config: StructureCapacityConfig = WorldConfigUtilImpl::get_member(
            world, selector!("structure_capacity_config"),
        );
        let capacity: u64 = match category {
            StructureCategory::None => 0,
            StructureCategory::Realm => structure_capacity_config.realm_capacity,
            StructureCategory::Village => structure_capacity_config.village_capacity,
            StructureCategory::Hyperstructure => structure_capacity_config.hyperstructure_capacity,
            StructureCategory::FragmentMine => structure_capacity_config.fragment_mine_capacity,
            StructureCategory::Bank => structure_capacity_config.bank_structure_capacity,
        };
        let capacity: u128 = capacity.into() * RESOURCE_PRECISION;
        let structure_weight: Weight = Weight { capacity, weight: 0 };
        ResourceImpl::initialize(ref world, structure_id);
        ResourceImpl::write_weight(ref world, structure_id, structure_weight);
    }


    fn battle_claim(
        ref world: WorldStorage,
        ref structure_guards: GuardTroops,
        ref structure_base: StructureBase,
        ref explorer: ExplorerTroops,
        structure_id: ID,
    ) {
        if explorer.owner != DAYDREAMS_AGENT_ID {
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let season_mode_on: bool = !blitz_mode_on;
            if season_mode_on {
                // villages can't be claimed in season mode
                if structure_base.category == StructureCategory::Village.into() {
                    return;
                }
            }

            // reset all guard troops
            structure_guards.reset_all_slots();
            StructureTroopGuardStoreImpl::store(ref structure_guards, ref world, structure_id);

            // get previous owner
            let previous_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );

            // get new owner
            let explorer_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, explorer.owner,
            );
            // store new owner
            StructureOwnerStoreImpl::store(explorer_owner_address, ref world, structure_id);

            // grant victory points to player for conquering hyperstructure
            let structure_was_owned_by_bandits: bool = previous_owner_address.is_zero();
            let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                world, selector!("victory_points_grant_config"),
            );
            if structure_was_owned_by_bandits && structure_base.category == StructureCategory::Hyperstructure.into() {
                PlayerRegisteredPointsImpl::register_points(
                    ref world, explorer_owner_address, victory_points_grant_config.claim_hyperstructure_points.into(),
                );
            }

            // grant victory points to player for conquering other structures
            if structure_was_owned_by_bandits && structure_base.category != StructureCategory::Hyperstructure.into() {
                let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                    world, selector!("victory_points_grant_config"),
                );
                PlayerRegisteredPointsImpl::register_points(
                    ref world, explorer_owner_address, victory_points_grant_config.claim_otherstructure_points.into(),
                );
            }
        }
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


    fn grant_starting_resources(ref world: WorldStorage, structure_id: ID, structure_coord: Coord) {
        let biome: Biome = get_biome(structure_coord.x.into(), structure_coord.y.into());
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
        let structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(ref world, structure_id);
        let starting_resources: StartingResourcesConfig = if structure_metadata.village_realm.is_non_zero() {
            WorldConfigUtilImpl::get_member(world, selector!("village_start_resources_config"))
        } else {
            WorldConfigUtilImpl::get_member(world, selector!("realm_start_resources_config"))
        };

        let (start_troop_resource_type, (start_troop_type, start_troop_tier)) = TroopsImpl::start_troop_type(biome);
        for i in 0..starting_resources.resources_list_count {
            let resource: ResourceList = world.read_model((starting_resources.resources_list_id, i));
            assert!(resource.resource_type != ResourceTypes::LORDS, "invalid start resource");

            let mut resource_type = resource.resource_type;
            let mut resource_amount = resource.amount;
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
            let mut realm_resource = SingleResourceStoreImpl::retrieve(
                ref world, structure_id, resource_type, ref structure_weight, resource_weight_grams, true,
            );

            if TroopResourceImpl::is_troop(resource_type) {
                if resource_type != start_troop_resource_type {
                    continue;
                } else {
                    // store the resource
                    realm_resource.add(resource_amount, ref structure_weight, resource_weight_grams);
                    realm_resource.store(ref world);
                    structure_weight.store(ref world, structure_id);

                    // create starting guard
                    let start_guard_troop_amount = resource_amount - TroopsImpl::start_resource_amount();
                    let (troop_management_systems_address, _) = world.dns(@"troop_management_systems").unwrap();
                    ITroopManagementSystemsDispatcher { contract_address: troop_management_systems_address }
                        .guard_add(
                            structure_id,
                            GuardSlot::Delta,
                            start_troop_type,
                            start_troop_tier,
                            start_guard_troop_amount,
                        );

                    // refetch structure weight
                    structure_weight = WeightStoreImpl::retrieve(ref world, structure_id);
                }
            } else {
                realm_resource.add(resource_amount, ref structure_weight, resource_weight_grams);
                realm_resource.store(ref world);
                structure_weight.store(ref world, structure_id);
            }
        };
    }
}

