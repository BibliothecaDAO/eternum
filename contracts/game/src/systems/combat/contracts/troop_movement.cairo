use crate::alias::ID;
use crate::models::position::Direction;

#[starknet::interface]
pub trait ITroopMovementSystems<TContractState> {
    fn explorer_move(
        ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool,
    ) -> Span<Tile>;
    fn explorer_extract_reward(ref self: TContractState, explorer_id: ID);
}

#[dojo::contract]
pub mod troop_movement_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
        VictoryPointsGrantConfig, WorldConfigUtilImpl,
    };
    use crate::models::events::{ExploreFind, ExplorerMoveStory,ExplorerExtractRewardStory, Story, StoryEvent, PointsRegisteredStory, PointsActivity};
    use crate::models::hyperstructure::PlayerRegisteredPointsImpl;
    use crate::models::map::{BiomeDiscovered, Tile, TileImpl, TileOccupier};
    use crate::models::map2::{TileOpt};
    use crate::models::position::{CoordTrait, Direction};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{StructureBaseStoreImpl, StructureOwnerStoreImpl};
    use crate::models::troop::{ExplorerTroops, GuardImpl};
    use crate::models::weight::Weight;
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::map::biomes::Biome;
    use crate::utils::random::VRFImpl;
    use starknet::ContractAddress;
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use super::{ITroopMovementSystems, ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait};

    // to be removed
    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    pub struct ExplorerMoveEvent {
        #[key]
        pub explorer_id: ID,
        pub explorer_structure_id: ID,
        pub explorer_owner_address: starknet::ContractAddress,
        pub explore_find: ExploreFind,
        pub reward_resource_type: u8,
        pub reward_resource_amount: u128,
        pub timestamp: u64,
    }

    #[abi(embed_v0)]
    impl TroopMovementSystemsImpl of ITroopMovementSystems<ContractState> {
        fn explorer_move(
            ref self: ContractState, explorer_id: ID, mut directions: Span<Direction>, explore: bool,
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
            let mut explore_reward_type = 0;
            let mut explore_reward_amount = 0;

            let caller = starknet::get_caller_address();

            let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let victory_points_grant_config: VictoryPointsGrantConfig = WorldConfigUtilImpl::get_member(
                world, selector!("victory_points_grant_config"),
            );
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let season_mode_on = !blitz_mode_on;
            // move explorer to target coordinate
            let mut biomes: Array<Biome> = array![];
            while true {

                // todo: for the alternate map feature, it is very simple.
                // simply add 15 steps to whatever direction the explorer is moving towards
                // let next = explorer.coord.neighbor_after_distance(*(directions.pop_front().unwrap()), 15);


                // ensure next coordinate is not occupied
                let from = explorer.coord;
                let next = explorer.coord.neighbor(*(directions.pop_front().unwrap()));
                let tile_opt: TileOpt = world.read_model((next.alt, next.x, next.y));
                let mut tile: Tile = tile_opt.into(); 
                assert!(tile.not_occupied(), "one of the tiles in path is occupied");

                // add biome to biomes
                let biome_library = biome_library::get_dispatcher(@world);
                let biome = biome_library.get_biome(next.alt, next.x.into(), next.y.into());
                biomes.append(biome);

                let mut occupy_destination: bool = true;
                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");

                    // ensure target tile is not explored
                    assert!(!tile.discovered(), "tile is already explored");

                    // set tile as explored
                    IMapImpl::explore(ref world, ref tile, biome);

                    // register points for player
                    PlayerRegisteredPointsImpl::register_points(
                        ref world, caller, victory_points_grant_config.explore_tiles_points.into(),
                    );

                    // perform lottery to discover mine
                    let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
                    let rng_library_dispatcher = rng_library::get_dispatcher(@world);
                    let vrf_seed: u256 = rng_library_dispatcher.get_random_number(caller, world);
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
                        ExploreFind::Village => { // AchievementTrait::progress(
                        //     world, caller.into(), Tasks::VILLAGE_DISCOVER, 1, starknet::get_block_timestamp(),
                        // );
                        },
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

                        let from_tile_opt: TileOpt = from_tile.into();
                        world.write_model(@from_tile_opt);
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
                        reward_resource_type: explore_reward_type,
                        reward_resource_amount: explore_reward_amount,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // update explorer
            world.write_model(@explorer);

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
            let mut tile: Tile =tile_opt.into();
            assert!(explorer_id == tile.occupier_id, "tile occupier should be explorer");
            assert!(tile.biome != Biome::None.into(), "tile must be explored");
            assert!(tile.reward_extracted == false, "tile reward already extracted");

            // mark reward as extracted
            IMapImpl::mark_reward_extracted(ref world, ref tile);

            // get relevant data to grant reward
            let caller = starknet::get_caller_address();
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let rng_library_dispatcher = rng_library::get_dispatcher(@world);
            let vrf_seed: u256 = rng_library_dispatcher.get_random_number(caller, world);

            // grant resource reward for exploration
            let (explore_reward_type, explore_reward_amount) = iExplorerImpl::exploration_reward(
                ref world, Option::Some(explorer), current_tick, map_config, vrf_seed, blitz_mode_on,
            );

            let exploration_reward_receiver: ID = iExplorerImpl::exploration_reward_receiver(
                ref world, explorer, explore_reward_type,
            );
            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_type);
            let mut reward_receiver_weight: Weight = WeightStoreImpl::retrieve(
                ref world, exploration_reward_receiver,
            );
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

#[dojo::contract]
pub mod troop_movement_util_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, QuestConfig, SeasonConfigImpl, TickImpl, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::ExploreFind;
    use crate::models::map::Tile;
    use crate::models::position::Coord;
    use crate::models::quest::{QuestFeatureFlag, QuestGameRegistry};
    use crate::models::structure::StructureReservation;
    use crate::systems::quest::constants::VERSION;
    use crate::systems::quest::contracts::{
        IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait, iQuestDiscoveryImpl,
    };
    use crate::systems::utils::hyperstructure::iHyperstructureDiscoveryImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl};
    use super::{
        ITroopMovementUtilSystems, ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait,
    };

    #[abi(embed_v0)]
    impl TroopMovementUtilImpl of ITroopMovementUtilSystems<ContractState> {
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
            // ensure caller is the troop movement systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop movement systems
            let (troop_movement_systems_address, _) = world.dns(@"troop_movement_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_systems_address,
                "caller must be the troop movement systems",
            );

            //////////////////////////////////////
            /// TIME BASED GLOBAL DISCOVERY
            //////////////////////////////////////

            // note that relic chests cant be found on reserved tiles. the logic for
            // that is handled in iRelicChestDiscoveryImpl::discover
            let (relic_chest_discovery_systems, _) = world.dns(@"relic_chest_discovery_systems").unwrap();
            let relic_chest_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                contract_address: relic_chest_discovery_systems,
            };
            relic_chest_discovery_systems
                .find_treasure(
                    vrf_seed,
                    tile,
                    caller,
                    map_config,
                    troop_limit_config,
                    troop_stamina_config,
                    current_tick,
                    season_mode_on,
                );

            //////////////////////////////////////
            /// LOTTERY BASED PERSONAL DISCOVERY
            //////////////////////////////////////

            // If the tile is reserved, no structure discovery can happen on it
            let coord: Coord = tile.into();
            let structure_reservation: StructureReservation = world.read_model(coord);
            if structure_reservation.reserved {
                return (false, ExploreFind::None);
            }

            let (hyperstructure_discovery_systems, _) = world.dns(@"hyperstructure_discovery_systems").unwrap();
            let hyperstructure_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                contract_address: hyperstructure_discovery_systems,
            };

            let (found_hyperstructure, _) = hyperstructure_discovery_systems
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
            if found_hyperstructure {
                return (true, ExploreFind::Hyperstructure);
            } else {
                // perform lottery to discover mine
                let (mine_discovery_systems, _) = world.dns(@"mine_discovery_systems").unwrap();
                let mine_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                    contract_address: mine_discovery_systems,
                };
                let (found_mine, _) = mine_discovery_systems
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
                if found_mine {
                    return (true, ExploreFind::Mine);
                } else {
                    // perform lottery to discover village
                    let (village_discovery_systems, _) = world.dns(@"village_discovery_systems").unwrap();
                    let village_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                        contract_address: village_discovery_systems,
                    };
                    let (found_village, _) = village_discovery_systems
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
                    if found_village {
                        return (true, ExploreFind::Village);
                    } else {
                        // perform lottery to discover agent
                        let (agent_discovery_systems, _) = world.dns(@"agent_discovery_systems").unwrap();
                        let agent_discovery_systems = ITroopMovementUtilSystemsDispatcher {
                            contract_address: agent_discovery_systems,
                        };

                        let (found_agent, _) = agent_discovery_systems
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
                        if found_agent {
                            return (true, ExploreFind::Agent);
                        } else {
                            let quest_config: QuestConfig = WorldConfigUtilImpl::get_member(
                                world, selector!("quest_config"),
                            );
                            let quest_game_registry: QuestGameRegistry = world.read_model(VERSION);
                            let feature_toggle: QuestFeatureFlag = world.read_model(VERSION);
                            let quest_game_count = quest_game_registry.games.len();
                            if quest_game_count > 0 && feature_toggle.enabled {
                                let quest_lottery_won: bool = iQuestDiscoveryImpl::lottery(
                                    quest_config, vrf_seed, world,
                                );
                                if quest_lottery_won {
                                    let (quest_system_address, _) = world.dns(@"quest_systems").unwrap();
                                    let quest_system = IQuestSystemsDispatcher {
                                        contract_address: quest_system_address,
                                    };
                                    quest_system.create_quest(tile, vrf_seed);
                                    return (true, ExploreFind::Quest);
                                }
                            }
                            return (false, ExploreFind::None);
                        }
                    }
                }
            }
        }
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
pub mod village_discovery_systems {
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
    use crate::systems::utils::village::iVillageDiscoveryImpl;
    use super::ITroopMovementUtilSystems;

    #[abi(embed_v0)]
    impl VillageDiscoveryImpl of ITroopMovementUtilSystems<ContractState> {
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

            let village_lottery_won: bool = iVillageDiscoveryImpl::lottery(map_config, vrf_seed, world);
            if village_lottery_won {
                iVillageDiscoveryImpl::create(
                    ref world, tile.into(), troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return (true, ExploreFind::Village);
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

