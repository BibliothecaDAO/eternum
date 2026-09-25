use starknet::storage::Map;

#[starknet::storage_node]
pub struct TroopStateStorage<TExplorerTroops> {
    pub explorers: Map<(u32, u32), TExplorerTroops>,
    pub home_counts: Map<(u32, u32), u16>,
    pub home_armies: Map<(u32, u32, u16), u32>,
}
