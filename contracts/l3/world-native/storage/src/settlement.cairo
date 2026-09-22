use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct SettlementPoolStateStorage {
    pub reserved_hyperstructures: Map<u32, u32>,
    pub opened: Map<(u32, bool), u32>,
    pub available_count: Map<(u32, bool), u16>,
    pub candidates: Map<(u32, bool, u16), u32>,
    pub reserved: Map<(u32, u32, u32), bool>,
}

#[starknet::storage_node]
pub struct SettlementStateStorage<
    TSettlementRules, TResourceAmount, TSettlementProgress, TPlayerEntry, TTroopType, TEntryEntitlement,
> {
    pub settlement_rules: Map<u32, Option<TSettlementRules>>,
    pub grant_counts: Map<u32, u32>,
    pub realm_grants: Map<(u32, u32), TResourceAmount>,
    pub progress: Map<u32, TSettlementProgress>,
    pub blitz_order: Map<(u32, u32), u8>,
    pub blitz_order_size: Map<u32, u32>,
    pub entries: Map<(u32, ContractAddress), Option<TPlayerEntry>>,
    pub starting_troops: Map<(u32, u8), TTroopType>,
    pub realm_resource_counts: Map<u32, u8>,
    pub realm_resources: Map<(u32, u8), u8>,
    pub entitlements: Map<(u32, ContractAddress), Option<TEntryEntitlement>>,
    pub entered_players: Map<(u32, ContractAddress), bool>,
}
