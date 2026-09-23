use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ClassHash;
use crate::map::{TileKey, TileOpt};

#[starknet::interface]
trait ITileLayout<TContractState> {
    fn write(ref self: TContractState, key: TileKey, value: u128);
    fn read(self: @TContractState, key: TileKey) -> u128;
    fn read_with_class(self: @TContractState, class_hash: ClassHash, key: TileKey) -> Option<TileOpt>;
}

#[starknet::contract]
mod TileLayoutFixture {
    use starknet::ClassHash;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::map::{TileKey, TileOpt};

    #[storage]
    struct Storage {
        #[flat]
        data: crate::state::Storage,
    }

    #[abi(embed_v0)]
    impl TileLayout of super::ITileLayout<ContractState> {
        fn write(ref self: ContractState, key: TileKey, value: u128) {
            let storage_key = (key.game_id, key.alt, key.col, key.row);
            self.data.map.tiles.write(storage_key, value);
            self.data.map.exists.write(storage_key, true);
        }

        fn read(self: @ContractState, key: TileKey) -> u128 {
            self.data.map.tiles.read((key.game_id, key.alt, key.col, key.row))
        }

        fn read_with_class(self: @ContractState, class_hash: ClassHash, key: TileKey) -> Option<TileOpt> {
            let mut calldata = array![];
            key.serialize(ref calldata);
            let mut result = starknet::syscalls::library_call_syscall(
                class_hash, selector!("layout_tile"), calldata.span(),
            )
                .unwrap();
            Serde::deserialize(ref result).unwrap()
        }
    }
}

#[test]
fn shared_storage_reads_the_same_game_tile_across_classes() {
    let layout = declare("TileLayoutFixture").unwrap().contract_class();
    let (contract_address, _) = layout.deploy(@array![]).unwrap();
    let fixture = ITileLayoutDispatcher { contract_address };
    let map_class = *declare("GamesTest").unwrap().contract_class().class_hash;
    let key = TileKey { game_id: 7, alt: true, col: 123, row: 456 };
    let value = 0x123456789abcdef;

    fixture.write(key, value);

    assert_eq!(fixture.read(key), value);
    assert_eq!(fixture.read_with_class(map_class, key), Some(TileOpt { data: value }));
    assert_eq!(fixture.read_with_class(map_class, TileKey { game_id: 8, ..key }), None);
}
