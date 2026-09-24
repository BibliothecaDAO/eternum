use starknet::ContractAddress;

#[starknet::storage_node]
pub struct EntryAdministrationStorage {
    pub operator: ContractAddress,
}
