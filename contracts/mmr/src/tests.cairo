// MMR Token Contract Tests
//
// Tests for the soul-bound MMR token contract using snforge.

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, spy_events, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

use mmr::contract::{
    GAME_ROLE, IERC20BalanceDispatcher, IERC20BalanceDispatcherTrait, IMMRTokenDispatcher, IMMRTokenDispatcherTrait,
    INITIAL_MMR, MIN_MMR, MMR_PRECISION, UPGRADER_ROLE,
};

// ================================
// TEST HELPERS
// ================================

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

fn setup() -> (IMMRTokenDispatcher, IERC20BalanceDispatcher, ContractAddress) {
    let contract_address = deploy_mmr_token();
    let mmr = IMMRTokenDispatcher { contract_address };
    let erc20 = IERC20BalanceDispatcher { contract_address };
    (mmr, erc20, contract_address)
}

// ================================
// INITIALIZATION TESTS
// ================================

#[test]
fn test_initialize_player() {
    let (mmr, erc20, contract_address) = setup();

    // Initially player should not have MMR
    assert!(!mmr.has_mmr(PLAYER1()), "Player should not have MMR yet");
    assert!(erc20.balance_of(PLAYER1()) == 0, "Balance should be 0");

    // Initialize player (must be called by GAME)
    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    stop_cheat_caller_address(contract_address);

    // Now player should have MMR
    assert!(mmr.has_mmr(PLAYER1()), "Player should have MMR");
    assert!(mmr.get_mmr(PLAYER1()) == 1000, "MMR should be 1000");
    assert!(erc20.balance_of(PLAYER1()) == INITIAL_MMR, "Balance should match initial");
}

#[test]
fn test_initialize_player_idempotent() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Initialize twice
    mmr.initialize_player(PLAYER1());
    mmr.initialize_player(PLAYER1());

    stop_cheat_caller_address(contract_address);

    // Should still have same MMR (not doubled)
    assert!(mmr.get_mmr(PLAYER1()) == 1000, "MMR should be 1000, not doubled");
    assert!(erc20.balance_of(PLAYER1()) == INITIAL_MMR, "Balance should not double");
}

#[test]
#[should_panic(expected: ('Caller is missing role',))]
fn test_initialize_player_unauthorized() {
    let (mmr, _, contract_address) = setup();

    // Try to initialize without GAME role
    start_cheat_caller_address(contract_address, PLAYER1());
    mmr.initialize_player(PLAYER2());
    stop_cheat_caller_address(contract_address);
}

// ================================
// GET MMR TESTS
// ================================

#[test]
fn test_get_mmr_uninitialized() {
    let (mmr, _, _) = setup();

    // Uninitialized player should have 0 MMR
    assert!(mmr.get_mmr(PLAYER1()) == 0, "Uninitialized should have 0 MMR");
}

#[test]
fn test_get_mmr_after_init() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 1000, "Should have initial 1000 MMR");
}

// ================================
// UPDATE MMR TESTS
// ================================

#[test]
fn test_update_mmr_increase() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    // Increase MMR to 1500
    mmr.update_mmr(PLAYER1(), 1500);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 1500, "MMR should be 1500");
    assert!(erc20.balance_of(PLAYER1()) == 1500 * MMR_PRECISION, "Balance should match");
}

#[test]
fn test_update_mmr_decrease() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    // Decrease MMR to 800
    mmr.update_mmr(PLAYER1(), 800);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 800, "MMR should be 800");
    assert!(erc20.balance_of(PLAYER1()) == 800 * MMR_PRECISION, "Balance should match");
}

#[test]
fn test_update_mmr_floor_enforced() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    // Try to set below floor (50)
    mmr.update_mmr(PLAYER1(), 50);
    stop_cheat_caller_address(contract_address);

    // Should be clamped to MIN_MMR (100)
    assert!(mmr.get_mmr(PLAYER1()) == 100, "MMR should be floor (100)");
    assert!(erc20.balance_of(PLAYER1()) == MIN_MMR, "Balance should be MIN_MMR");
}

#[test]
fn test_update_mmr_zero_to_floor() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    // Try to set to 0
    mmr.update_mmr(PLAYER1(), 0);
    stop_cheat_caller_address(contract_address);

    // Should be clamped to MIN_MMR (100)
    assert!(mmr.get_mmr(PLAYER1()) == 100, "MMR should be floor (100)");
}

#[test]
fn test_update_mmr_no_change() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    let balance_before = erc20.balance_of(PLAYER1());

    // Update to same value
    mmr.update_mmr(PLAYER1(), 1000);
    stop_cheat_caller_address(contract_address);

    assert!(erc20.balance_of(PLAYER1()) == balance_before, "Balance should not change");
}

#[test]
#[should_panic(expected: ('MMRToken: Player not initialized',))]
fn test_update_mmr_uninitialized() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    // Try to update without initializing first
    mmr.update_mmr(PLAYER1(), 1500);
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: ('Caller is missing role',))]
fn test_update_mmr_unauthorized() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    stop_cheat_caller_address(contract_address);

    // Try to update without GAME role
    start_cheat_caller_address(contract_address, PLAYER2());
    mmr.update_mmr(PLAYER1(), 1500);
    stop_cheat_caller_address(contract_address);
}

// ================================
// BATCH UPDATE TESTS
// ================================

#[test]
fn test_update_mmr_batch() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    mmr.initialize_player(PLAYER2());

    // Batch update
    let updates = array![(PLAYER1(), 1200), (PLAYER2(), 800)];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 1200, "Player1 should have 1200 MMR");
    assert!(mmr.get_mmr(PLAYER2()) == 800, "Player2 should have 800 MMR");
}

#[test]
fn test_update_mmr_batch_auto_initialize() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Batch update with uninitialized players - should auto-initialize
    let updates = array![(PLAYER1(), 1200), (PLAYER2(), 800)];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    // Both players should be initialized and have correct MMR
    assert!(mmr.has_mmr(PLAYER1()), "Player1 should be initialized");
    assert!(mmr.has_mmr(PLAYER2()), "Player2 should be initialized");
    assert!(mmr.get_mmr(PLAYER1()) == 1200, "Player1 should have 1200 MMR");
    assert!(mmr.get_mmr(PLAYER2()) == 800, "Player2 should have 800 MMR");
}

#[test]
fn test_update_mmr_batch_floor_enforced() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Batch update with one below floor
    let updates = array![(PLAYER1(), 50), (PLAYER2(), 1500)];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 100, "Player1 should be at floor");
    assert!(mmr.get_mmr(PLAYER2()) == 1500, "Player2 should have 1500");
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
    let updates = array![(PLAYER1(), 1200)];

    start_cheat_caller_address(contract_address, PLAYER2());
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);
}

// ================================
// ERC20 BALANCE TESTS
// ================================

#[test]
fn test_balance_of() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    stop_cheat_caller_address(contract_address);

    // Balance should be in wei (18 decimals)
    assert!(erc20.balance_of(PLAYER1()) == INITIAL_MMR, "Balance should be 1000e18");
}

#[test]
fn test_total_supply() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    mmr.initialize_player(PLAYER2());
    stop_cheat_caller_address(contract_address);

    // Total supply should be sum of all balances
    assert!(erc20.total_supply() == 2 * INITIAL_MMR, "Total supply should be 2000e18");
}

#[test]
fn test_total_supply_after_updates() {
    let (mmr, erc20, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());
    mmr.initialize_player(PLAYER2());

    // Update one up, one down
    mmr.update_mmr(PLAYER1(), 1200); // +200
    mmr.update_mmr(PLAYER2(), 800); // -200
    stop_cheat_caller_address(contract_address);

    // Total supply should remain the same
    assert!(erc20.total_supply() == 2 * INITIAL_MMR, "Total supply should be unchanged");
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

    // Batch initialize and update in one call (simulating game end)
    let updates = array![
        (p1, 1025), // Winner gains
        (p2, 1010),
        (p3, 1000), // Middle stays same
        (p4, 990),
        (p5, 975),
        (p6, 950), // Loser loses most
    ];
    mmr.update_mmr_batch(updates);
    stop_cheat_caller_address(contract_address);

    // Verify all players initialized and have correct MMR
    assert!(mmr.has_mmr(p1), "P1 should have MMR");
    assert!(mmr.has_mmr(p6), "P6 should have MMR");
    assert!(mmr.get_mmr(p1) == 1025, "P1 should have 1025");
    assert!(mmr.get_mmr(p6) == 950, "P6 should have 950");
}

#[test]
fn test_multiple_games_same_players() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());

    // Game 1
    mmr.initialize_player(PLAYER1());
    mmr.initialize_player(PLAYER2());
    mmr.update_mmr(PLAYER1(), 1025);
    mmr.update_mmr(PLAYER2(), 975);

    // Game 2
    mmr.update_mmr(PLAYER1(), 1000); // P1 loses, back to 1000
    mmr.update_mmr(PLAYER2(), 1000); // P2 wins, back to 1000

    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 1000, "P1 should be at 1000");
    assert!(mmr.get_mmr(PLAYER2()) == 1000, "P2 should be at 1000");
}

#[test]
fn test_large_mmr_values() {
    let (mmr, _, contract_address) = setup();

    start_cheat_caller_address(contract_address, GAME());
    mmr.initialize_player(PLAYER1());

    // Set very high MMR
    mmr.update_mmr(PLAYER1(), 5000);
    stop_cheat_caller_address(contract_address);

    assert!(mmr.get_mmr(PLAYER1()) == 5000, "Should handle large MMR");
}

// ================================
// CONSTANT VERIFICATION TESTS
// ================================

#[test]
fn test_constants() {
    // Verify constants are correct
    assert!(INITIAL_MMR == 1000_000000000000000000, "INITIAL_MMR should be 1000e18");
    assert!(MIN_MMR == 100_000000000000000000, "MIN_MMR should be 100e18");
    assert!(MMR_PRECISION == 1_000000000000000000, "MMR_PRECISION should be 1e18");
}
