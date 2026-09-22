use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ClassHash;
use crate::map::{TileKey, TileOpt};

#[starknet::interface]
trait ILegacyTile<TContractState> {
    fn write(ref self: TContractState, key: TileKey, value: u128);
    fn read(self: @TContractState, key: TileKey) -> u128;
    fn read_with_class(self: @TContractState, class_hash: ClassHash, key: TileKey) -> Option<TileOpt>;
}

// Freeze the pre-extraction declarations so a new storage prefix cannot pass unnoticed.
#[starknet::component]
mod LegacyMapState {
    use starknet::storage::Map;

    #[storage]
    pub struct Storage {
        pub tiles: Map<(u32, bool, u32, u32), u128>,
        pub exists: Map<(u32, bool, u32, u32), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}
}

#[starknet::contract]
mod LegacyTileFixture {
    use starknet::ClassHash;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::map::{IMapDispatcherTrait, IMapLibraryDispatcher, TileKey, TileOpt};
    use super::LegacyMapState;

    component!(path: LegacyMapState, storage: map, event: MapEvent);

    #[storage]
    struct Storage {
        #[substorage(v0)]
        map: LegacyMapState::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MapEvent: LegacyMapState::Event,
    }

    #[abi(embed_v0)]
    impl LegacyTile of super::ILegacyTile<ContractState> {
        fn write(ref self: ContractState, key: TileKey, value: u128) {
            let storage_key = (key.game_id, key.alt, key.col, key.row);
            self.map.tiles.write(storage_key, value);
            self.map.exists.write(storage_key, true);
        }

        fn read(self: @ContractState, key: TileKey) -> u128 {
            self.map.tiles.read((key.game_id, key.alt, key.col, key.row))
        }

        fn read_with_class(self: @ContractState, class_hash: ClassHash, key: TileKey) -> Option<TileOpt> {
            IMapLibraryDispatcher { class_hash }.tile(key)
        }
    }
}

#[test]
fn shared_storage_preserves_the_legacy_tile_layout_across_classes() {
    let legacy = declare("LegacyTileFixture").unwrap().contract_class();
    let (contract_address, _) = legacy.deploy(@array![]).unwrap();
    let fixture = ILegacyTileDispatcher { contract_address };
    let map_class = *declare("MapDomain").unwrap().contract_class().class_hash;
    let key = TileKey { game_id: 7, alt: true, col: 123, row: 456 };
    let value = 0x123456789abcdef;

    fixture.write(key, value);

    assert_eq!(fixture.read(key), value);
    assert_eq!(fixture.read_with_class(map_class, key), Some(TileOpt { data: value }));
    assert_eq!(fixture.read_with_class(map_class, TileKey { game_id: 8, ..key }), None);
}
