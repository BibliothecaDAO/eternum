#[starknet::interface]
pub trait IRealmsWorld<T> {
    fn world(ref self: T) -> ByteArray;
}

#[dojo::contract]
pub mod world {
    use starknet::{ContractAddress, get_caller_address};
    use dojo::model::{ModelStorage, ModelValueStorage};
    use dojo::event::EventStorage;

    #[abi(embed_v0)]
    impl RealmsWorldImpl of super::IRealmsWorld<ContractState> {

        fn world(ref self: ContractState) -> ByteArray {
            "eternal glory awaits for those who seek it"
        }
    }
}
