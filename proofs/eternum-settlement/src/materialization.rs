use std::collections::BTreeMap;

use ruint::aliases::U256 as WideU256;
use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::frozen_position::hash_payout_legs;
use crate::frozen_recovery::{
    FrozenRecoveryJournal, FrozenRefundRow, RefundRoute, hash_frozen_recovery_journal,
    hash_frozen_recovery_summary, hash_refund_dispositions, hash_refund_routes,
    hash_refund_sources, refund_dispositions_root, refund_sources_root,
};
use crate::protocol_hash::{domain, hash_encoded};
use crate::tree::FixedDepthTree;
use crate::types::{
    AbortRefundAux, BackingKey, BackingTotal, ClaimLeg, DeploymentRefundSource,
    DormantDeploymentRefundLeaf, FrozenDeploymentRefundClaim, FrozenRecoverySummary, U256,
    VerifiedMaterializationOutput,
};

pub const DEPLOYMENT_REFUND_SOURCE_FAMILY: u16 = u16::MAX;
const CHUNK_SIZE: u64 = 64;
const CHUNK_TREE_DEPTH: u8 = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MaterializationCoordinates {
    pub chunk_index: u64,
    pub start_index: u64,
    pub item_count: u8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentRefundMaterializationProgram {
    pub deployment_id: Felt,
    pub frozen_checkpoint_hash: Felt,
    pub index_family: u16,
    pub abort_refund_purpose: Felt,
}

impl DeploymentRefundMaterializationProgram {
    pub fn reference_v1() -> Self {
        Self {
            deployment_id: Felt::from(11_u8),
            frozen_checkpoint_hash: Felt::from(300_u16),
            index_family: DEPLOYMENT_REFUND_SOURCE_FAMILY,
            abort_refund_purpose: Felt::from(620_u16),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentRefundMaterializationWitness {
    pub summary: FrozenRecoverySummary,
    pub rows: Vec<FrozenRefundRow>,
    pub coordinates: MaterializationCoordinates,
    pub registered_terminal_refund_source_hash: Felt,
    pub recovery_journal: FrozenRecoveryJournal,
    pub verified_recovery_journal_hash: Felt,
    pub claimed_leaves: Vec<DormantDeploymentRefundLeaf>,
    pub expected_chunk_root: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentRefundMaterializedRow {
    pub leaf: DormantDeploymentRefundLeaf,
    pub claim: FrozenDeploymentRefundClaim,
    pub source: DeploymentRefundSource,
    pub aux: AbortRefundAux,
    pub legs: Vec<ClaimLeg>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentRefundMaterializationJournal {
    pub program_hash: Felt,
    pub terminal_refund_source_hash: Felt,
    pub recovery_journal_hash: Felt,
    pub verified_output_hash: Felt,
    pub chunk_root: Felt,
    pub live_preimages_hash: Felt,
    pub live_totals_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentRefundMaterializationOutput {
    pub verified: VerifiedMaterializationOutput,
    pub leaves: Vec<DormantDeploymentRefundLeaf>,
    pub rows: Vec<DeploymentRefundMaterializedRow>,
    pub parent_totals: Vec<BackingTotal>,
    pub journal: DeploymentRefundMaterializationJournal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeploymentRefundMaterializationError {
    Program,
    Summary,
    RecoveryReceipt,
    Coordinates,
    Source,
    Route,
    Claim,
    Aux,
    Legs,
    Leaf,
    ChunkRoot,
    Arithmetic,
    Tree,
}

pub fn execute_deployment_refund_materialization(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
) -> Result<DeploymentRefundMaterializationOutput, DeploymentRefundMaterializationError> {
    validate_program_summary(program, witness)?;
    validate_recovery_receipt(witness)?;
    validate_coordinates(
        witness.coordinates,
        witness.summary.deployment_refunds.source_count,
    )?;
    validate_normalized_commitments(witness)?;
    let leaves = derive_deployment_refund_leaves(
        program,
        &witness.summary,
        &witness.rows,
        witness.coordinates,
    )?;
    if leaves != witness.claimed_leaves {
        return Err(DeploymentRefundMaterializationError::Leaf);
    }
    let chunk_root = deployment_refund_chunk_root(&leaves)?;
    if chunk_root != witness.expected_chunk_root {
        return Err(DeploymentRefundMaterializationError::ChunkRoot);
    }
    let rows = collect_live_rows(program, witness, &leaves)?;
    let parent_totals = derive_live_parent_totals(program, &rows)?;
    let verified =
        build_verified_output(program, witness, &leaves, &rows, &parent_totals, chunk_root);
    let journal = build_journal(program, witness, &verified, chunk_root);
    Ok(DeploymentRefundMaterializationOutput {
        verified,
        leaves,
        rows,
        parent_totals,
        journal,
    })
}

pub fn materialization_coordinates(
    exclusive_high_watermark: u64,
) -> Result<Vec<MaterializationCoordinates>, DeploymentRefundMaterializationError> {
    if exclusive_high_watermark == 0 {
        return Ok(Vec::new());
    }
    let chunk_count = exclusive_high_watermark
        .checked_add(CHUNK_SIZE - 1)
        .ok_or(DeploymentRefundMaterializationError::Coordinates)?
        / CHUNK_SIZE;
    (0..chunk_count)
        .map(|chunk_index| {
            let start_index = chunk_index
                .checked_mul(CHUNK_SIZE)
                .ok_or(DeploymentRefundMaterializationError::Coordinates)?;
            let item_count = (exclusive_high_watermark - start_index).min(CHUNK_SIZE) as u8;
            Ok(MaterializationCoordinates {
                chunk_index,
                start_index,
                item_count,
            })
        })
        .collect()
}

pub fn derive_deployment_refund_leaves(
    program: &DeploymentRefundMaterializationProgram,
    summary: &FrozenRecoverySummary,
    rows: &[FrozenRefundRow],
    coordinates: MaterializationCoordinates,
) -> Result<Vec<DormantDeploymentRefundLeaf>, DeploymentRefundMaterializationError> {
    validate_coordinates(coordinates, summary.deployment_refunds.source_count)?;
    let terminal_refund_source_hash = hash_frozen_recovery_summary(summary);
    let start = usize::try_from(coordinates.start_index)
        .map_err(|_| DeploymentRefundMaterializationError::Coordinates)?;
    let end = start + usize::from(coordinates.item_count);
    rows.get(start..end)
        .ok_or(DeploymentRefundMaterializationError::Coordinates)?
        .iter()
        .enumerate()
        .map(|(leaf_index, row)| {
            build_dormant_refund_leaf(
                program,
                terminal_refund_source_hash,
                coordinates,
                leaf_index as u8,
                row,
            )
        })
        .collect()
}

pub fn deployment_refund_chunk_root(
    leaves: &[DormantDeploymentRefundLeaf],
) -> Result<Felt, DeploymentRefundMaterializationError> {
    materialization_tree()?
        .root(
            &leaves
                .iter()
                .map(hash_dormant_deployment_refund_leaf)
                .collect::<Vec<_>>(),
        )
        .map_err(|_| DeploymentRefundMaterializationError::Tree)
}

pub fn hash_deployment_refund_materialization_journal(
    journal: &DeploymentRefundMaterializationJournal,
) -> Felt {
    crate::poseidon_hash_many(&[
        domain("DEPLOYMENT_REFUND_MATERIALIZATION_JOURNAL_V1"),
        journal.program_hash,
        journal.terminal_refund_source_hash,
        journal.recovery_journal_hash,
        journal.verified_output_hash,
        journal.chunk_root,
        journal.live_preimages_hash,
        journal.live_totals_hash,
    ])
}

fn validate_program_summary(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
) -> Result<(), DeploymentRefundMaterializationError> {
    if program.index_family != DEPLOYMENT_REFUND_SOURCE_FAMILY
        || witness.summary.deployment_id != program.deployment_id
        || witness.summary.frozen_checkpoint_hash != program.frozen_checkpoint_hash
    {
        return Err(DeploymentRefundMaterializationError::Program);
    }
    let terminal_hash = hash_frozen_recovery_summary(&witness.summary);
    if terminal_hash != witness.registered_terminal_refund_source_hash
        || witness.summary.deployment_refunds.source_count == 0
        || witness.summary.deployment_refunds.source_cursor
            != witness.summary.deployment_refunds.source_count
        || witness.summary.deployment_refunds.disposition_count
            != witness.summary.deployment_refunds.source_count
        || witness.rows.len() != usize::from(witness.summary.deployment_refunds.source_count)
    {
        return Err(DeploymentRefundMaterializationError::Summary);
    }
    Ok(())
}

fn validate_recovery_receipt(
    witness: &DeploymentRefundMaterializationWitness,
) -> Result<(), DeploymentRefundMaterializationError> {
    if hash_frozen_recovery_journal(&witness.recovery_journal)
        != witness.verified_recovery_journal_hash
        || witness.recovery_journal.summary_hash != hash_frozen_recovery_summary(&witness.summary)
        || witness.recovery_journal.routes_hash != hash_refund_routes(&witness.rows)
    {
        return Err(DeploymentRefundMaterializationError::RecoveryReceipt);
    }
    Ok(())
}

fn validate_coordinates(
    coordinates: MaterializationCoordinates,
    exclusive_high_watermark: u16,
) -> Result<(), DeploymentRefundMaterializationError> {
    let expected = materialization_coordinates(u64::from(exclusive_high_watermark))?
        .get(
            usize::try_from(coordinates.chunk_index)
                .map_err(|_| DeploymentRefundMaterializationError::Coordinates)?,
        )
        .copied()
        .ok_or(DeploymentRefundMaterializationError::Coordinates)?;
    if coordinates != expected {
        return Err(DeploymentRefundMaterializationError::Coordinates);
    }
    Ok(())
}

fn validate_normalized_commitments(
    witness: &DeploymentRefundMaterializationWitness,
) -> Result<(), DeploymentRefundMaterializationError> {
    let sources = witness
        .rows
        .iter()
        .map(|row| row.source.clone())
        .collect::<Vec<_>>();
    let dispositions = witness
        .rows
        .iter()
        .map(|row| row.disposition.clone())
        .collect::<Vec<_>>();
    let commitment = &witness.summary.deployment_refunds;
    if commitment.sources_hash != hash_refund_sources(&sources)
        || commitment.sources_root
            != refund_sources_root(&sources)
                .map_err(|_| DeploymentRefundMaterializationError::Tree)?
        || commitment.refund_liabilities_hash != hash_refund_dispositions(&dispositions)
        || commitment.refund_liabilities_root
            != refund_dispositions_root(&dispositions)
                .map_err(|_| DeploymentRefundMaterializationError::Tree)?
    {
        return Err(DeploymentRefundMaterializationError::Summary);
    }
    Ok(())
}

fn build_dormant_refund_leaf(
    program: &DeploymentRefundMaterializationProgram,
    terminal_refund_source_hash: Felt,
    coordinates: MaterializationCoordinates,
    leaf_index: u8,
    row: &FrozenRefundRow,
) -> Result<DormantDeploymentRefundLeaf, DeploymentRefundMaterializationError> {
    let tombstone = matches!(
        row.route,
        RefundRoute::NoLiability | RefundRoute::EligibleSealedRoot
    );
    let (refund_claim_hash, source_hash, legs_hash, aux_hash) = if tombstone {
        validate_tombstone_row(row)?;
        (Felt::ZERO, Felt::ZERO, Felt::ZERO, Felt::ZERO)
    } else {
        validate_live_row(program, terminal_refund_source_hash, row)?
    };
    Ok(DormantDeploymentRefundLeaf {
        deployment_id: program.deployment_id,
        frozen_checkpoint_hash: program.frozen_checkpoint_hash,
        terminal_refund_source_hash,
        source_index: row.source.source_index,
        chunk_index: coordinates.chunk_index as u8,
        leaf_index,
        tombstone,
        refund_claim_hash,
        source_hash,
        legs_hash,
        aux_hash,
    })
}

fn validate_tombstone_row(
    row: &FrozenRefundRow,
) -> Result<(), DeploymentRefundMaterializationError> {
    match row.route {
        RefundRoute::NoLiability
            if row.claim.is_none()
                && row.aux.is_none()
                && row.legs.is_empty()
                && !row.disposition.has_liability =>
        {
            Ok(())
        }
        RefundRoute::EligibleSealedRoot
            if row.claim.is_some()
                && row.aux.is_some()
                && !row.legs.is_empty()
                && row.disposition.has_liability
                && row.disposition.has_batch_assignment =>
        {
            Ok(())
        }
        _ => Err(DeploymentRefundMaterializationError::Route),
    }
}

fn validate_live_row(
    program: &DeploymentRefundMaterializationProgram,
    terminal_refund_source_hash: Felt,
    row: &FrozenRefundRow,
) -> Result<(Felt, Felt, Felt, Felt), DeploymentRefundMaterializationError> {
    if !matches!(
        row.route,
        RefundRoute::OpenAssignedFrozen | RefundRoute::UnappendedFrozen
    ) || !row.disposition.has_liability
    {
        return Err(DeploymentRefundMaterializationError::Route);
    }
    let claim = row
        .claim
        .as_ref()
        .ok_or(DeploymentRefundMaterializationError::Claim)?;
    let aux = row
        .aux
        .as_ref()
        .ok_or(DeploymentRefundMaterializationError::Aux)?;
    validate_claim_source_aux_and_legs(
        program,
        terminal_refund_source_hash,
        claim,
        &row.source,
        aux,
        &row.legs,
    )?;
    Ok((
        hash_encoded("FROZEN_DEPLOYMENT_REFUND_CLAIM_V1", claim),
        hash_encoded("DEPLOYMENT_REFUND_SOURCE_LEAF_V1", &row.source),
        hash_payout_legs(&row.legs),
        hash_encoded("ABORT_REFUND_AUX_V1", aux),
    ))
}

fn validate_claim_source_aux_and_legs(
    program: &DeploymentRefundMaterializationProgram,
    terminal_refund_source_hash: Felt,
    claim: &FrozenDeploymentRefundClaim,
    source: &DeploymentRefundSource,
    aux: &AbortRefundAux,
    legs: &[ClaimLeg],
) -> Result<(), DeploymentRefundMaterializationError> {
    if claim.deployment_id != program.deployment_id
        || claim.frozen_checkpoint_hash != program.frozen_checkpoint_hash
        || claim.terminal_refund_source_hash != terminal_refund_source_hash
        || claim.source_index != source.source_index
        || claim.recipient_l1 != source.refund_recipient_l1
    {
        return Err(DeploymentRefundMaterializationError::Claim);
    }
    if aux.source_ingress_or_pool_id != source.source_ingress_or_pool_id
        || aux.funding_source_id != source.funding_source_id
        || aux.disposition_epoch != source.disposition_epoch
        || aux.refund_kind != source.refund_kind
        || aux.refund_policy_hash != source.refund_policy_hash
        || aux.unused_amount != source.refundable_total
        || claim.aux_hash != hash_encoded("ABORT_REFUND_AUX_V1", aux)
    {
        return Err(DeploymentRefundMaterializationError::Aux);
    }
    let [leg] = legs else {
        return Err(DeploymentRefundMaterializationError::Legs);
    };
    if leg.asset_mode != source.parent_key.asset_mode
        || leg.asset_id != source.parent_key.asset_id
        || leg.backing_pool_id != source.parent_key.backing_pool_id
        || leg.recipient != source.refund_recipient_l1
        || leg.amount_or_token_id != source.refundable_total
        || leg.policy_key != program.abort_refund_purpose
        || claim.legs_hash != hash_payout_legs(legs)
    {
        return Err(DeploymentRefundMaterializationError::Legs);
    }
    Ok(())
}

fn collect_live_rows(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
    leaves: &[DormantDeploymentRefundLeaf],
) -> Result<Vec<DeploymentRefundMaterializedRow>, DeploymentRefundMaterializationError> {
    let start = witness.coordinates.start_index as usize;
    leaves
        .iter()
        .zip(&witness.rows[start..start + leaves.len()])
        .filter(|(leaf, _)| !leaf.tombstone)
        .map(|(leaf, row)| {
            let claim = row
                .claim
                .clone()
                .ok_or(DeploymentRefundMaterializationError::Claim)?;
            let aux = row
                .aux
                .clone()
                .ok_or(DeploymentRefundMaterializationError::Aux)?;
            validate_claim_source_aux_and_legs(
                program,
                witness.registered_terminal_refund_source_hash,
                &claim,
                &row.source,
                &aux,
                &row.legs,
            )?;
            Ok(DeploymentRefundMaterializedRow {
                leaf: leaf.clone(),
                claim,
                source: row.source.clone(),
                aux,
                legs: row.legs.clone(),
            })
        })
        .collect()
}

fn derive_live_parent_totals(
    program: &DeploymentRefundMaterializationProgram,
    rows: &[DeploymentRefundMaterializedRow],
) -> Result<Vec<BackingTotal>, DeploymentRefundMaterializationError> {
    let mut totals = BTreeMap::<(Felt, Felt, u8, u32, Felt), WideU256>::new();
    for row in rows {
        for leg in &row.legs {
            if leg.policy_key != program.abort_refund_purpose {
                return Err(DeploymentRefundMaterializationError::Legs);
            }
            let key = (
                program.deployment_id,
                Felt::ZERO,
                leg.asset_mode,
                leg.asset_id,
                leg.backing_pool_id,
            );
            let next = totals
                .get(&key)
                .copied()
                .unwrap_or(WideU256::ZERO)
                .checked_add(to_wide(leg.amount_or_token_id))
                .ok_or(DeploymentRefundMaterializationError::Arithmetic)?;
            totals.insert(key, next);
        }
    }
    Ok(totals
        .into_iter()
        .map(|(key, amount_or_quota)| BackingTotal {
            key: BackingKey {
                deployment_id: key.0,
                game_id: key.1,
                asset_mode: key.2,
                asset_id: key.3,
                backing_pool_id: key.4,
            },
            amount_or_quota: from_wide(amount_or_quota),
        })
        .collect())
}

fn build_verified_output(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
    leaves: &[DormantDeploymentRefundLeaf],
    rows: &[DeploymentRefundMaterializedRow],
    parent_totals: &[BackingTotal],
    chunk_root: Felt,
) -> VerifiedMaterializationOutput {
    VerifiedMaterializationOutput {
        deployment_id: program.deployment_id,
        frozen_checkpoint_hash: program.frozen_checkpoint_hash,
        game_id: Felt::ZERO,
        index_family: program.index_family,
        chunk_index: witness.coordinates.chunk_index,
        item_count: witness.coordinates.item_count,
        items_hash: hash_items(leaves),
        chunk_root,
        live_liability_count: rows.len() as u8,
        live_preimages_hash: hash_live_preimages(rows),
        live_totals_hash: hash_live_totals(parent_totals),
    }
}

fn build_journal(
    program: &DeploymentRefundMaterializationProgram,
    witness: &DeploymentRefundMaterializationWitness,
    verified: &VerifiedMaterializationOutput,
    chunk_root: Felt,
) -> DeploymentRefundMaterializationJournal {
    DeploymentRefundMaterializationJournal {
        program_hash: hash_program(program),
        terminal_refund_source_hash: witness.registered_terminal_refund_source_hash,
        recovery_journal_hash: witness.verified_recovery_journal_hash,
        verified_output_hash: hash_encoded("DEPLOYMENT_REFUND_MATERIALIZATION_OUTPUT_V1", verified),
        chunk_root,
        live_preimages_hash: verified.live_preimages_hash,
        live_totals_hash: verified.live_totals_hash,
    }
}

fn hash_items(leaves: &[DormantDeploymentRefundLeaf]) -> Felt {
    let mut preimage = vec![
        domain("DORMANT_DEPLOYMENT_REFUND_ITEMS_V1"),
        Felt::from(leaves.len()),
    ];
    preimage.extend(leaves.iter().map(hash_dormant_deployment_refund_leaf));
    crate::poseidon_hash_many(&preimage)
}

fn hash_live_preimages(rows: &[DeploymentRefundMaterializedRow]) -> Felt {
    let mut preimage = vec![
        domain("DORMANT_DEPLOYMENT_REFUND_PREIMAGES_V1"),
        Felt::from(rows.len()),
    ];
    for row in rows {
        preimage.push(crate::poseidon_hash_many(&[
            domain("DORMANT_DEPLOYMENT_REFUND_PREIMAGE_V1"),
            hash_dormant_deployment_refund_leaf(&row.leaf),
            hash_encoded("FROZEN_DEPLOYMENT_REFUND_CLAIM_V1", &row.claim),
            hash_encoded("DEPLOYMENT_REFUND_SOURCE_LEAF_V1", &row.source),
            hash_encoded("ABORT_REFUND_AUX_V1", &row.aux),
            hash_payout_legs(&row.legs),
        ]));
    }
    crate::poseidon_hash_many(&preimage)
}

fn hash_live_totals(totals: &[BackingTotal]) -> Felt {
    let mut preimage = vec![
        domain("MATERIALIZED_LIVE_TOTALS_V1"),
        Felt::from(totals.len()),
    ];
    for total in totals {
        preimage.extend(total.encode());
    }
    crate::poseidon_hash_many(&preimage)
}

fn hash_dormant_deployment_refund_leaf(leaf: &DormantDeploymentRefundLeaf) -> Felt {
    hash_encoded("DORMANT_DEPLOYMENT_REFUND_LEAF_V1", leaf)
}

fn materialization_tree() -> Result<FixedDepthTree, DeploymentRefundMaterializationError> {
    FixedDepthTree::new(
        CHUNK_TREE_DEPTH,
        domain("DORMANT_DEPLOYMENT_REFUND_EMPTY_V1"),
        domain("DORMANT_DEPLOYMENT_REFUND_NODE_V1"),
    )
    .map_err(|_| DeploymentRefundMaterializationError::Tree)
}

fn hash_program(program: &DeploymentRefundMaterializationProgram) -> Felt {
    crate::poseidon_hash_many(&[
        domain("DEPLOYMENT_REFUND_MATERIALIZATION_OUTPUT_V1"),
        program.deployment_id,
        program.frozen_checkpoint_hash,
        Felt::from(program.index_family),
        program.abort_refund_purpose,
    ])
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
