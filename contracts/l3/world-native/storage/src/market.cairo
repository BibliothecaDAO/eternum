use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct MarketStateStorage<TMarket, TBankRules> {
    pub markets: Map<(u32, u8), TMarket>,
    pub liquidity: Map<(u32, ContractAddress, u8), u128>,
    pub bank_names: Map<(u32, u32), felt252>,
    pub bank_rules: Map<u32, TBankRules>,
    pub bank_rules_configured: Map<u32, bool>,
}
