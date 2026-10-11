use starknet::storage::Map;

#[starknet::storage_node]
pub struct TroopStateStorage<TExplorerTroops, TArmySlot, TArmyProgress> {
    pub explorers: Map<(u32, u64), TExplorerTroops>,
    pub slots: Map<(u32, u64, u64, u8), TArmySlot>,
    pub progress: Map<(u32, u64), TArmyProgress>,
    pub home_counts: Map<(u32, u64), u16>,
    pub home_armies: Map<(u32, u64, u16), u64>,
}
