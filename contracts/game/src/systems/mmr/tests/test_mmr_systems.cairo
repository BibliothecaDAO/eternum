// MMR Systems Integration Tests
//
// Tests the full MMR game flow including:
// - Admin controls for ranked series
// - MMR processing after game completion
// - Player stats tracking
// - Game record creation

use core::num::traits::Zero;
use dojo::model::{Model, ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::{ContractAddress, contract_address_const};
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR};
use crate::models::config::{BlitzRegistrationConfig, WorldConfigUtilImpl};
use crate::models::mmr::{GameMMRRecord, MMRConfig, MMRConfigDefaultImpl, MMRGameMeta, SeriesMMRConfig};
use crate::models::rank::{PlayerRank, PlayersRankTrial};
use crate::systems::mmr::contracts::{IMMRSystems, IMMRSystemsDispatcher, IMMRSystemsDispatcherTrait};
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
            TestResource::Model("WorldConfig"), // MMR models
            TestResource::Model("PlayerMMRStats"),
            TestResource::Model("GameMMRRecord"), TestResource::Model("SeriesMMRConfig"),
            TestResource::Model("MMRGameMeta"), TestResource::Model("MMRClaimed"),
            // Rank models (for trial data)
            TestResource::Model("PlayersRankTrial"), TestResource::Model("PlayerRank"),
            // MMR systems contract
            TestResource::Contract("mmr_systems"), // MMR events
            TestResource::Event("MMRGameProcessed"),
            TestResource::Event("MMRGameCommitted"), TestResource::Event("PlayerMMRChanged"),
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
    let mut world = spawn_test_world([namespace_def()].span());
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
        lobby_split_weight_scaled: 250000, // 0.25 * 1e6
        mean_regression_scaled: 15000, // 0.015 * 1e6
        min_players: 2, // Lower threshold for testing
        min_entry_fee: 0 // No fee requirement for testing
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);
}

/// Set blitz registration fee (used for MMR min entry fee checks)
fn setup_blitz_registration_fee(ref world: WorldStorage, fee_amount: u256) {
    let blitz_registration_config = BlitzRegistrationConfig {
        fee_amount,
        fee_token: Zero::zero(),
        fee_recipient: Zero::zero(),
        entry_token_address: Zero::zero(),
        collectibles_cosmetics_max: 0,
        collectibles_cosmetics_address: Zero::zero(),
        collectibles_timelock_address: Zero::zero(),
        collectibles_lootchest_address: Zero::zero(),
        collectibles_elitenft_address: Zero::zero(),
        registration_count: 0,
        registration_count_max: 0,
        registration_start_at: 0,
        assigned_positions_count: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("blitz_registration_config"), blitz_registration_config);
}

/// Set up a mock trial with player rankings
fn setup_mock_trial(ref world: WorldStorage, trial_id: u128, players: Span<ContractAddress>, ranks: Span<u16>) {
    let player_count: u16 = players.len().try_into().unwrap();
    let mut last_rank: u16 = 0;

    // Create rank entries for each player
    let mut i: u32 = 0;
    while i < players.len() {
        let player = *players.at(i);
        let rank = *ranks.at(i);

        if rank > last_rank {
            last_rank = rank;
        }

        // Create player rank entry
        let mut player_rank: PlayerRank = world.read_model((trial_id, player));
        player_rank.rank = rank;
        world.write_model_test(@player_rank);

        i += 1;
    }

    // Create trial
    let trial = PlayersRankTrial {
        trial_id,
        owner: contract_address_const::<'trial_owner'>(),
        last_rank,
        last_player_points: 0,
        total_player_points: 0,
        total_player_count_committed: player_count,
        total_player_count_revealed: player_count,
        total_prize_amount: 0,
        total_prize_amount_calculated: 0,
    };
    world.write_model_test(@trial);
}

/// Get MMR systems dispatcher
fn get_mmr_dispatcher(world: @WorldStorage) -> IMMRSystemsDispatcher {
    let (addr, _) = world.dns(@"mmr_systems").unwrap();
    IMMRSystemsDispatcher { contract_address: addr }
}

/// Get MMR systems contract address for cheat calls
fn get_mmr_contract_address(world: @WorldStorage) -> ContractAddress {
    let (addr, _) = world.dns(@"mmr_systems").unwrap();
    addr
}


// ================================
// SET SERIES RANKED TESTS
// ================================

#[test]
fn test_set_series_ranked_as_admin() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 1;

    // Initially not ranked
    assert!(!mmr.is_series_ranked(trial_id), "Should not be ranked initially");

    // Set as admin
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    // Now should be ranked
    assert!(mmr.is_series_ranked(trial_id), "Should be ranked after admin sets it");

    // Can also unset
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, false);
    stop_cheat_caller_address(mmr_addr);
    assert!(!mmr.is_series_ranked(trial_id), "Should be unranked after admin unsets it");
}

#[test]
#[should_panic]
fn test_set_series_ranked_as_non_admin() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);

    // Try to set as non-admin
    start_cheat_caller_address(mmr_addr, NON_ADMIN());
    mmr.set_series_ranked(1, true);
    stop_cheat_caller_address(mmr_addr);
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
        lobby_split_weight_scaled: 250000,
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
        lobby_split_weight_scaled: 250000,
        mean_regression_scaled: 15000,
        min_players: 6,
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

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
        lobby_split_weight_scaled: 250000,
        mean_regression_scaled: 15000,
        min_players: 2,
        min_entry_fee: 1_000000000000000000 // 1 LORDS (18 decimals)
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    // 0 fee should not be eligible
    assert!(!mmr.is_game_mmr_eligible(trial_id, 6, 0), "Should not be eligible with 0 fee");

    // Below min fee should not be eligible
    assert!(
        !mmr.is_game_mmr_eligible(trial_id, 6, 500000000000000000), "Should not be eligible below min fee",
    ); // 0.5 LORDS

    // Exactly min fee should be eligible
    assert!(mmr.is_game_mmr_eligible(trial_id, 6, 1_000000000000000000), "Should be eligible with exactly min fee");

    // Above min fee should be eligible
    assert!(mmr.is_game_mmr_eligible(trial_id, 6, 5_000000000000000000), "Should be eligible above min fee");
}


// ================================
// COMMIT + CLAIM MMR TESTS
// ================================

#[test]
fn test_commit_mmr_disabled() {
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
        lobby_split_weight_scaled: 250000,
        mean_regression_scaled: 15000,
        min_players: 2,
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);

    // Commit should no-op
    mmr.commit_game_mmr_meta(1, 1000, 1000);
    // Claim should no-op
    mmr.claim_game_mmr(1, PLAYER1());

    // Verify no records were created
    let record: GameMMRRecord = world.read_model((1_u128, PLAYER1()));
    assert!(record.timestamp == 0, "No record should be created when disabled");
}

#[test]
fn test_commit_mmr_not_ranked() {
    let mut world = spawn_mmr_test_world();
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);

    // Set up trial but do NOT mark as ranked
    let players = array![PLAYER1(), PLAYER2()].span();
    let ranks = array![1_u16, 2].span();
    setup_mock_trial(ref world, 1, players, ranks);

    // Commit should no-op
    mmr.commit_game_mmr_meta(1, 1000, 1000);
    // Claim should no-op
    mmr.claim_game_mmr(1, PLAYER1());

    // Verify no records were created
    let record: GameMMRRecord = world.read_model((1_u128, PLAYER1()));
    assert!(record.timestamp == 0, "No record should be created when not ranked");
}

#[test]
fn test_commit_mmr_already_processed() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 1;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    // Manually mark as processed
    let series_config = SeriesMMRConfig { trial_id, is_ranked: true, mmr_processed: true };
    world.write_model_test(@series_config);

    // Set up trial
    let players = array![PLAYER1(), PLAYER2()].span();
    let ranks = array![1_u16, 2].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    // Commit should return early
    mmr.commit_game_mmr_meta(trial_id, 1000, 1000);
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
    let mmr_addr = get_mmr_contract_address(@world);

    start_cheat_caller_address(mmr_addr, ADMIN());

    // Set multiple series with different ranked status
    mmr.set_series_ranked(1, true);
    mmr.set_series_ranked(2, false);
    mmr.set_series_ranked(3, true);

    stop_cheat_caller_address(mmr_addr);

    // Verify each series has independent status
    assert!(mmr.is_series_ranked(1), "Series 1 should be ranked");
    assert!(!mmr.is_series_ranked(2), "Series 2 should not be ranked");
    assert!(mmr.is_series_ranked(3), "Series 3 should be ranked");

    // Change one series
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(1, false);
    stop_cheat_caller_address(mmr_addr);

    // Others should be unaffected
    assert!(!mmr.is_series_ranked(1), "Series 1 should now be unranked");
    assert!(!mmr.is_series_ranked(2), "Series 2 should still not be ranked");
    assert!(mmr.is_series_ranked(3), "Series 3 should still be ranked");
}


// ================================
// COMMIT + CLAIM FLOW TESTS
// ================================

#[test]
fn test_commit_and_claim_success() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 100;

    // Mark series as ranked (admin only)
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    // Set up a complete trial with 4 players
    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2(), PLAYER3(), PLAYER4()].span();
    let ranks: Span<u16> = array![1_u16, 2, 3, 4].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    start_cheat_block_timestamp_global(1000);

    // Commit meta and claim for all players
    mmr.commit_game_mmr_meta(trial_id, 1000, 1000);
    mmr.claim_game_mmr(trial_id, PLAYER1());
    mmr.claim_game_mmr(trial_id, PLAYER2());
    mmr.claim_game_mmr(trial_id, PLAYER3());
    mmr.claim_game_mmr(trial_id, PLAYER4());

    // Verify game records were created
    let record1 = mmr.get_game_mmr_record(trial_id, PLAYER1());
    let record4 = mmr.get_game_mmr_record(trial_id, PLAYER4());

    assert!(record1.timestamp == 1000, "Record 1 should have timestamp");
    assert!(record4.timestamp == 1000, "Record 4 should have timestamp");
    assert!(record1.rank == 1, "Record 1 should have rank 1");
    assert!(record4.rank == 4, "Record 4 should have rank 4");
    assert!(record1.player_count == 4, "Record should show 4 players");

    // Verify player stats were updated
    let stats1 = mmr.get_player_stats(PLAYER1());
    let stats4 = mmr.get_player_stats(PLAYER4());

    assert!(stats1.games_played == 1, "Player 1 should have 1 game played");
    assert!(stats4.games_played == 1, "Player 4 should have 1 game played");

    // Winner should have gained, loser should have lost
    assert!(record1.mmr_after > record1.mmr_before, "Winner should gain MMR");
    assert!(record4.mmr_after < record4.mmr_before, "Loser should lose MMR");

    // Series should be marked processed after all claims
    let series_config: SeriesMMRConfig = world.read_model(trial_id);
    assert!(series_config.mmr_processed, "Series should be marked processed");
}

#[test]
fn test_claim_idempotent() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 101;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2()].span();
    let ranks: Span<u16> = array![1_u16, 2].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    start_cheat_block_timestamp_global(2000);

    mmr.commit_game_mmr_meta(trial_id, 1000, 1000);
    mmr.claim_game_mmr(trial_id, PLAYER1());

    let record_after_first = mmr.get_game_mmr_record(trial_id, PLAYER1());
    let stats_after_first = mmr.get_player_stats(PLAYER1());

    // Claim again (should be no-op)
    start_cheat_block_timestamp_global(3000);
    mmr.claim_game_mmr(trial_id, PLAYER1());

    let record_after_second = mmr.get_game_mmr_record(trial_id, PLAYER1());
    let stats_after_second = mmr.get_player_stats(PLAYER1());

    assert!(record_after_first.timestamp == record_after_second.timestamp, "Record timestamp should not change");
    assert!(
        record_after_first.mmr_after == record_after_second.mmr_after, "Record MMR should not change on second call",
    );
    assert!(stats_after_first.games_played == stats_after_second.games_played, "Games played should not increase");
}

#[test]
fn test_commit_below_min_entry_fee() {
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
        lobby_split_weight_scaled: 250000,
        mean_regression_scaled: 15000,
        min_players: 2,
        min_entry_fee: 1_000000000000000000,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    // Fee amount below min_entry_fee
    setup_blitz_registration_fee(ref world, 0);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 102;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2()].span();
    let ranks: Span<u16> = array![1_u16, 2].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    // Commit should no-op since entry fee below min
    mmr.commit_game_mmr_meta(trial_id, 1000, 1000);

    let meta: MMRGameMeta = mmr.get_game_mmr_meta(trial_id);
    assert!(meta.committed_at == 0, "Meta should not be committed below min entry fee");
}

#[test]
fn test_commit_below_min_players() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());

    // Set up config with min_players = 4
    let mmr_config = MMRConfig {
        enabled: true,
        mmr_token_address: Zero::zero(),
        initial_mmr: 1000,
        min_mmr: 100,
        distribution_mean: 1500,
        spread_factor: 450,
        max_delta: 45,
        k_factor: 50,
        lobby_split_weight_scaled: 250000,
        mean_regression_scaled: 15000,
        min_players: 4, // Require 4 players
        min_entry_fee: 0,
    };
    WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), mmr_config);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 103;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2()].span();
    let ranks: Span<u16> = array![1_u16, 2].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    mmr.commit_game_mmr_meta(trial_id, 1000, 1000);

    let meta: MMRGameMeta = mmr.get_game_mmr_meta(trial_id);
    assert!(meta.committed_at == 0, "Meta should not be committed below min players");
}

#[test]
fn test_claim_requires_commit() {
    let mut world = spawn_mmr_test_world();
    setup_world_config(ref world, ADMIN());
    setup_mmr_config(ref world);

    let mmr = get_mmr_dispatcher(@world);
    let mmr_addr = get_mmr_contract_address(@world);
    let trial_id: u128 = 104;

    // Mark series as ranked
    start_cheat_caller_address(mmr_addr, ADMIN());
    mmr.set_series_ranked(trial_id, true);
    stop_cheat_caller_address(mmr_addr);

    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2()].span();
    let ranks: Span<u16> = array![1_u16, 2].span();
    setup_mock_trial(ref world, trial_id, players, ranks);

    // Claim without commit should no-op
    mmr.claim_game_mmr(trial_id, PLAYER1());
    let record = mmr.get_game_mmr_record(trial_id, PLAYER1());
    assert!(record.timestamp == 0, "No record should be created without commit");
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
    let players: Span<ContractAddress> = array![PLAYER1(), PLAYER2(), PLAYER3(), PLAYER4(), PLAYER5(), PLAYER6()]
        .span();
    let ranks: Span<u16> = array![1_u16, 2, 3, 4, 5, 6].span();
    let mmrs: Span<u128> = array![1000_u128, 1000, 1000, 1000, 1000, 1000].span();

    // No split lobby
    let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs, Option::None);
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

    // No split lobby
    let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs, Option::None);
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
