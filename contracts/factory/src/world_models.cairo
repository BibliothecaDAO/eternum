use starknet::ContractAddress;

/// Model to store the metadata of a deployed world
/// by the world factory.
#[dojo::model]
pub struct WorldDeployed {
    /// The name of the deployed world.
    #[key]
    pub name: felt252,
    /// The address of the deployed world.
    pub address: ContractAddress,
    /// The block number of the deployed world.
    pub block_number: u64,
    /// The transaction hash of the deployed world.
    pub tx_hash: felt252,
}

/// Model to store the contracts of a deployed world.
///
/// Since during the registration of the resources,
/// the contracts are deployed, we need a way to keep track of
/// the deployment addresses.
///
/// To also not reach the limit of events (300 felts), we can't use
/// an array since we may reach the limit for big worlds.
/// We also already have the list of contracts in the config, only
/// a lookup will be done.
///
/// This also allows dynamic lookup for client applications to get the address of a contract
/// deployed from the world factory.
#[dojo::model]
pub struct WorldContract {
    /// The name of the deployed world.
    #[key]
    pub name: felt252,
    /// The dojo selector of the contract.
    #[key]
    pub contract_selector: felt252,
    /// The address of the deployed contract.
    pub contract_address: ContractAddress,
}
