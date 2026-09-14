// TileOpt preserves the original packed wire layout.
const LAYER_FLAG: u128 = 0x80000000000000000000000000000000;
const COL_SCALE: u128 = 0x200000000000000000000;
const ROW_SCALE: u128 = 0x2000000000000;
const BIOME_SCALE: u128 = 0x20000000000;
const ENTITY_RANGE: u128 = 0x100000000;
const OCCUPIER_SCALE: u128 = 0x200;
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
    use super::{BIOME_SCALE, BYTE_RANGE, ENTITY_RANGE, OCCUPIER_SCALE, TileKey, TileOpt, coordinate_bits};

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
            let previous = self.tile(key).map(|tile| tile.data).unwrap_or(coordinate_bits(key));
            assert!((previous / BIOME_SCALE) % BYTE_RANGE == 0, "tile already revealed");
            let data = previous + biome.into() * BIOME_SCALE;
            self.tiles.write(storage_key, data);
            self.exists.write(storage_key, true);
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
            self.exists.write(storage_key, true);
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
    fn vacate(ref self: T, key: TileKey, entity_id: u32);
}

#[starknet::contract]
pub mod MapDomain {
    use starknet::{ContractAddress, get_caller_address};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::geometry::{distance, spire_neighbor, tile_key};
    use crate::lifecycle::Lifecycle;
    use crate::troops::Coord;
    use super::{BYTE_RANGE, MapState, TileKey, TileOpt};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: MapState, storage: map, event: MapEvent);
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
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        MapEvent: MapState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
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
        fn vacate(ref self: ContractState, key: TileKey, entity_id: u32) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.troops, "only troops domain");
            self.map.vacate(key, entity_id);
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
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
