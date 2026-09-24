use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct DepositRules {
    pub paused: bool,
    pub realm_fee_bps: u16,
    pub velords_fee_bps: u16,
    pub season_fee_bps: u16,
    pub client_fee_bps: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Deposit {
    pub structure_id: u32,
    pub resource_type: u8,
    pub amount: u256,
    pub client_fee_recipient: ContractAddress,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Withdraw {
    pub structure_id: u32,
    pub recipient: ContractAddress,
    pub resource_type: u8,
    pub amount: u128,
    pub client_fee_recipient: ContractAddress,
}
#[starknet::interface]
pub trait IBridge<T> {
    fn configure_deposits(ref self: T, game_id: u32, rules: DepositRules);
    fn deposit_rules(self: @T, game_id: u32) -> DepositRules;
    fn deposit_resource(
        ref self: T, game_id: u32, actor: ContractAddress, command: Deposit, context: crate::commands::ActionContext,
    );
    fn withdraw_resource(
        ref self: T, game_id: u32, actor: ContractAddress, command: Withdraw, context: crate::commands::ActionContext,
    );
}
#[starknet::interface]
pub trait IBankWithdrawal<T> {
    fn withdraw_bank_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        bank_id: u32,
        resource_type: u8,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}
#[starknet::interface]
pub trait IDepositToken<T> {
    fn transfer_from(ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}
