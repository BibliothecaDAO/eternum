use starknet::storage::Map;

#[starknet::storage_node]
pub struct BridgeStateStorage<TDepositRules> {
    pub deposits: Map<u32, Option<TDepositRules>>,
}
