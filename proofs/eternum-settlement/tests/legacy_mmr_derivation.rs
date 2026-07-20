use std::collections::BTreeMap;

use eternum_settlement::legacy_mmr_derivation::{
    LegacyDerivationError, LegacyMmrDerivationProgram, LegacyMmrWorldSource,
    compute_source_commitments, execute_legacy_mmr_derivation, legacy_maximum_reward_units,
    legacy_result_key,
};
use eternum_settlement::mmr_plan::{
    MedianSource, MmrFormulaPolicy, MmrPlanOutput, MmrPlanWitness, execute_mmr_update_plan,
    hash_formula_inputs, hash_ranking_entry,
};
use eternum_settlement::types::{
    LegacyMmrPendingResultProjection, LegacyMmrProvedSourceInventory, LegacyMmrSourceParticipant,
    LegacyMmrWorldInventoryLeaf, MmrCurrentFormulaAux, MmrFormulaInput, MmrSnapshotEntry, U256,
};
use starknet_crypto::Felt;

#[test]
fn derives_two_ordered_overlapping_jobs_and_every_public_commitment() {
    let program = program();
    let sources = pending_sources();
    let commitments = compute_source_commitments(&sources).unwrap();
    let source_inventory = source_inventory(&program, &commitments);

    let output = execute_legacy_mmr_derivation(&program, &source_inventory, &sources).unwrap();

    assert_eq!(
        output.proved_source_inventory_hash,
        felt_hex("0x39a701299f9159612332c964f47cb533d6bcaa3299743861bd3a92a262eaa7")
    );
    assert_eq!(
        output.synthetic_deployment_id,
        felt_hex("0x33c8f1316768de91f0318a1fad4ec368dd4657f0bea5ac6ad41b11eb959aa61")
    );
    assert_eq!(
        output.dispositions_root,
        felt_hex("0x93064b94ad676e46210b7b30de51783bc9baf825af6ec55749cf010f89be05")
    );
    assert_eq!(
        output.imported_jobs_root,
        felt_hex("0x698a049290c992ff54c411e8e387e779a3ed56f98e16ac715f9d4b864257b0a")
    );
    assert_eq!(
        output.funding_scope_id,
        felt_hex("0x18efde19c29605c6bc73bab43547485fb81dcf16718b5de9bf7abe9735db3fb")
    );
    assert_eq!(output.dispositions.len(), 2);
    assert_eq!(output.imports.len(), 2);
    assert_eq!(output.imports[0].job.import_index, 0);
    assert_eq!(output.imports[1].job.import_index, 1);
    assert_eq!(output.imports[0].job.maximum_reward_units, 10);
    assert_eq!(output.imports[1].job.maximum_reward_units, 10);
    assert_eq!(output.pending_import_reward_units, 20);
    assert_ne!(output.synthetic_deployment_id, Felt::ZERO);
    assert_ne!(output.dispositions_root, output.imported_jobs_root);
    assert_ne!(output.funding_scope_id, output.synthetic_deployment_id);
    assert_eq!(output.imports[0].job.ranking.participant_count, 6);
    assert_eq!(output.imports[0].job.ranking.first_rank, 1);
    assert_eq!(output.imports[0].job.ranking.last_rank, 6);
    assert_eq!(
        output.imports[0].job.result.participant_root,
        output.imports[0].job.legacy_source_participants_root
    );
    assert_eq!(
        output.imports[0].job.ranking.result_hash,
        output.imports[0].job.result.result_hash
    );
    assert_eq!(
        output.imports[0].job.ranking_id,
        output.imports[0].job.result.ranking_id
    );

    let first_game_overlap = &output.imports[0].ranking_entries[1];
    let second_game_overlap = &output.imports[1].ranking_entries[0];
    assert_eq!(
        first_game_overlap.recipient_l1,
        second_game_overlap.recipient_l1
    );
    assert_ne!(
        first_game_overlap.participation_id,
        second_game_overlap.participation_id
    );
}

#[test]
fn rejects_source_commitment_substitution_and_world_reordering() {
    let (program, sources, source_inventory) = derivation_fixture();
    let mut changed = source_inventory.clone();
    changed.raw_projections_root += Felt::ONE;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &changed, &sources),
        Err(LegacyDerivationError::SourceCommitment),
    );

    let mut reordered = sources.clone();
    reordered.swap(0, 1);
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &reordered),
        Err(LegacyDerivationError::WorldOrder),
    );
}

#[test]
fn rejects_non_pending_mode_and_non_contiguous_source_indices() {
    let (program, sources, source_inventory) = derivation_fixture();
    let mut wrong_mode = sources.clone();
    pending_projection_mut(&mut wrong_mode[0]).application_mode = 2;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &wrong_mode),
        Err(LegacyDerivationError::PendingProjection),
    );

    let mut wrong_source_index = sources.clone();
    pending_participants_mut(&mut wrong_source_index[0])[0].source_index = 1;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &wrong_source_index),
        Err(LegacyDerivationError::ParticipantOrder),
    );
}

#[test]
fn rejects_aliases_duplicate_legacy_players_and_invalid_ranks() {
    let (program, sources, source_inventory) = derivation_fixture();
    let mut wrong_alias = sources.clone();
    pending_participants_mut(&mut wrong_alias[0])[0].player_l2 += Felt::ONE;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &wrong_alias),
        Err(LegacyDerivationError::ParticipantIdentity),
    );

    let mut duplicate_legacy_player = sources.clone();
    let first_player = duplicate_legacy_player[0].participants[0].legacy_player_key;
    let duplicate = &mut duplicate_legacy_player[0].participants[1];
    duplicate.player_l2 = first_player;
    duplicate.legacy_player_key = first_player;
    duplicate.recipient_l1 = first_player;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &duplicate_legacy_player),
        Err(LegacyDerivationError::ParticipantIdentity),
    );

    let mut wrong_rank = sources.clone();
    pending_participants_mut(&mut wrong_rank[0])[1].formula_rank = 0;
    assert_eq!(
        execute_legacy_mmr_derivation(&program, &source_inventory, &wrong_rank),
        Err(LegacyDerivationError::ParticipantRank),
    );
}

#[test]
fn rejects_an_aggregate_reward_bound_below_the_exact_job_sum() {
    let (program, sources, source_inventory) = derivation_fixture();
    let mut insufficient_budget = program.clone();
    insufficient_budget.max_reward_units = 19;
    assert_eq!(
        execute_legacy_mmr_derivation(&insufficient_budget, &source_inventory, &sources),
        Err(LegacyDerivationError::RewardBound),
    );
}

#[test]
fn derives_the_canonical_empty_pending_inventory_and_pins_every_supported_chunk_bound() {
    for chunk_size in [1, 2, 4, 8, 16, 32] {
        assert_eq!(
            legacy_maximum_reward_units(33, chunk_size).unwrap(),
            2 * 33_u32.div_ceil(chunk_size.into()) + 4
        );
    }

    let sources = Vec::new();
    let commitments = compute_source_commitments(&sources).unwrap();
    let reference_program = program();
    let source_inventory = source_inventory(&reference_program, &commitments);
    let output =
        execute_legacy_mmr_derivation(&reference_program, &source_inventory, &sources).unwrap();

    assert!(output.dispositions.is_empty());
    assert!(output.imports.is_empty());
    assert_eq!(output.pending_import_reward_units, 0);

    let mut unsupported_chunk = program();
    unsupported_chunk.settlement_chunk_size = 3;
    assert_eq!(
        execute_legacy_mmr_derivation(&unsupported_chunk, &source_inventory, &sources),
        Err(LegacyDerivationError::Program),
    );
}

#[test]
fn settles_overlapping_jobs_in_disposition_order_from_the_post_job_one_snapshot() {
    let program = program();
    let sources = pending_sources();
    let commitments = compute_source_commitments(&sources).unwrap();
    let source_inventory = source_inventory(&program, &commitments);
    let derived = execute_legacy_mmr_derivation(&program, &source_inventory, &sources).unwrap();
    let initial_balances = initial_mmr_balances(&derived.imports);

    let mut ordered_balances = initial_balances.clone();
    let first_plan = execute_imported_plan(1, 0, &derived, &ordered_balances);
    apply_plan(&mut ordered_balances, &first_plan);
    let post_first_balances = ordered_balances.clone();
    let overlap = felt(1001);
    let post_first_overlap = ordered_balances[&overlap];
    let second_plan = execute_imported_plan(2, 1, &derived, &ordered_balances);
    assert_eq!(
        second_plan
            .entries
            .iter()
            .find(|entry| entry.mmr_identity == overlap)
            .unwrap()
            .starting_mmr_logical,
        post_first_overlap,
    );
    apply_plan(&mut ordered_balances, &second_plan);

    let mut reversed_balances = initial_balances;
    let reversed_first = execute_imported_plan(1, 1, &derived, &reversed_balances);
    apply_plan(&mut reversed_balances, &reversed_first);
    let reversed_second = execute_imported_plan(2, 0, &derived, &reversed_balances);
    apply_plan(&mut reversed_balances, &reversed_second);

    assert_eq!(
        post_first_balances,
        expected_balances(&[
            (1000, 1512),
            (1001, 1502),
            (1002, 1493),
            (1003, 1484),
            (1004, 1476),
            (1005, 1470),
            (1006, 1500),
            (1007, 1500),
            (1008, 1500),
            (1009, 1500),
            (1010, 1500),
        ])
    );

    assert_eq!(post_first_overlap, 1_502);
    assert_eq!(
        second_plan.journal.plan_root,
        felt_hex("0x345ff2cc49bf5df2ad39b47b5fd1c62d357eab7dee0e90b2d11d6b26b5e70ae")
    );
    assert_eq!(ordered_balances[&overlap], 1_514);
    assert_eq!(reversed_balances[&overlap], 1_513);
    assert_eq!(
        ordered_balances,
        expected_balances(&[
            (1000, 1512),
            (1001, 1514),
            (1002, 1493),
            (1003, 1484),
            (1004, 1476),
            (1005, 1470),
            (1006, 1502),
            (1007, 1493),
            (1008, 1484),
            (1009, 1476),
            (1010, 1470),
        ])
    );
    assert_eq!(
        reversed_balances,
        expected_balances(&[
            (1000, 1512),
            (1001, 1513),
            (1002, 1493),
            (1003, 1484),
            (1004, 1476),
            (1005, 1470),
            (1006, 1502),
            (1007, 1493),
            (1008, 1484),
            (1009, 1476),
            (1010, 1470),
        ])
    );
    assert_ne!(ordered_balances, reversed_balances);
}

fn execute_imported_plan(
    sequence: u64,
    job_index: usize,
    derived: &eternum_settlement::legacy_mmr_derivation::LegacyMmrDerivationOutput,
    balances: &BTreeMap<Felt, u128>,
) -> MmrPlanOutput {
    let ranking_entries = derived.imports[job_index].ranking_entries.clone();
    let formula_inputs = ranking_entries
        .iter()
        .enumerate()
        .map(|(index, entry)| MmrFormulaInput {
            ordinal_index: (index + 1) as u16,
            ranking_entry_hash: hash_ranking_entry(entry),
            formula_rank: entry.rank,
        })
        .collect::<Vec<_>>();
    let snapshots = ranking_entries
        .iter()
        .map(|entry| {
            let logical = balances[&entry.recipient_l1];
            MmrSnapshotEntry {
                ranking_entry_hash: hash_ranking_entry(entry),
                mmr_identity: entry.recipient_l1,
                starting_mmr_scaled: U256 {
                    low: logical * 1_000_000_000_000_000_000,
                    high: 0,
                },
                starting_mmr_logical: logical,
            }
        })
        .collect::<Vec<_>>();
    let policy = MmrFormulaPolicy::default_blitz();
    let aux = MmrCurrentFormulaAux {
        median_source: MedianSource::LegacyStored as u8,
        game_median: derived.imports[job_index].job.legacy_game_median,
        participant_count: ranking_entries.len() as u16,
        formula_inputs_root: hash_formula_inputs(MedianSource::LegacyStored, &formula_inputs),
        formula_policy_hash: policy.hash(),
    };
    execute_mmr_update_plan(
        sequence,
        &MmrPlanWitness {
            ranking: derived.imports[job_index].job.ranking.clone(),
            ranking_entries,
            formula_inputs,
            snapshots,
            aux,
            policy,
        },
    )
    .unwrap()
}

fn initial_mmr_balances(
    imports: &[eternum_settlement::legacy_mmr_derivation::LegacyMmrDerivedImport],
) -> BTreeMap<Felt, u128> {
    imports
        .iter()
        .flat_map(|derived| &derived.ranking_entries)
        .map(|entry| (entry.recipient_l1, 1_500))
        .collect()
}

fn apply_plan(balances: &mut BTreeMap<Felt, u128>, plan: &MmrPlanOutput) {
    for entry in &plan.entries {
        balances.insert(entry.mmr_identity, entry.new_mmr_logical);
    }
}

fn expected_balances(entries: &[(u64, u128)]) -> BTreeMap<Felt, u128> {
    entries
        .iter()
        .map(|(player, balance)| (felt(*player), *balance))
        .collect()
}

fn program() -> LegacyMmrDerivationProgram {
    LegacyMmrDerivationProgram {
        mmr_token: felt(101),
        freeze_marker_hash: felt(102),
        cutover_id: felt(103),
        funding_owner: felt(104),
        module_binding_hash: felt(105),
        tie_break_policy_hash: felt(106),
        settlement_chunk_size: 2,
        max_reward_units: 20,
    }
}

fn derivation_fixture() -> (
    LegacyMmrDerivationProgram,
    Vec<LegacyMmrWorldSource>,
    LegacyMmrProvedSourceInventory,
) {
    let program = program();
    let sources = pending_sources();
    let commitments = compute_source_commitments(&sources).unwrap();
    let source_inventory = source_inventory(&program, &commitments);
    (program, sources, source_inventory)
}

fn source_inventory(
    program: &LegacyMmrDerivationProgram,
    commitments: &eternum_settlement::legacy_mmr_derivation::LegacySourceCommitments,
) -> LegacyMmrProvedSourceInventory {
    LegacyMmrProvedSourceInventory {
        cutover_id: program.cutover_id,
        production_candidate_hash: felt(201),
        static_config_hash: felt(202),
        finalized_state_root_anchor_hash: felt(203),
        inventory_program_id: felt(204),
        inventory_verification_key_hash: felt(205),
        quiescence_generation: 1,
        quiescence_marker_hash: felt(206),
        pre_freeze_witness_manifest_hash: felt(207),
        instrumentation_complete_marker_hash: felt(208),
        pending_import_baseline_hash: felt(209),
        admission_registry_hash: felt(210),
        factory_bindings_hash: felt(211),
        writer_count: 1,
        writers_root: felt(212),
        formula_configs_root: felt(213),
        registry_transition_accumulator: felt(214),
        factory_creation_highwater_hash: felt(215),
        partial_creation_count: 0,
        partial_creations_root: felt(216),
        factory_count: u16::from(commitments.world_count > 0),
        factories_hash: felt(217),
        factory_event_range_count: u16::from(commitments.world_count > 0),
        factory_event_ranges_hash: felt(218),
        historical_event_chain_root: felt(219),
        world_count: commitments.world_count,
        worlds_root: commitments.worlds_root,
        pending_import_bound_hash: felt(220),
        pending_import_job_count: commitments.pending_import_job_count,
        pending_import_reward_units: commitments.pending_import_reward_units,
        gate_state_sequence: 1,
        gate_transition_accumulator: felt(221),
        initial_token_state_hash: felt(222),
        final_token_state_hash: felt(223),
        token_mutation_accumulator: felt(224),
        legacy_factory_tuple_hash: felt(225),
        raw_projection_count: commitments.raw_projection_count,
        raw_projections_root: commitments.raw_projections_root,
        source_participant_count: commitments.source_participant_count,
        source_participants_root: commitments.source_participants_root,
        witness_object_count: 1,
        witness_objects_root: felt(226),
        prefunded_escrow_hash: felt(227),
    }
}

fn pending_sources() -> Vec<LegacyMmrWorldSource> {
    vec![
        pending_source(
            0,
            10,
            100,
            &[
                (1, 1000),
                (2, 1001),
                (3, 1002),
                (4, 1003),
                (5, 1004),
                (6, 1005),
            ],
        ),
        pending_source(
            1,
            11,
            101,
            &[
                (1, 1001),
                (2, 1006),
                (3, 1007),
                (4, 1008),
                (5, 1009),
                (6, 1010),
            ],
        ),
    ]
}

fn pending_source(
    disposition_index: u32,
    factory_event_index: u64,
    game_key: u64,
    participants: &[(u16, u64)],
) -> LegacyMmrWorldSource {
    let factory = felt(200);
    let world = felt(300 + game_key);
    let mmr_system = felt(400 + game_key);
    let game_or_trial_id = felt(game_key);
    let game_meta_hash = felt(500 + game_key);
    let claimed_hash = felt(600 + game_key);
    let source_participants = participants
        .iter()
        .enumerate()
        .map(
            |(source_index, (rank, player))| LegacyMmrSourceParticipant {
                source_index: source_index as u32,
                factory,
                factory_event_index,
                world,
                game_or_trial_id,
                player_l2: felt(*player),
                legacy_player_key: felt(*player),
                recipient_l1: felt(*player),
                legacy_participation_key: felt(7000 + source_index as u64),
                formula_rank: *rank,
                score: U256 {
                    low: 10_000 - source_index as u128,
                    high: 0,
                },
            },
        )
        .collect();
    let mut projection = LegacyMmrPendingResultProjection {
        result_key: Felt::ZERO,
        factory,
        factory_event_index,
        world,
        mmr_system,
        game_or_trial_id,
        game_meta_hash,
        pre_application_claimed_hash: claimed_hash,
        current_claimed_hash: claimed_hash,
        legacy_result_state_hash: felt(900 + game_key),
        legacy_ranking_layout_hash: felt(901),
        legacy_ranking_highwater: participants.len() as u32,
        legacy_game_median: 1_000,
        legacy_formula_policy_hash: MmrFormulaPolicy::default_blitz().hash(),
        settlement_chunk_size: 2,
        participant_count: participants.len() as u16,
        first_rank: participants.first().unwrap().0,
        last_rank: participants.last().unwrap().0,
        winner_l2: felt(participants.first().unwrap().1),
        ended_at: 1_000_000 + game_key,
        valid_result: true,
        abort_reason: 0,
        application_mode: 1,
        application_nonce: 0,
        application_hash: Felt::ZERO,
    };
    projection.result_key = legacy_result_key(&projection);
    LegacyMmrWorldSource {
        world: LegacyMmrWorldInventoryLeaf {
            disposition_index,
            factory_index: 0,
            factory,
            factory_event_index,
            world,
            world_class_hash: felt(800),
            world_config_hash: felt(801),
            mmr_system,
            game_or_trial_id,
            game_meta_hash,
            claimed_hash,
        },
        projection,
        participants: source_participants,
    }
}

fn pending_projection_mut(
    source: &mut LegacyMmrWorldSource,
) -> &mut LegacyMmrPendingResultProjection {
    &mut source.projection
}

fn pending_participants_mut(
    source: &mut LegacyMmrWorldSource,
) -> &mut Vec<LegacyMmrSourceParticipant> {
    &mut source.participants
}

fn felt(value: u64) -> Felt {
    Felt::from(value)
}

fn felt_hex(value: &str) -> Felt {
    Felt::from_hex(value).unwrap()
}
