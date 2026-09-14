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
    use super::{TileKey, TileOpt};

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
            assert!(!self.exists.read(storage_key), "tile already revealed");
            let data = (if key.alt {
                0x80000000000000000000000000000000
            } else {
                0
            })
                + key.col.into() * 0x200000000000000000000
                + key.row.into() * 0x2000000000000
                + biome.into() * 0x20000000000;
            self.tiles.write(storage_key, data);
            self.exists.write(storage_key, true);
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowSet { version: 1, model: 'TileOpt', keys: keys.span(), values: array![data.into()].span() });
        }

        fn occupy(
            ref self: ComponentState<TContractState>, key: TileKey, entity_id: u32, category: u8, is_structure: bool,
        ) {
            let tile = self.tile(key).expect('undiscovered tile');
            assert!(tile.data % 2 == 0, "cannot vacate structure");
            assert!(entity_id != 0 && category != 0, "empty occupier");
            assert!(tile.data % 0x20000000000 == 0, "occupied tile");
            let data = tile.data + entity_id.into() * 0x200 + category.into() * 2 + if is_structure {
                1
            } else {
                0
            };
            self.write_occupancy(key, data);
        }

        fn vacate(ref self: ComponentState<TContractState>, key: TileKey, entity_id: u32) {
            let tile = self.tile(key).expect('undiscovered tile');
            assert!(tile.data % 2 == 0, "cannot vacate structure");
            assert!(entity_id != 0 && (tile.data / 0x200) % 0x100000000 == entity_id.into(), "occupier mismatch");
            self.write_occupancy(key, tile.data - tile.data % 0x20000000000);
        }

        fn write_occupancy(ref self: ComponentState<TContractState>, key: TileKey, data: u128) {
            self.tiles.write((key.game_id, key.alt, key.col, key.row), data);
            let mut keys = array![];
            key.serialize(ref keys);
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
    fn tile(self: @T, key: TileKey) -> Option<TileOpt>;
    fn reveal(ref self: T, key: TileKey, biome: u8);
    fn occupy(ref self: T, key: TileKey, entity_id: u32, category: u8, is_structure: bool);
    fn vacate(ref self: T, key: TileKey, entity_id: u32);
}

#[starknet::contract]
pub mod MapDomain {
    use starknet::{ContractAddress, get_caller_address};
    use crate::lifecycle::Lifecycle;
    use super::{MapState, TileKey, TileOpt};
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
