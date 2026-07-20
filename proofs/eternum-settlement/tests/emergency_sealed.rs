use eternum_settlement::emergency_sealed::{
    AcceptedOutboxFact, EmergencyDispositionError, EmergencySealedJournal, EmergencySealedProgram,
    EmergencySealedWitness, ExactReservationDisposition, FrozenFactKind, RootBudgetSource,
    execute_emergency_sealed, hash_accepted_outbox_fact, hash_claim_leaf,
    hash_emergency_sealed_claim, hash_emergency_sealed_journal, hash_registered_claim_root,
    hash_settlement_legs, verify_emergency_sealed_journal,
};
use eternum_settlement::types::{ClaimLeaf, ClaimLeg, NftReservation, U256};
use starknet_crypto::Felt;

const PAYOUT_FUNGIBLE_OUTCOME: u16 = 0x1020;
const PAYOUT_OUTCOME_NFT: u16 = 0x1021;

#[test]
fn accepted_enabling_fact_preserves_the_registered_leaf_and_root_budget() {
    let (program, witness) = enabled_fixture();

    let output = execute_emergency_sealed(&program, &witness).expect("enabled sealed claim");

    assert_eq!(output.claim.disposition_kind, 1);
    assert_eq!(output.settlement_legs, witness.original_legs);
    assert_eq!(
        output.claim.liability_id,
        witness.original_leaf.liability_id
    );
    assert_eq!(output.parent_dispositions.len(), 1);
    assert!(output.parent_dispositions[0].is_conserved());
    assert!(verify_emergency_sealed_journal(
        &output.claim,
        &witness.original_leaf,
        &witness.original_legs,
        &output.settlement_legs,
        &output.journal,
        hash_emergency_sealed_journal(&output.journal),
    ));
}

#[test]
fn terminal_abort_uses_the_one_policy_pinned_replacement_and_releases_exact_quota() {
    let (program, witness) = abort_fixture();

    let output = execute_emergency_sealed(&program, &witness).expect("abort replacement");

    assert_eq!(output.claim.disposition_kind, 2);
    assert_eq!(output.settlement_legs, vec![refund_leg(88, 750)]);
    assert_eq!(
        output.claim.liability_id,
        witness.original_leaf.liability_id
    );
    assert_eq!(output.exact_reservation_dispositions.len(), 1);
    assert_eq!(
        output.exact_reservation_dispositions[0].disposition,
        ExactReservationDisposition::Released
    );
    assert_eq!(
        output.claim.settlement_legs_hash,
        hash_settlement_legs(&output.settlement_legs)
    );
}

#[test]
fn wrong_root_cursor_policy_budget_or_recipient_fails_closed() {
    let (program, witness) = abort_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| candidate.registered_root += Felt::ONE),
        EmergencyDispositionError::RegisteredRoot,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| candidate.frozen_outbox_cursor = 1),
        EmergencyDispositionError::AcceptedInterval,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.replacement_policy_hash += Felt::ONE
        }),
        EmergencyDispositionError::ReplacementPolicy,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| candidate.root_budget.source_mode = 2),
        EmergencyDispositionError::BudgetSource,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.root_budget.registered_original_legs_hash += Felt::ONE
        }),
        EmergencyDispositionError::BudgetSource,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.abort_recipient_l1 += Felt::ONE
        }),
        EmergencyDispositionError::Recipient,
    );
}

#[test]
fn missing_or_post_cursor_fact_cannot_enable_a_conditional_reward() {
    let (program, witness) = enabled_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.accepted_facts[1].transport_nonce = 2
        }),
        EmergencyDispositionError::AcceptedInterval,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.accepted_facts[1].effect_kind = FrozenFactKind::TerminalAbort
        }),
        EmergencyDispositionError::Disposition,
    );
}

#[test]
fn changed_original_or_settlement_preimages_and_stranded_reservations_fail() {
    let (program, witness) = abort_fixture();

    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.original_legs[0].amount_or_token_id.low += 1
        }),
        EmergencyDispositionError::OriginalLegs,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.original_reservations.clear()
        }),
        EmergencyDispositionError::ExactReservation,
    );

    let output = execute_emergency_sealed(&program, &witness).expect("valid abort");
    let mut substituted_legs = output.settlement_legs.clone();
    substituted_legs[0].amount_or_token_id.low += 1;
    assert!(!verify_emergency_sealed_journal(
        &output.claim,
        &witness.original_leaf,
        &witness.original_legs,
        &substituted_legs,
        &output.journal,
        hash_emergency_sealed_journal(&output.journal),
    ));
}

fn enabled_fixture() -> (EmergencySealedProgram, EmergencySealedWitness) {
    let program = EmergencySealedProgram::reference_blitz_v1();
    let legs = vec![fungible_leg(88, 750, 601)];
    let leaf = claim_leaf(PAYOUT_FUNGIBLE_OUTCOME, &legs, felt(9001));
    let facts = vec![
        fact(0, FrozenFactKind::Unrelated, felt(700)),
        fact(1, FrozenFactKind::EnablingResult, leaf.liability_id),
    ];
    let mut witness = base_witness(&program, leaf, legs, facts);
    witness.enabling_outbox_fact_hash = hash_accepted_outbox_fact(&witness.accepted_facts[1]);
    witness.requested_disposition_kind = 1;
    (program, witness)
}

fn abort_fixture() -> (EmergencySealedProgram, EmergencySealedWitness) {
    let program = EmergencySealedProgram::reference_blitz_v1();
    let outcome_id = U256 { low: 7001, high: 0 };
    let legs = vec![
        fungible_leg(99, 750, 610),
        ClaimLeg {
            asset_mode: 3,
            asset_id: 91,
            backing_pool_id: felt(800),
            recipient: felt(99),
            amount_or_token_id: outcome_id,
            policy_key: felt(611),
        },
    ];
    let leaf = claim_leaf(PAYOUT_OUTCOME_NFT, &legs, felt(9002));
    let facts = vec![
        fact(0, FrozenFactKind::Unrelated, felt(701)),
        fact(1, FrozenFactKind::TerminalAbort, leaf.liability_id),
    ];
    let mut witness = base_witness(&program, leaf.clone(), legs, facts);
    witness.enabling_outbox_fact_hash = hash_accepted_outbox_fact(&witness.accepted_facts[1]);
    witness.requested_disposition_kind = 2;
    witness.abort_recipient_l1 = felt(88);
    witness.original_reservations = vec![NftReservation {
        game_id: leaf.game_id,
        reservation_kind: 2,
        asset_mode: 3,
        asset_id: 91,
        purpose: felt(611),
        token_or_claim_id: outcome_id,
        source_id: felt(44),
        attributes_raw: 0,
        attributes_hash: felt(45),
        metadata_hash: felt(46),
    }];
    (program, witness)
}

fn base_witness(
    program: &EmergencySealedProgram,
    leaf: ClaimLeaf,
    legs: Vec<ClaimLeg>,
    accepted_facts: Vec<AcceptedOutboxFact>,
) -> EmergencySealedWitness {
    let (root, siblings) = hash_registered_claim_root(&leaf, 64).expect("reference root");
    let original_legs_hash = leaf.legs_hash;
    EmergencySealedWitness {
        frozen_checkpoint_hash: felt(300),
        frozen_outbox_cursor: 2,
        accepted_interval_start: 0,
        accepted_facts,
        registered_root: root,
        root_registered: true,
        merkle_siblings: siblings,
        original_leaf: leaf,
        original_legs: legs,
        original_reservations: vec![],
        root_budget: RootBudgetSource {
            source_mode: 1,
            batch_id: 4,
            game_id: felt(12),
            fully_funded: true,
            registered_original_legs_hash: original_legs_hash,
        },
        replacement_policy_hash: program.replacement_policy_hash,
        abort_recipient_l1: program.abort_recipient_l1,
        enabling_outbox_fact_hash: Felt::ZERO,
        requested_disposition_kind: 0,
    }
}

fn claim_leaf(claim_kind: u16, legs: &[ClaimLeg], liability_id: Felt) -> ClaimLeaf {
    ClaimLeaf {
        version: 1,
        deployment_id: felt(11),
        season_id: felt(13),
        game_id: felt(12),
        batch_id: 4,
        leaf_index: 7,
        claim_kind,
        liability_id,
        claimant_l2: felt(77),
        recipient_l1: felt(88),
        legs_hash: hash_settlement_legs(legs),
        aux_hash: felt(777),
    }
}

fn fact(nonce: u64, fact_kind: FrozenFactKind, subject_id: Felt) -> AcceptedOutboxFact {
    AcceptedOutboxFact {
        transport_nonce: nonce,
        action: if fact_kind == FrozenFactKind::Unrelated {
            0x0201
        } else {
            0x0206
        },
        subject_id,
        body_hash: felt(8000 + nonce),
        effect_kind: fact_kind,
        effect_hash: felt(8100 + nonce),
    }
}

fn fungible_leg(recipient: u64, amount: u128, policy: u64) -> ClaimLeg {
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

fn refund_leg(recipient: u64, amount: u128) -> ClaimLeg {
    fungible_leg(recipient, amount, 620)
}

fn changed(
    witness: &EmergencySealedWitness,
    mutate: impl FnOnce(&mut EmergencySealedWitness),
) -> EmergencySealedWitness {
    let mut candidate = witness.clone();
    mutate(&mut candidate);
    candidate
}

fn assert_error(
    program: &EmergencySealedProgram,
    witness: EmergencySealedWitness,
    expected: EmergencyDispositionError,
) {
    assert_eq!(execute_emergency_sealed(program, &witness), Err(expected));
}

fn felt(value: u64) -> Felt {
    Felt::from(value)
}

#[test]
fn claim_leaf_hash_is_committed_by_the_registered_tree() {
    let (_, witness) = enabled_fixture();
    assert_ne!(hash_claim_leaf(&witness.original_leaf), Felt::ZERO);
}

#[test]
fn rust_matches_the_cairo_and_typescript_public_journal_vectors() {
    let legs = vec![fungible_leg(88, 750, 601)];
    let leaf = claim_leaf(PAYOUT_FUNGIBLE_OUTCOME, &legs, felt(9001));
    let claim = eternum_settlement::types::EmergencySealedClaim {
        deployment_id: felt(11),
        frozen_checkpoint_hash: felt(300),
        game_id: felt(12),
        batch_id: 4,
        leaf_index: 7,
        original_leaf_hash: hash_claim_leaf(&leaf),
        liability_id: felt(9001),
        disposition_kind: 1,
        enabling_outbox_fact_hash: felt(4001),
        original_legs_hash: hash_settlement_legs(&legs),
        settlement_legs_hash: hash_settlement_legs(&legs),
    };
    let journal = EmergencySealedJournal {
        program_hash: felt(3001),
        frozen_checkpoint_hash: felt(300),
        accepted_interval_hash: felt(3002),
        registered_root: felt(3003),
        claim_hash: hash_emergency_sealed_claim(&claim),
        original_leaf_hash: claim.original_leaf_hash,
        original_legs_hash: claim.original_legs_hash,
        settlement_legs_hash: claim.settlement_legs_hash,
        parent_dispositions_hash: felt(3004),
        exact_reservations_hash: felt(3005),
    };
    assert_eq!(
        claim.original_leaf_hash,
        Felt::from_hex("0x556b800ade71aa2435161409a39f1c96c9e4ca6ea5da04457568db7a1303e9b")
            .unwrap(),
    );
    assert_eq!(
        claim.original_legs_hash,
        Felt::from_hex("0x629899a61f730d376f3132c3d96052f782439f569ed5368b58ac3a4dbb50003")
            .unwrap(),
    );
    assert_eq!(
        journal.claim_hash,
        Felt::from_hex("0x1373c23a74a4ba9cefdc862253704bc800077476bfe663669eefdcb2029ae9f")
            .unwrap(),
    );
    assert_eq!(
        hash_emergency_sealed_journal(&journal),
        Felt::from_hex("0x37890799d1a1ec66e4425bfffa52747bcfb6fdb984b80d39420f451b01b343f")
            .unwrap(),
    );
}
