use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct GuildStateStorage<TGuild> {
    pub guilds: Map<(u32, ContractAddress), TGuild>,
    pub members: Map<(u32, ContractAddress), ContractAddress>,
    pub member_count: Map<(u32, ContractAddress), u16>,
    pub whitelist: Map<(u32, ContractAddress, ContractAddress), bool>,
}
