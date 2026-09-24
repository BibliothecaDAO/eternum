use starknet::storage::Map;

#[starknet::storage_node]
pub struct TroopStateStorage<TExplorerTroops> {
    pub explorers: Map<(u32, u32), TExplorerTroops>,
}
