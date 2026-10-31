use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
    fn publish_frontier_pool(ref self: T, game_id: u32, amount: u128, prize_pool: u128);
    fn top_up_frontier_pool(ref self: T, game_id: u32, amount: u128);
    fn post_frontier_top(ref self: T, game_id: u32, winners: Array<ContractAddress>);
    fn sweep_lords(ref self: T, game_id: u32, structure_id: u64);
    fn award_frontier_prize(ref self: T, game_id: u32, rank: u16);
    fn frontier_prize(self: @T, game_id: u32) -> FrontierPrize;
    fn grant_labor(ref self: T, home: LaborHome, day: u64, account: ContractAddress) -> LaborGrant;
    fn labor_grant(self: @T, home: LaborHome, day: u64) -> Option<LaborGrant>;
}

// One game-day grant belongs to the home's immutable entry source.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborHome {
    pub game_id: u32,
    pub home: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct LaborRules {
    pub amount: u128,
    pub campaign_essence: u128,
    pub golden_amount: u128,
    pub golden_essence: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LaborGrant {
    pub game_id: u32,
    pub account: ContractAddress,
    pub home: u64,
    pub amount: u128,
    pub essence: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct FrontierPrize {
    pub pool: u128,
    pub issued: u128,
    pub count: Option<u16>,
}
