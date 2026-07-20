use std::collections::BTreeMap;

use ruint::aliases::U256 as WideU256;
use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::tree::FixedDepthTree;
use crate::types::{ClaimLeaf, ClaimLeg, EmergencySealedClaim, NftReservation, U256};

const ROOT_SOURCE_MODE: u8 = 1;
const CLAIM_TREE_DEPTH: u8 = 6;
const MAX_CLAIM_LEGS: usize = 8;
const GAME_RESULT_ACTION: u16 = 0x0206;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmergencySealedProgram {
    pub deployment_id: Felt,
    pub game_id: Felt,
    pub replacement_policy_hash: Felt,
    pub abort_recipient_l1: Felt,
    pub abort_fungible_policy_key: Felt,
    pub exact_asset_modes: Vec<u8>,
}

impl EmergencySealedProgram {
    pub fn reference_blitz_v1() -> Self {
        let mut program = Self {
            deployment_id: Felt::from(11_u8),
            game_id: Felt::from(12_u8),
            replacement_policy_hash: Felt::ZERO,
            abort_recipient_l1: Felt::from(88_u8),
            abort_fungible_policy_key: Felt::from(620_u16),
            exact_asset_modes: vec![3],
        };
        program.replacement_policy_hash = hash_replacement_policy(&program);
        program
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum FrozenFactKind {
    Unrelated = 0,
    EnablingResult = 1,
    TerminalAbort = 2,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptedOutboxFact {
    pub transport_nonce: u64,
    pub action: u16,
    pub subject_id: Felt,
    pub body_hash: Felt,
    pub effect_kind: FrozenFactKind,
    pub effect_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RootBudgetSource {
    pub source_mode: u8,
    pub batch_id: u64,
    pub game_id: Felt,
    pub fully_funded: bool,
    pub registered_original_legs_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmergencySealedWitness {
    pub frozen_checkpoint_hash: Felt,
    pub frozen_outbox_cursor: u64,
    pub accepted_interval_start: u64,
    pub accepted_facts: Vec<AcceptedOutboxFact>,
    pub registered_root: Felt,
    pub root_registered: bool,
    pub merkle_siblings: Vec<Felt>,
    pub original_leaf: ClaimLeaf,
    pub original_legs: Vec<ClaimLeg>,
    pub original_reservations: Vec<NftReservation>,
    pub root_budget: RootBudgetSource,
    pub replacement_policy_hash: Felt,
    pub abort_recipient_l1: Felt,
    pub enabling_outbox_fact_hash: Felt,
    pub requested_disposition_kind: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct ParentKey {
    pub asset_mode: u8,
    pub asset_id: u32,
    pub backing_pool_id: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParentDisposition {
    pub parent: ParentKey,
    pub original_amount: U256,
    pub settlement_amount: U256,
}

impl ParentDisposition {
    pub fn is_conserved(&self) -> bool {
        self.original_amount == self.settlement_amount
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ExactReservationDisposition {
    Retained = 1,
    Released = 2,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExactReservationEffect {
    pub reservation: NftReservation,
    pub disposition: ExactReservationDisposition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmergencySealedJournal {
    pub program_hash: Felt,
    pub frozen_checkpoint_hash: Felt,
    pub accepted_interval_hash: Felt,
    pub registered_root: Felt,
    pub claim_hash: Felt,
    pub original_leaf_hash: Felt,
    pub original_legs_hash: Felt,
    pub settlement_legs_hash: Felt,
    pub parent_dispositions_hash: Felt,
    pub exact_reservations_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmergencySealedOutput {
    pub claim: EmergencySealedClaim,
    pub settlement_legs: Vec<ClaimLeg>,
    pub parent_dispositions: Vec<ParentDisposition>,
    pub exact_reservation_dispositions: Vec<ExactReservationEffect>,
    pub journal: EmergencySealedJournal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmergencyDispositionError {
    Program,
    RegisteredRoot,
    AcceptedInterval,
    OriginalLeaf,
    OriginalLegs,
    Disposition,
    ReplacementPolicy,
    Recipient,
    BudgetSource,
    ParentConservation,
    ExactReservation,
    Arithmetic,
}

pub fn execute_emergency_sealed(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
) -> Result<EmergencySealedOutput, EmergencyDispositionError> {
    validate_program_binding(program, witness)?;
    validate_registered_leaf(program, witness)?;
    let accepted_interval_hash = validate_accepted_interval(witness)?;
    let settlement_legs = resolve_settlement_legs(program, witness)?;
    let parent_dispositions =
        derive_parent_dispositions(program, &witness.original_legs, &settlement_legs)?;
    let exact_reservation_dispositions = validate_exact_reservations(
        program,
        witness.requested_disposition_kind,
        &witness.original_leaf,
        &witness.original_legs,
        &settlement_legs,
        &witness.original_reservations,
    )?;
    let claim = build_claim(witness, &settlement_legs);
    let journal = build_journal(
        program,
        witness,
        &claim,
        accepted_interval_hash,
        &parent_dispositions,
        &exact_reservation_dispositions,
    );
    Ok(EmergencySealedOutput {
        claim,
        settlement_legs,
        parent_dispositions,
        exact_reservation_dispositions,
        journal,
    })
}

pub fn verify_emergency_sealed_journal(
    claim: &EmergencySealedClaim,
    original_leaf: &ClaimLeaf,
    original_legs: &[ClaimLeg],
    settlement_legs: &[ClaimLeg],
    journal: &EmergencySealedJournal,
    verified_journal_hash: Felt,
) -> bool {
    if original_legs.is_empty()
        || original_legs.len() > MAX_CLAIM_LEGS
        || settlement_legs.len() > MAX_CLAIM_LEGS
    {
        return false;
    }
    let original_leaf_hash = hash_claim_leaf(original_leaf);
    let original_legs_hash = hash_settlement_legs(original_legs);
    let settlement_legs_hash = hash_settlement_legs(settlement_legs);
    journal.claim_hash == hash_emergency_sealed_claim(claim)
        && journal.original_leaf_hash == original_leaf_hash
        && journal.original_legs_hash == original_legs_hash
        && journal.settlement_legs_hash == settlement_legs_hash
        && claim.original_leaf_hash == original_leaf_hash
        && claim.original_legs_hash == original_legs_hash
        && claim.settlement_legs_hash == settlement_legs_hash
        && original_leaf.liability_id == claim.liability_id
        && hash_emergency_sealed_journal(journal) == verified_journal_hash
}

pub fn hash_claim_leaf(leaf: &ClaimLeaf) -> Felt {
    hash_encoded("CLAIM_LEAF_V1", leaf)
}

pub fn hash_settlement_legs(legs: &[ClaimLeg]) -> Felt {
    let mut preimage = Vec::with_capacity(legs.len() * 7 + 2);
    preimage.extend([domain("CLAIM_LEGS_V1"), Felt::from(legs.len())]);
    for leg in legs {
        preimage.extend(leg.encode());
    }
    crate::poseidon_hash_many(&preimage)
}

pub fn hash_accepted_outbox_fact(fact: &AcceptedOutboxFact) -> Felt {
    crate::poseidon_hash_many(&[
        domain("ACCEPTED_OUTBOX_FACT_V1"),
        Felt::from(fact.transport_nonce),
        Felt::from(fact.action),
        fact.subject_id,
        fact.body_hash,
        Felt::from(fact.effect_kind as u16),
        fact.effect_hash,
    ])
}

pub fn hash_emergency_sealed_journal(journal: &EmergencySealedJournal) -> Felt {
    crate::poseidon_hash_many(&[
        domain("EMERGENCY_SEALED_JOURNAL_V1"),
        journal.program_hash,
        journal.frozen_checkpoint_hash,
        journal.accepted_interval_hash,
        journal.registered_root,
        journal.claim_hash,
        journal.original_leaf_hash,
        journal.original_legs_hash,
        journal.settlement_legs_hash,
        journal.parent_dispositions_hash,
        journal.exact_reservations_hash,
    ])
}

pub fn hash_registered_claim_root(
    leaf: &ClaimLeaf,
    capacity: usize,
) -> Result<(Felt, Vec<Felt>), EmergencyDispositionError> {
    if capacity != 1 << CLAIM_TREE_DEPTH {
        return Err(EmergencyDispositionError::RegisteredRoot);
    }
    let tree = claim_tree()?;
    let mut leaves = vec![empty_claim_leaf_hash(); usize::from(leaf.leaf_index) + 1];
    leaves[usize::from(leaf.leaf_index)] = hash_claim_leaf(leaf);
    let root = tree
        .root(&leaves)
        .map_err(|_| EmergencyDispositionError::RegisteredRoot)?;
    let proof = tree
        .proof(&leaves, usize::from(leaf.leaf_index))
        .map_err(|_| EmergencyDispositionError::RegisteredRoot)?;
    Ok((root, proof))
}

fn validate_program_binding(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
) -> Result<(), EmergencyDispositionError> {
    if program.exact_asset_modes.is_empty()
        || program
            .exact_asset_modes
            .windows(2)
            .any(|pair| pair[0] >= pair[1])
        || program.replacement_policy_hash != hash_replacement_policy(program)
    {
        return Err(EmergencyDispositionError::Program);
    }
    if witness.original_leaf.deployment_id != program.deployment_id
        || witness.original_leaf.game_id != program.game_id
    {
        return Err(EmergencyDispositionError::Program);
    }
    if witness.replacement_policy_hash != program.replacement_policy_hash {
        return Err(EmergencyDispositionError::ReplacementPolicy);
    }
    if witness.abort_recipient_l1 != program.abort_recipient_l1 {
        return Err(EmergencyDispositionError::Recipient);
    }
    Ok(())
}

fn validate_registered_leaf(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
) -> Result<(), EmergencyDispositionError> {
    let leaf = &witness.original_leaf;
    if !witness.root_registered
        || leaf.batch_id != witness.root_budget.batch_id
        || leaf.game_id != witness.root_budget.game_id
    {
        return Err(EmergencyDispositionError::RegisteredRoot);
    }
    if leaf.legs_hash != hash_settlement_legs(&witness.original_legs) {
        return Err(EmergencyDispositionError::OriginalLegs);
    }
    if witness.original_legs.is_empty() || witness.original_legs.len() > MAX_CLAIM_LEGS {
        return Err(EmergencyDispositionError::OriginalLegs);
    }
    validate_canonical_legs(program, &witness.original_legs)
        .map_err(|_| EmergencyDispositionError::OriginalLegs)?;
    let verified = claim_tree()?
        .verify(
            hash_claim_leaf(leaf),
            usize::from(leaf.leaf_index),
            &witness.merkle_siblings,
            witness.registered_root,
        )
        .map_err(|_| EmergencyDispositionError::RegisteredRoot)?;
    if !verified {
        return Err(EmergencyDispositionError::RegisteredRoot);
    }
    validate_root_budget(witness)
}

fn validate_root_budget(witness: &EmergencySealedWitness) -> Result<(), EmergencyDispositionError> {
    if witness.root_budget.source_mode != ROOT_SOURCE_MODE
        || !witness.root_budget.fully_funded
        || witness.root_budget.registered_original_legs_hash
            != hash_settlement_legs(&witness.original_legs)
    {
        return Err(EmergencyDispositionError::BudgetSource);
    }
    Ok(())
}

fn validate_accepted_interval(
    witness: &EmergencySealedWitness,
) -> Result<Felt, EmergencyDispositionError> {
    let expected_count = witness
        .frozen_outbox_cursor
        .checked_sub(witness.accepted_interval_start)
        .ok_or(EmergencyDispositionError::AcceptedInterval)?;
    if usize::try_from(expected_count).ok() != Some(witness.accepted_facts.len()) {
        return Err(EmergencyDispositionError::AcceptedInterval);
    }
    for (offset, fact) in witness.accepted_facts.iter().enumerate() {
        let expected_nonce = witness
            .accepted_interval_start
            .checked_add(offset as u64)
            .ok_or(EmergencyDispositionError::AcceptedInterval)?;
        if fact.transport_nonce != expected_nonce
            || fact.transport_nonce >= witness.frozen_outbox_cursor
        {
            return Err(EmergencyDispositionError::AcceptedInterval);
        }
        if fact.effect_kind != FrozenFactKind::Unrelated && fact.action != GAME_RESULT_ACTION {
            return Err(EmergencyDispositionError::AcceptedInterval);
        }
    }
    let mut preimage = vec![
        domain("ACCEPTED_OUTBOX_INTERVAL_V1"),
        Felt::from(witness.accepted_interval_start),
        Felt::from(witness.frozen_outbox_cursor),
        Felt::from(witness.accepted_facts.len()),
    ];
    preimage.extend(witness.accepted_facts.iter().map(hash_accepted_outbox_fact));
    Ok(crate::poseidon_hash_many(&preimage))
}

fn resolve_settlement_legs(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
) -> Result<Vec<ClaimLeg>, EmergencyDispositionError> {
    let matching_facts = witness
        .accepted_facts
        .iter()
        .filter(|fact| {
            fact.subject_id == witness.original_leaf.liability_id
                && fact.effect_kind != FrozenFactKind::Unrelated
        })
        .collect::<Vec<_>>();
    let [fact] = matching_facts.as_slice() else {
        return Err(EmergencyDispositionError::Disposition);
    };
    if hash_accepted_outbox_fact(fact) != witness.enabling_outbox_fact_hash {
        return Err(EmergencyDispositionError::Disposition);
    }
    match witness.requested_disposition_kind {
        1 if fact.effect_kind == FrozenFactKind::EnablingResult => {
            Ok(witness.original_legs.clone())
        }
        2 if fact.effect_kind == FrozenFactKind::TerminalAbort => {
            build_abort_replacement(program, witness)
        }
        _ => Err(EmergencyDispositionError::Disposition),
    }
}

fn build_abort_replacement(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
) -> Result<Vec<ClaimLeg>, EmergencyDispositionError> {
    let mut replacements = BTreeMap::<ParentKey, WideU256>::new();
    for leg in &witness.original_legs {
        if is_exact_leg(program, leg) {
            continue;
        }
        let parent = parent_key(leg);
        let amount = to_wide(leg.amount_or_token_id);
        let next = replacements
            .get(&parent)
            .copied()
            .unwrap_or(WideU256::ZERO)
            .checked_add(amount)
            .ok_or(EmergencyDispositionError::Arithmetic)?;
        replacements.insert(parent, next);
    }
    replacements
        .into_iter()
        .map(|(parent, amount)| {
            Ok(ClaimLeg {
                asset_mode: parent.asset_mode,
                asset_id: parent.asset_id,
                backing_pool_id: parent.backing_pool_id,
                recipient: program.abort_recipient_l1,
                amount_or_token_id: from_wide(amount),
                policy_key: program.abort_fungible_policy_key,
            })
        })
        .collect()
}

fn derive_parent_dispositions(
    program: &EmergencySealedProgram,
    original_legs: &[ClaimLeg],
    settlement_legs: &[ClaimLeg],
) -> Result<Vec<ParentDisposition>, EmergencyDispositionError> {
    let original = sum_fungible_parents(program, original_legs)?;
    let settlement = sum_fungible_parents(program, settlement_legs)?;
    if original.keys().ne(settlement.keys()) {
        return Err(EmergencyDispositionError::ParentConservation);
    }
    original
        .into_iter()
        .map(|(parent, original_amount)| {
            let settlement_amount = settlement[&parent];
            if original_amount != settlement_amount {
                return Err(EmergencyDispositionError::ParentConservation);
            }
            Ok(ParentDisposition {
                parent,
                original_amount: from_wide(original_amount),
                settlement_amount: from_wide(settlement_amount),
            })
        })
        .collect()
}

fn validate_canonical_legs(
    program: &EmergencySealedProgram,
    legs: &[ClaimLeg],
) -> Result<(), EmergencyDispositionError> {
    if legs
        .iter()
        .any(|leg| leg.amount_or_token_id == (U256 { low: 0, high: 0 }))
    {
        return Err(EmergencyDispositionError::OriginalLegs);
    }
    for pair in legs.windows(2) {
        if leg_sort_key(program, &pair[0]) >= leg_sort_key(program, &pair[1]) {
            return Err(EmergencyDispositionError::OriginalLegs);
        }
    }
    Ok(())
}

fn leg_sort_key(
    program: &EmergencySealedProgram,
    leg: &ClaimLeg,
) -> (u8, u32, Felt, Felt, Felt, u128, u128) {
    let (token_low, token_high) = if is_exact_leg(program, leg) {
        (leg.amount_or_token_id.low, leg.amount_or_token_id.high)
    } else {
        (0, 0)
    };
    (
        leg.asset_mode,
        leg.asset_id,
        leg.backing_pool_id,
        leg.recipient,
        leg.policy_key,
        token_high,
        token_low,
    )
}

fn sum_fungible_parents(
    program: &EmergencySealedProgram,
    legs: &[ClaimLeg],
) -> Result<BTreeMap<ParentKey, WideU256>, EmergencyDispositionError> {
    let mut totals = BTreeMap::new();
    for leg in legs.iter().filter(|leg| !is_exact_leg(program, leg)) {
        let parent = parent_key(leg);
        let next = totals
            .get(&parent)
            .copied()
            .unwrap_or(WideU256::ZERO)
            .checked_add(to_wide(leg.amount_or_token_id))
            .ok_or(EmergencyDispositionError::Arithmetic)?;
        totals.insert(parent, next);
    }
    Ok(totals)
}

fn validate_exact_reservations(
    program: &EmergencySealedProgram,
    disposition_kind: u16,
    leaf: &ClaimLeaf,
    original_legs: &[ClaimLeg],
    settlement_legs: &[ClaimLeg],
    reservations: &[NftReservation],
) -> Result<Vec<ExactReservationEffect>, EmergencyDispositionError> {
    let exact_original = original_legs
        .iter()
        .filter(|leg| is_exact_leg(program, leg))
        .collect::<Vec<_>>();
    if exact_original.len() != reservations.len() {
        return Err(EmergencyDispositionError::ExactReservation);
    }
    for (leg, reservation) in exact_original.iter().zip(reservations) {
        if reservation.game_id != leaf.game_id
            || reservation.asset_mode != leg.asset_mode
            || reservation.asset_id != leg.asset_id
            || reservation.purpose != leg.policy_key
            || reservation.token_or_claim_id != leg.amount_or_token_id
        {
            return Err(EmergencyDispositionError::ExactReservation);
        }
    }
    let exact_settlement = settlement_legs
        .iter()
        .filter(|leg| is_exact_leg(program, leg))
        .collect::<Vec<_>>();
    match disposition_kind {
        1 if exact_settlement == exact_original => Ok(reservations
            .iter()
            .cloned()
            .map(|reservation| ExactReservationEffect {
                reservation,
                disposition: ExactReservationDisposition::Retained,
            })
            .collect()),
        2 if exact_settlement.is_empty() => Ok(reservations
            .iter()
            .cloned()
            .map(|reservation| ExactReservationEffect {
                reservation,
                disposition: ExactReservationDisposition::Released,
            })
            .collect()),
        _ => Err(EmergencyDispositionError::ExactReservation),
    }
}

fn build_claim(
    witness: &EmergencySealedWitness,
    settlement_legs: &[ClaimLeg],
) -> EmergencySealedClaim {
    EmergencySealedClaim {
        deployment_id: witness.original_leaf.deployment_id,
        frozen_checkpoint_hash: witness.frozen_checkpoint_hash,
        game_id: witness.original_leaf.game_id,
        batch_id: witness.original_leaf.batch_id,
        leaf_index: witness.original_leaf.leaf_index,
        original_leaf_hash: hash_claim_leaf(&witness.original_leaf),
        liability_id: witness.original_leaf.liability_id,
        disposition_kind: witness.requested_disposition_kind,
        enabling_outbox_fact_hash: witness.enabling_outbox_fact_hash,
        original_legs_hash: hash_settlement_legs(&witness.original_legs),
        settlement_legs_hash: hash_settlement_legs(settlement_legs),
    }
}

fn build_journal(
    program: &EmergencySealedProgram,
    witness: &EmergencySealedWitness,
    claim: &EmergencySealedClaim,
    accepted_interval_hash: Felt,
    parent_dispositions: &[ParentDisposition],
    exact_reservations: &[ExactReservationEffect],
) -> EmergencySealedJournal {
    EmergencySealedJournal {
        program_hash: hash_program(program),
        frozen_checkpoint_hash: witness.frozen_checkpoint_hash,
        accepted_interval_hash,
        registered_root: witness.registered_root,
        claim_hash: hash_emergency_sealed_claim(claim),
        original_leaf_hash: claim.original_leaf_hash,
        original_legs_hash: claim.original_legs_hash,
        settlement_legs_hash: claim.settlement_legs_hash,
        parent_dispositions_hash: hash_parent_dispositions(parent_dispositions),
        exact_reservations_hash: hash_exact_reservations(exact_reservations),
    }
}

fn hash_replacement_policy(program: &EmergencySealedProgram) -> Felt {
    let mut preimage = vec![
        domain("EMERGENCY_REPLACEMENT_POLICY_V1"),
        program.deployment_id,
        program.game_id,
        program.abort_recipient_l1,
        program.abort_fungible_policy_key,
        Felt::from(program.exact_asset_modes.len()),
    ];
    preimage.extend(program.exact_asset_modes.iter().copied().map(Felt::from));
    crate::poseidon_hash_many(&preimage)
}

fn hash_program(program: &EmergencySealedProgram) -> Felt {
    crate::poseidon_hash_many(&[
        domain("EMERGENCY_SEALED_PROGRAM_V1"),
        program.deployment_id,
        program.game_id,
        program.replacement_policy_hash,
        program.abort_recipient_l1,
        program.abort_fungible_policy_key,
    ])
}

pub fn hash_emergency_sealed_claim(claim: &EmergencySealedClaim) -> Felt {
    hash_encoded("EMERGENCY_SEALED_CLAIM_V1", claim)
}

fn hash_parent_dispositions(dispositions: &[ParentDisposition]) -> Felt {
    let mut preimage = vec![
        domain("EMERGENCY_PARENT_DISPOSITIONS_V1"),
        Felt::from(dispositions.len()),
    ];
    for disposition in dispositions {
        preimage.extend([
            Felt::from(disposition.parent.asset_mode),
            Felt::from(disposition.parent.asset_id),
            disposition.parent.backing_pool_id,
            Felt::from(disposition.original_amount.low),
            Felt::from(disposition.original_amount.high),
            Felt::from(disposition.settlement_amount.low),
            Felt::from(disposition.settlement_amount.high),
        ]);
    }
    crate::poseidon_hash_many(&preimage)
}

fn hash_exact_reservations(dispositions: &[ExactReservationEffect]) -> Felt {
    let mut preimage = vec![
        domain("EMERGENCY_EXACT_RESERVATIONS_V1"),
        Felt::from(dispositions.len()),
    ];
    for effect in dispositions {
        preimage.extend(effect.reservation.encode());
        preimage.push(Felt::from(effect.disposition as u8));
    }
    crate::poseidon_hash_many(&preimage)
}

fn claim_tree() -> Result<FixedDepthTree, EmergencyDispositionError> {
    FixedDepthTree::new(CLAIM_TREE_DEPTH, domain("EMPTY_LEAF_V1"), domain("NODE_V1"))
        .map_err(|_| EmergencyDispositionError::RegisteredRoot)
}

fn empty_claim_leaf_hash() -> Felt {
    crate::poseidon_hash_many(&[domain("EMPTY_LEAF_V1")])
}

fn hash_encoded(domain_name: &str, value: &impl CanonicalEncode) -> Felt {
    let mut preimage = vec![domain(domain_name)];
    preimage.extend(value.encode());
    crate::poseidon_hash_many(&preimage)
}

fn parent_key(leg: &ClaimLeg) -> ParentKey {
    ParentKey {
        asset_mode: leg.asset_mode,
        asset_id: leg.asset_id,
        backing_pool_id: leg.backing_pool_id,
    }
}

fn is_exact_leg(program: &EmergencySealedProgram, leg: &ClaimLeg) -> bool {
    program.exact_asset_modes.contains(&leg.asset_mode)
}

fn to_wide(value: U256) -> WideU256 {
    WideU256::from(value.low) | (WideU256::from(value.high) << 128)
}

fn from_wide(value: WideU256) -> U256 {
    U256 {
        low: value.as_limbs()[0] as u128 | ((value.as_limbs()[1] as u128) << 64),
        high: value.as_limbs()[2] as u128 | ((value.as_limbs()[3] as u128) << 64),
    }
}

fn domain(name: &str) -> Felt {
    let selector = crate::schema_vector::hash_domain_selector(name)
        .unwrap_or_else(|| panic!("unregistered emergency-sealed domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}
