use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn deposit_source(self: @T, game_id: u32) -> Option<crate::deposits::DepositSource>;
    fn deliver_deposit(
        ref self: T, game_id: u32, deposit: crate::deposits::LordsDeposit, r: felt252, s: felt252, cancel: bool,
    );
    fn deposit_receipt(self: @T, game_id: u32, id: u64) -> Option<crate::deposits::DepositReceipt>;
    fn spend_lords(self: @T, game_id: u32, account: ContractAddress) -> crate::deposits::SpendLords;
    fn principal_withdrawal(
        self: @T, game_id: u32, account: ContractAddress,
    ) -> Option<crate::deposits::PrincipalWithdrawal>;
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
    fn sweep_lords(ref self: T, game_id: u32, structure_id: u64);
    fn frontier_prize(self: @T, game_id: u32) -> FrontierPrize;
}

#[starknet::interface]
pub trait IHomeGrants<T> {
    fn grant_seal(ref self: T, game_id: u32, account: ContractAddress);
    fn credit_fragments(ref self: T, game_id: u32, credit: crate::fragments::FragmentCredit);
}

#[starknet::interface]
pub trait IResourceContext<T> {
    fn resource_context(self: @T, game_id: u32) -> crate::commands::ResourceContext;
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
