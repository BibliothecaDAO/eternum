use starknet::storage::Map;

#[starknet::storage_node]
pub struct DeepStorage<TSite, TGuard> {
    pub paid_tick: Map<u32, Option<u64>>,
    pub altar_bars: Map<(u32, u8), u32>,
    pub team_banes: Map<(u32, u8, u64), Option<(u8, u64, u8)>>,
    pub latest_bane_day: Map<(u32, u8), Option<u64>>,
    pub army_ticks: Map<(u32, u64), Option<u64>>,
    pub site_ids: Map<(u32, u8), u64>,
    pub guards: Map<(u32, u64), Option<TGuard>>,
    pub slots: Map<(u32, u64, u8), u64>,
    pub sites: Map<(u32, u64), Option<TSite>>,
}
