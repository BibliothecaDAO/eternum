use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord, TExpeditionSite, TSiteChest> {
    pub structures: Map<(u32, u32), TStructureRecord>,
    pub expedition_sites: Map<(u32, u32), Option<TExpeditionSite>>,
    pub site_chests: Map<(u32, u32), Option<TSiteChest>>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage {
    pub entity_names: Map<(u32, u32), felt252>,
}
