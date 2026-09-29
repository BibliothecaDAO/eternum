use starknet::storage::Map;

#[starknet::storage_node]
pub struct TroopStateStorage<TExplorerTroops, TArmySlot, TArmyProgress> {
    pub explorers: Map<(u32, u32), TExplorerTroops>,
    pub slots: Map<(u32, u32, u64, u8), TArmySlot>,
    pub progress: Map<(u32, u32), TArmyProgress>,
    pub offer_ids: Map<(u32, u32), u32>,
    pub home_counts: Map<(u32, u32), u16>,
    pub home_armies: Map<(u32, u32, u16), u32>,
}
