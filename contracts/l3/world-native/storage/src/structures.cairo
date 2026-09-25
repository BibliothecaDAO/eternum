use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord, TExpeditionSite> {
    pub structures: Map<(u32, u32), TStructureRecord>,
    pub expedition_sites: Map<(u32, u32), Option<TExpeditionSite>>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage {
    pub entity_names: Map<(u32, u32), felt252>,
}
