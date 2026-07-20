use std::collections::BTreeSet;

use ruint::aliases::U256 as WideU256;
use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::frozen_position::hash_payout_legs;
use crate::tree::FixedDepthTree;
use crate::types::{
    AbortRefundAux, ClaimLeg, DeploymentRefundCommitment, DeploymentRefundDisposition,
    DeploymentRefundSource, FrozenCheckpoint, FrozenDeploymentRefundClaim, FrozenRecoverySummary,
    GameBackingLot, U256,
};

const MAX_REFUND_SOURCES: usize = 256;
const REFUND_TREE_DEPTH: u8 = 8;
const ABORT_REFUND_SOURCE_KIND: u8 = 9;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenRecoveryProgram {
    pub deployment_id: Felt,
    pub checkpoint_hash: Felt,
    pub abort_refund_source_kind: u8,
    pub abort_refund_purpose: Felt,
}

impl FrozenRecoveryProgram {
    pub fn reference_v1() -> Self {
        Self {
            deployment_id: Felt::from(11_u8),
            checkpoint_hash: Felt::from(300_u16),
            abort_refund_source_kind: ABORT_REFUND_SOURCE_KIND,
            abort_refund_purpose: Felt::from(620_u16),
        }
    }

    pub fn derive_refund_liability(&self, source: &DeploymentRefundSource) -> Felt {
        let stable_source_id = crate::poseidon_hash_many(&[
            domain("ABORT_REFUND_SOURCE_V1"),
            source.source_ingress_or_pool_id,
            source.funding_source_id,
            Felt::from(source.disposition_epoch),
            Felt::from(source.refund_kind),
        ]);
        crate::poseidon_hash_many(&[
            domain("ETERNUM_LIABILITY_V1"),
            self.deployment_id,
            Felt::ZERO,
            Felt::from(self.abort_refund_source_kind),
            stable_source_id,
            Felt::from(source.disposition_epoch),
        ])
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefundAssignment {
    None,
    Open {
        batch_id: u64,
        leaf_index: u8,
        liability_id: Felt,
    },
    Sealed {
        batch_id: u64,
        leaf_index: u8,
        liability_id: Felt,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum RefundRoute {
    NoLiability = 0,
    EligibleSealedRoot = 1,
    OpenAssignedFrozen = 2,
    UnappendedFrozen = 3,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenGameLotWitness {
    pub allocation_index: u16,
    pub terminal_state_hash: Felt,
    pub lot: GameBackingLot,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenRecoveryWitness {
    pub checkpoint: FrozenCheckpoint,
    pub sources: Vec<DeploymentRefundSource>,
    pub game_lots: Vec<FrozenGameLotWitness>,
    pub assignments: Vec<RefundAssignment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenRefundRow {
    pub source: DeploymentRefundSource,
    pub disposition: DeploymentRefundDisposition,
    pub route: RefundRoute,
    pub claim: Option<FrozenDeploymentRefundClaim>,
    pub aux: Option<AbortRefundAux>,
    pub legs: Vec<ClaimLeg>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenRecoveryJournal {
    pub program_hash: Felt,
    pub state_root: Felt,
    pub summary_hash: Felt,
    pub sources_hash: Felt,
    pub dispositions_hash: Felt,
    pub game_returns_hash: Felt,
    pub routes_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenRecoveryOutput {
    pub summary: FrozenRecoverySummary,
    pub rows: Vec<FrozenRefundRow>,
    pub journal: FrozenRecoveryJournal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrozenRecoveryError {
    Checkpoint,
    SourceCount,
    SourceIndex,
    SourceIdentity,
    SourceConservation,
    NonphysicalSource,
    LotClass,
    LotOrder,
    LotConservation,
    LotAttribution,
    Assignment,
    StateRoot,
    Arithmetic,
    Tree,
}

pub fn execute_frozen_recovery(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
) -> Result<FrozenRecoveryOutput, FrozenRecoveryError> {
    validate_checkpoint_binding(program, witness)?;
    validate_source_rows(witness)?;
    validate_frozen_source_commitment(witness)?;
    let virtual_returns = derive_virtual_returns(witness)?;
    validate_assignments(program, witness)?;
    validate_reference_state_root(program, witness)?;
    let mut rows = normalize_refund_rows(program, witness, &virtual_returns)?;
    let summary = build_frozen_recovery_summary(witness, &rows)?;
    bind_terminal_refund_source_hash(&mut rows, hash_frozen_recovery_summary(&summary));
    let journal = build_journal(program, witness, &summary, &rows)?;
    Ok(FrozenRecoveryOutput {
        summary,
        rows,
        journal,
    })
}

pub fn hash_refund_sources(sources: &[DeploymentRefundSource]) -> Felt {
    hash_counted_encoded_list(
        "DEPLOYMENT_REFUND_SOURCES_V1",
        "DEPLOYMENT_REFUND_SOURCE_LEAF_V1",
        sources,
    )
}

pub fn refund_sources_root(
    sources: &[DeploymentRefundSource],
) -> Result<Felt, FrozenRecoveryError> {
    refund_tree(
        "DEPLOYMENT_REFUND_SOURCE_EMPTY_V1",
        "DEPLOYMENT_REFUND_SOURCE_NODE_V1",
    )?
    .root(
        &sources
            .iter()
            .map(|source| hash_encoded("DEPLOYMENT_REFUND_SOURCE_LEAF_V1", source))
            .collect::<Vec<_>>(),
    )
    .map_err(|_| FrozenRecoveryError::Tree)
}

pub fn hash_frozen_recovery_summary(summary: &FrozenRecoverySummary) -> Felt {
    hash_encoded("FROZEN_RECOVERY_SUMMARY_V1", summary)
}

pub fn hash_frozen_recovery_journal(journal: &FrozenRecoveryJournal) -> Felt {
    crate::poseidon_hash_many(&[
        domain("FROZEN_RECOVERY_JOURNAL_V1"),
        journal.program_hash,
        journal.state_root,
        journal.summary_hash,
        journal.sources_hash,
        journal.dispositions_hash,
        journal.game_returns_hash,
        journal.routes_hash,
    ])
}

pub fn hash_frozen_recovery_state(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
) -> Felt {
    let mut preimage = vec![
        domain("FROZEN_RECOVERY_REFERENCE_STATE_V1"),
        hash_program(program),
        witness.checkpoint.deployment_id,
        witness.checkpoint.checkpoint_hash,
        Felt::from(witness.checkpoint.block_number),
        witness.checkpoint.block_hash,
        Felt::from(witness.checkpoint.inbox_cursor),
        Felt::from(witness.checkpoint.outbox_cursor),
        Felt::from(witness.sources.len()),
    ];
    for source in &witness.sources {
        preimage.extend(source.encode());
    }
    preimage.push(Felt::from(witness.game_lots.len()));
    for lot in &witness.game_lots {
        preimage.extend([Felt::from(lot.allocation_index), lot.terminal_state_hash]);
        preimage.extend(lot.lot.encode());
    }
    preimage.push(Felt::from(witness.assignments.len()));
    for assignment in &witness.assignments {
        append_assignment(&mut preimage, assignment);
    }
    crate::poseidon_hash_many(&preimage)
}

fn validate_checkpoint_binding(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
) -> Result<(), FrozenRecoveryError> {
    if witness.checkpoint.deployment_id != program.deployment_id
        || witness.checkpoint.checkpoint_hash != program.checkpoint_hash
    {
        return Err(FrozenRecoveryError::Checkpoint);
    }
    let source_count = usize::from(witness.checkpoint.deployment_refunds.source_count);
    if source_count == 0
        || source_count > MAX_REFUND_SOURCES
        || source_count != witness.sources.len()
        || source_count != witness.assignments.len()
    {
        return Err(FrozenRecoveryError::SourceCount);
    }
    Ok(())
}

fn validate_source_rows(witness: &FrozenRecoveryWitness) -> Result<(), FrozenRecoveryError> {
    let mut physical_count = 0_u16;
    for (index, source) in witness.sources.iter().enumerate() {
        if usize::from(source.source_index) != index {
            return Err(FrozenRecoveryError::SourceIndex);
        }
        validate_source_conservation(source)?;
        if is_nonphysical(source) {
            validate_nonphysical_source(source)?;
        } else {
            physical_count = physical_count
                .checked_add(1)
                .ok_or(FrozenRecoveryError::Arithmetic)?;
            validate_physical_identity(witness, source)?;
        }
    }
    if physical_count
        != witness
            .checkpoint
            .deployment_refunds
            .physical_refund_source_count
    {
        return Err(FrozenRecoveryError::SourceCount);
    }
    Ok(())
}

fn validate_source_conservation(
    source: &DeploymentRefundSource,
) -> Result<(), FrozenRecoveryError> {
    let refundable = checked_add(
        source.unallocated_total,
        source.returned_unused_from_games_total,
    )?;
    if refundable != source.refundable_total
        || checked_add(source.committed_lifetime_total, source.refundable_total)?
            != source.provisioned_physical_total
    {
        return Err(FrozenRecoveryError::SourceConservation);
    }
    Ok(())
}

fn validate_nonphysical_source(source: &DeploymentRefundSource) -> Result<(), FrozenRecoveryError> {
    if source.source_ingress_or_pool_id != Felt::ZERO
        || source.funding_source_id != Felt::ZERO
        || source.refund_recipient_l1 != Felt::ZERO
        || source.refund_policy_hash != Felt::ZERO
        || source.provisioned_physical_total != zero()
        || source.committed_lifetime_total != zero()
        || source.unallocated_total != zero()
        || source.returned_unused_from_games_total != zero()
        || source.refundable_total != zero()
        || source.disposition_epoch != 0
        || source.refund_kind != 0
        || source.emitted
    {
        return Err(FrozenRecoveryError::NonphysicalSource);
    }
    Ok(())
}

fn validate_physical_identity(
    witness: &FrozenRecoveryWitness,
    source: &DeploymentRefundSource,
) -> Result<(), FrozenRecoveryError> {
    if source.parent_key.deployment_id != witness.checkpoint.deployment_id
        || source.parent_key.game_id != Felt::ZERO
        || source.source_ingress_or_pool_id == Felt::ZERO
        || source.funding_source_id == Felt::ZERO
        || source.refund_recipient_l1 == Felt::ZERO
        || source.refund_policy_hash == Felt::ZERO
    {
        return Err(FrozenRecoveryError::SourceIdentity);
    }
    Ok(())
}

fn validate_frozen_source_commitment(
    witness: &FrozenRecoveryWitness,
) -> Result<(), FrozenRecoveryError> {
    if witness.checkpoint.deployment_refunds.sources_hash != hash_refund_sources(&witness.sources)
        || witness.checkpoint.deployment_refunds.sources_root
            != refund_sources_root(&witness.sources)?
    {
        return Err(FrozenRecoveryError::SourceIdentity);
    }
    Ok(())
}

fn derive_virtual_returns(
    witness: &FrozenRecoveryWitness,
) -> Result<Vec<U256>, FrozenRecoveryError> {
    let mut returns = vec![zero(); witness.sources.len()];
    let mut seen = BTreeSet::new();
    let mut previous_order = None;
    for lot_witness in &witness.game_lots {
        let lot = &lot_witness.lot;
        if lot.lot_class != 1 {
            return Err(FrozenRecoveryError::LotClass);
        }
        let order = (
            lot.game_id,
            lot_witness.allocation_index,
            lot.source_index,
            lot.lot_index,
        );
        if previous_order.is_some_and(|previous| previous >= order) || !seen.insert(order) {
            return Err(FrozenRecoveryError::LotOrder);
        }
        previous_order = Some(order);
        let source = witness
            .sources
            .get(usize::from(lot.source_index))
            .ok_or(FrozenRecoveryError::SourceIndex)?;
        if lot_witness.allocation_index != lot.source_index
            || lot.source_id != source.funding_source_id
        {
            return Err(FrozenRecoveryError::LotAttribution);
        }
        let accounted = checked_add(
            checked_add(lot.active_committed_total, lot.cumulative_outbox_total)?,
            lot.returned_unused_total,
        )?;
        let free = checked_sub(lot.allocated_total, accounted)
            .map_err(|_| FrozenRecoveryError::LotConservation)?;
        returns[usize::from(lot.source_index)] =
            checked_add(returns[usize::from(lot.source_index)], free)?;
    }
    validate_lot_source_totals(witness)?;
    Ok(returns)
}

fn validate_lot_source_totals(witness: &FrozenRecoveryWitness) -> Result<(), FrozenRecoveryError> {
    for source in witness
        .sources
        .iter()
        .filter(|source| !is_nonphysical(source))
    {
        let mut allocated = zero();
        let mut returned = zero();
        for lot in witness
            .game_lots
            .iter()
            .filter(|lot| lot.lot.source_index == source.source_index)
        {
            allocated = checked_add(allocated, lot.lot.allocated_total)?;
            returned = checked_add(returned, lot.lot.returned_unused_total)?;
        }
        if checked_add(allocated, source.unallocated_total)? != source.provisioned_physical_total
            || returned != source.returned_unused_from_games_total
        {
            return Err(FrozenRecoveryError::LotConservation);
        }
    }
    Ok(())
}

fn validate_reference_state_root(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
) -> Result<(), FrozenRecoveryError> {
    if witness.checkpoint.state_root != hash_frozen_recovery_state(program, witness) {
        return Err(FrozenRecoveryError::StateRoot);
    }
    Ok(())
}

fn validate_assignments(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
) -> Result<(), FrozenRecoveryError> {
    for (source, assignment) in witness.sources.iter().zip(&witness.assignments) {
        match assignment {
            RefundAssignment::None => {}
            RefundAssignment::Open { liability_id, .. }
            | RefundAssignment::Sealed { liability_id, .. }
                if !is_nonphysical(source)
                    && *liability_id == program.derive_refund_liability(source) => {}
            _ => return Err(FrozenRecoveryError::Assignment),
        }
    }
    Ok(())
}

fn normalize_refund_rows(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
    virtual_returns: &[U256],
) -> Result<Vec<FrozenRefundRow>, FrozenRecoveryError> {
    witness
        .sources
        .iter()
        .zip(&witness.assignments)
        .map(|(source, assignment)| {
            normalize_refund_row(
                program,
                &witness.checkpoint,
                source,
                assignment,
                virtual_returns[usize::from(source.source_index)],
            )
        })
        .collect()
}

fn normalize_refund_row(
    program: &FrozenRecoveryProgram,
    checkpoint: &FrozenCheckpoint,
    source: &DeploymentRefundSource,
    assignment: &RefundAssignment,
    virtual_return: U256,
) -> Result<FrozenRefundRow, FrozenRecoveryError> {
    let mut normalized = source.clone();
    if !is_nonphysical(source) {
        normalized.returned_unused_from_games_total =
            checked_add(source.returned_unused_from_games_total, virtual_return)?;
        normalized.refundable_total = checked_add(
            normalized.unallocated_total,
            normalized.returned_unused_from_games_total,
        )?;
        normalized.committed_lifetime_total = checked_sub(
            normalized.provisioned_physical_total,
            normalized.refundable_total,
        )?;
    }
    let route = classify_route(&normalized, assignment)?;
    normalized.emitted = matches!(
        route,
        RefundRoute::OpenAssignedFrozen | RefundRoute::EligibleSealedRoot
    );
    let (disposition, claim, aux, legs) =
        build_refund_claim(program, checkpoint, &normalized, assignment, route)?;
    Ok(FrozenRefundRow {
        source: normalized,
        disposition,
        route,
        claim,
        aux,
        legs,
    })
}

fn classify_route(
    source: &DeploymentRefundSource,
    assignment: &RefundAssignment,
) -> Result<RefundRoute, FrozenRecoveryError> {
    if source.refundable_total == zero() {
        return if matches!(assignment, RefundAssignment::None) {
            Ok(RefundRoute::NoLiability)
        } else {
            Err(FrozenRecoveryError::Assignment)
        };
    }
    Ok(match assignment {
        RefundAssignment::None => RefundRoute::UnappendedFrozen,
        RefundAssignment::Open { .. } => RefundRoute::OpenAssignedFrozen,
        RefundAssignment::Sealed { .. } => RefundRoute::EligibleSealedRoot,
    })
}

fn build_refund_claim(
    program: &FrozenRecoveryProgram,
    checkpoint: &FrozenCheckpoint,
    source: &DeploymentRefundSource,
    assignment: &RefundAssignment,
    route: RefundRoute,
) -> Result<RefundClaimParts, FrozenRecoveryError> {
    let source_leaf_hash = hash_encoded("DEPLOYMENT_REFUND_SOURCE_LEAF_V1", source);
    if route == RefundRoute::NoLiability {
        return Ok((
            DeploymentRefundDisposition {
                source_index: source.source_index,
                source_leaf_hash,
                has_liability: false,
                liability_id: Felt::ZERO,
                legs_hash: Felt::ZERO,
                aux_hash: Felt::ZERO,
                has_batch_assignment: false,
                batch_id: 0,
                leaf_index: 0,
            },
            None,
            None,
            vec![],
        ));
    }
    let liability_id = program.derive_refund_liability(source);
    let (has_batch_assignment, batch_id, leaf_index) = assignment_fields(assignment, liability_id)?;
    let aux = build_abort_refund_aux(source);
    let legs = vec![build_refund_leg(program, source)];
    let legs_hash = hash_payout_legs(&legs);
    let aux_hash = hash_encoded("ABORT_REFUND_AUX_V1", &aux);
    let terminal_refund_source_hash = Felt::ZERO;
    let claim = FrozenDeploymentRefundClaim {
        deployment_id: checkpoint.deployment_id,
        frozen_checkpoint_hash: checkpoint.checkpoint_hash,
        terminal_refund_source_hash,
        source_index: source.source_index,
        liability_id,
        recipient_l1: source.refund_recipient_l1,
        legs_hash,
        aux_hash,
    };
    Ok((
        DeploymentRefundDisposition {
            source_index: source.source_index,
            source_leaf_hash,
            has_liability: true,
            liability_id,
            legs_hash,
            aux_hash,
            has_batch_assignment,
            batch_id,
            leaf_index,
        },
        Some(claim),
        Some(aux),
        legs,
    ))
}

type RefundClaimParts = (
    DeploymentRefundDisposition,
    Option<FrozenDeploymentRefundClaim>,
    Option<AbortRefundAux>,
    Vec<ClaimLeg>,
);

fn assignment_fields(
    assignment: &RefundAssignment,
    expected_liability_id: Felt,
) -> Result<(bool, u64, u8), FrozenRecoveryError> {
    match assignment {
        RefundAssignment::None => Ok((false, 0, 0)),
        RefundAssignment::Open {
            batch_id,
            leaf_index,
            liability_id,
        }
        | RefundAssignment::Sealed {
            batch_id,
            leaf_index,
            liability_id,
        } if *liability_id == expected_liability_id => Ok((true, *batch_id, *leaf_index)),
        _ => Err(FrozenRecoveryError::Assignment),
    }
}

fn build_abort_refund_aux(source: &DeploymentRefundSource) -> AbortRefundAux {
    AbortRefundAux {
        source_ingress_or_pool_id: source.source_ingress_or_pool_id,
        funding_source_id: source.funding_source_id,
        disposition_epoch: source.disposition_epoch,
        refund_kind: source.refund_kind,
        refund_policy_hash: source.refund_policy_hash,
        unused_amount: source.refundable_total,
    }
}

fn build_refund_leg(program: &FrozenRecoveryProgram, source: &DeploymentRefundSource) -> ClaimLeg {
    ClaimLeg {
        asset_mode: source.parent_key.asset_mode,
        asset_id: source.parent_key.asset_id,
        backing_pool_id: source.parent_key.backing_pool_id,
        recipient: source.refund_recipient_l1,
        amount_or_token_id: source.refundable_total,
        policy_key: program.abort_refund_purpose,
    }
}

fn build_frozen_recovery_summary(
    witness: &FrozenRecoveryWitness,
    rows: &[FrozenRefundRow],
) -> Result<FrozenRecoverySummary, FrozenRecoveryError> {
    let sources = rows
        .iter()
        .map(|row| row.source.clone())
        .collect::<Vec<_>>();
    let dispositions = rows
        .iter()
        .map(|row| row.disposition.clone())
        .collect::<Vec<_>>();
    let deployment_refunds = DeploymentRefundCommitment {
        source_count: sources.len() as u16,
        physical_refund_source_count: sources
            .iter()
            .filter(|source| !is_nonphysical(source))
            .count() as u16,
        sources_hash: hash_refund_sources(&sources),
        sources_root: refund_sources_root(&sources)?,
        game_return_count: witness.game_lots.len() as u16,
        game_returns_hash: hash_game_returns(&witness.game_lots)?,
        source_cursor: sources.len() as u16,
        disposition_count: dispositions.len() as u16,
        refund_liability_count: dispositions.iter().filter(|row| row.has_liability).count() as u16,
        refund_liabilities_hash: hash_refund_dispositions(&dispositions),
        refund_liabilities_root: refund_dispositions_root(&dispositions)?,
    };
    let checkpoint = &witness.checkpoint;
    let summary = FrozenRecoverySummary {
        deployment_id: checkpoint.deployment_id,
        frozen_checkpoint_hash: checkpoint.checkpoint_hash,
        final_inbox_cursor: checkpoint.inbox_cursor,
        final_outbox_cursor: checkpoint.outbox_cursor,
        has_final_outbox_batch: checkpoint.has_final_outbox_batch,
        final_outbox_batch_id: checkpoint.final_outbox_batch_id,
        cumulative_outbox_totals_hash: checkpoint.cumulative_outbox_totals_hash,
        active_exit_totals_hash: checkpoint.active_exit_totals_hash,
        index_high_watermarks_hash: checkpoint.index_high_watermarks_hash,
        remaining_quotas_hash: checkpoint.remaining_quotas_hash,
        unsealed_ingress_activations_hash: checkpoint.unsealed_ingress_activations_hash,
        unsealed_ingress_activation_count: checkpoint.unsealed_ingress_activation_count,
        unsealed_control_acks_hash: checkpoint.unsealed_control_acks_hash,
        unsealed_control_ack_count: checkpoint.unsealed_control_ack_count,
        lifecycle_commitment: checkpoint.lifecycle_commitment,
        deployment_refunds,
    };
    Ok(summary)
}

fn bind_terminal_refund_source_hash(
    rows: &mut [FrozenRefundRow],
    terminal_refund_source_hash: Felt,
) {
    for claim in rows.iter_mut().filter_map(|row| row.claim.as_mut()) {
        claim.terminal_refund_source_hash = terminal_refund_source_hash;
    }
}

fn build_journal(
    program: &FrozenRecoveryProgram,
    witness: &FrozenRecoveryWitness,
    summary: &FrozenRecoverySummary,
    rows: &[FrozenRefundRow],
) -> Result<FrozenRecoveryJournal, FrozenRecoveryError> {
    let sources = rows
        .iter()
        .map(|row| row.source.clone())
        .collect::<Vec<_>>();
    let dispositions = rows
        .iter()
        .map(|row| row.disposition.clone())
        .collect::<Vec<_>>();
    Ok(FrozenRecoveryJournal {
        program_hash: hash_program(program),
        state_root: witness.checkpoint.state_root,
        summary_hash: hash_frozen_recovery_summary(summary),
        sources_hash: hash_refund_sources(&sources),
        dispositions_hash: hash_refund_dispositions(&dispositions),
        game_returns_hash: hash_game_returns(&witness.game_lots)?,
        routes_hash: hash_refund_routes(rows),
    })
}

pub fn hash_refund_dispositions(dispositions: &[DeploymentRefundDisposition]) -> Felt {
    hash_counted_encoded_list(
        "DEPLOYMENT_REFUND_DISPOSITIONS_V1",
        "DEPLOYMENT_REFUND_DISPOSITION_LEAF_V1",
        dispositions,
    )
}

pub fn refund_dispositions_root(
    dispositions: &[DeploymentRefundDisposition],
) -> Result<Felt, FrozenRecoveryError> {
    refund_tree(
        "DEPLOYMENT_REFUND_DISPOSITION_EMPTY_V1",
        "DEPLOYMENT_REFUND_DISPOSITION_NODE_V1",
    )?
    .root(
        &dispositions
            .iter()
            .map(|row| hash_encoded("DEPLOYMENT_REFUND_DISPOSITION_LEAF_V1", row))
            .collect::<Vec<_>>(),
    )
    .map_err(|_| FrozenRecoveryError::Tree)
}

pub fn hash_refund_routes(rows: &[FrozenRefundRow]) -> Felt {
    let mut preimage = vec![domain("FROZEN_REFUND_ROUTES_V1"), Felt::from(rows.len())];
    for row in rows {
        preimage.extend([
            Felt::from(row.source.source_index),
            Felt::from(row.route as u8),
            hash_encoded("DEPLOYMENT_REFUND_DISPOSITION_LEAF_V1", &row.disposition),
            row.claim
                .as_ref()
                .map(|claim| hash_encoded("FROZEN_DEPLOYMENT_REFUND_CLAIM_V1", claim))
                .unwrap_or(Felt::ZERO),
        ]);
    }
    crate::poseidon_hash_many(&preimage)
}

fn hash_game_returns(lots: &[FrozenGameLotWitness]) -> Result<Felt, FrozenRecoveryError> {
    let mut preimage = vec![domain("FROZEN_GAME_RETURNS_V1"), Felt::from(lots.len())];
    for lot in lots {
        let normalized_return = checked_sub(
            lot.lot.allocated_total,
            checked_add(
                lot.lot.active_committed_total,
                lot.lot.cumulative_outbox_total,
            )?,
        )?;
        preimage.push(crate::poseidon_hash_many(&[
            domain("FROZEN_GAME_RETURN_V1"),
            lot.lot.game_id,
            Felt::from(lot.allocation_index),
            Felt::from(lot.lot.source_index),
            Felt::from(normalized_return.low),
            Felt::from(normalized_return.high),
            lot.terminal_state_hash,
        ]));
    }
    Ok(crate::poseidon_hash_many(&preimage))
}

fn hash_counted_encoded_list<T: CanonicalEncode>(
    list_domain: &str,
    leaf_domain: &str,
    values: &[T],
) -> Felt {
    let mut preimage = vec![domain(list_domain), Felt::from(values.len())];
    preimage.extend(values.iter().map(|value| hash_encoded(leaf_domain, value)));
    crate::poseidon_hash_many(&preimage)
}

fn refund_tree(
    empty_domain: &str,
    node_domain: &str,
) -> Result<FixedDepthTree, FrozenRecoveryError> {
    FixedDepthTree::new(REFUND_TREE_DEPTH, domain(empty_domain), domain(node_domain))
        .map_err(|_| FrozenRecoveryError::Tree)
}

fn hash_encoded(domain_name: &str, value: &impl CanonicalEncode) -> Felt {
    let mut preimage = vec![domain(domain_name)];
    preimage.extend(value.encode());
    crate::poseidon_hash_many(&preimage)
}

fn hash_program(program: &FrozenRecoveryProgram) -> Felt {
    crate::poseidon_hash_many(&[
        domain("FROZEN_RECOVERY_SUMMARY_V1"),
        program.deployment_id,
        program.checkpoint_hash,
        Felt::from(program.abort_refund_source_kind),
        program.abort_refund_purpose,
    ])
}

fn append_assignment(preimage: &mut Vec<Felt>, assignment: &RefundAssignment) {
    match assignment {
        RefundAssignment::None => preimage.push(Felt::ZERO),
        RefundAssignment::Open {
            batch_id,
            leaf_index,
            liability_id,
        } => preimage.extend([
            Felt::ONE,
            Felt::from(*batch_id),
            Felt::from(*leaf_index),
            *liability_id,
        ]),
        RefundAssignment::Sealed {
            batch_id,
            leaf_index,
            liability_id,
        } => preimage.extend([
            Felt::TWO,
            Felt::from(*batch_id),
            Felt::from(*leaf_index),
            *liability_id,
        ]),
    }
}

fn is_nonphysical(source: &DeploymentRefundSource) -> bool {
    source.provisioned_physical_total == zero()
}

fn checked_add(left: U256, right: U256) -> Result<U256, FrozenRecoveryError> {
    to_wide(left)
        .checked_add(to_wide(right))
        .map(from_wide)
        .ok_or(FrozenRecoveryError::Arithmetic)
}

fn checked_sub(left: U256, right: U256) -> Result<U256, FrozenRecoveryError> {
    to_wide(left)
        .checked_sub(to_wide(right))
        .map(from_wide)
        .ok_or(FrozenRecoveryError::Arithmetic)
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

fn zero() -> U256 {
    U256 { low: 0, high: 0 }
}

fn domain(name: &str) -> Felt {
    let selector = crate::schema_vector::hash_domain_selector(name)
        .unwrap_or_else(|| panic!("unregistered frozen-recovery domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}
