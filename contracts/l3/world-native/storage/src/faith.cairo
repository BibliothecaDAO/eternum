use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct FaithStateStorage<TWonderFaith, TFaithfulStructure, TPlayerFaithPoints> {
    pub faith_wonders: Map<(u32, u32), TWonderFaith>,
    pub faith_pledges: Map<(u32, u32), TFaithfulStructure>,
    pub faith_players: Map<(u32, ContractAddress, u32), TPlayerFaithPoints>,
    pub faith_wonder_count: Map<u32, u32>,
    pub faith_wonder_ids: Map<(u32, u32), u32>,
    pub prize_checkpoint: Map<u32, (u32, u128, u32)>,
}
