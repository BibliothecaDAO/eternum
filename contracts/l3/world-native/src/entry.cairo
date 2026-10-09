use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
    fn grant_labor(ref self: T, realm: LaborRealm, day: u64, account: ContractAddress) -> LaborGrant;
    fn labor_grant(self: @T, realm: LaborRealm, day: u64) -> Option<LaborGrant>;
}

// The held Realm earns the claim; the recipient chooses one owned Frontier home to store it.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborRealm {
    pub game_id: u32,
    pub realm_id: u32,
    pub home: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LaborRules {
    pub amount: u128,
    // Zero leaves the account's number of held Realms unrestricted.
    pub account_daily_limit: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborGrant {
    pub game_id: u32,
    pub account: ContractAddress,
    pub home: u64,
    pub amount: u128,
}

// Holding a Realm earns one daily claim on the shard, independently of any game's seeded day schedule.
pub fn labor_day(timestamp: u64) -> u64 {
    timestamp / 86400
}
