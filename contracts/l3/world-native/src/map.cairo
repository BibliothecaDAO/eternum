// TileOpt preserves the original packed wire layout.
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
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Settlements of crate::settlement::ISettlementPool<ContractState> {
        fn reserved_hyperstructures(self: @ContractState, game_id: u32) -> u32 {
            self.settlements.reserved_hyperstructures.read(game_id)
        }
        fn settlement_pool(self: @ContractState, game_id: u32) -> SettlementPool {
            let season = self.lifecycle.require_active().season;
            let rules = ISettlementViewsDispatcher { contract_address: season }.settlement_rules(game_id);
            let center = self.map_center(game_id);
            self.settlements.pool(game_id, center, rules)
        }
        fn claim_settlement(ref self: ContractState, game_id: u32, registered: u16, seed: u256) -> Span<Coord> {
            let season = self.lifecycle.require_active().season;
            assert!(get_caller_address() == season, "only season domain");
            let rules = ISettlementViewsDispatcher { contract_address: season }.settlement_rules(game_id);
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
            let game = IGameDispatcher { contract_address: season }.game(game_id);
            let game_rules = IGameDispatcher { contract_address: season }.rules(game_id);
            assert!(game_rules.blitz_mode_on, "not a Blitz game");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            let rules = ISettlementViewsDispatcher { contract_address: season }.settlement_rules(game_id);
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
                    rules.map_config, seed, timestamp, distance(coord, center), hyperstructures, false,
                )
            }
        }
        fn tile(self: @ContractState, key: TileKey) -> Option<TileOpt> {
            self.map.tile(key)
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
    #[generate_trait]
    impl Internal of InternalTrait {
        fn map_center(self: @ContractState, game_id: u32) -> Coord {
            let rules = IGameDispatcher { contract_address: self.lifecycle.require_active().season }.rules(game_id);
            let center = 2147483646 - rules.map_center_offset;
            Coord { alt: false, x: center, y: center }
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
