// MMR Token Contract Tests
//
// Tests for the soul-bound MMR token contract using snforge.
// Token uses 18 decimals. balance_of returns INITIAL_MMR for uninitialized players,
// update_mmr auto-initializes and enforces floor.

use mmr::contract::{
    IERC20ViewDispatcher, IERC20ViewDispatcherTrait, IMMRTokenDispatcher, IMMRTokenDispatcherTrait, INITIAL_MMR,
    MIN_MMR,
};
use snforge_std::{ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;

// ================================
// TEST HELPERS
// ================================

// Helper to scale MMR values to 18 decimals
const PRECISION: u256 = 1_000000000000000000; // 1e18

fn e18(val: u256) -> u256 {
    val * PRECISION
}

fn ADMIN() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn GAME() -> ContractAddress {
    'game'.try_into().unwrap()
}

fn UPGRADER() -> ContractAddress {
    'upgrader'.try_into().unwrap()
}

fn PLAYER1() -> ContractAddress {
    'player1'.try_into().unwrap()
}

fn PLAYER2() -> ContractAddress {
    'player2'.try_into().unwrap()
}

fn PLAYER3() -> ContractAddress {
    'player3'.try_into().unwrap()
}

fn deploy_mmr_token() -> ContractAddress {
    let contract = snforge_std::declare("MMRToken").unwrap().contract_class();
    let constructor_calldata = array![ADMIN().into(), GAME().into(), UPGRADER().into()];
    let (contract_address, _) = contract.deploy(@constructor_calldata).unwrap();
    contract_address
}

fn setup() -> (IMMRTokenDispatcher, IERC20ViewDispatcher, ContractAddress) {
    let contract_address = deploy_mmr_token();
    let mmr = IMMRTokenDispatcher { contract_address };
    let erc20 = IERC20ViewDispatcher { contract_address };
    (mmr, erc20, contract_address)
}

// ================================
// BALANCE_OF TESTS
// ================================

#[test]
fn test_balance_of_uninitialized_returns_initial_mmr() {
    let (mmr, _, _) = setup();

    // Uninitialized player should get INITIAL_MMR from balance_of
    assert!(mmr.balance_of(PLAYER1()) == INITIAL_MMR, "Uninitialized should return INITIAL_MMR");
    assert!(mmr.balance_of(PLAYER1()) == e18(1000), "Should be 1000e18");
}

#[test]
fn test_balance_of_after_update() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1500));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(1500), "Should have 1500e18 MMR");
}

// ================================
// UPDATE MMR TESTS
// ================================

#[test]
fn test_update_mmr_auto_initializes() {
    let (mmr, _, contract_address) = setup();

    // Player not yet updated - balance_of returns INITIAL_MMR
    assert!(mmr.balance_of(PLAYER1()) == INITIAL_MMR, "Should return initial");

    start_cheat_caller_address(contract_address, GAME());
    // First update auto-initializes
    mmr.update_mmr(PLAYER1(), e18(1200));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(1200), "Should have 1200e18 MMR");
}

#[test]
fn test_update_mmr_increase() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Initialize with 1000e18, then increase to 1500e18
    mmr.update_mmr(PLAYER1(), e18(1000));
    mmr.update_mmr(PLAYER1(), e18(1500));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(1500), "MMR should be 1500e18");
}

#[test]
fn test_update_mmr_decrease() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1000));
    mmr.update_mmr(PLAYER1(), e18(800));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(800), "MMR should be 800e18");
}

#[test]
fn test_update_mmr_floor_enforced() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Try to set below floor (50e18)
    mmr.update_mmr(PLAYER1(), e18(50));
    stop_cheat_caller_address(contract_address);

    // Should be clamped to MIN_MMR (100e18)
    assert!(mmr.balance_of(PLAYER1()) == MIN_MMR, "MMR should be floor (100e18)");
    assert!(mmr.balance_of(PLAYER1()) == e18(100), "Should be 100e18");
}

#[test]
fn test_update_mmr_zero_to_floor() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Try to set to 0
    mmr.update_mmr(PLAYER1(), 0);
    stop_cheat_caller_address(contract_address);

    // Should be clamped to MIN_MMR (100e18)
    assert!(mmr.balance_of(PLAYER1()) == MIN_MMR, "MMR should be floor (100e18)");
}

#[test]
fn test_update_mmr_no_change() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1000));

    let balance_before = mmr.balance_of(PLAYER1());

    // Update to same value
    mmr.update_mmr(PLAYER1(), e18(1000));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == balance_before, "Balance should not change");
}

#[test]
#[should_panic(expected: ('Caller is missing role',))]
fn test_update_mmr_unauthorized() {
    let (mmr, _, contract_address) = setup();

    // Try to update without GAME role
    start_cheat_caller_address(contract_address, PLAYER2());
    mmr.update_mmr(PLAYER1(), e18(1500));
    stop_cheat_caller_address(contract_address);
}

// ================================
// BATCH UPDATE TESTS
// ================================

#[test]
fn test_update_mmr_batch() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Initialize players first
    mmr.update_mmr(PLAYER1(), e18(1000));
    mmr.update_mmr(PLAYER2(), e18(1000));

    // Batch update
    let updates = array![(PLAYER1(), e18(1200)), (PLAYER2(), e18(800))];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(1200), "Player1 should have 1200e18 MMR");
    assert!(mmr.balance_of(PLAYER2()) == e18(800), "Player2 should have 800e18 MMR");
}

#[test]
fn test_update_mmr_batch_auto_initialize() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Batch update with uninitialized players - should auto-initialize
    let updates = array![(PLAYER1(), e18(1200)), (PLAYER2(), e18(800))];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    // Both players should have correct MMR
    assert!(mmr.balance_of(PLAYER1()) == e18(1200), "Player1 should have 1200e18 MMR");
    assert!(mmr.balance_of(PLAYER2()) == e18(800), "Player2 should have 800e18 MMR");
}

#[test]
fn test_update_mmr_batch_floor_enforced() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Batch update with one below floor
    let updates = array![(PLAYER1(), e18(50)), (PLAYER2(), e18(1500))];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == MIN_MMR, "Player1 should be at floor");
    assert!(mmr.balance_of(PLAYER2()) == e18(1500), "Player2 should have 1500e18");
}

#[test]
fn test_update_mmr_batch_empty() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Empty batch should not panic
    let updates: Array<(ContractAddress, u256)> = array![];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: ('Caller is missing role',))]
fn test_update_mmr_batch_unauthorized() {
    let (mmr, _, contract_address) = setup();

    // Try batch update without GAME role
    let updates = array![(PLAYER1(), e18(1200))];

    start_cheat_caller_address(contract_address, PLAYER2());
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);
}

// ================================
// TOTAL SUPPLY TESTS
// ================================

#[test]
fn test_total_supply_after_first_update() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1000));
    stop_cheat_caller_address(contract_address);

    // Total supply should reflect the stored value
    assert!(erc20.total_supply() == e18(1000), "Total supply should be 1000e18");
}

#[test]
fn test_total_supply_multiple_players() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1000));
    mmr.update_mmr(PLAYER2(), e18(1000));
    stop_cheat_caller_address(contract_address);

    // Total supply should be sum of all balances
    assert!(erc20.total_supply() == e18(2000), "Total supply should be 2000e18");
}

#[test]
fn test_total_supply_after_updates() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.update_mmr(PLAYER1(), e18(1000));
    mmr.update_mmr(PLAYER2(), e18(1000));

    // Update one up, one down
    mmr.update_mmr(PLAYER1(), e18(1200)); // +200e18
    mmr.update_mmr(PLAYER2(), e18(800)); // -200e18
    stop_cheat_caller_address(contract_address);

    // Total supply should remain the same
    assert!(erc20.total_supply() == e18(2000), "Total supply should be unchanged");
}

// ================================
// ERC20 VIEW TESTS
// ================================

#[test]
fn test_erc20_metadata() {
    let (_, erc20, _) = setup();

    assert!(erc20.name() == "Blitz MMR", "Name should be Blitz MMR");
    assert!(erc20.symbol() == "MMR", "Symbol should be MMR");
    assert!(erc20.decimals() == 18, "Decimals should be 18");
}

// ================================
// MULTI-PLAYER SCENARIO TESTS
// ================================

#[test]
fn test_six_player_game_simulation() {
    let (mmr, _, contract_address) = setup();

    // Create 6 player addresses
    let p1: ContractAddress = 'p1'.try_into().unwrap();
    let p2: ContractAddress = 'p2'.try_into().unwrap();
    let p3: ContractAddress = 'p3'.try_into().unwrap();
    let p4: ContractAddress = 'p4'.try_into().unwrap();
    let p5: ContractAddress = 'p5'.try_into().unwrap();
    let p6: ContractAddress = 'p6'.try_into().unwrap();

    start_cheat_caller_address(contract_address, GAME());

    // Batch update in one call (simulating game end)
    let updates = array![
        (p1, e18(1025)), // Winner gains
        (p2, e18(1010)), (p3, e18(1000)), // Middle stays same
        (p4, e18(990)),
        (p5, e18(975)), (p6, e18(950)) // Loser loses most
    ];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    // Verify all players have correct MMR
    assert!(mmr.balance_of(p1) == e18(1025), "P1 should have 1025e18");
    assert!(mmr.balance_of(p2) == e18(1010), "P2 should have 1010e18");
    assert!(mmr.balance_of(p3) == e18(1000), "P3 should have 1000e18");
    assert!(mmr.balance_of(p4) == e18(990), "P4 should have 990e18");
    assert!(mmr.balance_of(p5) == e18(975), "P5 should have 975e18");
    assert!(mmr.balance_of(p6) == e18(950), "P6 should have 950e18");
}

#[test]
fn test_multiple_games_same_players() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Game 1
    mmr.update_mmr(PLAYER1(), e18(1025));
    mmr.update_mmr(PLAYER2(), e18(975));

    // Game 2
    mmr.update_mmr(PLAYER1(), e18(1000)); // P1 loses, back to 1000
    mmr.update_mmr(PLAYER2(), e18(1000)); // P2 wins, back to 1000

    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(1000), "P1 should be at 1000e18");
    assert!(mmr.balance_of(PLAYER2()) == e18(1000), "P2 should be at 1000e18");
}

#[test]
fn test_large_mmr_values() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Set very high MMR
    mmr.update_mmr(PLAYER1(), e18(5000));
    stop_cheat_caller_address(contract_address);

    assert!(mmr.balance_of(PLAYER1()) == e18(5000), "Should handle large MMR");
}

// ================================
// CONSTANT VERIFICATION TESTS
// ================================

#[test]
fn test_constants() {
    // Verify constants are correct (with 18 decimal scaling)
    assert!(INITIAL_MMR == 1000_000000000000000000, "INITIAL_MMR should be 1000e18");
    assert!(MIN_MMR == 100_000000000000000000, "MIN_MMR should be 100e18");
}
