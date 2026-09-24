use starknet::storage::Map;

#[starknet::storage_node]
pub struct VillageStateStorage<TResourceAmount, TVillageResource, TVillagePass> {
    pub village_delay: Map<u32, Option<u16>>,
    pub village_grant_count: Map<u32, u32>,
    pub village_grants: Map<(u32, u32), TResourceAmount>,
    pub village_pool: Map<(u32, u8), TVillageResource>,
    pub village_passes: Map<(u32, u16), Option<TVillagePass>>,
}
