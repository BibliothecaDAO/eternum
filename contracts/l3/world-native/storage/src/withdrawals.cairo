use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct WithdrawalStateStorage<TWithdrawalTerms, TRetention> {
    pub terms: Map<u32, TWithdrawalTerms>,
    pub retention: Map<(u32, u32), TRetention>,
    pub tokens: Map<(u32, u8), ContractAddress>,
}
