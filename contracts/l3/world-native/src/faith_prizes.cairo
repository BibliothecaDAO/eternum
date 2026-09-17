use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::faith::{ClaimPlayer, PlayerFaithKey};
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct PrizePool {
    pub funded: u128,
    pub distributed: bool,
}
#[starknet::interface]
pub trait IFaithPrizes<T> {
    fn configure_faith_reward_token(ref self: T, game_id: u32, token: ContractAddress);
    fn faith_reward_token(self: @T, game_id: u32) -> ContractAddress;
    fn faith_prize_pool(self: @T, game_id: u32) -> PrizePool;
    fn faith_prize_claimed(self: @T, key: PlayerFaithKey) -> bool;
    fn fund_faith_prizes(ref self: T, game_id: u32, actor: ContractAddress, amount: u128, context: ExecutionContext);
    fn distribute_faith_prizes(ref self: T, game_id: u32, actor: ContractAddress, context: ExecutionContext);
    fn claim_faith_prize(
        ref self: T, game_id: u32, actor: ContractAddress, command: ClaimPlayer, context: ExecutionContext,
    );
}
#[starknet::interface]
pub trait IPrizeToken<T> {
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}
