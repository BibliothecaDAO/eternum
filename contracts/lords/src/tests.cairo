use lords::contract::{ITestLordsDispatcher, ITestLordsDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;

#[test]
fn test_mint_lords_credits_the_calling_wallet() {
    let contract = declare("TestLords").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![]).unwrap();
    let player: ContractAddress = 'player'.try_into().unwrap();

    start_cheat_caller_address(contract_address, player);
    ITestLordsDispatcher { contract_address }.mint_test_lords();
    stop_cheat_caller_address(contract_address);

    let balance = IERC20Dispatcher { contract_address }.balance_of(player);
    assert!(balance == 1_000 * 1000000000000000000);
}
