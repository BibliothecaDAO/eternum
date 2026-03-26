use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ContractAddress;
use super::super::helpers::addresses::{ALICE, BOB};
use super::super::helpers::contracts::{
    approve_erc20, deploy_mock_erc20, deploy_realms_swap_factory, deploy_realms_swap_router, mint_mock_erc20,
};
use super::super::helpers::fixtures::{
    E18, add_liquidity, create_pair, pair_reserves_for_tokens, swap_exact_tokens_for_tokens,
};
use super::super::mocks::mock_camel_compat_erc20::{
    IMockCamelCompatibleERC20Dispatcher, IMockCamelCompatibleERC20DispatcherTrait,
};

#[derive(Copy, Drop)]
struct CamelCompatibilitySetup {
    factory: ContractAddress,
    router: ContractAddress,
    snake_token: ContractAddress,
    camel_token: ContractAddress,
    pair: ContractAddress,
}

fn deploy_mock_camel_compatible_erc20(name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let contract_class = declare("MockCamelCompatibleERC20").unwrap().contract_class();
    let mut calldata = array![];
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    let (address, _) = contract_class.deploy(@calldata).unwrap();
    address
}

fn mint_camel_compatible_erc20(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    IMockCamelCompatibleERC20Dispatcher { contract_address: token }.mint(recipient, amount);
}

fn camel_balance_of(token: ContractAddress, account: ContractAddress) -> u256 {
    IMockCamelCompatibleERC20Dispatcher { contract_address: token }.balanceOf(account)
}

fn deploy_core_with_camel_compatible_pair() -> CamelCompatibilitySetup {
    let factory = deploy_realms_swap_factory();
    let router = deploy_realms_swap_router(factory);
    let snake_token = deploy_mock_erc20("Snake Token", "SNK");
    let camel_token = deploy_mock_camel_compatible_erc20("Camel Token", "CML");
    let pair = create_pair(factory, snake_token, camel_token);
    CamelCompatibilitySetup { factory, router, snake_token, camel_token, pair }
}

fn seed_camel_compatible_pair() -> CamelCompatibilitySetup {
    let setup = deploy_core_with_camel_compatible_pair();

    mint_mock_erc20(setup.snake_token, ALICE(), 20 * E18);
    mint_camel_compatible_erc20(setup.camel_token, ALICE(), 40 * E18);
    approve_erc20(setup.snake_token, ALICE(), setup.router, 20 * E18);
    approve_erc20(setup.camel_token, ALICE(), setup.router, 40 * E18);

    let _ = add_liquidity(setup.router, ALICE(), setup.snake_token, setup.camel_token, 20 * E18, 40 * E18);
    setup
}

#[test]
fn test_add_liquidity_accepts_camel_balance_and_transfer_from_tokens() {
    let setup = deploy_core_with_camel_compatible_pair();

    mint_mock_erc20(setup.snake_token, ALICE(), 2 * E18);
    mint_camel_compatible_erc20(setup.camel_token, ALICE(), 4 * E18);
    approve_erc20(setup.snake_token, ALICE(), setup.router, 2 * E18);
    approve_erc20(setup.camel_token, ALICE(), setup.router, 4 * E18);

    let (snake_added, camel_added, liquidity) = add_liquidity(
        setup.router, ALICE(), setup.snake_token, setup.camel_token, 2 * E18, 4 * E18,
    );
    let (snake_reserve, camel_reserve) = pair_reserves_for_tokens(
        setup.router, setup.pair, setup.snake_token, setup.camel_token,
    );

    assert!(snake_added == 2 * E18, "router should move the requested snake token amount");
    assert!(camel_added == 4 * E18, "router should move the requested camel token amount");
    assert!(liquidity > 0, "pair should mint LP tokens for the added liquidity");
    assert!(snake_reserve == 2 * E18, "snake reserve should reflect the added liquidity");
    assert!(camel_reserve == 4 * E18, "camel reserve should reflect the added liquidity");
}

#[test]
fn test_swap_exact_tokens_for_tokens_accepts_camel_balance_and_transfer_from_tokens() {
    let setup = seed_camel_compatible_pair();

    mint_camel_compatible_erc20(setup.camel_token, BOB(), 2 * E18);
    approve_erc20(setup.camel_token, BOB(), setup.router, 2 * E18);

    let snake_before = IERC20Dispatcher { contract_address: setup.snake_token }.balance_of(BOB());
    let camel_before = camel_balance_of(setup.camel_token, BOB());
    let (camel_reserve_before, snake_reserve_before) = pair_reserves_for_tokens(
        setup.router, setup.pair, setup.camel_token, setup.snake_token,
    );

    let path = array![setup.camel_token, setup.snake_token];
    let amounts = swap_exact_tokens_for_tokens(setup.router, BOB(), 2 * E18, 0, path.span(), BOB());
    let camel_in = *amounts.at(0);
    let snake_out = *amounts.at(1);

    assert!(camel_in == 2 * E18, "swap should spend the quoted camel token input");
    assert!(camel_before - camel_balance_of(setup.camel_token, BOB()) == camel_in, "camel spend should match the quote");
    assert!(
        IERC20Dispatcher { contract_address: setup.snake_token }.balance_of(BOB()) - snake_before == snake_out,
        "snake receipt should match the router output",
    );

    let (camel_reserve_after, snake_reserve_after) = pair_reserves_for_tokens(
        setup.router, setup.pair, setup.camel_token, setup.snake_token,
    );
    assert!(camel_reserve_after == camel_reserve_before + camel_in, "camel reserve should increase by the input amount");
    assert!(snake_reserve_after == snake_reserve_before - snake_out, "snake reserve should decrease by the output amount");
}
