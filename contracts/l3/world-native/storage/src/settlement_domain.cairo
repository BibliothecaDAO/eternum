use starknet::storage::Map;

#[starknet::storage_node]
pub struct SettlementDomainStorage<TDepthRules> {
    pub depth_configuration: Map<u32, bool>,
    pub depth_rules: Map<(u32, u8), Option<TDepthRules>>,
}
