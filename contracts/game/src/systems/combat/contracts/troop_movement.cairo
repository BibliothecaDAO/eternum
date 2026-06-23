use crate::alias::ID;
use crate::models::position::Direction;

#[starknet::interface]
pub trait ITroopMovementSystems<TContractState> {
    fn explorer_move(
        ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool,
    ) -> Span<Tile>;
    fn explorer_explore_and_extract(
        ref self: TContractState, explorer_id: ID, directions: Span<Direction>,
    ) -> Span<Tile>;
    fn explorer_extract_reward(ref self: TContractState, explorer_id: ID);
}

#[dojo::contract]
pub mod troop_movement_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::{Model, ModelStorage};
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::agent::AgentOwner;
    use crate::models::config::{
        BlitzExplorationConfig, CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig,
        TroopStaminaConfig, VictoryPointsGrantConfig, WorldConfigUtilImpl,
    };
    use crate::models::events::{
        ExploreFind, ExplorerExtractRewardStory, ExplorerMoveStory, PointsActivity, PointsRegisteredStory, Story,
        StoryEvent,
    };
    use crate::models::hyperstructure::PlayerRegisteredPointsImpl;
    use crate::models::map::{BiomeDiscovered, Tile, TileImpl, TileOccupier};
    use crate::models::map2::{TileOpt, TileOptDataReadTrait, TileOptDataWriteTrait};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::resource::production::production::Production;
    use crate::models::resource::resource::{
        Resource, ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::rng::{RNG, RNG_TX_SEED_INCREMENT};
    use crate::models::stamina::StaminaTrait;
    use crate::models::structure::{StructureBaseStoreImpl, StructureOwnerStoreImpl};
    use crate::models::troop::{ExplorerTroops, GuardImpl, TroopsTrait};
    use crate::models::weight::{Weight, WeightImpl};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::utils::blitz_profile::iBlitzProfileImpl;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::map::biomes::{Biome, get_biome_from_world};
    use crate::utils::math::PercentageValueImpl;
    use crate::utils::random::{VRFImpl, random};
    use super::{
        ITroopMovementSystems, ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait,
        movement_discovery,
    };

    // to be removed
    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerMoveEvent {
        #[key]
        pub explorer_id: ID,
        pub explorer_structure_id: ID,
        pub explorer_owner_address: starknet::ContractAddress,
        pub explore_find: ExploreFind,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerRewardEvent {
        #[key]
        pub explorer_id: ID,
        pub explorer_structure_id: ID,
        pub explorer_owner_address: starknet::ContractAddress,
        pub reward_resource_id: u8,
        pub reward_resource_amount: u128,
        pub coord: Coord,
        pub timestamp: u64,
    }

    const NON_BLITZ_EXPLORATION_REWARD_WEIGHT_TOTAL: u128 = 10_022_132;

    #[abi(embed_v0)]
    impl TroopMovementSystemsImpl of ITroopMovementSystems<ContractState> {
        fn explorer_move(
            ref self: ContractState, explorer_id: ID, mut directions: Span<Direction>, mut explore: bool,
        ) -> Span<Tile> {
            let mut tiles_to_return: Array<Tile> = array![];

            // ensure directions are not empty
            assert!(directions.len().is_non_zero(), "directions must be more than 0");

            // Store original directions for the event
            let original_directions = directions;

            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();
            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // Store original coordinate for the event
            let start_coord = explorer.coord;

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // ensure explorer tile is correct
            let tile_opt: TileOpt = world.read_model((explorer.coord.alt, explorer.coord.x, explorer.coord.y));
            let mut tile: Tile = tile_opt.into();
            assert!(explorer_id == tile.occupier_id, "tile occupier should be explorer");

            // remove explorer from current tile
            IMapImpl::occupy(ref world, ref tile, TileOccupier::None, 0);

            let mut explore_find = ExploreFind::None;

            let caller = starknet::get_caller_address();

            let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                world, selector!("victory_points_grant_config"),
            );
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let season_mode_on = !blitz_mode_on;
            // move explorer to target coordinate
            let mut biomes: Array<Biome> = array![];
            while true {
                // ensure next coordinate is not occupied
                let from = explorer.coord;
                let next = explorer.coord.neighbor(*directions.pop_front().unwrap());
                let tile_opt: TileOpt = world.read_model((next.alt, next.x, next.y));
                let mut tile: Tile = tile_opt.into();
                assert!(tile.not_occupied(), "one of the tiles in path is occupied");

                // add biome to biomes
                let biome = get_biome_from_world(world, next.alt, next.x.into(), next.y.into());
                biomes.append(biome);

                let mut occupy_destination: bool = true;

                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");
                    if tile.discovered() {
                        // this branch corrects for the case where an explorer tries to explore an already explored
                        // tile.
                        // which may be the case if the indexer is out of sync with actual chain state

                        // force consume vrf seed
                        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
                        let _vrf_seed: u256 = rng_library_dispatcher
                            .get_random_number(Source::Salt(tile.to_seed()), world);
                        // set explore to false
                        explore = false;
                    }
                }

                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");

                    // ensure target tile is not explored
                    assert!(!tile.discovered(), "tile is already explored");

                    // set tile as explored in memory; the final occupancy write stores the packed tile once.
                    IMapImpl::explore_memory(ref tile, biome);

                    // register points for player
                    PlayerRegisteredPointsImpl::register_points(
                        ref world, caller, victory_points_grant_config.explore_tiles_points.into(),
                    );

                    // perform lottery to discover mine
                    let rng_library_dispatcher = rng_library::get_dispatcher(@world);
                    let vrf_seed: u256 = rng_library_dispatcher.get_random_number(Source::Salt(tile.to_seed()), world);
                    let (troop_movement_util_systems_address, _) = world.dns(@"troop_movement_util_systems").unwrap();
                    let troop_movement_util_systems = ITroopMovementUtilSystemsDispatcher {
                        contract_address: troop_movement_util_systems_address,
                    };

                    let (found_treasure, _explore_find) = troop_movement_util_systems
                        .find_treasure(
                            vrf_seed,
                            tile,
                            starknet::get_caller_address(),
                            map_config,
                            troop_limit_config,
                            troop_stamina_config,
                            current_tick,
                            season_mode_on,
                        );

                    explore_find = _explore_find;
                    if found_treasure {
                        // ensure explorer does not occupy destination tile
                        occupy_destination = false;

                        // refresh tile model
                        let tile_opt: TileOpt = world.read_model((next.alt, next.x, next.y));
                        tile = tile_opt.into();
                    }

                    // emit explore achievement progression
                    AchievementTrait::progress(
                        world, caller.into(), Tasks::EXPLORE, 1, starknet::get_block_timestamp(),
                    );

                    // emit discovery achievement achievement
                    match explore_find {
                        ExploreFind::None => {},
                        ExploreFind::Hyperstructure => {
                            AchievementTrait::progress(
                                world,
                                caller.into(),
                                Tasks::HYPERSTRUCTURE_DISCOVER,
                                1,
                                starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::Mine => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::MINE_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::Agent => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::AGENT_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::Quest => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::QUEST_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::Village => {},
                        ExploreFind::HolySite => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::HOLYSITE_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::Camp => {
                            AchievementTrait::progress(
                                world, caller.into(), Tasks::CAMP_DISCOVER, 1, starknet::get_block_timestamp(),
                            );
                        },
                        ExploreFind::BitcoinMine => {},
                    }

                    // check if biome type has been discovered by player previously
                    let biome_u8: u8 = biome.into();
                    let mut biome_discovered: BiomeDiscovered = world.read_model((caller, biome_u8));
                    if !biome_discovered.discovered {
                        biome_discovered.discovered = true;
                        world.write_model(@biome_discovered);

                        // emit achievement progression
                        AchievementTrait::progress(
                            world, caller.into(), Tasks::BIOME_DISCOVER, 1, starknet::get_block_timestamp(),
                        );
                    }
                } else {
                    // ensure all tiles passed through during travel are explored
                    assert!(tile.discovered(), "one of the tiles in path is not explored");
                }

                // update explorer coordinate
                explorer.coord = next;

                // set explorer as occupier of target coordinate
                if directions.len().is_zero() {
                    let tile_occupier = IMapImpl::get_troop_occupier(
                        explorer.owner, explorer.troops.category, explorer.troops.tier,
                    );
                    if occupy_destination {
                        // ensure explorer does not occupy fragment mine
                        // tile when mines are discovered
                        IMapImpl::occupy(ref world, ref tile, tile_occupier, explorer_id);
                    } else {
                        // move explorer back to previous coordinate
                        explorer.coord = from;
                        // set explorer as occupier of previous coordinate
                        let from_tile_opt: TileOpt = world.read_model((from.alt, from.x, from.y));
                        let mut from_tile: Tile = from_tile_opt.into();
                        IMapImpl::occupy(ref world, ref from_tile, tile_occupier, explorer_id);
                    }
                    tiles_to_return.append(tile);
                    break;
                } else {
                    tiles_to_return.append(tile);
                }
            }

            // burn stamina cost
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            iExplorerImpl::burn_stamina_cost(
                ref world, ref explorer, troop_stamina_config, explore, biomes, current_tick,
            );

            // burn food cost
            iExplorerImpl::burn_food_cost(ref world, ref explorer, troop_stamina_config, explore);

            // emit event
            let explorer_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(explorer_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerMoveStory(
                            ExplorerMoveStory {
                                explorer_owner,
                                explorer_id,
                                explorer_structure_id: explorer.owner,
                                start_coord,
                                end_coord: explorer.coord,
                                directions: original_directions,
                                explore,
                                explore_find,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
            if explore {
                // emit story events
                let points_registered_story = PointsRegisteredStory {
                    owner_address: explorer_owner,
                    activity: PointsActivity::Exploration,
                    points: victory_points_grant_config.explore_tiles_points.into(),
                };
                world
                    .emit_event(
                        @StoryEvent {
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(explorer_owner),
                            entity_id: Option::Some(explorer_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::PointsRegisteredStory(points_registered_story),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            }

            // to be removed
            world
                .emit_event(
                    @ExplorerMoveEvent {
                        explorer_id,
                        explorer_structure_id: explorer.owner,
                        explorer_owner_address: starknet::get_caller_address(),
                        explore_find: explore_find,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // update explorer
            world.write_model(@explorer);

            tiles_to_return.span()
        }

        fn explorer_explore_and_extract(
            ref self: ContractState, explorer_id: ID, mut directions: Span<Direction>,
        ) -> Span<Tile> {
            let mut tiles_to_return: Array<Tile> = array![];

            assert!(directions.len().is_non_zero(), "directions must be more than 0");
            let original_directions = directions;

            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            let caller = starknet::get_caller_address();
            let explorer_owner = assert_explorer_caller_and_resolve_event_owner(ref world, explorer, caller);

            let start_coord = explorer.coord;
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            let from = explorer.coord;
            let mut source_tile_opt: TileOpt = world.read_model((from.alt, from.x, from.y));
            assert!(
                explorer_id == TileOptDataReadTrait::occupier_id(source_tile_opt.data),
                "tile occupier should be explorer",
            );

            let block_timestamp = starknet::get_block_timestamp();
            let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                world, selector!("victory_points_grant_config"),
            );
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let season_mode_on = !blitz_mode_on;

            let next = explorer.coord.neighbor(*directions.pop_front().unwrap());
            let mut target_tile_opt: TileOpt = world.read_model((next.alt, next.x, next.y));
            let mut target_tile: Tile = target_tile_opt.into();
            assert!(target_tile.not_occupied(), "one of the tiles in path is occupied");
            assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");

            let biome = get_biome_from_world(world, next.alt, next.x.into(), next.y.into());

            let (explore, explore_find, occupy_destination, movement_vrf_seed) = discover_target_if_needed(
                ref world,
                ref target_tile,
                caller,
                next,
                biome,
                map_config,
                troop_stamina_config,
                victory_points_grant_config,
                current_tick,
                block_timestamp,
                season_mode_on,
            );

            explorer.coord = next;
            let explorer_occupier_type = TileOptDataReadTrait::occupier_type(source_tile_opt.data);
            let explorer_occupier_is_structure = TileOptDataReadTrait::occupier_is_structure(source_tile_opt.data);

            let mut reward_tile: Tile = target_tile;
            if occupy_destination {
                occupy_tile_with_existing_occupier_memory(
                    ref target_tile, explorer_occupier_type, explorer_occupier_is_structure, explorer_id,
                );
                reward_tile = target_tile;
            } else {
                explorer.coord = from;
                let source_tile: Tile = source_tile_opt.into();
                reward_tile = source_tile;
            }

            let tile_to_return = target_tile;
            tiles_to_return.append(tile_to_return);

            assert!(explorer.coord.alt == false, "Eternum: explorer must be on surface to extract reward");
            assert!(explorer_id == reward_tile.occupier_id, "tile occupier should be explorer");
            assert!(reward_tile.biome != Biome::None.into(), "tile must be explored");

            let reward_vrf_seed: u256 = movement_vrf_seed + RNG_TX_SEED_INCREMENT;
            let should_grant_reward = !reward_tile.reward_extracted;
            if should_grant_reward {
                IMapImpl::mark_reward_extracted_memory(ref reward_tile);
            }

            store_combined_explore_tiles(
                ref world, ref source_tile_opt, ref target_tile_opt, reward_tile, occupy_destination,
            );

            burn_single_step_stamina_cost(ref explorer, troop_stamina_config, explore, biome, current_tick);
            burn_explorer_food_cost_with_deferred_weight_store(ref world, explorer, troop_stamina_config, explore);

            let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
            emit_explorer_move_stories(
                ref world,
                explorer,
                explorer_owner,
                caller,
                explorer_id,
                start_coord,
                original_directions,
                explore,
                explore_find,
                victory_points_grant_config,
                tx_hash,
                block_timestamp,
            );

            world.write_model(@explorer);

            if should_grant_reward {
                grant_explorer_reward_and_emit(
                    ref world,
                    explorer,
                    explorer_owner,
                    caller,
                    reward_tile,
                    reward_vrf_seed,
                    current_tick,
                    map_config,
                    blitz_mode_on,
                    tx_hash,
                    block_timestamp,
                );
            }

            tiles_to_return.span()
        }

        fn explorer_extract_reward(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure explorer is at the surface
            assert!(explorer.coord.alt == false, "Eternum: explorer must be on surface to extract reward");

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // ensure explorer tile is correct
            let tile_opt: TileOpt = world.read_model((explorer.coord.alt, explorer.coord.x, explorer.coord.y));
            let mut tile: Tile = tile_opt.into();
            assert!(explorer_id == tile.occupier_id, "tile occupier should be explorer");
            assert!(tile.biome != Biome::None.into(), "tile must be explored");

            // ensure to consume vrf seed even if tile.reward_extracted is true
            // to prevent client errors
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(Source::Salt(tile.to_seed()), world);

            if tile.reward_extracted {
                return;
            }
            assert!(tile.reward_extracted == false, "tile reward already extracted");

            // mark reward as extracted
            IMapImpl::mark_reward_extracted(ref world, ref tile);

            // get relevant data to grant reward
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let blitz_exploration_config: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_exploration_config"),
            );
            let blitz_exploration_reward_profile_id = iBlitzProfileImpl::resolve_blitz_profile_id(
                blitz_exploration_config.reward_profile_id,
            );
            let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));

            // grant resource reward for exploration
            let (explore_reward_type, explore_reward_amount) = iExplorerImpl::exploration_reward(
                ref world,
                Option::Some(explorer),
                current_tick,
                map_config,
                vrf_seed,
                blitz_mode_on,
                blitz_exploration_reward_profile_id,
            );

            let exploration_reward_receiver: ID = iExplorerImpl::exploration_reward_receiver(
                ref world, blitz_mode_on, explorer, explore_reward_type,
            );
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_type);
            let mut reward_receiver_weight: Weight = WeightStoreImpl::retrieve(ref world, exploration_reward_receiver);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world,
                exploration_reward_receiver,
                explore_reward_type,
                ref reward_receiver_weight,
                resource_weight_grams,
                true,
            );
            resource.add(explore_reward_amount, ref reward_receiver_weight, resource_weight_grams);
            resource.store(ref world);
            reward_receiver_weight.store(ref world, exploration_reward_receiver);

            // emit event
            let explorer_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(explorer_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerExtractRewardStory(
                            ExplorerExtractRewardStory {
                                explorer_owner,
                                explorer_id,
                                explorer_structure_id: explorer.owner,
                                coord: tile.into(),
                                reward_resource_type: explore_reward_type,
                                reward_resource_amount: explore_reward_amount,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            world
                .emit_event(
                    @ExplorerRewardEvent {
                        explorer_id,
                        explorer_structure_id: explorer.owner,
                        explorer_owner_address: starknet::get_caller_address(),
                        reward_resource_id: explore_reward_type,
                        reward_resource_amount: explore_reward_amount,
                        coord: explorer.coord,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }

    #[inline(always)]
    fn discover_target_if_needed(
        ref world: WorldStorage,
        ref target_tile: Tile,
        caller: ContractAddress,
        target_coord: Coord,
        biome: Biome,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        victory_points_grant_config: VictoryPointsGrantConfig,
        current_tick: u64,
        block_timestamp: u64,
        season_mode_on: bool,
    ) -> (bool, ExploreFind, bool, u256) {
        if target_tile.discovered() {
            let movement_vrf_seed = derive_initial_tx_random_seed(ref world, Source::Salt(target_tile.to_seed()));
            return (false, ExploreFind::None, true, movement_vrf_seed);
        }

        IMapImpl::explore_memory(ref target_tile, biome);

        PlayerRegisteredPointsImpl::register_points(
            ref world, caller, victory_points_grant_config.explore_tiles_points.into(),
        );

        let vrf_seed: u256 = derive_initial_tx_random_seed(ref world, Source::Salt(target_tile.to_seed()));
        let (found_treasure, explore_find) = movement_discovery::find_treasure(
            ref world, vrf_seed, target_tile, caller, map_config, troop_stamina_config, current_tick, season_mode_on,
        );

        let mut occupy_destination = true;
        if found_treasure {
            occupy_destination = false;
            let target_tile_opt: TileOpt = world.read_model((target_coord.alt, target_coord.x, target_coord.y));
            target_tile = target_tile_opt.into();
        }

        AchievementTrait::progress(world, caller.into(), Tasks::EXPLORE, 1, block_timestamp);
        progress_discovery_achievement(world, caller, explore_find, block_timestamp);
        mark_biome_discovered_if_needed(ref world, caller, biome, block_timestamp);

        (true, explore_find, occupy_destination, vrf_seed)
    }

    #[inline(always)]
    fn store_combined_explore_tiles(
        ref world: WorldStorage,
        ref source_tile_opt: TileOpt,
        ref target_tile_opt: TileOpt,
        reward_tile: Tile,
        occupy_destination: bool,
    ) {
        if occupy_destination {
            source_tile_opt.data = TileOptDataWriteTrait::without_occupier(source_tile_opt.data);
            target_tile_opt
                .data =
                    TileOptDataWriteTrait::with_tile_state(
                        target_tile_opt.data,
                        reward_tile.biome,
                        reward_tile.occupier_type,
                        reward_tile.occupier_is_structure,
                        reward_tile.occupier_id,
                        reward_tile.reward_extracted,
                    );
            world.write_model(@source_tile_opt);
            world.write_model(@target_tile_opt);
        } else {
            source_tile_opt
                .data =
                    TileOptDataWriteTrait::with_reward_extracted(source_tile_opt.data, reward_tile.reward_extracted);
            world.write_model(@source_tile_opt);
        }
    }

    #[inline(always)]
    fn progress_discovery_achievement(
        world: WorldStorage, caller: ContractAddress, explore_find: ExploreFind, block_timestamp: u64,
    ) {
        match explore_find {
            ExploreFind::None => {},
            ExploreFind::Hyperstructure => {
                AchievementTrait::progress(world, caller.into(), Tasks::HYPERSTRUCTURE_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::Mine => {
                AchievementTrait::progress(world, caller.into(), Tasks::MINE_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::Agent => {
                AchievementTrait::progress(world, caller.into(), Tasks::AGENT_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::Quest => {
                AchievementTrait::progress(world, caller.into(), Tasks::QUEST_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::Village => {},
            ExploreFind::HolySite => {
                AchievementTrait::progress(world, caller.into(), Tasks::HOLYSITE_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::Camp => {
                AchievementTrait::progress(world, caller.into(), Tasks::CAMP_DISCOVER, 1, block_timestamp);
            },
            ExploreFind::BitcoinMine => {},
        }
    }

    #[inline(always)]
    fn mark_biome_discovered_if_needed(
        ref world: WorldStorage, caller: ContractAddress, biome: Biome, block_timestamp: u64,
    ) {
        let biome_u8: u8 = biome.into();
        let mut biome_discovered: BiomeDiscovered = world.read_model((caller, biome_u8));
        if !biome_discovered.discovered {
            biome_discovered.discovered = true;
            world.write_model(@biome_discovered);

            AchievementTrait::progress(world, caller.into(), Tasks::BIOME_DISCOVER, 1, block_timestamp);
        }
    }

    #[inline(always)]
    fn assert_explorer_caller_and_resolve_event_owner(
        ref world: WorldStorage, explorer: ExplorerTroops, caller: ContractAddress,
    ) -> ContractAddress {
        if explorer.owner == DAYDREAMS_AGENT_ID {
            let agent_owner: AgentOwner = world.read_model(explorer.explorer_id);
            assert!(agent_owner.address == caller, "caller is not the agent owner");
            return StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
        }

        let explorer_owner = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
        explorer_owner.assert_caller_owner();
        explorer_owner
    }

    #[inline(always)]
    fn derive_initial_tx_random_seed(ref world: WorldStorage, source: Source) -> u256 {
        let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
        let rng: RNG = world.read_model(tx_hash);
        let mut seed = rng.seed;
        if seed.is_zero() {
            let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(
                world, selector!("vrf_provider_address"),
            );
            seed = VRFImpl::seed(source, vrf_provider);
        }
        seed + RNG_TX_SEED_INCREMENT
    }

    #[inline(always)]
    fn occupy_tile_with_existing_occupier_memory(
        ref tile: Tile, occupier_type: u8, occupier_is_structure: bool, occupier_id: ID,
    ) {
        tile.occupier_type = occupier_type;
        tile.occupier_id = occupier_id;
        tile.occupier_is_structure = occupier_is_structure;
    }

    #[inline(always)]
    fn emit_explorer_move_stories(
        ref world: WorldStorage,
        explorer: ExplorerTroops,
        explorer_owner: ContractAddress,
        caller: ContractAddress,
        explorer_id: ID,
        start_coord: Coord,
        original_directions: Span<Direction>,
        explore: bool,
        explore_find: ExploreFind,
        victory_points_grant_config: VictoryPointsGrantConfig,
        tx_hash: felt252,
        block_timestamp: u64,
    ) {
        world
            .emit_event(
                @StoryEvent {
                    id: world.dispatcher.uuid(),
                    owner: Option::Some(explorer_owner),
                    entity_id: Option::Some(explorer_id),
                    tx_hash,
                    story: Story::ExplorerMoveStory(
                        ExplorerMoveStory {
                            explorer_owner,
                            explorer_id,
                            explorer_structure_id: explorer.owner,
                            start_coord,
                            end_coord: explorer.coord,
                            directions: original_directions,
                            explore,
                            explore_find,
                        },
                    ),
                    timestamp: block_timestamp,
                },
            );

        if explore {
            let points_registered_story = PointsRegisteredStory {
                owner_address: explorer_owner,
                activity: PointsActivity::Exploration,
                points: victory_points_grant_config.explore_tiles_points.into(),
            };
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(explorer_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash,
                        story: Story::PointsRegisteredStory(points_registered_story),
                        timestamp: block_timestamp,
                    },
                );
        }

        world
            .emit_event(
                @ExplorerMoveEvent {
                    explorer_id,
                    explorer_structure_id: explorer.owner,
                    explorer_owner_address: caller,
                    explore_find: explore_find,
                    timestamp: block_timestamp,
                },
            );
    }

    #[inline(always)]
    fn grant_explorer_reward_and_emit(
        ref world: WorldStorage,
        explorer: ExplorerTroops,
        explorer_owner: ContractAddress,
        caller: ContractAddress,
        reward_tile: Tile,
        vrf_seed: u256,
        current_tick: u64,
        map_config: MapConfig,
        blitz_mode_on: bool,
        tx_hash: felt252,
        block_timestamp: u64,
    ) {
        let blitz_exploration_reward_profile_id = if blitz_mode_on {
            let blitz_exploration_config: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("blitz_exploration_config"),
            );
            iBlitzProfileImpl::resolve_blitz_profile_id(blitz_exploration_config.reward_profile_id)
        } else {
            0
        };

        let (explore_reward_type, explore_reward_amount) = if blitz_mode_on {
            iExplorerImpl::exploration_reward(
                ref world,
                Option::Some(explorer),
                current_tick,
                map_config,
                vrf_seed,
                blitz_mode_on,
                blitz_exploration_reward_profile_id,
            )
        } else {
            non_blitz_exploration_reward(explorer, current_tick, map_config, vrf_seed, block_timestamp)
        };

        if blitz_mode_on {
            let exploration_reward_receiver = iExplorerImpl::exploration_reward_receiver(
                ref world, blitz_mode_on, explorer, explore_reward_type,
            );
            grant_resource_reward_to_producing_receiver(
                ref world, exploration_reward_receiver, explore_reward_type, explore_reward_amount,
            );
        } else {
            grant_resource_reward_to_non_producing_receiver(
                ref world, explorer.explorer_id, explore_reward_type, explore_reward_amount,
            );
        }

        world
            .emit_event(
                @StoryEvent {
                    id: world.dispatcher.uuid(),
                    owner: Option::Some(explorer_owner),
                    entity_id: Option::Some(explorer.explorer_id),
                    tx_hash,
                    story: Story::ExplorerExtractRewardStory(
                        ExplorerExtractRewardStory {
                            explorer_owner,
                            explorer_id: explorer.explorer_id,
                            explorer_structure_id: explorer.owner,
                            coord: reward_tile.into(),
                            reward_resource_type: explore_reward_type,
                            reward_resource_amount: explore_reward_amount,
                        },
                    ),
                    timestamp: block_timestamp,
                },
            );

        world
            .emit_event(
                @ExplorerRewardEvent {
                    explorer_id: explorer.explorer_id,
                    explorer_structure_id: explorer.owner,
                    explorer_owner_address: caller,
                    reward_resource_id: explore_reward_type,
                    reward_resource_amount: explore_reward_amount,
                    coord: explorer.coord,
                    timestamp: block_timestamp,
                },
            );
    }

    #[inline(always)]
    fn grant_resource_reward_to_producing_receiver(
        ref world: WorldStorage, entity_id: ID, resource_type: u8, amount: u128,
    ) {
        assert!(entity_id.is_non_zero(), "entity id not found");
        assert!(resource_type.is_non_zero(), "invalid resource specified");

        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
        let mut entity_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world, entity_id, resource_type, ref entity_weight, resource_weight_grams, true,
        );
        resource.add(amount, ref entity_weight, resource_weight_grams);
        resource.store(ref world);
        entity_weight.store(ref world, entity_id);
    }

    #[inline(always)]
    fn grant_resource_reward_to_non_producing_receiver(
        ref world: WorldStorage, entity_id: ID, resource_type: u8, amount: u128,
    ) {
        assert!(entity_id.is_non_zero(), "entity id not found");
        assert!(resource_type.is_non_zero(), "invalid resource specified");

        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
        let mut entity_weight: Weight = WeightStoreImpl::retrieve(ref world, entity_id);
        let balance: u128 = ResourceImpl::read_balance(ref world, entity_id, resource_type);
        let (storable_amount, total_weight) = storable_resource_amount(
            amount, entity_weight.unused(), resource_weight_grams,
        );
        ResourceImpl::write_balance(ref world, entity_id, resource_type, balance + storable_amount);
        entity_weight.add(total_weight);
        entity_weight.store(ref world, entity_id);
    }

    #[inline(always)]
    fn storable_resource_amount(amount: u128, storage_left: u128, unit_weight: u128) -> (u128, u128) {
        let mut max_storable: u128 = amount;
        let mut total_weight: u128 = unit_weight * amount;

        if storage_left < total_weight {
            max_storable = storage_left / unit_weight;
            total_weight = max_storable * unit_weight;
        }

        (max_storable, total_weight)
    }

    #[inline(always)]
    fn non_blitz_exploration_reward(
        explorer: ExplorerTroops, current_tick: u64, map_config: MapConfig, vrf_seed: u256, block_timestamp: u64,
    ) -> (u8, u128) {
        let reward_resource_type = non_blitz_exploration_reward_resource(vrf_seed, block_timestamp);
        let reward_resource_amount = non_blitz_exploration_reward_amount(explorer, current_tick, map_config);
        (reward_resource_type, reward_resource_amount)
    }

    #[inline(always)]
    fn non_blitz_exploration_reward_amount(explorer: ExplorerTroops, current_tick: u64, map_config: MapConfig) -> u128 {
        let mut reward_resource_amount: u128 = map_config.reward_resource_amount.into();
        let mut reward_boost_percent: u128 = explorer.troops.boosts.incr_explore_reward_percent_num.into();
        if reward_boost_percent.is_zero() {
            return reward_resource_amount * RESOURCE_PRECISION;
        }
        if current_tick > explorer.troops.boosts.incr_explore_reward_end_tick.into() {
            return reward_resource_amount * RESOURCE_PRECISION;
        }

        reward_resource_amount += (reward_resource_amount * reward_boost_percent) / PercentageValueImpl::_100().into();
        reward_resource_amount * RESOURCE_PRECISION
    }

    #[inline(always)]
    fn non_blitz_exploration_reward_resource(vrf_seed: u256, block_timestamp: u64) -> u8 {
        let reward_salt: u128 = block_timestamp.into() + 18;
        let reward_roll = random(vrf_seed, reward_salt, NON_BLITZ_EXPLORATION_REWARD_WEIGHT_TOTAL);
        non_blitz_exploration_reward_resource_from_roll(reward_roll)
    }

    #[inline(always)]
    fn non_blitz_exploration_reward_resource_from_roll(reward_roll: u128) -> u8 {
        if reward_roll < 2_018_108 {
            return ResourceTypes::WOOD;
        }
        if reward_roll < 3_604_023 {
            return ResourceTypes::STONE;
        }
        if reward_roll < 5_146_478 {
            return ResourceTypes::COAL;
        }
        if reward_roll < 6_210_059 {
            return ResourceTypes::COPPER;
        }
        if reward_roll < 7_101_809 {
            return ResourceTypes::OBSIDIAN;
        }
        if reward_roll < 7_802_413 {
            return ResourceTypes::SILVER;
        }
        if reward_roll < 8_276_860 {
            return ResourceTypes::IRONWOOD;
        }
        if reward_roll < 8_661_971 {
            return ResourceTypes::COLD_IRON;
        }
        if reward_roll < 9_029_778 {
            return ResourceTypes::GOLD;
        }
        if reward_roll < 9_268_812 {
            return ResourceTypes::HARTWOOD;
        }
        if reward_roll < 9_389_536 {
            return ResourceTypes::DIAMONDS;
        }
        if reward_roll < 9_488_932 {
            return ResourceTypes::SAPPHIRE;
        }
        if reward_roll < 9_585_109 {
            return ResourceTypes::RUBY;
        }
        if reward_roll < 9_681_286 {
            return ResourceTypes::DEEP_CRYSTAL;
        }
        if reward_roll < 9_750_501 {
            return ResourceTypes::IGNIUM;
        }
        if reward_roll < 9_815_692 {
            return ResourceTypes::ETHEREAL_SILICA;
        }
        if reward_roll < 9_871_628 {
            return ResourceTypes::TRUE_ICE;
        }
        if reward_roll < 9_916_296 {
            return ResourceTypes::TWILIGHT_QUARTZ;
        }
        if reward_roll < 9_953_721 {
            return ResourceTypes::ALCHEMICAL_SILVER;
        }
        if reward_roll < 9_975_854 {
            return ResourceTypes::ADAMANTINE;
        }
        if reward_roll < 9_990_743 {
            return ResourceTypes::MITHRAL;
        }
        if reward_roll < 9_999_999 {
            return ResourceTypes::DRAGONHIDE;
        }
        ResourceTypes::EARTHEN_SHARD
    }

    #[inline(always)]
    fn burn_explorer_food_cost_with_deferred_weight_store(
        ref world: WorldStorage, explorer: ExplorerTroops, troop_stamina_config: TroopStaminaConfig, explore: bool,
    ) {
        if explorer.owner == DAYDREAMS_AGENT_ID {
            return;
        }

        let (wheat_cost, fish_cost) = food_costs_for_movement(troop_stamina_config, explore);
        let troop_count = explorer.troops.count.into() / RESOURCE_PRECISION;
        let wheat_burn_amount: u128 = wheat_cost * troop_count;
        let fish_burn_amount: u128 = fish_cost * troop_count;
        let wheat_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::WHEAT);
        let fish_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::FISH);

        let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer.owner);
        burn_structure_food_resource(
            ref world,
            explorer.owner,
            selector!("WHEAT_BALANCE"),
            selector!("WHEAT_PRODUCTION"),
            wheat_burn_amount,
            wheat_weight_grams,
            ref explorer_weight,
        );
        burn_structure_food_resource(
            ref world,
            explorer.owner,
            selector!("FISH_BALANCE"),
            selector!("FISH_PRODUCTION"),
            fish_burn_amount,
            fish_weight_grams,
            ref explorer_weight,
        );
        explorer_weight.store(ref world, explorer.owner);
    }

    #[inline(always)]
    fn food_costs_for_movement(troop_stamina_config: TroopStaminaConfig, explore: bool) -> (u128, u128) {
        if explore {
            return (
                troop_stamina_config.stamina_explore_wheat_cost.into(),
                troop_stamina_config.stamina_explore_fish_cost.into(),
            );
        }

        (troop_stamina_config.stamina_travel_wheat_cost.into(), troop_stamina_config.stamina_travel_fish_cost.into())
    }

    #[inline(always)]
    fn burn_single_step_stamina_cost(
        ref explorer: ExplorerTroops,
        troop_stamina_config: TroopStaminaConfig,
        explore: bool,
        biome: Biome,
        current_tick: u64,
    ) {
        let stamina_cost = single_step_stamina_cost(ref explorer, troop_stamina_config, explore, biome);
        explorer
            .troops
            .stamina
            .spend(
                ref explorer.troops.boosts,
                explorer.troops.category,
                explorer.troops.tier,
                troop_stamina_config,
                stamina_cost,
                current_tick,
                true,
            );
    }

    #[inline(always)]
    fn single_step_stamina_cost(
        ref explorer: ExplorerTroops, troop_stamina_config: TroopStaminaConfig, explore: bool, biome: Biome,
    ) -> u64 {
        if explore {
            return troop_stamina_config.stamina_explore_stamina_cost.into();
        }

        let mut stamina_cost: u64 = troop_stamina_config.stamina_travel_stamina_cost.into();
        let (add, stamina_bonus) = explorer.troops.stamina_travel_bonus(biome, troop_stamina_config);
        if add {
            stamina_cost += stamina_bonus.into();
        } else {
            stamina_cost -= stamina_bonus.into();
        }
        stamina_cost
    }

    #[inline(always)]
    fn burn_structure_food_resource(
        ref world: WorldStorage,
        structure_id: ID,
        balance_selector: felt252,
        production_selector: felt252,
        burn_amount: u128,
        resource_weight_grams: u128,
        ref structure_weight: Weight,
    ) {
        let resource_ptr = Model::<Resource>::ptr_from_keys(structure_id);
        let mut balance: u128 = world.read_member(resource_ptr, balance_selector);
        let mut production: Production = world.read_member(resource_ptr, production_selector);
        let produces = production.building_count.is_non_zero();
        if produces {
            harvest_active_food_production(ref production, ref balance, ref structure_weight, resource_weight_grams);
        }

        assert!(balance >= burn_amount, "insufficient food balance");
        world.write_member(resource_ptr, balance_selector, balance - burn_amount);
        if produces {
            world.write_member(resource_ptr, production_selector, production);
        }

        structure_weight.deduct(burn_amount * resource_weight_grams);
    }

    #[inline(always)]
    fn harvest_active_food_production(
        ref production: Production, ref balance: u128, ref structure_weight: Weight, resource_weight_grams: u128,
    ) {
        let now: u32 = starknet::get_block_timestamp().try_into().unwrap();
        if production.last_updated_at == now {
            return;
        }

        let start_at = production.last_updated_at;
        production.last_updated_at = now;
        let harvest_amount: u128 = ((now - start_at).into()) * production.production_rate.into();
        if harvest_amount.is_non_zero() {
            let (storable_amount, total_weight) = storable_resource_amount(
                harvest_amount, structure_weight.unused(), resource_weight_grams,
            );
            balance += storable_amount;
            structure_weight.add(total_weight);
        }
    }
}
use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig};
use crate::models::events::ExploreFind;
use crate::models::map::Tile;

#[starknet::interface]
pub trait ITroopMovementUtilSystems<T> {
    fn find_treasure(
        self: @T,
        vrf_seed: u256,
        tile: Tile,
        caller: starknet::ContractAddress,
        map_config: MapConfig,
        troop_limit_config: TroopLimitConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
        season_mode_on: bool,
    ) -> (bool, ExploreFind);
}

pub mod movement_discovery {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;
    use crate::models::agent::AgentCountImpl;
    use crate::models::config::{CombatConfigImpl, MapConfig, TroopLimitConfig, TroopStaminaConfig};
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::models::position::Coord;
    use crate::models::record::{RelicRecord, WorldRecordImpl};
    use crate::models::structure::StructureReservation;
    use crate::systems::utils::bitcoin_mine::iBitcoinMineDiscoveryImpl;
    use crate::systems::utils::camp::iCampDiscoveryImpl;
    use crate::systems::utils::holysite::iHolySiteDiscoveryImpl;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::relic::iRelicChestDiscoveryImpl;
    use crate::systems::utils::troop::iAgentDiscoveryImpl;

    pub fn find_treasure(
        ref world: WorldStorage,
        vrf_seed: u256,
        tile: Tile,
        caller: ContractAddress,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
        season_mode_on: bool,
    ) -> (bool, ExploreFind) {
        if !season_mode_on {
            discover_relic_chest_if_due(ref world, tile, map_config, vrf_seed);
        }

        if !has_enabled_personal_discovery_chance(tile, map_config, season_mode_on) {
            return (false, ExploreFind::None);
        }

        if is_structure_reserved(world, tile) {
            return (false, ExploreFind::None);
        }

        if season_mode_on && find_hyperstructure(ref world, tile, caller, map_config, troop_stamina_config, vrf_seed) {
            return (true, ExploreFind::Hyperstructure);
        }

        if find_mine(ref world, tile, season_mode_on, map_config, troop_stamina_config, vrf_seed) {
            return (true, ExploreFind::Mine);
        }

        if season_mode_on && find_holysite(ref world, tile, map_config, troop_stamina_config, vrf_seed) {
            return (true, ExploreFind::HolySite);
        }

        if tile.alt && find_bitcoin_mine(ref world, tile, map_config, troop_stamina_config, vrf_seed) {
            return (true, ExploreFind::BitcoinMine);
        }

        if !season_mode_on && find_camp(ref world, tile, map_config, troop_stamina_config, vrf_seed) {
            return (true, ExploreFind::Camp);
        }

        if find_agent(ref world, tile, map_config, troop_stamina_config, current_tick, vrf_seed) {
            return (true, ExploreFind::Agent);
        }

        return (false, ExploreFind::None);
    }

    fn has_enabled_personal_discovery_chance(tile: Tile, map_config: MapConfig, season_mode_on: bool) -> bool {
        if season_mode_on && map_config.hyps_win_prob != 0 {
            return true;
        }

        if map_config.shards_mines_win_probability != 0 {
            return true;
        }

        if season_mode_on && map_config.holysite_win_probability != 0 {
            return true;
        }

        if tile.alt && map_config.bitcoin_mine_win_probability != 0 {
            return true;
        }

        if !season_mode_on && map_config.camp_win_probability != 0 {
            return true;
        }

        map_config.agent_discovery_prob != 0
    }

    fn discover_relic_chest_if_due(ref world: WorldStorage, tile: Tile, map_config: MapConfig, vrf_seed: u256) {
        let mut relic_record: RelicRecord = WorldRecordImpl::get_member(world, selector!("relic_record"));
        if iRelicChestDiscoveryImpl::should_discover(world, relic_record, map_config) {
            iRelicChestDiscoveryImpl::discover(ref world, tile.into(), map_config, vrf_seed);
            relic_record.last_discovered_at = starknet::get_block_timestamp();
            WorldRecordImpl::set_member(ref world, selector!("relic_record"), relic_record);
        }
    }

    fn is_structure_reserved(world: WorldStorage, tile: Tile) -> bool {
        let coord: Coord = tile.into();
        let structure_reservation: StructureReservation = world.read_model(coord);
        structure_reservation.reserved
    }

    fn find_hyperstructure(
        ref world: WorldStorage,
        tile: Tile,
        caller: ContractAddress,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        if map_config.hyps_win_prob == 0 {
            return false;
        }

        let hyps_lottery_won = iHyperstructureDiscoveryImpl::lottery(world, tile.into(), map_config, vrf_seed);
        if hyps_lottery_won {
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iHyperstructureDiscoveryImpl::create(
                ref world,
                tile.into(),
                caller,
                map_config,
                troop_limit_config,
                troop_stamina_config,
                vrf_seed,
                false,
                false,
            );
            return true;
        }
        return false;
    }

    fn find_mine(
        ref world: WorldStorage,
        tile: Tile,
        season_mode_on: bool,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        if map_config.shards_mines_win_probability == 0 {
            return false;
        }

        let mine_lottery_won = iMineDiscoveryImpl::lottery(map_config, vrf_seed, world);
        if mine_lottery_won {
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iMineDiscoveryImpl::create(
                ref world, tile.into(), season_mode_on, map_config, troop_limit_config, troop_stamina_config, vrf_seed,
            );
            return true;
        }
        return false;
    }

    fn find_holysite(
        ref world: WorldStorage,
        tile: Tile,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        if map_config.holysite_win_probability == 0 {
            return false;
        }

        let holysite_lottery_won = iHolySiteDiscoveryImpl::lottery(map_config, vrf_seed, world);
        if holysite_lottery_won {
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iHolySiteDiscoveryImpl::create(ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed);
            return true;
        }
        return false;
    }

    fn find_bitcoin_mine(
        ref world: WorldStorage,
        tile: Tile,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        if map_config.bitcoin_mine_win_probability == 0 {
            return false;
        }

        let bitcoin_mine_lottery_won = iBitcoinMineDiscoveryImpl::lottery(map_config, vrf_seed, world);
        if bitcoin_mine_lottery_won {
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iBitcoinMineDiscoveryImpl::create(
                ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed,
            );
            return true;
        }
        return false;
    }

    fn find_camp(
        ref world: WorldStorage,
        tile: Tile,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        vrf_seed: u256,
    ) -> bool {
        if map_config.camp_win_probability == 0 {
            return false;
        }

        let camp_lottery_won = iCampDiscoveryImpl::lottery(map_config, vrf_seed, world);
        if camp_lottery_won {
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iCampDiscoveryImpl::create(ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed);
            return true;
        }
        return false;
    }

    fn find_agent(
        ref world: WorldStorage,
        mut tile: Tile,
        map_config: MapConfig,
        troop_stamina_config: TroopStaminaConfig,
        current_tick: u64,
        vrf_seed: u256,
    ) -> bool {
        if map_config.agent_discovery_prob == 0 {
            return false;
        }

        let agent_lottery_won = iAgentDiscoveryImpl::lottery(map_config, vrf_seed, world);
        if agent_lottery_won {
            if AgentCountImpl::limit_reached(world) {
                return false;
            }
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iAgentDiscoveryImpl::create(
                ref world, ref tile, vrf_seed, troop_limit_config, troop_stamina_config, current_tick,
            );
            return true;
        }
        return false;
    }
}

#[dojo::contract]
pub mod troop_movement_util_systems {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig};
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use super::{ITroopMovementUtilSystems, movement_discovery};

    #[abi(embed_v0)]
    impl TroopMovementUtilImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop movement systems because this changes state
            let mut world = self.world(DEFAULT_NS());
            let _caller = caller;
            let _troop_limit_config = troop_limit_config;

            assert_called_by_troop_movement_systems(world);

            movement_discovery::find_treasure(
                ref world, vrf_seed, tile, caller, map_config, troop_stamina_config, current_tick, season_mode_on,
            )
        }
    }

    fn assert_called_by_troop_movement_systems(world: WorldStorage) {
        let (troop_movement_systems_address, _) = world.dns(@"troop_movement_systems").unwrap();
        assert!(
            starknet::get_caller_address() == troop_movement_systems_address,
            "caller must be the troop movement systems",
        );
    }
}


#[dojo::contract]
pub mod hyperstructure_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl HyperstructureDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            // Hyperstructures only discoverable in season mode (non-blitz)
            if !season_mode_on {
                return (false, ExploreFind::None);
            }

            let hyps_lottery_won: bool = iHyperstructureDiscoveryImpl::lottery(
                world, tile.into(), map_config, vrf_seed,
            );
            if hyps_lottery_won {
                iHyperstructureDiscoveryImpl::create(
                    ref world,
                    tile.into(),
                    caller,
                    map_config,
                    troop_limit_config,
                    troop_stamina_config,
                    vrf_seed,
                    false,
                    false,
                );
                return (true, ExploreFind::Hyperstructure);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod mine_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl MineDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            let mine_lottery_won: bool = iMineDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if mine_lottery_won {
                iMineDiscoveryImpl::create(
                    ref world,
                    tile.into(),
                    season_mode_on,
                    map_config,
                    troop_limit_config,
                    troop_stamina_config,
                    vrf_seed,
                );
                return (true, ExploreFind::Mine);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod holysite_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl};
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::systems::utils::holysite::iHolySiteDiscoveryImpl;
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl HolySiteDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            // Holy sites only discoverable in season mode (non-blitz)
            if !season_mode_on {
                return (false, ExploreFind::None);
            }

            let holysite_lottery_won: bool = iHolySiteDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if holysite_lottery_won {
                iHolySiteDiscoveryImpl::create(
                    ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return (true, ExploreFind::HolySite);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod camp_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{MapConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl};
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::systems::utils::camp::iCampDiscoveryImpl;
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl CampDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            // Camps only discoverable in blitz mode (non-season)
            if season_mode_on {
                return (false, ExploreFind::None);
            }

            let camp_lottery_won: bool = iCampDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if camp_lottery_won {
                iCampDiscoveryImpl::create(ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed);
                return (true, ExploreFind::Camp);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod agent_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::agent::AgentCountImpl;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl AgentDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            if AgentCountImpl::limit_reached(world) {
                return (false, ExploreFind::None);
            }

            let agent_lottery_won: bool = iAgentDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if agent_lottery_won {
                iAgentDiscoveryImpl::create(
                    ref world, ref tile, vrf_seed, troop_limit_config, troop_stamina_config, current_tick,
                );
                return (true, ExploreFind::Agent);
            }
            return (false, ExploreFind::None);
        }
    }
}

#[dojo::contract]
pub mod relic_chest_discovery_systems {
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::agent::AgentCountImpl;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::models::record::{RelicRecord, WorldRecordImpl};
    use crate::systems::utils::relic::iRelicChestDiscoveryImpl;
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl RelicChestDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
        fn find_treasure(
            self: @ContractState,
            vrf_seed: u256,
            mut tile: Tile,
            caller: starknet::ContractAddress,
            map_config: MapConfig,
            troop_limit_config: TroopLimitConfig,
            troop_stamina_config: TroopStaminaConfig,
            current_tick: u64,
            season_mode_on: bool,
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // Relics only discoverable in blitz mode (non-season)
            if season_mode_on {
                return (false, ExploreFind::None);
            }

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            let mut relic_record: RelicRecord = WorldRecordImpl::get_member(world, selector!("relic_record"));
            if iRelicChestDiscoveryImpl::should_discover(world, relic_record, map_config) {
                iRelicChestDiscoveryImpl::discover(ref world, tile.into(), map_config, vrf_seed);

                // update relic record
                relic_record.last_discovered_at = starknet::get_block_timestamp();
                WorldRecordImpl::set_member(ref world, selector!("relic_record"), relic_record);
            }
            return (false, ExploreFind::None);
        }
    }
}
