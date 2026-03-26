use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::addresses::{ADMIN, UPGRADER};
use super::super::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

pub fn deploy_mock_erc20(name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let contract_class = declare("MockERC20").unwrap().contract_class();
    let mut calldata = array![];
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    let (address, _) = contract_class.deploy(@calldata).unwrap();
    address
}

pub fn deploy_realms_swap_factory() -> ContractAddress {
    let pair_class = declare("RealmsSwapPair").unwrap().contract_class();
    let factory_class = declare("RealmsSwapFactory").unwrap().contract_class();
    let mut calldata = array![];
    (*pair_class.class_hash).serialize(ref calldata);
    ADMIN().serialize(ref calldata);
    UPGRADER().serialize(ref calldata);
    let (address, _) = factory_class.deploy(@calldata).unwrap();
    address
}

pub fn deploy_realms_swap_router(factory: ContractAddress) -> ContractAddress {
    let router_class = declare("RealmsSwapRouter").unwrap().contract_class();
    let mut calldata = array![];
    factory.serialize(ref calldata);
    ADMIN().serialize(ref calldata);
    UPGRADER().serialize(ref calldata);
    let (address, _) = router_class.deploy(@calldata).unwrap();
    address
}

pub fn deploy_flash_callee() -> ContractAddress {
    let callee_class = declare("MockFlashCallee").unwrap().contract_class();
    let calldata = array![];
    let (address, _) = callee_class.deploy(@calldata).unwrap();
    address
}

pub fn mint_mock_erc20(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    IMockERC20Dispatcher { contract_address: token }.mint(recipient, amount);
}

pub fn approve_erc20(token: ContractAddress, owner: ContractAddress, spender: ContractAddress, amount: u256) {
    start_cheat_caller_address(token, owner);
    IERC20Dispatcher { contract_address: token }.approve(spender, amount);
    stop_cheat_caller_address(token);
}

pub fn mint_and_approve_mock_erc20(
    token: ContractAddress, owner: ContractAddress, spender: ContractAddress, amount: u256,
) {
    mint_mock_erc20(token, owner, amount);
    approve_erc20(token, owner, spender, amount);
}
