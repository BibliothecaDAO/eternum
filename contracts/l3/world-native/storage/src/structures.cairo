use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord> {
    pub structures: Map<(u32, u32), TStructureRecord>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage {
    pub entity_names: Map<(u32, u32), felt252>,
}
