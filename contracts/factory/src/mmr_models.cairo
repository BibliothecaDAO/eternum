use starknet::ContractAddress;
#[dojo::model]
pub struct MMRRegistration {
    /// The name of the contract
    #[key]
    pub address: ContractAddress,
    pub version: felt252,
}
