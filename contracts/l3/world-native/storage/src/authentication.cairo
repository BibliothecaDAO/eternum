use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct AuthenticationStorage<TAuthentication> {
    pub authentication: TAuthentication,
    pub nonces: Map<(u32, ContractAddress), u64>,
}
