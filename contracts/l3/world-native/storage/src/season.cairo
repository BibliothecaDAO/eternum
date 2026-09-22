use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct SeasonPointsStorage {
    pub player_points: Map<(u32, ContractAddress), u128>,
    pub season_points: Map<u32, u128>,
    pub win_thresholds: Map<u32, Option<u128>>,
    pub close_initiators: Map<u32, Option<ContractAddress>>,
}
