use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Retention {
    pub troop_percent: u8,
    pub resource_percent: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WithdrawalRules {
    pub paused: bool,
    pub bank_fee_bps: u16,
    pub velords_fee_bps: u16,
    pub season_fee_bps: u16,
    pub client_fee_bps: u16,
    pub velords_recipient: ContractAddress,
    pub season_recipient: ContractAddress,
    pub retention: Span<Retention>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct WithdrawalTerms {
    pub paused: bool,
    pub bank_fee_bps: u16,
    pub velords_fee_bps: u16,
    pub season_fee_bps: u16,
    pub client_fee_bps: u16,
    pub velords_recipient: ContractAddress,
    pub season_recipient: ContractAddress,
    pub retention_count: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceToken {
    pub resource_type: u8,
    pub token: ContractAddress,
}
#[starknet::interface]
pub trait IWithdrawals<T> {
    fn configure_withdrawals(ref self: T, game_id: u32, rules: WithdrawalRules, tokens: Span<ResourceToken>);
    #[cfg(test)]
    fn withdrawal_rules(self: @T, game_id: u32) -> WithdrawalRules;
    #[cfg(test)]
    fn resource_token(self: @T, key: crate::market::MarketKey) -> ContractAddress;
}
#[starknet::interface]
pub trait IResourceToken<T> {
    fn decimals(self: @T) -> u8;
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn mint(ref self: T, recipient: ContractAddress, amount: u256);
}
fn token_scale(token: ContractAddress) -> u256 {
    let decimals = IResourceTokenDispatcher { contract_address: token }.decimals();
    let mut scale: u256 = 1;
    for _ in 0_u8..decimals {
        scale *= 10;
    }
    scale
}
pub fn token_amount(token: ContractAddress, amount: u128) -> u256 {
    amount.into() * token_scale(token) / crate::rules::RESOURCE_PRECISION.into()
}
pub fn resource_amount(token: ContractAddress, amount: u256) -> u128 {
    (amount * crate::rules::RESOURCE_PRECISION.into() / token_scale(token)).try_into().unwrap()
}
pub fn transfer_or_mint(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    let token = IResourceTokenDispatcher { contract_address: token };
    if token.balance_of(starknet::get_contract_address()) < amount {
        token.mint(recipient, amount);
    } else {
        assert!(token.transfer(recipient, amount), "resource token transfer failed");
    }
}
