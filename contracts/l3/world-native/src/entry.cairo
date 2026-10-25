use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
    fn publish_frontier_pool(ref self: T, game_id: u32, amount: u128);
    fn grant_labor(ref self: T, home: LaborHome, day: u64, account: ContractAddress) -> LaborGrant;
    fn labor_grant(self: @T, home: LaborHome, day: u64) -> Option<LaborGrant>;
}

// Daily labor belongs to the home founded with a held Realm.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborHome {
    pub game_id: u32,
    pub home: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LaborRules {
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborGrant {
    pub game_id: u32,
    pub account: ContractAddress,
    pub home: u64,
    pub amount: u128,
}

// Each settled home earns one daily claim, independently of the game's seeded day schedule.
pub fn labor_day(timestamp: u64) -> u64 {
    timestamp / 86400
}
