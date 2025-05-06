use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;

#[starknet::interface]
pub trait ITroopMovementSystems<TContractState> {
    fn explorer_move(
        ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool,
    ) -> Span<Tile>;
}

#[dojo::contract]
pub mod troop_movement_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::{
        config::{
            CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
            WorldConfigUtilImpl,
        },
        map::{Tile, TileImpl, TileOccupier}, position::{CoordTrait, Direction},
        resource::resource::{ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl},
        structure::{StructureBaseStoreImpl, StructureOwnerStoreImpl}, troop::{ExplorerTroops, GuardImpl},
        weight::{Weight},
    };
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::utils::random::{VRFImpl};
    use starknet::ContractAddress;


    use super::ITroopMovementSystems;
    use super::{ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait};

    #[derive(Copy, Drop, Serde, Introspect)]
    pub enum ExploreFind {
        None,
        Hyperstructure,
        Mine,
        Agent,
        Quest,
    }

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
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();
            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // ensure explorer tile is correct
            let mut tile: Tile = world.read_model((explorer.coord.x, explorer.coord.y));
            assert!(explorer_id == tile.occupier_id, "tile occupier should be explorer");

            // remove explorer from current tile
            IMapImpl::occupy(ref world, ref tile, TileOccupier::None, 0);

            let mut explore_find = ExploreFind::None;
            let mut explore_reward_type = 0;
            let mut explore_reward_amount = 0;

            let caller = starknet::get_caller_address();

            let current_tick: u64 = TickImpl::get_tick_config(ref world).current();
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            // move explorer to target coordinate
            let mut biomes: Array<Biome> = array![];
            while true {
                // ensure next coordinate is not occupied
                let from = explorer.coord;
                let next = explorer.coord.neighbor(*(directions.pop_front().unwrap()));
                let mut tile: Tile = world.read_model((next.x, next.y));
                assert!(tile.not_occupied(), "one of the tiles in path is occupied");

                // add biome to biomes
                let biome = get_biome(next.x.into(), next.y.into());
                biomes.append(biome);

                let mut occupy_destination: bool = true;
                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");

                    // ensure target tile is not explored
                    assert!(!tile.discovered(), "tile is already explored");

                    // set tile as explored
                    IMapImpl::explore(ref world, ref tile, biome);

                    // perform lottery to discover mine
                    let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
                    let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(
                        world, selector!("vrf_provider_address"),
                    );
                    let vrf_seed: u256 = VRFImpl::seed(caller, vrf_provider);
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
                        );

                    explore_find = _explore_find;
                    if found_treasure {
                        // ensure explorer does not occupy destination tile
                        occupy_destination = false;

                        // refresh tile model
                        tile = world.read_model((next.x, next.y));
                    }

                    // grant resource reward for exploration
                    let (_explore_reward_type, _explore_reward_amount) = iExplorerImpl::exploration_reward(
                        ref world, map_config, vrf_seed,
                    );
                    explore_reward_type = _explore_reward_type;
                    explore_reward_amount = _explore_reward_amount;
                    let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_type);
                    let mut resource = SingleResourceStoreImpl::retrieve(
                        ref world, explorer_id, explore_reward_type, ref explorer_weight, resource_weight_grams, false,
                    );
                    resource.add(explore_reward_amount, ref explorer_weight, resource_weight_grams);
                    resource.store(ref world);
                    explorer_weight.store(ref world, explorer_id);
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
                        let mut from_tile: Tile = world.read_model((from.x, from.y));
                        IMapImpl::occupy(ref world, ref from_tile, tile_occupier, explorer_id);
                        world.write_model(@from_tile);
                    }
                    tiles_to_return.append(tile);
                    break;
                } else {
                    tiles_to_return.append(tile);
                }
            };

            // burn stamina cost
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            iExplorerImpl::burn_stamina_cost(
                ref world, ref explorer, troop_stamina_config, explore, biomes, current_tick,
            );

            // burn food cost
            iExplorerImpl::burn_food_cost(ref world, ref explorer, troop_stamina_config, explore);

            // emit event
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

            // emit achievement progression
            AchievementTrait::progress(
                world, explorer.owner.into(), Tasks::EXPLORE, 1, starknet::get_block_timestamp(),
            );

            tiles_to_return.span()
        }
    }
}
use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
use s1_eternum::models::map::Tile;
use s1_eternum::models::{config::{MapConfig}};
use troop_movement_systems::ExploreFind;

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
    ) -> (bool, ExploreFind);
}

#[dojo::contract]
pub mod troop_movement_util_systems {
    use dojo::model::{ModelStorage};
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::quest::{QuestFeatureFlag, QuestGameRegistry};
    use s1_eternum::models::{
        config::{CombatConfigImpl, MapConfig, QuestConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl},
    };
    use s1_eternum::systems::quest::constants::VERSION;
    use s1_eternum::systems::quest::contracts::{
        IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait, iQuestDiscoveryImpl,
    };
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use super::{ITroopMovementUtilSystems, troop_movement_systems::ExploreFind};
    use super::{ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait};

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
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop movement systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop movement systems
            let (troop_movement_systems_address, _) = world.dns(@"troop_movement_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_systems_address,
                "caller must be the troop movement systems",
            );

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
                    );
                if found_mine {
                    return (true, ExploreFind::Mine);
                } else {
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
                            let quest_lottery_won: bool = iQuestDiscoveryImpl::lottery(quest_config, vrf_seed);
                            if quest_lottery_won {
                                let (quest_system_address, _) = world.dns(@"quest_systems").unwrap();
                                let quest_system = IQuestSystemsDispatcher { contract_address: quest_system_address };
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


#[dojo::contract]
pub mod hyperstructure_discovery_systems {
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::{config::{CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl}};
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use super::{ITroopMovementUtilSystems, troop_movement_systems::ExploreFind};

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
                    ref world, tile.into(), caller, map_config, troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return (true, ExploreFind::Hyperstructure);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod mine_discovery_systems {
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::{config::{CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl}};
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use super::{ITroopMovementUtilSystems, troop_movement_systems::ExploreFind};

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
        ) -> (bool, ExploreFind) {
            // ensure caller is the troop utils systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop utils movement systems
            let (troop_movement_util_systems, _) = world.dns(@"troop_movement_util_systems").unwrap();
            assert!(
                starknet::get_caller_address() == troop_movement_util_systems,
                "caller must be the troop_movement_util_systems",
            );

            let mine_lottery_won: bool = iMineDiscoveryImpl::lottery(map_config, vrf_seed);
            if mine_lottery_won {
                iMineDiscoveryImpl::create(
                    ref world, tile.into(), map_config, troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return (true, ExploreFind::Mine);
            }
            return (false, ExploreFind::None);
        }
    }
}


#[dojo::contract]
pub mod agent_discovery_systems {
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::agent::AgentCountImpl;
    use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::{config::{CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl}};
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use super::{ITroopMovementUtilSystems, troop_movement_systems::ExploreFind};

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

            let agent_lottery_won: bool = iAgentDiscoveryImpl::lottery(map_config, vrf_seed);
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

