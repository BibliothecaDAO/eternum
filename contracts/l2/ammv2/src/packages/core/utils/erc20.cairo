use ammv2::packages::core::interfaces::erc20::{
    IERC20MinimalCamelOnlySafeDispatcher, IERC20MinimalCamelOnlySafeDispatcherTrait, IERC20MinimalDispatcher,
    IERC20MinimalDispatcherTrait, IERC20MinimalSafeDispatcher, IERC20MinimalSafeDispatcherTrait,
};
use starknet::{ContractAddress, SyscallResultTrait};

pub fn transfer(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    IERC20MinimalDispatcher { contract_address: token }.transfer(recipient, amount);
}

#[feature("safe_dispatcher")]
pub fn balance_of_compatible(token: ContractAddress, account: ContractAddress) -> u256 {
    let dispatcher = IERC20MinimalSafeDispatcher { contract_address: token };
    match dispatcher.balance_of(account) {
        Result::Ok(balance) => balance,
        Result::Err(_) => {
            IERC20MinimalCamelOnlySafeDispatcher { contract_address: token }.balanceOf(account).unwrap_syscall()
        },
    }
}

#[feature("safe_dispatcher")]
pub fn transfer_from_compatible(
    token: ContractAddress, sender: ContractAddress, recipient: ContractAddress, amount: u256,
) {
    let dispatcher = IERC20MinimalSafeDispatcher { contract_address: token };
    match dispatcher.transfer_from(sender, recipient, amount) {
        Result::Ok(_) => (),
        Result::Err(_) => {
            IERC20MinimalCamelOnlySafeDispatcher { contract_address: token }
                .transferFrom(sender, recipient, amount)
                .unwrap_syscall();
        },
    }
}
