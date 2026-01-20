// MMR Systems Integration Tests
//
// Tests the full MMR game flow including:
// - Admin controls for ranked series
// - MMR processing after game completion
// - Player stats tracking
// - Game record creation

use core::num::traits::Zero;
use dojo::model::{Model, ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait, world};
use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
use starknet::ContractAddress;
use starknet::contract_address_const;
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, WORLD_CONFIG_ID};
use crate::models::config::{WorldConfig, WorldConfigUtilImpl, m_WorldConfig};
use crate::models::mmr::{
    GameMMRRecord, MMRConfig, MMRConfigDefaultImpl, PlayerMMRStats, SeriesMMRConfig, m_GameMMRRecord, m_PlayerMMRStats,
    m_SeriesMMRConfig,
};
use crate::models::rank::{PlayersRankTrial, RankList, RankPrize, m_PlayersRankTrial, m_RankList, m_RankPrize};
use crate::systems::mmr::contracts::{IMMRSystems, IMMRSystemsDispatcher, IMMRSystemsDispatcherTrait, mmr_systems};
use crate::systems::utils::mmr::MMRCalculatorImpl;


// ================================
// TEST HELPERS
// ================================

fn ADMIN() -> ContractAddress {
    contract_address_const::<'admin'>()
}

fn NON_ADMIN() -> ContractAddress {
    contract_address_const::<'non_admin'>()
}

fn PLAYER1() -> ContractAddress {
    contract_address_const::<'player1'>()
}

fn PLAYER2() -> ContractAddress {
    contract_address_const::<'player2'>()
}

fn PLAYER3() -> ContractAddress {
    contract_address_const::<'player3'>()
}

fn PLAYER4() -> ContractAddress {
    contract_address_const::<'player4'>()
}

fn PLAYER5() -> ContractAddress {
    contract_address_const::<'player5'>()
}

fn PLAYER6() -> ContractAddress {
    contract_address_const::<'player6'>()
}

/// Create namespace definition with required models
fn namespace_def() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            // Config models
            TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
            // MMR models
            TestResource::Model(m_PlayerMMRStats::TEST_CLASS_HASH),
            TestResource::Model(m_GameMMRRecord::TEST_CLASS_HASH),
            TestResource::Model(m_SeriesMMRConfig::TEST_CLASS_HASH),
            // Rank models (for trial data)
            TestResource::Model(m_PlayersRankTrial::TEST_CLASS_HASH),
            TestResource::Model(m_RankPrize::TEST_CLASS_HASH),
            TestResource::Model(m_RankList::TEST_CLASS_HASH),
            // MMR systems contract
            TestResource::Contract(mmr_systems::TEST_CLASS_HASH),
        ]
            .span(),
    }
}

/// Create contract definitions with permissions
fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(DEFAULT_NS(), @"mmr_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
    ]
        .span()
}

/// Spawn test world with MMR systems
fn spawn_mmr_test_world() -> WorldStorage {
    let mut world = spawn_test_world(world::TEST_CLASS_HASH, [namespace_def()].span());
    world.sync_perms_and_inits(contract_defs());
    world.dispatcher.uuid();
    world
}

/// Set up world config with admin address
fn setup_world_config(ref world: WorldStorage, admin: ContractAddress) {
    // Set admin address in world config
    WorldConfigUtilImpl::set_member(ref world, selector!("admin_address"), admin);
}

/// Set up MMR config (enabled with no token - for testing calculations only)
fn setup_mmr_config(ref world: WorldStorage) {
    let mmr_config = MMRConfig {
        enabled: true,
        mmr_token_address: Zero::zero(), // No token for unit tests
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        mean_regression_scaled: 15000, // 0.015 * 1e6
        min_players: 2, // Lower threshold for testing
        min_entry_fee: 0, // No fee requirement for testing
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);
}

/// Set up a mock trial with player rankings
fn setup_mock_trial(
    ref world: WorldStorage,
    trial_id: u128,
    players: Span<ContractAddress>,
    ranks: Span<u16>,
) {
    let player_count: u16 = players.len().try_into().unwrap();

    // Create trial
    let trial = PlayersRankTrial {
        trial_id,
        owner: contract_address_const::<'trial_owner'>(),
        last_rank: player_count,
        last_player_points: 0,
        total_player_points: 0,
        total_player_count_committed: player_count,
        total_player_count_revealed: player_count,
        total_prize_amount: 0,
        total_prize_amount_calculated: 0,
    };
    world.write_model_test(@trial);

    // Create rank entries for each player
    let mut i: u32 = 0;
    while i < players.len() {
        let player = *players.at(i);
        let rank = *ranks.at(i);

        // Get or create rank prize entry
        let mut rank_prize: RankPrize = world.read_model((trial_id, rank));
        let index = rank_prize.total_players_same_rank_count;
        rank_prize.total_players_same_rank_count += 1;
        world.write_model_test(@rank_prize);

        // Create rank list entry
        let rank_list = RankList { trial_id, rank, index, player };
        world.write_model_test(@rank_list);

        i += 1;
    };
}

/// Get MMR systems dispatcher
fn get_mmr_dispatcher(world: @WorldStorage) -> IMMRSystemsDispatcher {
    let (addr, _) = world.dns(@"mmr_systems").unwrap();
    IMMRSystemsDispatcher { contract_address: addr }
}


// ================================
// SET SERIES RANKED TESTS
// ================================

#[test]
fn test_set_series_ranked_as_admin() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    let mmr = get_mmr_dispatcher(@world);
    let trial_id: u128 = 1;

    // Initially not ranked
    assert!(!mmr.is_series_ranked(trial_id), "Should not be ranked initially");

    // Set as admin
    starknet::testing::set_contract_address(ADMIN());
    mmr.set_series_ranked(trial_id, true);

    // Now should be ranked
    assert!(mmr.is_series_ranked(trial_id), "Should be ranked after admin sets it");

    // Can also unset
    mmr.set_series_ranked(trial_id, false);
    assert!(!mmr.is_series_ranked(trial_id), "Should be unranked after admin unsets it");
}

#[test]
#[should_panic]
fn test_set_series_ranked_as_non_admin() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    let mmr = get_mmr_dispatcher(@world);

    // Try to set as non-admin
    starknet::testing::set_contract_address(NON_ADMIN());
    mmr.set_series_ranked(1, true);
}


// ================================
// IS SERIES RANKED TESTS
// ================================

#[test]
fn test_is_series_ranked_default() {
    let mut world = spawn_mmr_test_world();
    let mmr = get_mmr_dispatcher(@world);

    // Any trial should default to not ranked
    assert!(!mmr.is_series_ranked(1), "Trial 1 should not be ranked by default");
    assert!(!mmr.is_series_ranked(999), "Trial 999 should not be ranked by default");
}


// ================================
// GET PLAYER MMR TESTS
// ================================

#[test]
fn test_get_player_mmr_uninitialized() {
    let mut world = spawn_mmr_test_world();
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);

    // Uninitialized player should return initial MMR
    let player_mmr = mmr.get_player_mmr(PLAYER1());
    assert!(player_mmr == 1000, "Uninitialized player should have initial MMR of 1000");
}


// ================================
// GET PLAYER STATS TESTS
// ================================

#[test]
fn test_get_player_stats_uninitialized() {
    let mut world = spawn_mmr_test_world();
    let mmr = get_mmr_dispatcher(@world);

    let stats = mmr.get_player_stats(PLAYER1());

    // Uninitialized stats should have zeroed values
    assert!(stats.games_played == 0, "Should have 0 games played");
    assert!(stats.highest_mmr == 0, "Should have 0 highest MMR");
    assert!(stats.lowest_mmr == 0, "Should have 0 lowest MMR");
}


// ================================
// IS GAME MMR ELIGIBLE TESTS
// ================================

#[test]
fn test_is_game_mmr_eligible_disabled() {
    let mut world = spawn_mmr_test_world();

    // Set MMR config as disabled
    let mmr_config = MMRConfig {
        enabled: false,
        mmr_token_address: Zero::zero(),
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        mean_regression_scaled: 15000,
        min_players: 6,
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);

    // Should not be eligible when disabled
    assert!(!mmr.is_game_mmr_eligible(1, 6, 0), "Should not be eligible when MMR disabled");
}

#[test]
fn test_is_game_mmr_eligible_not_ranked() {
    let mut world = spawn_mmr_test_world();
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let trial_id: u128 = 1;

    // Series not marked as ranked
    assert!(!mmr.is_game_mmr_eligible(trial_id, 6, 0), "Should not be eligible when series not ranked");
}

#[test]
fn test_is_game_mmr_eligible_below_min_players() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    // Set min_players to 6
    let mmr_config = MMRConfig {
        enabled: true,
        mmr_token_address: Zero::zero(),
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        mean_regression_scaled: 15000,
        min_players: 6,
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    starknet::testing::set_contract_address(ADMIN());
    mmr.set_series_ranked(trial_id, true);

    // 4 players is below min_players of 6
    assert!(!mmr.is_game_mmr_eligible(trial_id, 4, 0), "Should not be eligible below min players");

    // 6 players should be eligible
    assert!(mmr.is_game_mmr_eligible(trial_id, 6, 0), "Should be eligible with exactly min players");

    // 10 players should be eligible
    assert!(mmr.is_game_mmr_eligible(trial_id, 10, 0), "Should be eligible above min players");
}

#[test]
fn test_is_game_mmr_eligible_below_min_fee() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    // Set min_entry_fee to 1 LORDS
    let mmr_config = MMRConfig {
        enabled: true,
        mmr_token_address: Zero::zero(),
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        mean_regression_scaled: 15000,
        min_players: 2,
        min_entry_fee: 1_000000000000000000, // 1 LORDS (18 decimals)
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    starknet::testing::set_contract_address(ADMIN());
    mmr.set_series_ranked(trial_id, true);

    // 0 fee should not be eligible
    assert!(!mmr.is_game_mmr_eligible(trial_id, 6, 0), "Should not be eligible with 0 fee");

    // Below min fee should not be eligible
    assert!(
        !mmr.is_game_mmr_eligible(trial_id, 6, 500000000000000000),
        "Should not be eligible below min fee",
    ); // 0.5 LORDS

    // Exactly min fee should be eligible
    assert!(
        mmr.is_game_mmr_eligible(trial_id, 6, 1_000000000000000000), "Should be eligible with exactly min fee",
    );

    // Above min fee should be eligible
    assert!(mmr.is_game_mmr_eligible(trial_id, 6, 5_000000000000000000), "Should be eligible above min fee");
}


// ================================
// PROCESS GAME MMR TESTS
// ================================

#[test]
fn test_process_game_mmr_disabled() {
    let mut world = spawn_mmr_test_world();

    // Set MMR config as disabled
    let mmr_config = MMRConfig {
        enabled: false,
        mmr_token_address: Zero::zero(),
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        mean_regression_scaled: 15000,
        min_players: 2,
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);

    // Should not panic, just return early
    let players = array![PLAYER1(), PLAYER2()];
    let ranks = array![1_u16, 2];
    mmr.process_game_mmr(1, players, ranks);

    // Verify no records were created
    let record: GameMMRRecord = world.read_model((1_u128, PLAYER1()));
    assert!(record.timestamp == 0, "No record should be created when disabled");
}

#[test]
fn test_process_game_mmr_not_ranked() {
    let mut world = spawn_mmr_test_world();
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);

    // Series not marked as ranked - should return early
    let players = array![PLAYER1(), PLAYER2()];
    let ranks = array![1_u16, 2];
    mmr.process_game_mmr(1, players, ranks);

    // Verify no records were created
    let record: GameMMRRecord = world.read_model((1_u128, PLAYER1()));
    assert!(record.timestamp == 0, "No record should be created when not ranked");
}

#[test]
fn test_process_game_mmr_already_processed() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    starknet::testing::set_contract_address(ADMIN());
    mmr.set_series_ranked(trial_id, true);

    // Manually mark as processed
    let series_config = SeriesMMRConfig { trial_id, is_ranked: true, mmr_processed: true };
    world.write_model_test(@series_config);

    // Try to process again - should return early
    let players = array![PLAYER1(), PLAYER2()];
    let ranks = array![1_u16, 2];
    mmr.process_game_mmr(trial_id, players, ranks);

    // Would need token to actually create records, so we just verify no panic
}


// ================================
// GET GAME MMR RECORD TESTS
// ================================

#[test]
fn test_get_game_mmr_record_not_exists() {
    let mut world = spawn_mmr_test_world();
    let mmr = get_mmr_dispatcher(@world);

    let record = mmr.get_game_mmr_record(1, PLAYER1());

    // Should return zeroed record
    assert!(record.mmr_before == 0, "Should have 0 mmr_before");
    assert!(record.mmr_after == 0, "Should have 0 mmr_after");
    assert!(record.timestamp == 0, "Should have 0 timestamp");
}


// ================================
// MULTIPLE SERIES TESTS
// ================================

#[test]
fn test_multiple_series_independent() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    let mmr = get_mmr_dispatcher(@world);

    starknet::testing::set_contract_address(ADMIN());

    // Set multiple series with different ranked status
    mmr.set_series_ranked(1, true);
    mmr.set_series_ranked(2, false);
    mmr.set_series_ranked(3, true);

    // Verify each series has independent status
    assert!(mmr.is_series_ranked(1), "Series 1 should be ranked");
    assert!(!mmr.is_series_ranked(2), "Series 2 should not be ranked");
    assert!(mmr.is_series_ranked(3), "Series 3 should be ranked");

    // Change one series
    mmr.set_series_ranked(1, false);

    // Others should be unaffected
    assert!(!mmr.is_series_ranked(1), "Series 1 should now be unranked");
    assert!(!mmr.is_series_ranked(2), "Series 2 should still not be ranked");
    assert!(mmr.is_series_ranked(3), "Series 3 should still be ranked");
}


// ================================
// MMR CALCULATION LIBRARY INTEGRATION TESTS
// ================================

#[test]
fn test_mmr_calculator_median() {
    // Test odd count
    let values: Span<u128> = array![1200, 1000, 1100].span();
    let median = MMRCalculatorImpl::calculate_median(values);
    assert!(median == 1100, "Median of [1200, 1000, 1100] should be 1100");

    // Test even count
    let values2: Span<u128> = array![1000, 1100, 1200, 1300].span();
    let median2 = MMRCalculatorImpl::calculate_median(values2);
    assert!(median2 == 1100, "Median of [1000, 1100, 1200, 1300] should be 1100");
}

#[test]
fn test_mmr_calculator_full_game() {
    let config = MMRConfigDefaultImpl::default();

    // 6 players with equal MMR
    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2(), PLAYER3(), PLAYER4(), PLAYER5(), PLAYER6()].span();
    let ranks: Span<u16> = array![1_u16, 2, 3, 4, 5, 6].span();
    let mmrs: Span<u128> = array![1000_u128, 1000, 1000, 1000, 1000, 1000].span();

    let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs);
    let updates_span = updates.span();

    // Should have 6 updates
    assert!(updates_span.len() == 6, "Should have 6 updates");

    // Winner should gain, loser should lose
    let (_, winner_new) = *updates_span.at(0);
    let (_, loser_new) = *updates_span.at(5);
    assert!(winner_new > 1000, "Winner should gain MMR");
    assert!(loser_new < 1000, "Loser should lose MMR");
}

#[test]
fn test_mmr_calculator_upset() {
    let config = MMRConfigDefaultImpl::default();

    // Low MMR player wins against high MMR players
    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2()].span();
    let ranks: Span<u16> = array![1_u16, 2].span();
    let mmrs: Span<u128> = array![800_u128, 1500].span(); // Low MMR wins

    let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs);
    let updates_span = updates.span();

    let (_, low_mmr_winner_new) = *updates_span.at(0);
    let (_, high_mmr_loser_new) = *updates_span.at(1);

    // Low MMR upset winner should gain significantly
    let gain = low_mmr_winner_new - 800;
    assert!(gain > 0, "Upset winner should gain MMR");

    // High MMR loser should lose
    let loss = 1500 - high_mmr_loser_new;
    assert!(loss > 0, "Upset loser should lose MMR");
}
