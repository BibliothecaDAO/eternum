#[starknet::interface]
pub trait IFakeLib<T> {
    /// Returns a fake value.
    fn func_1(self: @T) -> u8;
}

#[dojo::library]
pub mod fake_library {
    use super::IFakeLib;

    #[abi(embed_v0)]
    impl IFakeLibImpl of IFakeLib<ContractState> {
        fn func_1(self: @ContractState) -> u8 {
            42
        }
    }
}
