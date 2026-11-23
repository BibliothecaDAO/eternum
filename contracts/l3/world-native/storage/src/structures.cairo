use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord, TExpeditionSite> {
    pub structures: Map<(u32, u64), TStructureRecord>,
    pub expedition_sites: Map<(u32, u64), Option<TExpeditionSite>>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage {
    pub entity_names: Map<(u32, u64), felt252>,
}

#[starknet::storage_node]
pub struct HyperstructureStorage {
    pub counts: Map<u32, u32>,
    pub held_since: Map<(u32, u64), u64>,
}
