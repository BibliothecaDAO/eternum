use eternum_settlement::frozen_position::{
    ActivePosition, BatchAssignment, FrozenPositionError, FrozenPositionJournal,
    FrozenPositionProgram, FrozenPositionWitness, PendingPosition, SourcePosition,
    execute_frozen_position, hash_exit_claim, hash_frozen_position_journal,
    hash_katana_reference_state, hash_payout_legs, verify_frozen_position_journal,
};
use eternum_settlement::types::{ClaimLeg, ExitClaim, U256};
use starknet_crypto::Felt;

#[test]
fn active_position_matches_the_zero_client_a2_withdrawal_quote() {
    let (program, witness) = active_fixture();

    let output = execute_frozen_position(&program, &witness).expect("valid active position");

    assert_eq!(output.claim.source_state, 1);
    assert_eq!(output.legs, expected_active_legs());
    assert_eq!(
        output.claim.payout_legs_hash,
        hash_payout_legs(&output.legs)
    );
    assert!(verify_frozen_position_journal(
        &program,
        &output.claim,
        &output.legs,
        &output.journal,
        hash_frozen_position_journal(&output.journal),
    ));
}

#[test]
fn pending_and_open_assignment_copy_the_stored_body_without_requoting() {
    for source in [pending_source(), open_assignment_source()] {
        let (mut program, mut witness) = active_fixture();
        program.position_family = 8;
        witness.position_family = 8;
        witness.recipient_l1 = felt(91);
        witness.source = source;
        witness.state_root = hash_katana_reference_state(&program, &witness);

        let output = execute_frozen_position(&program, &witness).expect("valid stored liability");

        assert_eq!(output.legs, stored_pending_legs());
        assert_eq!(output.claim.recipient_l1, felt(91));
        assert_ne!(output.legs, expected_active_legs());
    }
}

#[test]
fn guest_rejects_root_layout_owner_index_generation_formula_and_leg_substitution() {
    let (program, witness) = active_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| candidate.state_root += Felt::ONE),
        FrozenPositionError::StateRoot,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| candidate.layout_hash += Felt::ONE),
        FrozenPositionError::Layout,
    );
    assert!(
        execute_frozen_position(
            &program,
            &changed(&witness, |candidate| candidate.owner_l2 += Felt::ONE),
        )
        .is_err()
    );
    assert!(
        execute_frozen_position(
            &program,
            &changed(&witness, |candidate| candidate.position_id += 1),
        )
        .is_err()
    );
    assert!(
        execute_frozen_position(
            &program,
            &changed(&witness, |candidate| candidate.position_generation += 1),
        )
        .is_err()
    );

    let mut wrong_formula = program.clone();
    wrong_formula.withdrawal_policy.client_bps += 1;
    assert!(execute_frozen_position(&wrong_formula, &witness).is_err());

    let output = execute_frozen_position(&program, &witness).expect("valid fixture");
    let mut wrong_legs = output.legs.clone();
    wrong_legs[0].amount_or_token_id.low += 1;
    assert!(!verify_frozen_position_journal(
        &program,
        &output.claim,
        &wrong_legs,
        &output.journal,
        hash_frozen_position_journal(&output.journal),
    ));
    assert!(!verify_frozen_position_journal(
        &program,
        &output.claim,
        &[],
        &output.journal,
        hash_frozen_position_journal(&output.journal),
    ));
    let mut too_many_legs = output.legs.clone();
    too_many_legs.extend(output.legs.iter().cloned());
    too_many_legs.push(output.legs[0].clone());
    assert!(!verify_frozen_position_journal(
        &program,
        &output.claim,
        &too_many_legs,
        &output.journal,
        hash_frozen_position_journal(&output.journal),
    ));
}

#[test]
fn sealed_cursor_covered_or_unbacked_assignments_cannot_be_reclassified() {
    let (program, mut witness) = active_fixture();
    witness.source = open_assignment_source();
    witness.state_root = hash_katana_reference_state(&program, &witness);

    let sealed = changed(&witness, |candidate| {
        if let SourcePosition::BatchAssigned(assignment) = &mut candidate.source {
            assignment.batch_sealed = true;
        }
    });
    assert_error(&program, sealed, FrozenPositionError::SealedAssignment);

    let covered = changed(&witness, |candidate| {
        if let SourcePosition::BatchAssigned(assignment) = &mut candidate.source {
            assignment.represented_before_final_cursor = true;
        }
    });
    assert_error(&program, covered, FrozenPositionError::CursorCovered);

    let unbacked = changed(&witness, |candidate| {
        if let SourcePosition::BatchAssigned(assignment) = &mut candidate.source {
            assignment.in_active_exit_totals = false;
        }
    });
    assert_error(&program, unbacked, FrozenPositionError::ActiveExitBacking);
}

#[test]
fn rust_matches_the_cairo_and_typescript_public_journal_vectors() {
    let legs = expected_active_legs();
    let payout_legs_hash = hash_payout_legs(&legs);
    let claim = ExitClaim {
        deployment_id: felt(11),
        game_id: felt(12),
        frozen_block_number: 700,
        world: felt(10),
        class_hash: felt(201),
        schema_hash: felt(202),
        position_family: 7,
        position_id: 42,
        position_generation: 3,
        source_state: 1,
        liability_id: felt(7001),
        owner_l2: felt(77),
        recipient_l1: felt(88),
        recovery_policy_hash: felt(501),
        payout_legs_hash,
    };
    let claim_hash = hash_exit_claim(&claim);
    let journal = FrozenPositionJournal {
        program_hash: felt(3001),
        state_root: felt(3002),
        final_outbox_cursor: 19,
        claim_hash,
        payout_legs_hash,
    };

    assert_eq!(
        payout_legs_hash,
        Felt::from_hex("0x517b79f2017cab86758286645e1d32ba5f9b507f1260767dc3625e419f33082")
            .unwrap(),
    );
    assert_eq!(
        claim_hash,
        Felt::from_hex("0x41c6f6d9243cada591946f7a9a945bb8b35e14a9eb1c029e71d0cef866e8fc").unwrap(),
    );
    assert_eq!(
        hash_frozen_position_journal(&journal),
        Felt::from_hex("0x7d37e77b8cc5f0db16705e88b91ac862f125d684b8fa5644992eee730db58bc")
            .unwrap(),
    );
}

fn active_fixture() -> (FrozenPositionProgram, FrozenPositionWitness) {
    let program = FrozenPositionProgram::reference_blitz_resource_v1();
    let mut witness = FrozenPositionWitness {
        chain_id: felt(1),
        frozen_block_number: 700,
        state_root: Felt::ZERO,
        layout_hash: program.layout_hash,
        world: program.world,
        game_id: felt(12),
        position_family: program.position_family,
        position_id: 42,
        position_generation: 3,
        owner_l2: felt(77),
        recipient_l1: felt(88),
        recovery_policy_hash: program.withdrawal_policy.hash,
        source: SourcePosition::Active(ActivePosition {
            amount: U256 {
                low: 10_000,
                high: 0,
            },
            resource_class: 1,
            hyperstructures_completed: 0,
        }),
        final_outbox_cursor: 19,
    };
    witness.state_root = hash_katana_reference_state(&program, &witness);
    (program, witness)
}

fn pending_source() -> SourcePosition {
    SourcePosition::UnsealedPending(PendingPosition {
        recipient_l1: felt(91),
        recovery_policy_hash: felt(501),
        auxiliary_body_hash: felt(701),
        parent_shares_hash: felt(702),
        lot_shares_hash: felt(703),
        legs: stored_pending_legs(),
    })
}

fn open_assignment_source() -> SourcePosition {
    SourcePosition::BatchAssigned(BatchAssignment {
        pending: match pending_source() {
            SourcePosition::UnsealedPending(pending) => pending,
            _ => unreachable!(),
        },
        batch_id: 4,
        leaf_index: 7,
        batch_sealed: false,
        in_active_exit_totals: true,
        represented_before_final_cursor: false,
    })
}

fn stored_pending_legs() -> Vec<ClaimLeg> {
    vec![leg(91, 8_765, 601), leg(92, 123, 602), leg(93, 12, 603)]
}

fn expected_active_legs() -> Vec<ClaimLeg> {
    vec![
        leg(88, 9_700, 601),
        leg(92, 100, 602),
        leg(93, 150, 603),
        leg(92, 50, 604),
    ]
}

fn leg(recipient: u64, amount: u128, policy: u64) -> ClaimLeg {
    ClaimLeg {
        asset_mode: 1,
        asset_id: 37,
        backing_pool_id: felt(500),
        recipient: felt(recipient),
        amount_or_token_id: U256 {
            low: amount,
            high: 0,
        },
        policy_key: felt(policy),
    }
}

fn changed(
    witness: &FrozenPositionWitness,
    mutate: impl FnOnce(&mut FrozenPositionWitness),
) -> FrozenPositionWitness {
    let mut candidate = witness.clone();
    mutate(&mut candidate);
    candidate
}

fn assert_error(
    program: &FrozenPositionProgram,
    witness: FrozenPositionWitness,
    expected: FrozenPositionError,
) {
    assert_eq!(execute_frozen_position(program, &witness), Err(expected));
}

fn felt(value: u64) -> Felt {
    Felt::from(value)
}

#[allow(dead_code)]
fn assert_public_claim_shape(_: ExitClaim) {}
