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
    let value = 11 * crate::map::BIOME_SCALE + crate::map::REWARD_EXTRACTED_FLAG;

    fixture.write(key, value);

    assert_eq!(fixture.read(key), value);
    assert_eq!(
        fixture.read_with_class(map_class, key), Some(TileOpt { data: value + crate::map::coordinate_bits(key) }),
    );
    assert_eq!(fixture.read_with_class(map_class, TileKey { game_id: 8, ..key }), None);
}

#[starknet::interface]
trait IAuthenticationLayout<T> {
    fn seed(
        ref self: T,
        game: u32,
        actor: starknet::ContractAddress,
        authentication: crate::games::Authentication,
        nonce: u64,
        head: crate::recording::ExecutionHead,
    );
    fn read_with_class(
        self: @T, class_hash: ClassHash, game: u32, actor: starknet::ContractAddress,
    ) -> (crate::games::Authentication, u64, crate::recording::ExecutionHead);
}

// The original component fields check that flattening shared nodes preserves their addresses and packing.
#[starknet::contract]
mod OriginalAuthenticationLayout {
    use eternum_randomness_protocol::entrypoint::{
        IRecordedExecutionViewsDispatcherTrait, IRecordedExecutionViewsLibraryDispatcher,
    };
    use starknet::storage::{Map, StorageMapWriteAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress};
    use crate::games::{Authentication, IGamesAuthenticationDispatcherTrait, IGamesAuthenticationLibraryDispatcher};
    use crate::recording::{ExecutionHead, HeadPacking};

    #[storage]
    struct Storage {
        authentication: Authentication,
        nonces: Map<(u32, ContractAddress), u64>,
        heads: Map<felt252, ExecutionHead>,
    }

    #[abi(embed_v0)]
    impl Layout of super::IAuthenticationLayout<ContractState> {
        fn seed(
            ref self: ContractState,
            game: u32,
            actor: ContractAddress,
            authentication: Authentication,
            nonce: u64,
            head: ExecutionHead,
        ) {
            self.authentication.write(authentication);
            self.nonces.write((game, actor), nonce);
            self.heads.write(game.into(), head);
        }
        fn read_with_class(
            self: @ContractState, class_hash: ClassHash, game: u32, actor: ContractAddress,
        ) -> (Authentication, u64, ExecutionHead) {
            let authentication = IGamesAuthenticationLibraryDispatcher { class_hash };
            (
                authentication.authentication(),
                authentication.next_nonce(game, actor),
                IRecordedExecutionViewsLibraryDispatcher { class_hash }.get_head(game.into()),
            )
        }
    }
}

#[test]
fn shared_authentication_nonces_and_heads_keep_the_original_layout() {
    let (contract_address, _) = declare("OriginalAuthenticationLayout")
        .unwrap()
        .contract_class()
        .deploy(@array![])
        .unwrap();
    let original = IAuthenticationLayoutDispatcher { contract_address };
    let games = *declare("Games").unwrap().contract_class().class_hash;
    let actor = 9.try_into().unwrap();
    let authentication = crate::games::Authentication {
        submitter: 11.try_into().unwrap(), account_class: 13.try_into().unwrap(), guardian_public_key: 17,
    };
    let head = crate::recording::ExecutionHead { order: 17, timestamp: 0x100000001, state: 19 };
    original.seed(7, actor, authentication, 23, head);
    let (actual, nonce, recorded) = original.read_with_class(games, 7, actor);
    assert_eq!(actual.submitter, authentication.submitter);
    assert_eq!(actual.account_class, authentication.account_class);
    assert_eq!(actual.guardian_public_key, authentication.guardian_public_key);
    assert_eq!(nonce, 23);
    assert_eq!(recorded.order, head.order);
    assert_eq!(recorded.timestamp, head.timestamp);
    assert_eq!(recorded.state, head.state);
    let (_, other_nonce, other_head) = original.read_with_class(games, 8, actor);
    assert_eq!(other_nonce, 0);
    assert_eq!(other_head.order, 0);
    assert_eq!(other_head.timestamp, 0);
    assert_eq!(other_head.state, 0);
}
