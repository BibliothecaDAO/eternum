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
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        CombatConfigImpl, MapConfig, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
        VictoryPointsGrantConfig, WorldConfigUtilImpl,
    };
    use crate::models::events::{
        ExploreFind, ExplorerMoveStory, PointsActivity, PointsRegisteredStory, Story, StoryEvent,
    };
    use crate::models::hyperstructure::PlayerRegisteredPointsImpl;
    use crate::models::map::{BiomeDiscovered, Tile, TileImpl, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction};
    use crate::models::structure::StructureOwnerStoreImpl;
    use crate::models::troop::{ExplorerTroops, GuardImpl};
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::troop::iExplorerImpl;
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::map::biomes::{Biome, get_biome_from_world};
    use super::{
        ITroopMovementRewardSystemsDispatcher, ITroopMovementRewardSystemsDispatcherTrait, ITroopMovementSystems,
        ITroopMovementUtilSystemsDispatcher, ITroopMovementUtilSystemsDispatcherTrait,
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
            ref self: ContractState, explorer_id: ID, directions: Span<Direction>,
        ) -> Span<Tile> {
            let tiles_to_return = self.explorer_move(explorer_id, directions, true);
            self.explorer_extract_reward(explorer_id);
            tiles_to_return
        }

        fn explorer_extract_reward(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            let (troop_movement_reward_systems_address, _) = world.dns(@"troop_movement_reward_systems").unwrap();
            let troop_movement_reward_systems = ITroopMovementRewardSystemsDispatcher {
                contract_address: troop_movement_reward_systems_address,
            };
            troop_movement_reward_systems.extract_reward(explorer_id, starknet::get_caller_address());
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

#[starknet::interface]
pub trait ITroopMovementRewardSystems<T> {
    fn extract_reward(self: @T, explorer_id: ID, caller: starknet::ContractAddress);
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
pub mod troop_movement_reward_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{BlitzExplorationConfig, MapConfig, TickImpl, TickTrait, WorldConfigUtilImpl};
    use crate::models::events::{ExplorerExtractRewardStory, Story, StoryEvent};
    use crate::models::map::{Tile, TileImpl};
    use crate::models::map2::TileOpt;
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::StructureOwnerStoreImpl;
    use crate::models::troop::ExplorerTroops;
    use crate::models::weight::Weight;
    use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};
    use crate::systems::utils::blitz_profile::iBlitzProfileImpl;
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::troop::iExplorerImpl;
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::map::biomes::Biome;
    use super::ITroopMovementRewardSystems;
    use super::troop_movement_systems::ExplorerRewardEvent;

    #[abi(embed_v0)]
    impl TroopMovementRewardImpl of ITroopMovementRewardSystems<ContractState> {
        fn extract_reward(self: @ContractState, explorer_id: ID, caller: ContractAddress) {
            let mut world = self.world(DEFAULT_NS());
            assert_called_by_troop_movement_systems(world);

            let explorer: ExplorerTroops = assert_explorer_can_extract_reward(ref world, explorer_id);
            let mut tile = read_explorer_reward_tile(world, explorer);
            let vrf_seed = consume_explorer_reward_seed(world, tile);

            if tile.reward_extracted {
                return;
            }

            IMapImpl::mark_reward_extracted(ref world, ref tile);

            let (explore_reward_type, explore_reward_amount) = grant_explorer_reward(ref world, explorer, vrf_seed);
            emit_explorer_reward_events(
                ref world, explorer, explorer_id, tile, explore_reward_type, explore_reward_amount, caller,
            );
        }
    }

    fn assert_called_by_troop_movement_systems(world: WorldStorage) {
        let (troop_movement_systems_address, _) = world.dns(@"troop_movement_systems").unwrap();
        assert!(
            starknet::get_caller_address() == troop_movement_systems_address,
            "caller must be the troop movement systems",
        );
    }

    fn assert_explorer_can_extract_reward(ref world: WorldStorage, explorer_id: ID) -> ExplorerTroops {
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert!(explorer.coord.alt == false, "Eternum: explorer must be on surface to extract reward");
        assert!(explorer.troops.count.is_non_zero(), "explorer is dead");
        explorer
    }

    fn read_explorer_reward_tile(world: WorldStorage, explorer: ExplorerTroops) -> Tile {
        let tile_opt: TileOpt = world.read_model((explorer.coord.alt, explorer.coord.x, explorer.coord.y));
        let tile: Tile = tile_opt.into();
        assert!(explorer.explorer_id == tile.occupier_id, "tile occupier should be explorer");
        assert!(tile.biome != Biome::None.into(), "tile must be explored");
        tile
    }

    fn consume_explorer_reward_seed(world: WorldStorage, tile: Tile) -> u256 {
        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        rng_library_dispatcher.get_random_number(Source::Salt(tile.to_seed()), world)
    }

    fn grant_explorer_reward(ref world: WorldStorage, explorer: ExplorerTroops, vrf_seed: u256) -> (u8, u128) {
        let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
        let blitz_exploration_config: BlitzExplorationConfig = WorldConfigUtilImpl::get_member(
            world, selector!("blitz_exploration_config"),
        );
        let blitz_exploration_reward_profile_id = iBlitzProfileImpl::resolve_blitz_profile_id(
            blitz_exploration_config.reward_profile_id,
        );
        let current_tick: u64 = TickImpl::get_tick_interval(ref world).current();
        let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));

        let (explore_reward_type, explore_reward_amount) = iExplorerImpl::exploration_reward(
            ref world,
            Option::Some(explorer),
            current_tick,
            map_config,
            vrf_seed,
            blitz_mode_on,
            blitz_exploration_reward_profile_id,
        );

        let reward_receiver = iExplorerImpl::exploration_reward_receiver(
            ref world, blitz_mode_on, explorer, explore_reward_type,
        );
        grant_resource_reward(ref world, reward_receiver, explore_reward_type, explore_reward_amount);

        (explore_reward_type, explore_reward_amount)
    }

    fn grant_resource_reward(ref world: WorldStorage, receiver_id: ID, resource_type: u8, resource_amount: u128) {
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
        let mut reward_receiver_weight: Weight = WeightStoreImpl::retrieve(ref world, receiver_id);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world, receiver_id, resource_type, ref reward_receiver_weight, resource_weight_grams, true,
        );
        resource.add(resource_amount, ref reward_receiver_weight, resource_weight_grams);
        resource.store(ref world);
        reward_receiver_weight.store(ref world, receiver_id);
    }

    fn emit_explorer_reward_events(
        ref world: WorldStorage,
        explorer: ExplorerTroops,
        explorer_id: ID,
        tile: Tile,
        reward_resource_type: u8,
        reward_resource_amount: u128,
        caller: ContractAddress,
    ) {
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
                            reward_resource_type,
                            reward_resource_amount,
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
                    explorer_owner_address: caller,
                    reward_resource_id: reward_resource_type,
                    reward_resource_amount,
                    coord: explorer.coord,
                    timestamp: starknet::get_block_timestamp(),
                },
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
