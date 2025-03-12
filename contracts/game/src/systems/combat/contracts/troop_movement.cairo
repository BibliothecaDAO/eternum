use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;

#[starknet::interface]
pub trait ITroopMovementSystems<TContractState> {
    fn explorer_move(ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool);
}

#[dojo::contract]
pub mod troop_movement_systems {
    use core::num::traits::zero::Zero;
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
    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::utils::random::{VRFImpl};
    use starknet::ContractAddress;


    use super::ITroopMovementSystems;
    use super::{ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait};

    #[derive(Copy, Drop, Serde)]
    pub enum ExploreTreasure {
        None,
        Hyperstructure,
        Mine,
        Agent,
    }


    #[abi(embed_v0)]
    impl TroopMovementSystemsImpl of ITroopMovementSystems<ContractState> {
        fn explorer_move(ref self: ContractState, explorer_id: ID, mut directions: Span<Direction>, explore: bool) {
            // ensure directions are not empty
            assert!(directions.len().is_non_zero(), "directions must be more than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // remove explorer from current occupier
            let mut tile: Tile = world.read_model((explorer.coord.x, explorer.coord.y));
            IMapImpl::occupy(ref world, ref tile, TileOccupier::None, 0);

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

                    let found_treasure: bool = troop_movement_util_systems
                        .find_treasure(
                            vrf_seed,
                            tile,
                            starknet::get_caller_address(),
                            map_config,
                            troop_limit_config,
                            troop_stamina_config,
                            current_tick,
                        );
                    if found_treasure {
                        // ensure explorer does not occupy destination tile
                        occupy_destination = false;

                        // refresh tile model
                        tile = world.read_model((next.x, next.y));
                    }

                    // grant resource reward for exploration
                    let (explore_reward_id, explore_reward_amount) = iExplorerImpl::exploration_reward(
                        ref world, map_config, vrf_seed,
                    );
                    let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_id);
                    let mut resource = SingleResourceStoreImpl::retrieve(
                        ref world, explorer_id, explore_reward_id, ref explorer_weight, resource_weight_grams, false,
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
                    if occupy_destination {
                        // ensure explorer does not occupy fragment mine
                        // tile when mines are discovered
                        IMapImpl::occupy(ref world, ref tile, TileOccupier::Explorer, explorer_id);
                    } else {
                        // move explorer back to previous coordinate
                        explorer.coord = from;
                        // set explorer as occupier of previous coordinate
                        let mut from_tile: Tile = world.read_model((from.x, from.y));
                        IMapImpl::occupy(ref world, ref from_tile, TileOccupier::Explorer, explorer_id);
                        world.write_model(@from_tile);
                    }
                    break;
                }
            };

            // burn stamina cost
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            iExplorerImpl::burn_stamina_cost(
                ref world, ref explorer, troop_stamina_config, explore, biomes, current_tick,
            );

            // burn food cost
            iExplorerImpl::burn_food_cost(ref world, ref explorer, troop_stamina_config, explore);

            // update explorer
            world.write_model(@explorer);
        }
    }
}
use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
use s1_eternum::models::map::Tile;


use s1_eternum::models::{config::{MapConfig}};

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
    ) -> bool;
}

#[dojo::contract]
pub mod troop_movement_util_systems {
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::config::{TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::{config::{CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, WorldConfigUtilImpl}};
    use s1_eternum::systems::utils::{
        hyperstructure::iHyperstructureDiscoveryImpl, mine::iMineDiscoveryImpl,
        troop::{iAgentDiscoveryImpl, iExplorerImpl, iTroopImpl},
    };
    use super::{ITroopMovementUtilSystems};

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
        ) -> bool {
            // ensure caller is the troop movement systems because this changes state
            let mut world = self.world(DEFAULT_NS());

            // ensure caller is the troop movement systems
            let (troop_movement_systems_address, _) = world.dns(@"troop_movement_systems").unwrap();
            assert!(starknet::get_caller_address() == troop_movement_systems_address, "caller must be the troop movement systems");
            let mut tile = tile;
            let hyps_lottery_won: bool = iHyperstructureDiscoveryImpl::lottery(
                world, tile.into(), map_config, vrf_seed,
            );
            if hyps_lottery_won {
                iHyperstructureDiscoveryImpl::create(
                    ref world, tile.into(), caller, map_config, troop_limit_config, troop_stamina_config, vrf_seed,
                );
                return true;
            } else {
                // perform lottery to discover mine
                let mine_lottery_won: bool = iMineDiscoveryImpl::lottery(map_config, vrf_seed);
                if mine_lottery_won {
                    iMineDiscoveryImpl::create(
                        ref world, tile.into(), map_config, troop_limit_config, troop_stamina_config, vrf_seed,
                    );
                    return true;
                } else {
                    let agent_lottery_won: bool = iAgentDiscoveryImpl::lottery(map_config, vrf_seed);
                    if agent_lottery_won {
                        iAgentDiscoveryImpl::create(
                            ref world, ref tile, vrf_seed, troop_limit_config, troop_stamina_config, current_tick,
                        );
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        }
    }
}
