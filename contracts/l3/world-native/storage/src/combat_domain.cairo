use starknet::storage::Map;

#[starknet::storage_node]
pub struct CombatDomainStorage {
    pub village_raids: Map<(u32, u64), u64>,
}
