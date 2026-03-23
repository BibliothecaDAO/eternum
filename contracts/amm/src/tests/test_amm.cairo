use core::num::traits::Zero;
use eternum_amm::amm::{IEternumAMMDispatcher, IEternumAMMDispatcherTrait};
use eternum_amm::math::MINIMUM_LIQUIDITY;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

// ============ Constants ============

const E18: u256 = 1_000_000_000_000_000_000; // 10^18
const DEADLINE: u64 = 999_999_999_999;

fn OWNER() -> ContractAddress {
    starknet::contract_address_const::<'OWNER'>()
}

fn ALICE() -> ContractAddress {
    starknet::contract_address_const::<'ALICE'>()
}

fn BOB() -> ContractAddress {
    starknet::contract_address_const::<'BOB'>()
}

fn FEE_RECIPIENT() -> ContractAddress {
    starknet::contract_address_const::<'FEE_RECIPIENT'>()
}

// ============ Deploy helpers ============

fn deploy_mock_erc20(name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let contract_class = declare("MockERC20").unwrap().contract_class();
    let mut calldata = array![];
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    let (addr, _) = contract_class.deploy(@calldata).unwrap();
    addr
}

fn deploy_amm(owner: ContractAddress, lords: ContractAddress, fee_recipient: ContractAddress) -> ContractAddress {
    let lp_class = declare("LPToken").unwrap().contract_class();
    let amm_class = declare("EternumAMM").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    lords.serialize(ref calldata);
    fee_recipient.serialize(ref calldata);
    (*lp_class.class_hash).serialize(ref calldata);
    let (addr, _) = amm_class.deploy(@calldata).unwrap();
    addr
}

// ============ Setup struct ============

#[derive(Drop)]
struct TestSetup {
    amm: IEternumAMMDispatcher,
    lords: ContractAddress,
    token: ContractAddress,
    amm_addr: ContractAddress,
}

/// Deploy LORDS, resource token, AMM. Create pool with given protocol fee.
/// Mint tokens to ALICE and BOB. Approve AMM to spend their tokens.
fn setup_with_protocol_fee(protocol_fee_num: u256, protocol_fee_denom: u256) -> TestSetup {
    let lords = deploy_mock_erc20("Mock LORDS", "LORDS");
    let token = deploy_mock_erc20("Mock Resource", "RES");
    let amm_addr = deploy_amm(OWNER(), lords, FEE_RECIPIENT());
    let amm = IEternumAMMDispatcher { contract_address: amm_addr };

    // Owner creates pool
    start_cheat_caller_address(amm_addr, OWNER());
    amm.create_pool(token, 3, 1000, protocol_fee_num, protocol_fee_denom);
    stop_cheat_caller_address(amm_addr);

    let lords_erc20 = IMockERC20Dispatcher { contract_address: lords };
    let token_erc20 = IMockERC20Dispatcher { contract_address: token };

    // Mint tokens to ALICE and BOB
    let mint_amount = 1_000_000 * E18;
    lords_erc20.mint(ALICE(), mint_amount);
    lords_erc20.mint(BOB(), mint_amount);
    token_erc20.mint(ALICE(), mint_amount);
    token_erc20.mint(BOB(), mint_amount);

    // Also mint to fee_recipient so the AMM can transfer protocol fees there
    // (AMM transfers from its own balance, not from fee_recipient)

    let lords_ierc20 = IERC20Dispatcher { contract_address: lords };
    let token_ierc20 = IERC20Dispatcher { contract_address: token };

    // ALICE approves AMM
    start_cheat_caller_address(lords, ALICE());
    lords_ierc20.approve(amm_addr, mint_amount);
    stop_cheat_caller_address(lords);

    start_cheat_caller_address(token, ALICE());
    token_ierc20.approve(amm_addr, mint_amount);
    stop_cheat_caller_address(token);

    // BOB approves AMM
    start_cheat_caller_address(lords, BOB());
    lords_ierc20.approve(amm_addr, mint_amount);
    stop_cheat_caller_address(lords);

    start_cheat_caller_address(token, BOB());
    token_ierc20.approve(amm_addr, mint_amount);
    stop_cheat_caller_address(token);

    TestSetup { amm, lords, token, amm_addr }
}

fn setup() -> TestSetup {
    setup_with_protocol_fee(0, 1)
}

// ============ Tests ============

#[test]
fn test_create_pool() {
    let lords = deploy_mock_erc20("Mock LORDS", "LORDS");
    let token = deploy_mock_erc20("Mock Resource", "RES");
    let amm_addr = deploy_amm(OWNER(), lords, FEE_RECIPIENT());
    let amm = IEternumAMMDispatcher { contract_address: amm_addr };

    start_cheat_caller_address(amm_addr, OWNER());
    amm.create_pool(token, 3, 1000, 0, 1);
    stop_cheat_caller_address(amm_addr);

    // Verify pool exists by querying LP token (would panic if pool doesn't exist)
    let lp_token_addr = amm.get_lp_token(token);
    assert!(!lp_token_addr.is_zero(), "LP token should be deployed");

    // Verify reserves are zero initially
    let (lords_reserve, token_reserve) = amm.get_reserves(token);
    assert!(lords_reserve == 0, "lords reserve should be 0");
    assert!(token_reserve == 0, "token reserve should be 0");
}

#[test]
#[should_panic]
fn test_create_pool_not_owner() {
    let lords = deploy_mock_erc20("Mock LORDS", "LORDS");
    let token = deploy_mock_erc20("Mock Resource", "RES");
    let amm_addr = deploy_amm(OWNER(), lords, FEE_RECIPIENT());
    let amm = IEternumAMMDispatcher { contract_address: amm_addr };

    // ALICE (non-owner) tries to create a pool
    start_cheat_caller_address(amm_addr, ALICE());
    amm.create_pool(token, 3, 1000, 0, 1);
    stop_cheat_caller_address(amm_addr);
}

#[test]
fn test_add_liquidity_first() {
    let s = setup();
    let lords_amount = 1000 * E18;
    let token_amount = 5000 * E18;
    let expected_provider_lp = lords_amount - MINIMUM_LIQUIDITY;

    start_cheat_caller_address(s.amm_addr, ALICE());
    let (lords_used, token_used, lp_minted) = s.amm.add_liquidity(s.token, lords_amount, token_amount, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // First LP sets the ratio; all amounts should be used
    assert!(lords_used == lords_amount, "all lords should be used");
    assert!(token_used == token_amount, "all tokens should be used");
    assert!(lp_minted == expected_provider_lp, "provider lp mint should exclude locked liquidity");

    // Verify reserves
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == lords_amount, "lords reserve mismatch");
    assert!(token_reserve == token_amount, "token reserve mismatch");

    // Verify LP token balances
    let lp_token_addr = s.amm.get_lp_token(s.token);
    let lp_erc20 = IERC20Dispatcher { contract_address: lp_token_addr };
    assert!(lp_erc20.balance_of(ALICE()) == lp_minted, "provider LP balance mismatch");
    assert!(lp_erc20.balance_of(s.amm_addr) == MINIMUM_LIQUIDITY, "AMM should hold locked minimum liquidity");
}

#[test]
fn test_add_liquidity_proportional() {
    let s = setup();

    // ALICE provides initial liquidity: 1000 LORDS / 5000 tokens (1:5 ratio)
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 5000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // BOB adds liquidity: 500 LORDS with excess tokens
    start_cheat_caller_address(s.amm_addr, BOB());
    let (lords_used, token_used, lp_minted) = s.amm.add_liquidity(s.token, 500 * E18, 10000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // Should maintain 1:5 ratio: 500 LORDS, 2500 tokens
    assert!(lords_used == 500 * E18, "wrong lords used");
    assert!(token_used == 2500 * E18, "wrong tokens used");

    // LP mint = (500 * 1000) / 1000 = 500 (proportional to first LP mint)
    assert!(lp_minted == 500 * E18, "wrong lp minted");

    // Verify total reserves
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == 1500 * E18, "lords reserve mismatch");
    assert!(token_reserve == 7500 * E18, "token reserve mismatch");
}

#[test]
fn test_remove_liquidity() {
    let s = setup();

    // ALICE provides liquidity: 1000 LORDS / 5000 tokens
    start_cheat_caller_address(s.amm_addr, ALICE());
    let (_, _, lp_minted) = s.amm.add_liquidity(s.token, 1000 * E18, 5000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // ALICE approves AMM to burn LP tokens
    let lp_token_addr = s.amm.get_lp_token(s.token);
    let lp_erc20 = IERC20Dispatcher { contract_address: lp_token_addr };
    // Note: burn is called by AMM via ILPToken, no approval needed from user for burn
    // But we still need to track balances

    let lords_before = IERC20Dispatcher { contract_address: s.lords }.balance_of(ALICE());
    let token_before = IERC20Dispatcher { contract_address: s.token }.balance_of(ALICE());

    // Remove half the liquidity
    let half_lp = lp_minted / 2;
    start_cheat_caller_address(s.amm_addr, ALICE());
    let (lords_out, token_out) = s.amm.remove_liquidity(s.token, half_lp, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let expected_lords_out = half_lp;
    let expected_token_out = half_lp * 5;
    assert!(lords_out == expected_lords_out, "wrong lords out");
    assert!(token_out == expected_token_out, "wrong tokens out");

    // Verify LP balance decreased
    assert!(lp_erc20.balance_of(ALICE()) == lp_minted - half_lp, "LP balance not decreased");

    // Verify token balances increased
    let lords_after = IERC20Dispatcher { contract_address: s.lords }.balance_of(ALICE());
    let token_after = IERC20Dispatcher { contract_address: s.token }.balance_of(ALICE());
    assert!(lords_after == lords_before + lords_out, "lords balance mismatch");
    assert!(token_after == token_before + token_out, "token balance mismatch");

    // Verify remaining reserves
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == (1000 * E18) - expected_lords_out, "lords reserve mismatch");
    assert!(token_reserve == (5000 * E18) - expected_token_out, "token reserve mismatch");
}

#[test]
fn test_remove_all_redeemable_liquidity_leaves_locked_minimum_in_pool() {
    let s = setup();
    let lords_amount = 1000 * E18;
    let token_amount = 5000 * E18;

    start_cheat_caller_address(s.amm_addr, ALICE());
    let (_, _, lp_minted) = s.amm.add_liquidity(s.token, lords_amount, token_amount, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let lp_token_addr = s.amm.get_lp_token(s.token);
    let lp_erc20 = IERC20Dispatcher { contract_address: lp_token_addr };
    let locked_token_reserve = (MINIMUM_LIQUIDITY * token_amount) / lords_amount;

    start_cheat_caller_address(s.amm_addr, ALICE());
    let (lords_out, token_out) = s.amm.remove_liquidity(s.token, lp_minted, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    assert!(lords_out == lords_amount - MINIMUM_LIQUIDITY, "wrong lords returned");
    assert!(token_out == token_amount - locked_token_reserve, "wrong tokens returned");
    assert!(lp_erc20.balance_of(ALICE()) == 0, "provider should burn all redeemable LP");
    assert!(lp_erc20.balance_of(s.amm_addr) == MINIMUM_LIQUIDITY, "AMM should retain locked LP balance");
    assert!(lp_erc20.total_supply() == MINIMUM_LIQUIDITY, "total supply should equal locked floor");

    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == MINIMUM_LIQUIDITY, "lords reserve should keep locked dust");
    assert!(token_reserve == locked_token_reserve, "token reserve should keep proportional locked dust");
}

#[test]
fn test_swap_lords_for_token() {
    let s = setup();

    // ALICE provides liquidity: 1000 LORDS / 1000 tokens (1:1)
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 1000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let token_erc20 = IERC20Dispatcher { contract_address: s.token };
    let lords_erc20 = IERC20Dispatcher { contract_address: s.lords };
    let bob_token_before = token_erc20.balance_of(BOB());
    let bob_lords_before = lords_erc20.balance_of(BOB());

    // BOB swaps 100 LORDS for tokens
    let swap_amount = 100 * E18;
    start_cheat_caller_address(s.amm_addr, BOB());
    let token_out = s.amm.swap_lords_for_token(s.token, swap_amount, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // token_out should be > 0 and < swap_amount (due to fee + price impact)
    assert!(token_out > 0, "should receive tokens");
    assert!(token_out < swap_amount, "should receive less due to fee and slippage");

    // Verify BOB balances changed
    assert!(lords_erc20.balance_of(BOB()) == bob_lords_before - swap_amount, "lords not deducted");
    assert!(token_erc20.balance_of(BOB()) == bob_token_before + token_out, "tokens not received");

    // Verify reserves updated
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == 1000 * E18 + swap_amount, "lords reserve wrong");
    assert!(token_reserve == 1000 * E18 - token_out, "token reserve wrong");
}

#[test]
fn test_swap_token_for_lords() {
    let s = setup();

    // ALICE provides liquidity: 1000 LORDS / 1000 tokens (1:1)
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 1000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let token_erc20 = IERC20Dispatcher { contract_address: s.token };
    let lords_erc20 = IERC20Dispatcher { contract_address: s.lords };
    let bob_token_before = token_erc20.balance_of(BOB());
    let bob_lords_before = lords_erc20.balance_of(BOB());

    // BOB swaps 100 tokens for LORDS
    let swap_amount = 100 * E18;
    start_cheat_caller_address(s.amm_addr, BOB());
    let lords_out = s.amm.swap_token_for_lords(s.token, swap_amount, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    assert!(lords_out > 0, "should receive lords");
    assert!(lords_out < swap_amount, "should receive less due to fee and slippage");

    // Verify BOB balances
    assert!(token_erc20.balance_of(BOB()) == bob_token_before - swap_amount, "tokens not deducted");
    assert!(lords_erc20.balance_of(BOB()) == bob_lords_before + lords_out, "lords not received");

    // Verify reserves
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);
    assert!(lords_reserve == 1000 * E18 - lords_out, "lords reserve wrong");
    assert!(token_reserve == 1000 * E18 + swap_amount, "token reserve wrong");
}

#[test]
fn test_swap_token_for_token() {
    let s = setup();
    // Deploy a second token
    let token2 = deploy_mock_erc20("Mock Resource 2", "RES2");

    // Owner creates pool for token2
    start_cheat_caller_address(s.amm_addr, OWNER());
    s.amm.create_pool(token2, 3, 1000, 0, 1);
    stop_cheat_caller_address(s.amm_addr);

    // Mint and approve token2 for ALICE and BOB
    let token2_mock = IMockERC20Dispatcher { contract_address: token2 };
    let token2_erc20 = IERC20Dispatcher { contract_address: token2 };
    let mint_amount = 1_000_000 * E18;
    token2_mock.mint(ALICE(), mint_amount);
    token2_mock.mint(BOB(), mint_amount);

    start_cheat_caller_address(token2, ALICE());
    token2_erc20.approve(s.amm_addr, mint_amount);
    stop_cheat_caller_address(token2);

    start_cheat_caller_address(token2, BOB());
    token2_erc20.approve(s.amm_addr, mint_amount);
    stop_cheat_caller_address(token2);

    // ALICE provides liquidity to both pools
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 1000 * E18, 0, 0, DEADLINE);
    s.amm.add_liquidity(token2, 1000 * E18, 2000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let token1_erc20 = IERC20Dispatcher { contract_address: s.token };
    let bob_token1_before = token1_erc20.balance_of(BOB());
    let bob_token2_before = token2_erc20.balance_of(BOB());

    // BOB swaps 100 token1 for token2 (token1 -> LORDS -> token2)
    let swap_amount = 100 * E18;
    start_cheat_caller_address(s.amm_addr, BOB());
    let token2_out = s.amm.swap_token_for_token(s.token, token2, swap_amount, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    assert!(token2_out > 0, "should receive token2");

    // Verify BOB balances
    assert!(token1_erc20.balance_of(BOB()) == bob_token1_before - swap_amount, "token1 not deducted");
    assert!(token2_erc20.balance_of(BOB()) == bob_token2_before + token2_out, "token2 not received");
}

#[test]
#[should_panic(expected: "slippage exceeded")]
fn test_swap_slippage_exceeded() {
    let s = setup();

    // ALICE provides liquidity: 1000 LORDS / 1000 tokens
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 1000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // BOB swaps 100 LORDS with unrealistically high min_token_out
    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_lords_for_token(s.token, 100 * E18, 100 * E18, DEADLINE); // min_out = 100 is too high
    stop_cheat_caller_address(s.amm_addr);
}

#[test]
#[should_panic(expected: "AMM is paused")]
fn test_pause() {
    let s = setup();

    // ALICE provides liquidity
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 1000 * E18, 1000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // Owner pauses
    start_cheat_caller_address(s.amm_addr, OWNER());
    s.amm.set_paused(true);
    stop_cheat_caller_address(s.amm_addr);

    assert!(s.amm.is_paused(), "should be paused");

    // BOB tries to swap while paused
    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_lords_for_token(s.token, 100 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);
}

#[test]
fn test_protocol_fee() {
    // Set protocol fee to 1/100 (1%)
    let s = setup_with_protocol_fee(1, 100);

    // ALICE provides liquidity: 10000 LORDS / 10000 tokens
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 10000 * E18, 10000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let token_erc20 = IERC20Dispatcher { contract_address: s.token };
    let fee_recipient_balance_before = token_erc20.balance_of(FEE_RECIPIENT());

    // BOB swaps 1000 LORDS for tokens
    start_cheat_caller_address(s.amm_addr, BOB());
    let token_out = s.amm.swap_lords_for_token(s.token, 1000 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    // Fee recipient should have received protocol fee
    let fee_recipient_balance_after = token_erc20.balance_of(FEE_RECIPIENT());
    let protocol_fee_received = fee_recipient_balance_after - fee_recipient_balance_before;

    assert!(protocol_fee_received > 0, "fee recipient should receive fee");
    assert!(token_out > 0, "user should still receive tokens");
    // The total output (user + fee) should equal what would have been output without protocol fee extraction
// from reserves. Protocol fee = gross_output * 1/100
// So user gets 99% of the gross output
}

#[test]
fn test_protocol_fee_lords_for_token_keeps_reserve_equal_to_contract_balance() {
    let s = setup_with_protocol_fee(1, 100);

    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 10000 * E18, 10000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_lords_for_token(s.token, 1000 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let lords_erc20 = IERC20Dispatcher { contract_address: s.lords };
    let token_erc20 = IERC20Dispatcher { contract_address: s.token };
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);

    assert!(lords_reserve == lords_erc20.balance_of(s.amm_addr), "lords reserve must equal AMM balance");
    assert!(token_reserve == token_erc20.balance_of(s.amm_addr), "token reserve must equal AMM balance");
}

#[test]
fn test_protocol_fee_token_for_lords_keeps_reserve_equal_to_contract_balance() {
    let s = setup_with_protocol_fee(1, 100);

    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 10000 * E18, 10000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_token_for_lords(s.token, 1000 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let lords_erc20 = IERC20Dispatcher { contract_address: s.lords };
    let token_erc20 = IERC20Dispatcher { contract_address: s.token };
    let (lords_reserve, token_reserve) = s.amm.get_reserves(s.token);

    assert!(lords_reserve == lords_erc20.balance_of(s.amm_addr), "lords reserve must equal AMM balance");
    assert!(token_reserve == token_erc20.balance_of(s.amm_addr), "token reserve must equal AMM balance");
}

#[test]
fn test_protocol_fee_token_to_token_keeps_pools_aligned_with_balances() {
    let s = setup_with_protocol_fee(1, 100);
    let token2 = deploy_mock_erc20("Mock Resource 2", "RES2");

    start_cheat_caller_address(s.amm_addr, OWNER());
    s.amm.create_pool(token2, 3, 1000, 1, 100);
    stop_cheat_caller_address(s.amm_addr);

    let token2_mock = IMockERC20Dispatcher { contract_address: token2 };
    let token2_erc20 = IERC20Dispatcher { contract_address: token2 };
    let mint_amount = 1_000_000 * E18;
    token2_mock.mint(ALICE(), mint_amount);
    token2_mock.mint(BOB(), mint_amount);

    start_cheat_caller_address(token2, ALICE());
    token2_erc20.approve(s.amm_addr, mint_amount);
    stop_cheat_caller_address(token2);

    start_cheat_caller_address(token2, BOB());
    token2_erc20.approve(s.amm_addr, mint_amount);
    stop_cheat_caller_address(token2);

    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 10000 * E18, 10000 * E18, 0, 0, DEADLINE);
    s.amm.add_liquidity(token2, 10000 * E18, 20000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_token_for_token(s.token, token2, 1000 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let lords_erc20 = IERC20Dispatcher { contract_address: s.lords };
    let token1_erc20 = IERC20Dispatcher { contract_address: s.token };
    let (lords_reserve_1, token_reserve_1) = s.amm.get_reserves(s.token);
    let (lords_reserve_2, token_reserve_2) = s.amm.get_reserves(token2);

    assert!(token_reserve_1 == token1_erc20.balance_of(s.amm_addr), "token1 reserve must equal AMM balance");
    assert!(token_reserve_2 == token2_erc20.balance_of(s.amm_addr), "token2 reserve must equal AMM balance");
    assert!(
        lords_reserve_1 + lords_reserve_2 == lords_erc20.balance_of(s.amm_addr),
        "total lords reserves must equal AMM balance",
    );
}

#[test]
fn test_constant_product_invariant() {
    let s = setup();

    // ALICE provides liquidity: 10000 LORDS / 10000 tokens
    start_cheat_caller_address(s.amm_addr, ALICE());
    s.amm.add_liquidity(s.token, 10000 * E18, 10000 * E18, 0, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let (lords_before, token_before) = s.amm.get_reserves(s.token);
    let k_before = lords_before * token_before;

    // BOB swaps LORDS for tokens
    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_lords_for_token(s.token, 1000 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let (lords_after, token_after) = s.amm.get_reserves(s.token);
    let k_after = lords_after * token_after;

    // k should only increase (LP fees grow reserves)
    assert!(k_after >= k_before, "constant product invariant violated: k decreased after swap");

    // Do another swap in reverse direction
    let k_before_2 = k_after;

    start_cheat_caller_address(s.amm_addr, BOB());
    s.amm.swap_token_for_lords(s.token, 500 * E18, 0, DEADLINE);
    stop_cheat_caller_address(s.amm_addr);

    let (lords_after_2, token_after_2) = s.amm.get_reserves(s.token);
    let k_after_2 = lords_after_2 * token_after_2;

    assert!(k_after_2 >= k_before_2, "constant product invariant violated after second swap");
}
