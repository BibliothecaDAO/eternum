use crate::troops::Coord;
// TileOpt preserves the original packed wire layout.
const REWARD_EXTRACTED_FLAG: u128 = 0x20000000000000000000000000000;
const LAYER_FLAG: u128 = 0x80000000000000000000000000000000;
const COL_SCALE: u128 = 0x200000000000000000000;
const ROW_SCALE: u128 = 0x2000000000000;
const BIOME_SCALE: u128 = 0x20000000000;
const ENTITY_RANGE: u128 = 0x100000000;
const OCCUPIER_SCALE: u128 = 0x200;
const RESERVED_HYPERSTRUCTURE: u128 = 39;
const BYTE_RANGE: u128 = 0x100;

#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct TileKey {
    pub game_id: u32,
    pub alt: bool,
    pub col: u32,
    pub row: u32,
}

#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct TileOpt {
    pub data: u128,
}

#[starknet::component]
pub mod MapState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowMemberSet, RowSet};
    use super::{
        BIOME_SCALE, BYTE_RANGE, ENTITY_RANGE, OCCUPIER_SCALE, RESERVED_HYPERSTRUCTURE, TileKey, TileOpt,
        coordinate_bits,
    };

    #[storage]
    pub struct Storage {
        pub tiles: Map<(u32, bool, u32, u32), u128>,
        pub exists: Map<(u32, bool, u32, u32), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn tile(self: @ComponentState<TContractState>, key: TileKey) -> Option<TileOpt> {
            let storage_key = (key.game_id, key.alt, key.col, key.row);
            if self.exists.read(storage_key) {
                Some(TileOpt { data: self.tiles.read(storage_key) })
            } else {
                None
            }
        }

        fn reveal(ref self: ComponentState<TContractState>, key: TileKey, biome: u8) {
            assert!(key.game_id != 0, "reserved game id");
            assert!(biome > 0 && biome <= 17, "invalid biome");
            let storage_key = (key.game_id, key.alt, key.col, key.row);
            let tile = self.tile(key);
            let previous = tile.map(|tile| tile.data).unwrap_or(coordinate_bits(key));
            assert!((previous / BIOME_SCALE) % BYTE_RANGE == 0, "tile already revealed");
            let data = previous + biome.into() * BIOME_SCALE;
            self.tiles.write(storage_key, data);
            if tile.is_none() {
                self.exists.write(storage_key, true);
            }
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() });
        }

        fn occupy(
            ref self: ComponentState<TContractState>, key: TileKey, entity_id: u32, category: u8, is_structure: bool,
        ) {
            let tile = self.tile(key).unwrap_or(TileOpt { data: coordinate_bits(key) });
            assert!(tile.data % 2 == 0, "cannot occupy structure");
            assert!(entity_id != 0 && category != 0, "empty occupier");
            assert!(tile.data % BIOME_SCALE == 0, "occupied tile");
            let data = tile.data
                + entity_id.into() * OCCUPIER_SCALE
                + category.into() * 2
                + if is_structure {
                    1
                } else {
                    0
                };
            self.write_occupancy(key, data);
        }

        fn reserve_hyperstructure(ref self: ComponentState<TContractState>, key: TileKey) {
            let tile = self.tile(key).expect('unrevealed reservation');
            assert!(tile.data % BIOME_SCALE == 0, "occupied reservation tile");
            self.write_occupancy(key, tile.data + RESERVED_HYPERSTRUCTURE * 2 + 1);
        }
        fn release_hyperstructure(ref self: ComponentState<TContractState>, key: TileKey) {
            let tile = self.tile(key).expect('missing reservation');
            assert!((tile.data / 2) % BYTE_RANGE == RESERVED_HYPERSTRUCTURE, "hyperstructure already created");
            self.write_occupancy(key, tile.data - tile.data % BIOME_SCALE);
        }
        fn upgrade_realm(
            ref self: ComponentState<TContractState>, key: TileKey, entity_id: u32, wonder: bool, level: u8,
        ) {
            let tile = self.tile(key).expect('missing realm tile');
            assert!(!key.alt && tile.data % 2 == 1, "not a surface structure");
            assert!((tile.data / OCCUPIER_SCALE) % ENTITY_RANGE == entity_id.into(), "occupier mismatch");
            let previous = (tile.data / 2) % BYTE_RANGE;
            assert!(previous >= 1 && previous <= 8, "not a realm tile");
            assert!(level <= 3, "invalid realm level");
            let category: u128 = level.into() + if wonder {
                5
            } else {
                1
            };
            self.write_occupancy(key, tile.data - previous * 2 + category * 2);
        }

        fn vacate(ref self: ComponentState<TContractState>, key: TileKey, entity_id: u32) {
            let tile = self.tile(key).expect('undiscovered tile');
            assert!(tile.data % 2 == 0, "cannot vacate structure");
            assert!(
                entity_id != 0 && (tile.data / OCCUPIER_SCALE) % ENTITY_RANGE == entity_id.into(), "occupier mismatch",
            );
            self.write_occupancy(key, tile.data - tile.data % BIOME_SCALE);
        }

        fn write_occupancy(ref self: ComponentState<TContractState>, key: TileKey, data: u128) {
            let storage_key = (key.game_id, key.alt, key.col, key.row);
            let existed = self.exists.read(storage_key);
            self.tiles.write(storage_key, data);
            if !existed {
                self.exists.write(storage_key, true);
            }
            let mut keys = array![];
            key.serialize(ref keys);
            if !existed {
                self
                    .emit(
                        RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() },
                    );
                return;
            }
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'TileOpt',
                        member: 'data',
                        keys: keys.span(),
                        values: array![data.into()].span(),
                    },
                );
        }
    }
}

#[starknet::interface]
pub trait IMap<T> {
    fn biome(self: @T, key: TileKey) -> u8;
    fn discovery(
        self: @T, key: TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
    ) -> crate::discovery::Discovery;
    fn tile(self: @T, key: TileKey) -> Option<TileOpt>;
    fn reveal(ref self: T, key: TileKey, biome: u8);
    fn reveal_structure_surroundings(ref self: T, game_id: u32, coord: Coord);
    fn occupy(ref self: T, key: TileKey, entity_id: u32, category: u8, is_structure: bool);
    fn upgrade_realm(ref self: T, key: TileKey, entity_id: u32, wonder: bool, level: u8);
    fn vacate(ref self: T, key: TileKey, entity_id: u32);
}

#[starknet::contract]
pub mod MapDomain {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::geometry::{distance, spire_neighbor, tile_key};
    use crate::lifecycle::Lifecycle;
    use crate::settlement::{
        ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, SettlementPool, SettlementPoolState,
    };
    use crate::troops::Coord;
    use super::{BIOME_SCALE, BYTE_RANGE, MapState, TileKey, TileOpt};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: MapState, storage: map, event: MapEvent);
    component!(path: SettlementPoolState, storage: settlements, event: SettlementEvent);
    impl SettlementInternal = SettlementPoolState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl MapInternal = MapState::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        spire_layouts: starknet::storage::Map<u32, Option<crate::spires::SpireLayout>>,
        exploration_rewards: starknet::storage::Map<(u32, u32), crate::exploration_rewards::ExplorationReward>,
        exploration_reward_count: starknet::storage::Map<u32, u32>,
        last_relic_discovery: starknet::storage::Map<u32, u64>,
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        map: MapState::Storage,
        #[substorage(v0)]
        settlements: SettlementPoolState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        MapEvent: MapState::Event,
        SettlementEvent: SettlementPoolState::Event,
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Spires of crate::spires::ISpires<ContractState> {
        fn initialize_spires(ref self: ContractState, game_id: u32, layout: crate::spires::SpireLayout) {
            self.lifecycle.assert_configurator();
            let peers = self.lifecycle.require_active();
            let games = IGameDispatcher { contract_address: peers.season };
            assert!(!games.rules(game_id).blitz_mode_on, "spires require an Eternum game");
            assert!(self.spire_layouts.read(game_id).is_none(), "spires already initialized");
            crate::spires::validate(layout);
            let center = self.map_center(game_id);
            for ordinal in 0_u32..layout.count.into() {
                self.create_spire(game_id, crate::spires::location(center, layout, ordinal));
            }
            self.spire_layouts.write(game_id, Some(layout));
            let mut values = array![];
            layout.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1, model: 'SpireLayout', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn spire_layout(self: @ContractState, game_id: u32) -> Option<crate::spires::SpireLayout> {
            self.spire_layouts.read(game_id)
        }
        fn place_spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            self.create_spire(game_id, coord)
        }
    }
    #[abi(embed_v0)]
    impl SeasonPlacement of crate::realms::ISeasonPlacement<ContractState> {
        fn claim_season_settlement(ref self: ContractState, game_id: u32, settled_count: u16, seed: u256) -> Coord {
            let settlement = self.lifecycle.require_active().settlement;
            assert!(get_caller_address() == settlement, "only settlement domain");
            let mut rules = ISettlementViewsDispatcher { contract_address: settlement }.settlement_rules(game_id);
            assert!(rules.mode == crate::settlement::SettlementMode::Single, "season settlement requires one realm");
            rules.registration_limit = 0xffff;
            let center = self.map_center(game_id);
            for _ in 0..64_u32 {
                let coords = self.settlements.claim(game_id, center, rules, settled_count, seed);
                let coord = *coords.at(0);
                let occupied = self
                    .map
                    .tile(tile_key(game_id, coord))
                    .map(|tile| (tile.data / 2) % BYTE_RANGE != 0)
                    .unwrap_or(false);
                if !occupied {
                    return coord;
                }
            }
            panic!("no vacant settlement in search limit")
        }
    }
    #[abi(embed_v0)]
    impl Settlements of crate::settlement::ISettlementPool<ContractState> {
        fn reserved_hyperstructures(self: @ContractState, game_id: u32) -> u32 {
            self.settlements.reserved_hyperstructures.read(game_id)
        }
        fn settlement_pool(self: @ContractState, game_id: u32) -> SettlementPool {
            let settlement = self.lifecycle.require_active().settlement;
            let rules = ISettlementViewsDispatcher { contract_address: settlement }.settlement_rules(game_id);
            let center = self.map_center(game_id);
            self.settlements.pool(game_id, center, rules)
        }
        fn village_pool(self: @ContractState, game_id: u32) -> SettlementPool {
            let settlement = self.lifecycle.require_active().settlement;
            let rules = ISettlementViewsDispatcher { contract_address: settlement }.settlement_rules(game_id);
            self.settlements.village_pool(game_id, self.map_center(game_id), rules)
        }
        fn claim_village(ref self: ContractState, game_id: u32, registered: u16, seed: u256) -> Coord {
            let settlement = self.lifecycle.require_active().settlement;
            assert!(get_caller_address() == settlement, "only settlement domain");
            let rules = ISettlementViewsDispatcher { contract_address: settlement }.settlement_rules(game_id);
            self.settlements.claim_village(game_id, self.map_center(game_id), rules, registered, seed)
        }
        fn claim_settlement(ref self: ContractState, game_id: u32, registered: u16, seed: u256) -> Span<Coord> {
            let settlement = self.lifecycle.require_active().settlement;
            assert!(get_caller_address() == settlement, "only settlement domain");
            let rules = ISettlementViewsDispatcher { contract_address: settlement }.settlement_rules(game_id);
            let center = self.map_center(game_id);
            self.settlements.claim(game_id, center, rules, registered, seed)
        }
    }
    #[abi(embed_v0)]
    impl Reservations of crate::settlement::IBlitzReservations<ContractState> {
        fn reserve_hyperstructures(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            count: u8,
            context: crate::commands::ExecutionContext,
        ) {
            let season = self.lifecycle.require_active().season;
            assert!(get_caller_address() == season, "only season domain");
            self.reserve_sites(game_id, count, context.timestamp);
        }
        fn initialize_reservations(ref self: ContractState, game_id: u32) {
            assert!(get_caller_address() == self.lifecycle.require_active().registry, "only registrar domain");
            self.reserve_sites(game_id, 255, starknet::get_block_timestamp());
        }

        fn release_hyperstructure(ref self: ContractState, game_id: u32, coord: Coord) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            self.map.release_hyperstructure(tile_key(game_id, coord));
        }
    }
    #[abi(embed_v0)]
    impl Map of super::IMap<ContractState> {
        fn biome(self: @ContractState, key: TileKey) -> u8 {
            let season = IGameDispatcher { contract_address: self.lifecycle.require_active().season };
            let rules = season.rules(key.game_id);
            crate::biome::get_biome_with_climate(key.alt, key.col.into(), key.row.into(), rules.biome_climate_config)
                .into()
        }
        fn discovery(
            self: @ContractState, key: TileKey, seed: u256, hyperstructures: u32, timestamp: u64,
        ) -> crate::discovery::Discovery {
            let season = IGameDispatcher { contract_address: self.lifecycle.require_active().season };
            let rules = season.rules(key.game_id);
            let coord = Coord { alt: key.alt, x: key.col, y: key.row };
            if key.alt {
                let mut adjacent = false;
                for direction in 0_u8..6 {
                    let tile = self.map.tile(tile_key(key.game_id, spire_neighbor(coord, direction)));
                    if tile.map(|tile| (tile.data / 2) % BYTE_RANGE == 35).unwrap_or(false) {
                        adjacent = true;
                    }
                }
                crate::discovery::ethereal(
                    rules.map_config, rules.bitcoin_mine_config.enabled, adjacent, seed, timestamp,
                )
            } else {
                let center = Coord {
                    alt: false, x: 2147483646 - rules.map_center_offset, y: 2147483646 - rules.map_center_offset,
                };
                crate::discovery::surface(
                    rules.map_config, seed, timestamp, distance(coord, center), hyperstructures, rules.blitz_mode_on,
                )
            }
        }
        fn tile(self: @ContractState, key: TileKey) -> Option<TileOpt> {
            self.map.tile(key)
        }
        fn reveal_structure_surroundings(ref self: ContractState, game_id: u32, coord: Coord) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            for direction in 0_u8..6 {
                let key = tile_key(game_id, crate::geometry::neighbor(coord, direction));
                let data = self.map.tile(key).map(|tile| tile.data).unwrap_or(0);
                if data / BIOME_SCALE % BYTE_RANGE == 0 {
                    self.map.reveal(key, self.biome(key));
                }
            }
        }
        fn reveal(ref self: ContractState, key: TileKey, biome: u8) {
            self.assert_domain_caller();
            self.map.reveal(key, biome);
        }
        fn occupy(ref self: ContractState, key: TileKey, entity_id: u32, category: u8, is_structure: bool) {
            let peers = self.lifecycle.require_active();
            let expected = if is_structure {
                peers.structures
            } else {
                peers.troops
            };
            assert!(get_caller_address() == expected, "wrong occupier domain");
            self.map.occupy(key, entity_id, category, is_structure);
        }
        fn upgrade_realm(ref self: ContractState, key: TileKey, entity_id: u32, wonder: bool, level: u8) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            self.map.upgrade_realm(key, entity_id, wonder, level);
        }
        fn vacate(ref self: ContractState, key: TileKey, entity_id: u32) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.troops, "only troops domain");
            self.map.vacate(key, entity_id);
        }
    }
    #[abi(embed_v0)]
    impl Extraction of crate::exploration_rewards::IExtraction<ContractState> {
        fn configure_extraction(
            ref self: ContractState, game_id: u32, rewards: Span<crate::exploration_rewards::ExplorationReward>,
        ) {
            self.lifecycle.assert_configurator();
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }.game(game_id);
            assert!(self.exploration_reward_count.read(game_id) == 0, "immutable extraction rewards");
            assert!(!rewards.is_empty(), "empty exploration pool");
            let mut total: u128 = 0;
            for index in 0..rewards.len() {
                let reward = *rewards.at(index);
                assert!(reward.resource_type > 0 && reward.resource_type <= 58, "invalid reward resource");
                total += reward.weight;
                self.exploration_rewards.write((game_id, index), reward);
            }
            assert!(total != 0, "empty exploration pool");
            self.exploration_reward_count.write(game_id, rewards.len());
            let mut values = array![];
            rewards.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'ExtractionRewards',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn extraction_rewards(
            self: @ContractState, game_id: u32,
        ) -> Span<crate::exploration_rewards::ExplorationReward> {
            let count = self.exploration_reward_count.read(game_id);
            assert!(count != 0, "missing extraction rewards");
            let mut rewards = array![];
            for index in 0..count {
                rewards.append(self.exploration_rewards.read((game_id, index)));
            }
            rewards.span()
        }
        fn extract_exploration_reward(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            explorer_id: u32,
            context: crate::commands::ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(
                get_caller_address() == peers.season || get_caller_address() == peers.troops,
                "only authenticated command domain",
            );
            crate::commands::assert_context_time(context.timestamp);
            let games = IGameDispatcher { contract_address: peers.season };
            let game = games.game(game_id);
            crate::game::assert_playing(game, context.timestamp);
            let explorer = crate::troops::ITroopsDispatcherTrait::authorized_explorer(
                crate::troops::ITroopsDispatcher { contract_address: peers.troops },
                crate::troops::ExplorerKey { game_id, explorer_id },
                actor,
            );
            assert!(!explorer.coord.alt, "extraction requires surface");
            assert!(explorer.troops.count != 0, "explorer is dead");
            let key = tile_key(game_id, explorer.coord);
            let tile = self.map.tile(key).expect('unrevealed extraction tile');
            assert!(
                (tile.data / super::OCCUPIER_SCALE) % super::ENTITY_RANGE == explorer_id.into(),
                "explorer does not occupy tile",
            );
            assert!(tile.data / BIOME_SCALE % BYTE_RANGE != 0, "tile must be revealed");
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, game.seed);
            if tile.data / super::REWARD_EXTRACTED_FLAG % 2 == 1 {
                return;
            }
            let rules = games.rules(game_id);
            let reward = crate::exploration_rewards::draw(self.extraction_rewards(game_id), seed, context.timestamp);
            let amount = crate::exploration_rewards::boosted_amount(
                reward.amount, explorer.troops.boosts, context.timestamp / rules.tick_config.armies_tick_in_seconds,
            );
            let receiver = crate::exploration_rewards::receiver(
                rules.blitz_mode_on, explorer_id, explorer.owner, reward.resource_type,
            );
            crate::exploration_rewards::IExplorationGrantDispatcherTrait::grant_exploration_reward(
                crate::exploration_rewards::IExplorationGrantDispatcher { contract_address: peers.resources },
                crate::resources::ResourceKey { game_id, entity_id: receiver },
                reward.resource_type,
                amount,
                context.timestamp,
            );
            self.map.write_occupancy(key, tile.data + super::REWARD_EXTRACTED_FLAG);
            self
                .record_extraction(
                    game_id,
                    actor,
                    context.timestamp,
                    crate::exploration_rewards::ExtractedReward {
                        explorer_id, receiver, coord: explorer.coord, resource_type: reward.resource_type, amount,
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl RelicMap of crate::relics::IRelicMap<ContractState> {
        fn relic_discovery_time(self: @ContractState, game_id: u32) -> u64 {
            self.last_relic_discovery.read(game_id)
        }
        fn discover_relic_chest(ref self: ContractState, game_id: u32, coord: Coord, seed: u256, timestamp: u64) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.troops, "only troops domain");
            crate::commands::assert_context_time(timestamp);
            let games = IGameDispatcher { contract_address: peers.season };
            let rules = games.rules(game_id);
            if !rules.blitz_mode_on || coord.alt {
                return;
            }
            if self.last_relic_discovery.read(game_id)
                + Into::<u16, u64>::into(rules.map_config.relic_discovery_interval_sec) > timestamp {
                return;
            }
            let mut destination = crate::relics::chest_destination(
                coord, seed, timestamp, rules.map_config.relic_hex_dist_from_center,
            );
            loop {
                let key = tile_key(game_id, destination);
                let data = self.map.tile(key).map(|tile| tile.data).unwrap_or(0);
                if data % BIOME_SCALE == 0 && !self.settlements.reserved.read((game_id, destination.x, destination.y)) {
                    if data / BIOME_SCALE % BYTE_RANGE == 0 {
                        self.map.reveal(key, self.biome(key));
                    }
                    self.map.occupy(key, games.allocate_entity(game_id), 34, false);
                    break;
                }
                destination = crate::geometry::neighbor(destination, 0);
            }
            self.last_relic_discovery.write(game_id, timestamp);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'RelicDiscovery',
                        keys: array![game_id.into()].span(),
                        values: array![timestamp.into()].span(),
                    },
                );
        }
        fn consume_relic_chest(ref self: ContractState, game_id: u32, coord: Coord) {
            assert!(get_caller_address() == self.lifecycle.require_active().economy, "only economy domain");
            let key = tile_key(game_id, coord);
            let tile = self.map.tile(key).expect('missing chest tile');
            assert!(tile.data % 2 == 0 && (tile.data / 2) % BYTE_RANGE == 34, "tile is not a relic chest");
            let id = ((tile.data / super::OCCUPIER_SCALE) % super::ENTITY_RANGE).try_into().unwrap();
            self.map.vacate(key, id);
        }
        fn reveal_relic_ring(ref self: ContractState, game_id: u32, coord: Coord, radius: u8) {
            assert!(get_caller_address() == self.lifecycle.require_active().troops, "only troops domain");
            assert!(radius == 1 || radius == 2, "invalid relic radius");
            for radius in 1_u32..Into::<u8, u32>::into(radius) + 1 {
                let mut next = crate::geometry::neighbor_at_distance(coord, 4, radius);
                for direction in 0_u8..6 {
                    for _ in 0..radius {
                        let key = tile_key(game_id, next);
                        let data = self.map.tile(key).map(|tile| tile.data).unwrap_or(0);
                        if data / BIOME_SCALE % BYTE_RANGE == 0 {
                            self.map.reveal(key, self.biome(key));
                        }
                        next = crate::geometry::neighbor(next, direction);
                    }
                }
            }
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn reserve_sites(ref self: ContractState, game_id: u32, count: u8, timestamp: u64) {
            let season = self.lifecycle.require_active().season;
            let game = IGameDispatcher { contract_address: season }.game(game_id);
            let game_rules = IGameDispatcher { contract_address: season }.rules(game_id);
            assert!(game_rules.blitz_mode_on, "not a Blitz game");
            assert!(game.end_at == 0 || timestamp < game.end_at, "game ended");
            let rules = ISettlementViewsDispatcher { contract_address: self.lifecycle.require_active().settlement }
                .settlement_rules(game_id);
            let required = crate::settlement_grid::reservation_count(rules.registration_limit, rules.mode);
            let center = self.map_center(game_id);
            let mut placed = self.settlements.reserved_hyperstructures.read(game_id);
            let last = core::cmp::min(required, placed + count.into());
            while placed < last {
                let coord = crate::settlement_grid::reservation_location(
                    center, rules.mode, rules.reward_profile, placed,
                );
                let key = tile_key(game_id, coord);
                let previous = self.map.tile(key).map(|tile| tile.data).unwrap_or(0);
                assert!(previous % BIOME_SCALE == 0, "occupied reservation tile");
                if previous / BIOME_SCALE % BYTE_RANGE == 0 {
                    self.map.reveal(key, self.biome(key));
                }
                self.map.reserve_hyperstructure(key);
                placed += 1;
            }
            if placed != self.settlements.reserved_hyperstructures.read(game_id) {
                self.settlements.reserved_hyperstructures.write(game_id, placed);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'HyperstructureReservations',
                            keys: array![game_id.into()].span(),
                            values: array![placed.into()].span(),
                        },
                    );
            }
        }

        fn create_spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            for alt in array![false, true] {
                let tile = self.map.tile(tile_key(game_id, Coord { alt, ..coord }));
                assert!(tile.map(|value| (value.data / 2) % BYTE_RANGE == 0).unwrap_or(true), "spire tile occupied");
            }
            let id = IGameDispatcher { contract_address: self.lifecycle.require_active().season }
                .allocate_entity(game_id);
            for alt in array![false, true] {
                let center = Coord { alt, ..coord };
                self.reveal_spire_access(game_id, center);
                self.map.occupy(tile_key(game_id, center), id, 35, true);
                for direction in 0_u8..6 {
                    self.reveal_spire_access(game_id, spire_neighbor(center, direction));
                }
            }
            id
        }
        fn reveal_spire_access(ref self: ContractState, game_id: u32, coord: Coord) {
            let key = tile_key(game_id, coord);
            let data = self.map.tile(key).map(|tile| tile.data).unwrap_or(0);
            if data / BIOME_SCALE % BYTE_RANGE == 0 {
                self.map.reveal(key, self.biome(key));
            }
        }

        fn map_center(self: @ContractState, game_id: u32) -> Coord {
            let rules = IGameDispatcher { contract_address: self.lifecycle.require_active().season }.rules(game_id);
            let center = 2147483646 - rules.map_center_offset;
            Coord { alt: false, x: center, y: center }
        }
        fn record_extraction(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            timestamp: u64,
            reward: crate::exploration_rewards::ExtractedReward,
        ) {
            let games = IGameDispatcher { contract_address: self.lifecycle.require_active().season };
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: games.allocate_entity(game_id),
                        entity_id: Some(reward.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::ExplorationReward(reward),
                    },
                );
        }
        fn assert_domain_caller(self: @ContractState) {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(caller == peers.troops || caller == peers.structures, "only gameplay domain");
        }
    }
}

fn coordinate_bits(key: TileKey) -> u128 {
    (if key.alt {
        LAYER_FLAG
    } else {
        0
    }) + key.col.into() * COL_SCALE + key.row.into() * ROW_SCALE
}

pub fn structure_occupant(tile: TileOpt) -> Option<u32> {
    if tile.data % 2 == 1 {
        Some(((tile.data / OCCUPIER_SCALE) % ENTITY_RANGE).try_into().unwrap())
    } else {
        None
    }
}
