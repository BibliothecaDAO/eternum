use eternum_settlement::frozen_recovery::{
    FrozenGameLotWitness, FrozenRecoveryError, FrozenRecoveryJournal, FrozenRecoveryProgram,
    FrozenRecoveryWitness, RefundAssignment, RefundRoute, execute_frozen_recovery,
    hash_frozen_recovery_journal, hash_frozen_recovery_state, hash_refund_sources,
    refund_sources_root,
};
use eternum_settlement::materialization::{
    DeploymentRefundMaterializationError, DeploymentRefundMaterializationJournal,
    DeploymentRefundMaterializationProgram, DeploymentRefundMaterializationWitness,
    MaterializationCoordinates, derive_deployment_refund_leaves,
    execute_deployment_refund_materialization, hash_deployment_refund_materialization_journal,
    materialization_coordinates,
};
use eternum_settlement::types::{
    BackingKey, DeploymentRefundCommitment, DeploymentRefundSource, FrozenCheckpoint,
    GameBackingLot, U256,
};
use starknet_crypto::Felt;

#[test]
fn virtual_returns_normalize_every_source_and_classify_all_routes() {
    let (program, witness) = complete_fixture();

    let output = execute_frozen_recovery(&program, &witness).expect("normalized frozen recovery");

    assert_eq!(output.summary.deployment_refunds.source_cursor, 4);
    assert_eq!(output.summary.deployment_refunds.disposition_count, 4);
    assert_eq!(output.summary.deployment_refunds.refund_liability_count, 3);
    assert_eq!(output.rows[0].route, RefundRoute::UnappendedFrozen);
    assert_eq!(output.rows[1].route, RefundRoute::OpenAssignedFrozen);
    assert_eq!(output.rows[2].route, RefundRoute::EligibleSealedRoot);
    assert_eq!(output.rows[3].route, RefundRoute::NoLiability);
    assert_eq!(
        output.rows[0].source.returned_unused_from_games_total,
        amount(400)
    );
    assert_eq!(output.rows[0].source.refundable_total, amount(500));
    assert_eq!(output.rows[0].source.committed_lifetime_total, amount(500));
    assert_eq!(output.rows[0].legs[0].amount_or_token_id, amount(500));
    assert_eq!(output.rows[0].legs[0].recipient, felt(88));
}

#[test]
fn wrong_family_high_water_lot_class_index_or_share_fails() {
    let (program, witness) = complete_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.checkpoint.deployment_refunds.source_count = 3
        }),
        FrozenRecoveryError::SourceCount,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.game_lots[0].lot.lot_class = 2
        }),
        FrozenRecoveryError::LotClass,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.game_lots[0].lot.source_index = 2
        }),
        FrozenRecoveryError::LotAttribution,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.game_lots[0].lot.active_committed_total.low += 1
        }),
        FrozenRecoveryError::StateRoot,
    );
}

#[test]
fn wrong_source_total_recipient_policy_or_assignment_fails() {
    let (program, witness) = complete_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.sources[0].committed_lifetime_total.low += 1
        }),
        FrozenRecoveryError::SourceConservation,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.sources[0].refund_recipient_l1 += Felt::ONE
        }),
        FrozenRecoveryError::SourceIdentity,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.sources[0].refund_policy_hash += Felt::ONE
        }),
        FrozenRecoveryError::SourceIdentity,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.assignments[1] = RefundAssignment::Open {
                batch_id: 8,
                leaf_index: 2,
                liability_id: felt(9999),
            }
        }),
        FrozenRecoveryError::Assignment,
    );
}

#[test]
fn wrong_checkpoint_state_root_or_game_lot_order_fails() {
    let (program, witness) = complete_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.checkpoint.checkpoint_hash += Felt::ONE
        }),
        FrozenRecoveryError::Checkpoint,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.checkpoint.state_root += Felt::ONE
        }),
        FrozenRecoveryError::StateRoot,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| candidate.game_lots.swap(0, 1)),
        FrozenRecoveryError::LotOrder,
    );
}

#[test]
fn deployment_refund_materialization_emits_live_and_route_tombstone_leaves() {
    let (recovery_program, recovery_witness) = complete_fixture();
    let recovery = execute_frozen_recovery(&recovery_program, &recovery_witness).expect("recovery");
    let program = DeploymentRefundMaterializationProgram::reference_v1();
    let witness = deployment_materialization_fixture(&program, &recovery);

    let output =
        execute_deployment_refund_materialization(&program, &witness).expect("materialization");

    assert_eq!(output.leaves.len(), 4);
    assert!(!output.leaves[0].tombstone);
    assert!(!output.leaves[1].tombstone);
    assert!(output.leaves[2].tombstone);
    assert!(output.leaves[3].tombstone);
    assert_eq!(output.verified.game_id, Felt::ZERO);
    assert_eq!(output.verified.live_liability_count, 2);
    assert_eq!(
        output.rows[0].claim.terminal_refund_source_hash,
        witness.registered_terminal_refund_source_hash
    );
    assert_ne!(
        hash_deployment_refund_materialization_journal(&output.journal),
        Felt::ZERO
    );
}

#[test]
fn deployment_refund_materialization_rejects_wrong_high_water_coordinate_tombstone_and_root() {
    let (recovery_program, recovery_witness) = complete_fixture();
    let recovery = execute_frozen_recovery(&recovery_program, &recovery_witness).expect("recovery");
    let program = DeploymentRefundMaterializationProgram::reference_v1();
    let witness = deployment_materialization_fixture(&program, &recovery);

    assert_materialization_error(
        &program,
        changed_materialization(&witness, |candidate| {
            candidate.summary.deployment_refunds.source_count = 3
        }),
        DeploymentRefundMaterializationError::Summary,
    );
    assert_materialization_error(
        &program,
        changed_materialization(&witness, |candidate| candidate.coordinates.start_index = 1),
        DeploymentRefundMaterializationError::Coordinates,
    );
    assert_materialization_error(
        &program,
        changed_materialization(&witness, |candidate| {
            candidate.claimed_leaves[0].tombstone = true
        }),
        DeploymentRefundMaterializationError::Leaf,
    );
    assert_materialization_error(
        &program,
        changed_materialization(&witness, |candidate| {
            candidate.expected_chunk_root += Felt::ONE
        }),
        DeploymentRefundMaterializationError::ChunkRoot,
    );
}

#[test]
fn deployment_refund_materialization_rejects_cursor_route_claim_quote_and_leg_substitution() {
    let (recovery_program, recovery_witness) = complete_fixture();
    let recovery = execute_frozen_recovery(&recovery_program, &recovery_witness).expect("recovery");
    let program = DeploymentRefundMaterializationProgram::reference_v1();
    let witness = deployment_materialization_fixture(&program, &recovery);

    assert_materialization_error(
        &program,
        changed_materialization(&witness, |candidate| {
            candidate.summary.deployment_refunds.source_cursor = 3
        }),
        DeploymentRefundMaterializationError::Summary,
    );
    assert_authenticated_row_error(
        &program,
        &witness,
        |candidate| candidate.rows[0].route = RefundRoute::EligibleSealedRoot,
        DeploymentRefundMaterializationError::Route,
    );
    assert_authenticated_row_error(
        &program,
        &witness,
        |candidate| candidate.rows[0].claim.as_mut().unwrap().recipient_l1 += Felt::ONE,
        DeploymentRefundMaterializationError::Claim,
    );
    assert_authenticated_row_error(
        &program,
        &witness,
        |candidate| candidate.rows[0].aux.as_mut().unwrap().refund_policy_hash += Felt::ONE,
        DeploymentRefundMaterializationError::Aux,
    );
    assert_authenticated_row_error(
        &program,
        &witness,
        |candidate| candidate.rows[0].aux.as_mut().unwrap().unused_amount.low += 1,
        DeploymentRefundMaterializationError::Aux,
    );
    assert_authenticated_row_error(
        &program,
        &witness,
        |candidate| candidate.rows[0].legs[0].amount_or_token_id.low += 1,
        DeploymentRefundMaterializationError::Legs,
    );
}

#[test]
fn materialization_coordinates_cover_every_high_water_slot_once() {
    for (high_water, expected_counts) in [
        (0, vec![]),
        (1, vec![1]),
        (63, vec![63]),
        (64, vec![64]),
        (65, vec![64, 1]),
        (256, vec![64, 64, 64, 64]),
    ] {
        let coordinates = materialization_coordinates(high_water).expect("bounded coordinates");
        assert_eq!(
            coordinates
                .iter()
                .map(|coordinate| coordinate.item_count)
                .collect::<Vec<_>>(),
            expected_counts,
        );
        let covered = coordinates
            .iter()
            .flat_map(|coordinate| {
                coordinate.start_index..coordinate.start_index + u64::from(coordinate.item_count)
            })
            .collect::<Vec<_>>();
        assert_eq!(covered, (0..high_water).collect::<Vec<_>>());
    }
}

#[test]
fn rust_matches_the_cairo_and_typescript_a21_public_journals() {
    let recovery = FrozenRecoveryJournal {
        program_hash: felt(3001),
        state_root: felt(3002),
        summary_hash: felt(3003),
        sources_hash: felt(3004),
        dispositions_hash: felt(3005),
        game_returns_hash: felt(3006),
        routes_hash: felt(3007),
    };
    let deployment = DeploymentRefundMaterializationJournal {
        program_hash: felt(4001),
        terminal_refund_source_hash: felt(4002),
        recovery_journal_hash: felt(4003),
        verified_output_hash: felt(4004),
        chunk_root: felt(4005),
        live_preimages_hash: felt(4006),
        live_totals_hash: felt(4007),
    };

    assert_eq!(
        hash_frozen_recovery_journal(&recovery),
        Felt::from_hex("0x40aea6316d38fddec50d6a2ba770a77babc95603c124e2ba6356644004b5afa")
            .unwrap(),
    );
    assert_eq!(
        hash_deployment_refund_materialization_journal(&deployment),
        Felt::from_hex("0x4aaed4fdfc7127f25f78d7b21d6875604cb2173fdbaf4f89656644f5ab7e43d")
            .unwrap(),
    );
}

fn deployment_materialization_fixture(
    program: &DeploymentRefundMaterializationProgram,
    recovery: &eternum_settlement::frozen_recovery::FrozenRecoveryOutput,
) -> DeploymentRefundMaterializationWitness {
    let coordinates = MaterializationCoordinates {
        chunk_index: 0,
        start_index: 0,
        item_count: 4,
    };
    let terminal_hash =
        eternum_settlement::frozen_recovery::hash_frozen_recovery_summary(&recovery.summary);
    let claimed_leaves =
        derive_deployment_refund_leaves(program, &recovery.summary, &recovery.rows, coordinates)
            .expect("derived leaves");
    let mut witness = DeploymentRefundMaterializationWitness {
        summary: recovery.summary.clone(),
        rows: recovery.rows.clone(),
        coordinates,
        registered_terminal_refund_source_hash: terminal_hash,
        recovery_journal: recovery.journal.clone(),
        verified_recovery_journal_hash:
            eternum_settlement::frozen_recovery::hash_frozen_recovery_journal(&recovery.journal),
        claimed_leaves,
        expected_chunk_root: Felt::ZERO,
    };
    witness.expected_chunk_root =
        eternum_settlement::materialization::deployment_refund_chunk_root(&witness.claimed_leaves)
            .expect("chunk root");
    witness
}

fn changed_materialization(
    witness: &DeploymentRefundMaterializationWitness,
    mutate: impl FnOnce(&mut DeploymentRefundMaterializationWitness),
) -> DeploymentRefundMaterializationWitness {
    let mut candidate = witness.clone();
    mutate(&mut candidate);
    candidate
}

fn assert_authenticated_row_error(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
    mutate: impl FnOnce(&mut DeploymentRefundMaterializationWitness),
    expected: DeploymentRefundMaterializationError,
) {
    let mut candidate = changed_materialization(witness, mutate);
    candidate.recovery_journal.routes_hash =
        eternum_settlement::frozen_recovery::hash_refund_routes(&candidate.rows);
    candidate.verified_recovery_journal_hash =
        eternum_settlement::frozen_recovery::hash_frozen_recovery_journal(
            &candidate.recovery_journal,
        );
    assert_materialization_error(program, candidate, expected);
}

fn assert_materialization_error(
    program: &DeploymentRefundMaterializationProgram,
    witness: DeploymentRefundMaterializationWitness,
    expected: DeploymentRefundMaterializationError,
) {
    assert_eq!(
        execute_deployment_refund_materialization(program, &witness),
        Err(expected)
    );
}

fn complete_fixture() -> (FrozenRecoveryProgram, FrozenRecoveryWitness) {
    let program = FrozenRecoveryProgram::reference_v1();
    let sources = vec![
        physical_source(0, 88, 501),
        physical_source(1, 89, 502),
        physical_source(2, 90, 503),
        nonphysical_source(3),
    ];
    let game_lots = vec![game_lot(12, 0, 0), game_lot(12, 1, 1), game_lot(13, 2, 2)];
    let assignments = vec![
        RefundAssignment::None,
        RefundAssignment::Open {
            batch_id: 8,
            leaf_index: 2,
            liability_id: program.derive_refund_liability(&sources[1]),
        },
        RefundAssignment::Sealed {
            batch_id: 9,
            leaf_index: 3,
            liability_id: program.derive_refund_liability(&sources[2]),
        },
        RefundAssignment::None,
    ];
    let mut checkpoint = frozen_checkpoint(program.deployment_id, sources.len() as u16);
    checkpoint.deployment_refunds.sources_hash = hash_refund_sources(&sources);
    checkpoint.deployment_refunds.sources_root =
        refund_sources_root(&sources).expect("source tree");
    let mut witness = FrozenRecoveryWitness {
        checkpoint,
        sources,
        game_lots,
        assignments,
    };
    witness.checkpoint.state_root = hash_frozen_recovery_state(&program, &witness);
    checkpoint = witness.checkpoint.clone();
    witness.checkpoint = checkpoint;
    (program, witness)
}

fn physical_source(index: u16, recipient: u64, policy: u64) -> DeploymentRefundSource {
    DeploymentRefundSource {
        source_index: index,
        parent_key: BackingKey {
            deployment_id: felt(11),
            game_id: Felt::ZERO,
            asset_mode: 1,
            asset_id: 37 + u32::from(index),
            backing_pool_id: felt(500 + u64::from(index)),
        },
        source_ingress_or_pool_id: felt(600 + u64::from(index)),
        funding_source_id: felt(700 + u64::from(index)),
        refund_recipient_l1: felt(recipient),
        refund_policy_hash: felt(policy),
        provisioned_physical_total: amount(1_000),
        committed_lifetime_total: amount(800),
        unallocated_total: amount(100),
        returned_unused_from_games_total: amount(100),
        refundable_total: amount(200),
        disposition_epoch: 1,
        refund_kind: 2,
        emitted: index != 0,
    }
}

fn nonphysical_source(index: u16) -> DeploymentRefundSource {
    DeploymentRefundSource {
        source_index: index,
        parent_key: BackingKey {
            deployment_id: felt(11),
            game_id: Felt::ZERO,
            asset_mode: 3,
            asset_id: 99,
            backing_pool_id: felt(900),
        },
        source_ingress_or_pool_id: Felt::ZERO,
        funding_source_id: Felt::ZERO,
        refund_recipient_l1: Felt::ZERO,
        refund_policy_hash: Felt::ZERO,
        provisioned_physical_total: amount(0),
        committed_lifetime_total: amount(0),
        unallocated_total: amount(0),
        returned_unused_from_games_total: amount(0),
        refundable_total: amount(0),
        disposition_epoch: 0,
        refund_kind: 0,
        emitted: false,
    }
}

fn game_lot(game: u64, source_index: u16, lot_index: u8) -> FrozenGameLotWitness {
    FrozenGameLotWitness {
        allocation_index: source_index,
        terminal_state_hash: felt(1000 + u64::from(source_index)),
        lot: GameBackingLot {
            game_id: felt(game),
            parent_key_hash: felt(2000 + u64::from(source_index)),
            lot_index,
            lot_class: 1,
            source_index,
            source_id: felt(700 + u64::from(source_index)),
            allocated_total: amount(900),
            active_committed_total: amount(200),
            cumulative_outbox_total: amount(300),
            returned_unused_total: amount(100),
        },
    }
}

fn frozen_checkpoint(deployment_id: Felt, source_count: u16) -> FrozenCheckpoint {
    FrozenCheckpoint {
        deployment_id,
        checkpoint_hash: felt(300),
        block_number: 700,
        block_hash: felt(301),
        state_root: Felt::ZERO,
        economic_timestamp: 800,
        archive_manifest_hash: felt(302),
        inbox_cursor: 17,
        outbox_cursor: 19,
        has_final_outbox_batch: true,
        final_outbox_batch_id: 9,
        cumulative_outbox_totals_hash: felt(303),
        active_exit_totals_hash: felt(304),
        index_high_watermarks_hash: felt(305),
        remaining_quotas_hash: felt(306),
        unsealed_ingress_activations_hash: felt(307),
        unsealed_ingress_activation_count: 2,
        unsealed_control_acks_hash: felt(308),
        unsealed_control_ack_count: 1,
        lifecycle_commitment: felt(309),
        deployment_refunds: DeploymentRefundCommitment {
            source_count,
            physical_refund_source_count: 3,
            sources_hash: felt(310),
            sources_root: felt(311),
            game_return_count: 3,
            game_returns_hash: felt(312),
            source_cursor: 0,
            disposition_count: 0,
            refund_liability_count: 0,
            refund_liabilities_hash: Felt::ZERO,
            refund_liabilities_root: Felt::ZERO,
        },
    }
}

fn changed(
    witness: &FrozenRecoveryWitness,
    mutate: impl FnOnce(&mut FrozenRecoveryWitness),
) -> FrozenRecoveryWitness {
    let mut candidate = witness.clone();
    mutate(&mut candidate);
    candidate
}

fn assert_error(
    program: &FrozenRecoveryProgram,
    witness: FrozenRecoveryWitness,
    expected: FrozenRecoveryError,
) {
    assert_eq!(execute_frozen_recovery(program, &witness), Err(expected));
}

fn amount(value: u128) -> U256 {
    U256 {
        low: value,
        high: 0,
    }
}

fn felt(value: u64) -> Felt {
    Felt::from(value)
}
