use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord> {
    pub structures: Map<(u32, u32), TStructureRecord>,
    pub explorers: Map<(u32, u32, u16), u32>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage<TResourceAmount> {
    pub camp_resource_count: Map<u32, Option<u32>>,
    pub camp_grants: Map<(u32, u32), TResourceAmount>,
    pub address_names: Map<ContractAddress, felt252>,
    pub entity_names: Map<(u32, u32), felt252>,
}
