pub use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
pub use starknet::ClassHash;
pub use crate::map::{TileKey, TileOpt};

#[starknet::interface]
pub trait ITileLayout<TContractState> {
    fn write(ref self: TContractState, key: TileKey, value: u128);
    fn read(self: @TContractState, key: TileKey) -> u128;
    fn read_with_class(self: @TContractState, class_hash: ClassHash, key: TileKey) -> Option<TileOpt>;
}

#[starknet::contract]
pub mod TileLayoutFixture {
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
