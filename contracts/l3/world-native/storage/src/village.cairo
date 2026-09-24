use starknet::storage::Map;

#[starknet::storage_node]
pub struct VillageStateStorage<TVillagePass> {
    pub village_passes: Map<(u32, u16), Option<TVillagePass>>,
}
