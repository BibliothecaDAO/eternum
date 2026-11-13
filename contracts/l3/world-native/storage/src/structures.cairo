use starknet::storage::Map;

#[starknet::storage_node]
pub struct StructureStateStorage<TStructureRecord, TExpeditionSite, TSiteChest> {
    pub structures: Map<(u32, u64), TStructureRecord>,
    pub expedition_sites: Map<(u32, u64), Option<TExpeditionSite>>,
    pub site_chests: Map<(u32, u64), Option<TSiteChest>>,
    pub supply_posts: Map<(u32, bool, u32, u32), u64>,
    pub shrine_rewards: Map<(u32, u64), Option<u8>>,
}

#[starknet::storage_node]
pub struct StructuresDomainStorage {
    pub entity_names: Map<(u32, u64), felt252>,
}
