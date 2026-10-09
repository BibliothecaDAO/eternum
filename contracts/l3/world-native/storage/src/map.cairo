use starknet::storage::Map;

#[starknet::storage_node]
pub struct MapStateStorage {
    pub tiles: Map<(u32, bool, u32, u32), u128>,
    pub exists: Map<(u32, bool, u32, u32), bool>,
    pub occupancy: Map<(u32, bool, u32, u32), u128>,
    pub entity_tiles: Map<(u32, u64), Option<(bool, u32, u32)>>,
}

#[starknet::storage_node]
pub struct MapDomainStorage {
    pub empty_reveals: Map<(u32, u64, u64), Option<u8>>,
    pub ruin_found: Map<(u32, u64, u64), bool>,
    pub last_relic_discovery: Map<u32, u64>,
}
