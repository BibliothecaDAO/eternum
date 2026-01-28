//! MMR Systems Integration Tests
//!
//! Tests for:
//! - commit_game_mmr_meta: Commits MMR metadata (median) for a completed game
//! - claim_game_mmr: Claims MMR updates for all players
//!
//! These tests use snforge with actual system calls through dispatchers.

#[cfg(test)]
mod tests {
    use core::num::traits::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, WORLD_CONFIG_ID};
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::mmr::{MMRClaimed, MMRConfigDefaultImpl, MMRGameMeta};
    use crate::models::rank::{PlayerRank, PlayersRankFinal, PlayersRankTrial};
    use crate::systems::mmr::contracts::{IMMRSystemsDispatcher, IMMRSystemsDispatcherTrait};
    use crate::utils::testing::contracts::mmr_token_mock::{IMockMMRTokenDispatcher, IMockMMRTokenDispatcherTrait};

    // ================================
    // TEST HELPERS
    // ================================

    // Token uses 18 decimals
    const PRECISION: u256 = 1_000000000000000000; // 1e18

    fn e18(val: u256) -> u256 {
        val * PRECISION
    }

    fn addr(val: felt252) -> ContractAddress {
        val.try_into().unwrap()
    }

    fn namespace_def_mmr() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // Core config
                TestResource::Model("WorldConfig"), // MMR models
                TestResource::Model("MMRGameMeta"),
                TestResource::Model("MMRClaimed"), // Rank models
                TestResource::Model("PlayersRankFinal"),
                TestResource::Model("PlayersRankTrial"), TestResource::Model("PlayerRank"),
                // MMR system contract
                TestResource::Contract("mmr_systems"), // MMR events
                TestResource::Event("MMRGameCommitted"),
                TestResource::Event("PlayerMMRChanged"),
            ]
                .span(),
        }
    }

    fn contract_defs_mmr() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"mmr_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn setup_mmr_world() -> WorldStorage {
        let mut world = spawn_test_world([namespace_def_mmr()].span());
        world.sync_perms_and_inits(contract_defs_mmr());
        world.dispatcher.uuid();
        // Set a non-zero timestamp for tests (contract uses get_block_timestamp)
        start_cheat_block_timestamp_global(1000);
        world
    }

    fn get_mmr_systems_dispatcher(ref world: WorldStorage) -> (ContractAddress, IMMRSystemsDispatcher) {
        let (addr, _) = world.dns(@"mmr_systems").unwrap();
        (addr, IMMRSystemsDispatcher { contract_address: addr })
    }

    /// Deploys the mock MMR token contract
    fn deploy_mock_mmr_token() -> (ContractAddress, IMockMMRTokenDispatcher) {
        let contract_class = declare("MockMMRToken").unwrap().contract_class();
        let (token_address, _) = contract_class.deploy(@array![]).unwrap();
        (token_address, IMockMMRTokenDispatcher { contract_address: token_address })
    }

    /// Sets up a finalized trial with ranked players
    fn setup_finalized_trial(
        ref world: WorldStorage, trial_id: u128, players: Span<ContractAddress>, ranks: Span<u16>,
    ) {
        // Set finalized trial
        let players_rank_final = PlayersRankFinal { world_id: WORLD_CONFIG_ID.into(), trial_id };
        world.write_model_test(@players_rank_final);

        // Set trial data
        let player_count: u16 = players.len().try_into().unwrap();
        let trial = PlayersRankTrial {
            trial_id,
            owner: addr('trial_owner'),
            last_rank: player_count,
            last_player_points: 0,
            total_player_points: 0,
            total_player_count_committed: player_count,
            total_player_count_revealed: player_count,
            total_prize_amount: 0,
            total_prize_amount_calculated: 0,
        };
        world.write_model_test(@trial);

        // Set player ranks
        let mut i: u32 = 0;
        while i < players.len() {
            let player_rank = PlayerRank { trial_id, player: *players.at(i), rank: *ranks.at(i), paid: false };
            world.write_model_test(@player_rank);
            i += 1;
        }
    }

    /// Sets up MMR config with a mock token address
    fn setup_mmr_config(ref world: WorldStorage, token_address: ContractAddress) {
        let mut config = MMRConfigDefaultImpl::default();
        config.enabled = true;
        config.mmr_token_address = token_address;
        WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), config);
    }

    // ================================
    // COMMIT SUCCESS TESTS
    // ================================

    #[test]
    fn test_commit_success_six_players_even_median() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        // Set up players with known MMRs (sorted ascending)
        let p1 = addr('p1');
        let p2 = addr('p2');
        let p3 = addr('p3');
        let p4 = addr('p4');
        let p5 = addr('p5');
        let p6 = addr('p6');

        // MMRs: 800, 900, 1000, 1100, 1200, 1400 (with 18 decimals)
        // Median for even count = (1000 + 1100) / 2 = 1050
        token.set_mmr(p1, e18(800));
        token.set_mmr(p2, e18(900));
        token.set_mmr(p3, e18(1000));
        token.set_mmr(p4, e18(1100));
        token.set_mmr(p5, e18(1200));
        token.set_mmr(p6, e18(1400));

        // Players must be provided sorted by MMR ascending
        let players = array![p1, p2, p3, p4, p5, p6];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        // Verify MMRGameMeta was written with correct median
        let meta: MMRGameMeta = world.read_model(1_u128);
        assert!(meta.game_median == 1050, "Median should be 1050 for even count");
    }

    #[test]
    fn test_commit_success_seven_players_odd_median() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        let p1 = addr('p1');
        let p2 = addr('p2');
        let p3 = addr('p3');
        let p4 = addr('p4');
        let p5 = addr('p5');
        let p6 = addr('p6');
        let p7 = addr('p7');

        // MMRs: 700, 850, 950, 1000, 1050, 1150, 1300 (with 18 decimals)
        // Median for odd count = middle element = 1000 (index 3)
        token.set_mmr(p1, e18(700));
        token.set_mmr(p2, e18(850));
        token.set_mmr(p3, e18(950));
        token.set_mmr(p4, e18(1000));
        token.set_mmr(p5, e18(1050));
        token.set_mmr(p6, e18(1150));
        token.set_mmr(p7, e18(1300));

        let players = array![p1, p2, p3, p4, p5, p6, p7];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16, 7_u16];

        // Need to update min_players config since we have 7
        let mut config = MMRConfigDefaultImpl::default();
        config.enabled = true;
        config.mmr_token_address = token_addr;
        config.min_players = 6; // Keep at 6, we have 7
        WorldConfigUtilImpl::set_member(ref world, selector!("mmr_config"), config);

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        let meta: MMRGameMeta = world.read_model(1_u128);
        assert!(meta.game_median == 1000, "Median should be 1000 for odd count");
    }

    #[test]
    fn test_commit_success_new_players_use_initial_mmr() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        // Players with no MMR set - should use initial_mmr (1000)
        let p1 = addr('new1');
        let p2 = addr('new2');
        let p3 = addr('new3');
        let p4 = addr('new4');
        let p5 = addr('new5');
        let p6 = addr('new6');

        // All use initial_mmr = 1000, so median = 1000
        let players = array![p1, p2, p3, p4, p5, p6];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        let meta: MMRGameMeta = world.read_model(1_u128);
        assert!(meta.game_median == 1000, "Median should be 1000 (initial MMR for new players)");
    }

    // ================================
    // COMMIT ERROR TESTS
    // ================================

    #[test]
    #[should_panic(expected: "Eternum: rankings not finalized")]
    fn test_commit_fails_no_finalized_trial() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: MMR not enabled")]
    fn test_commit_fails_mmr_not_enabled() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        // MMR config not enabled (default)

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: no players")]
    fn test_commit_fails_empty_players() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1')];
        let ranks = array![1_u16];
        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, addr('mock_token'));

        let empty_players: Array<ContractAddress> = array![];
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(empty_players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: MMR: player count mismatch")]
    fn test_commit_fails_player_count_mismatch() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        // Set up trial with 6 players
        let all_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];
        setup_finalized_trial(ref world, 1, all_players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Try to commit with only 4 players
        let fewer_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4')];

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(fewer_players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "MMR: players must be sorted by MMR ascending")]
    fn test_commit_fails_players_not_sorted() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        let p1 = addr('p1');
        let p2 = addr('p2');
        let p3 = addr('p3');
        let p4 = addr('p4');
        let p5 = addr('p5');
        let p6 = addr('p6');

        // Set MMRs (with 18 decimals)
        token.set_mmr(p1, e18(1400)); // Highest
        token.set_mmr(p2, e18(900));
        token.set_mmr(p3, e18(1000));
        token.set_mmr(p4, e18(1100));
        token.set_mmr(p5, e18(1200));
        token.set_mmr(p6, e18(800)); // Lowest

        // Provide in wrong order (not sorted by MMR)
        let players = array![p1, p2, p3, p4, p5, p6];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "MMR: player address repeated")]
    fn test_commit_fails_duplicate_players() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        let p1 = addr('p1');
        let p2 = addr('p2');
        let p3 = addr('p3');

        token.set_mmr(p1, e18(900));
        token.set_mmr(p2, e18(1000));
        token.set_mmr(p3, e18(1100));

        // Include p1 twice
        let players_with_dup = array![p1, p2, p3, p1, addr('p4'), addr('p5')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players_with_dup.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players_with_dup);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "MMR: player")]
    fn test_commit_fails_player_not_in_trial() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        // Set up trial with specific players
        let trial_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];
        setup_finalized_trial(ref world, 1, trial_players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Try to commit with a player not in trial
        let wrong_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('intruder')];

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(wrong_players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: mmr meta already committed")]
    fn test_commit_fails_already_committed() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // First commit succeeds
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players.clone());
        stop_cheat_caller_address(system_addr);

        // Second commit should fail
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: not enough players")]
    fn test_commit_fails_not_enough_players() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        // Only 3 players, but min_players is 6
        let players = array![addr('p1'), addr('p2'), addr('p3')];
        let ranks = array![1_u16, 2_u16, 3_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);
    }

    // ================================
    // CLAIM SUCCESS TESTS
    // ================================

    #[test]
    fn test_claim_success_six_players_mmr_updated() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        let p1 = addr('p1');
        let p2 = addr('p2');
        let p3 = addr('p3');
        let p4 = addr('p4');
        let p5 = addr('p5');
        let p6 = addr('p6');

        // All start at 1000 MMR (with 18 decimals)
        token.set_mmr(p1, e18(1000));
        token.set_mmr(p2, e18(1000));
        token.set_mmr(p3, e18(1000));
        token.set_mmr(p4, e18(1000));
        token.set_mmr(p5, e18(1000));
        token.set_mmr(p6, e18(1000));

        // Players sorted by MMR (all same, so any order works)
        let players = array![p1, p2, p3, p4, p5, p6];
        // Ranks: p1=1st, p2=2nd, etc.
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit first
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players.clone());
        stop_cheat_caller_address(system_addr);

        // Claim
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);

        // Verify winner gained and loser lost (values are in 18 decimals)
        let winner_mmr: u256 = token.get_player_mmr(p1);
        let loser_mmr: u256 = token.get_player_mmr(p6);

        assert!(winner_mmr > e18(1000), "Rank 1 should gain MMR");
        assert!(loser_mmr < e18(1000), "Rank 6 should lose MMR");

        // Verify monotonic: better rank = higher final MMR
        let mmr2: u256 = token.get_player_mmr(p2);
        let mmr3: u256 = token.get_player_mmr(p3);
        let mmr4: u256 = token.get_player_mmr(p4);
        let mmr5: u256 = token.get_player_mmr(p5);

        assert!(winner_mmr > mmr2, "Rank 1 > Rank 2");
        assert!(mmr2 > mmr3, "Rank 2 > Rank 3");
        assert!(mmr3 > mmr4, "Rank 3 > Rank 4");
        assert!(mmr4 > mmr5, "Rank 4 > Rank 5");
        assert!(mmr5 > loser_mmr, "Rank 5 > Rank 6");
    }

    #[test]
    fn test_claim_success_marks_claimed() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players.clone());
        stop_cheat_caller_address(system_addr);

        // Verify not claimed yet
        let claimed_before: MMRClaimed = world.read_model(WORLD_CONFIG_ID);
        assert!(claimed_before.claimed_at == 0, "Should not be claimed yet");

        // Claim
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);

        // Verify claimed
        let claimed_after: MMRClaimed = world.read_model(WORLD_CONFIG_ID);
        assert!(claimed_after.claimed_at > 0, "Should be marked as claimed");
    }

    // ================================
    // CLAIM ERROR TESTS
    // ================================

    #[test]
    #[should_panic(expected: "Eternum: rankings not finalized")]
    fn test_claim_fails_no_finalized_trial() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: MMR not enabled")]
    fn test_claim_fails_mmr_not_enabled() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: mmr meta not committed")]
    fn test_claim_fails_meta_not_committed() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, addr('mock_token'));

        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: mmr already claimed")]
    fn test_claim_fails_already_claimed() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players.clone());
        stop_cheat_caller_address(system_addr);

        // First claim succeeds
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players.clone());
        stop_cheat_caller_address(system_addr);

        // Second claim should fail
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: MMR: player count mismatch")]
    fn test_claim_fails_player_count_mismatch() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit with all players
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        // Try to claim with fewer players
        let fewer_players = array![addr('p1'), addr('p2'), addr('p3')];
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(fewer_players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "MMR: player address repeated")]
    fn test_claim_fails_duplicate_players() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        // Try to claim with duplicates
        let dup_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p1'), addr('p6')];
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(dup_players);
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    #[should_panic(expected: "Eternum: player zero rank")]
    fn test_claim_fails_player_no_rank() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, _token) = deploy_mock_mmr_token();

        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')];
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.commit_game_mmr_meta(players);
        stop_cheat_caller_address(system_addr);

        // Try to claim with a player not in trial
        let wrong_players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('intruder')];
        start_cheat_caller_address(system_addr, addr('caller'));
        dispatcher.claim_game_mmr(wrong_players);
        stop_cheat_caller_address(system_addr);
    }

    // ================================
    // FULL INTEGRATION TEST
    // ================================

    #[test]
    fn test_full_commit_then_claim_flow() {
        let mut world = setup_mmr_world();
        let (system_addr, dispatcher) = get_mmr_systems_dispatcher(ref world);
        let (token_addr, token) = deploy_mock_mmr_token();

        // Setup: 6 players with varying MMRs
        let p1 = addr('alice');
        let p2 = addr('bob');
        let p3 = addr('charlie');
        let p4 = addr('diana');
        let p5 = addr('eve');
        let p6 = addr('frank');

        // Set MMRs (must be sorted ascending for commit, with 18 decimals)
        token.set_mmr(p1, e18(800)); // Low-rated underdog
        token.set_mmr(p2, e18(900));
        token.set_mmr(p3, e18(1000));
        token.set_mmr(p4, e18(1100));
        token.set_mmr(p5, e18(1200));
        token.set_mmr(p6, e18(1400)); // High-rated favorite

        // Players sorted by MMR ascending
        let players_by_mmr = array![p1, p2, p3, p4, p5, p6];

        // Ranks: p1 (800 MMR) wins! p6 (1400 MMR) loses - an upset!
        let ranks = array![1_u16, 2_u16, 3_u16, 4_u16, 5_u16, 6_u16];

        setup_finalized_trial(ref world, 1, players_by_mmr.span(), ranks.span());
        setup_mmr_config(ref world, token_addr);

        // Commit phase
        start_cheat_caller_address(system_addr, addr('committer'));
        dispatcher.commit_game_mmr_meta(players_by_mmr.clone());
        stop_cheat_caller_address(system_addr);

        // Verify median computed correctly: (1000 + 1100) / 2 = 1050
        let meta: MMRGameMeta = world.read_model(1_u128);
        assert!(meta.game_median == 1050, "Median should be 1050");

        // Claim phase
        start_cheat_caller_address(system_addr, addr('claimer'));
        dispatcher.claim_game_mmr(players_by_mmr);
        stop_cheat_caller_address(system_addr);

        // Verify results (values are in 18 decimals)
        let winner_new_mmr: u256 = token.get_player_mmr(p1);
        let loser_new_mmr: u256 = token.get_player_mmr(p6);

        // Underdog won - should gain significant MMR (was 800e18)
        let winner_gain: u256 = winner_new_mmr - e18(800);
        assert!(winner_gain > e18(20), "Underdog winner should gain significant MMR");

        // Favorite lost - should lose MMR (was 1400e18)
        assert!(loser_new_mmr < e18(1400), "Favorite loser should lose MMR");

        // Verify claimed flag is set
        let claimed: MMRClaimed = world.read_model(WORLD_CONFIG_ID);
        assert!(claimed.claimed_at > 0, "Should be marked claimed");
    }
}
