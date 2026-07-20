use std::collections::BTreeMap;

use ruint::aliases::U256 as WideU256;
use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::frozen_position::{
    FrozenPositionError, FrozenPositionProgram, FrozenPositionWitness, execute_frozen_position,
    hash_exit_claim, hash_payout_legs,
};
use crate::materialization::{MaterializationCoordinates, materialization_coordinates};
use crate::tree::FixedDepthTree;
use crate::types::{
    BackingKey, BackingTotal, ClaimLeg, DormantExitLeaf, ExitClaim, U256,
    VerifiedMaterializationOutput,
};

const CHUNK_TREE_DEPTH: u8 = 6;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionMaterializationProgram {
    pub frozen_position: FrozenPositionProgram,
    pub frozen_checkpoint_hash: Felt,
    pub frozen_block_number: u64,
    pub final_outbox_cursor: u64,
    pub exclusive_high_watermark: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TombstonePositionWitness {
    pub source_index: u64,
    pub authenticated_empty_slot_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PositionSlotWitness {
    Tombstone(TombstonePositionWitness),
    Live(Box<FrozenPositionWitness>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionMaterializationWitness {
    pub coordinates: MaterializationCoordinates,
    pub slots: Vec<PositionSlotWitness>,
    pub claimed_leaves: Vec<DormantExitLeaf>,
    pub expected_chunk_root: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionMaterializedRow {
    pub leaf: DormantExitLeaf,
    pub claim: ExitClaim,
    pub legs: Vec<ClaimLeg>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionMaterializationJournal {
    pub program_hash: Felt,
    pub verified_output_hash: Felt,
    pub chunk_root: Felt,
    pub live_preimages_hash: Felt,
    pub live_totals_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionMaterializationOutput {
    pub verified: VerifiedMaterializationOutput,
    pub leaves: Vec<DormantExitLeaf>,
    pub rows: Vec<PositionMaterializedRow>,
    pub parent_totals: Vec<BackingTotal>,
    pub journal: PositionMaterializationJournal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PositionMaterializationError {
    Program,
    Coordinates,
    Tombstone,
    Position,
    Leaf,
    ChunkRoot,
    Arithmetic,
    Tree,
}

pub fn execute_position_materialization(
    program: &PositionMaterializationProgram,
    witness: &PositionMaterializationWitness,
) -> Result<PositionMaterializationOutput, PositionMaterializationError> {
    validate_program(program)?;
    validate_coordinates(program, witness)?;
    let derived = derive_position_rows(program, &witness.slots, witness.coordinates)?;
    let leaves = derived
        .iter()
        .map(|row| row.leaf().clone())
        .collect::<Vec<_>>();
    if leaves != witness.claimed_leaves {
        return Err(PositionMaterializationError::Leaf);
    }
    let chunk_root = position_chunk_root(&leaves)?;
    if chunk_root != witness.expected_chunk_root {
        return Err(PositionMaterializationError::ChunkRoot);
    }
    let rows = derived
        .into_iter()
        .filter_map(DerivedPositionRow::into_live)
        .collect::<Vec<_>>();
    let parent_totals = derive_parent_totals(program, &rows)?;
    let verified =
        build_verified_output(program, witness, &leaves, &rows, &parent_totals, chunk_root);
    let journal = build_journal(program, &verified, chunk_root);
    Ok(PositionMaterializationOutput {
        verified,
        leaves,
        rows,
        parent_totals,
        journal,
    })
}

pub fn derive_position_leaves(
    program: &PositionMaterializationProgram,
    slots: &[PositionSlotWitness],
    coordinates: MaterializationCoordinates,
) -> Result<Vec<DormantExitLeaf>, PositionMaterializationError> {
    validate_coordinate_value(program, coordinates)?;
    derive_position_rows(program, slots, coordinates).map(|rows| {
        rows.into_iter()
            .map(DerivedPositionRow::into_leaf)
            .collect()
    })
}

pub fn position_chunk_root(
    leaves: &[DormantExitLeaf],
) -> Result<Felt, PositionMaterializationError> {
    position_tree()?
        .root(
            &leaves
                .iter()
                .map(hash_dormant_exit_leaf)
                .collect::<Vec<_>>(),
        )
        .map_err(|_| PositionMaterializationError::Tree)
}

pub fn hash_tombstone_reference_slot(
    program: &PositionMaterializationProgram,
    source_index: u64,
) -> Felt {
    crate::poseidon_hash_many(&[
        domain("DORMANT_POSITION_TOMBSTONE_REFERENCE_V1"),
        hash_program(program),
        Felt::from(source_index),
    ])
}

pub fn hash_position_materialization_journal(journal: &PositionMaterializationJournal) -> Felt {
    crate::poseidon_hash_many(&[
        domain("POSITION_MATERIALIZATION_JOURNAL_V1"),
        journal.program_hash,
        journal.verified_output_hash,
        journal.chunk_root,
        journal.live_preimages_hash,
        journal.live_totals_hash,
    ])
}

enum DerivedPositionRow {
    Tombstone(DormantExitLeaf),
    Live(Box<PositionMaterializedRow>),
}

impl DerivedPositionRow {
    fn leaf(&self) -> &DormantExitLeaf {
        match self {
            Self::Tombstone(leaf) => leaf,
            Self::Live(row) => &row.leaf,
        }
    }

    fn into_leaf(self) -> DormantExitLeaf {
        match self {
            Self::Tombstone(leaf) => leaf,
            Self::Live(row) => row.leaf,
        }
    }

    fn into_live(self) -> Option<PositionMaterializedRow> {
        match self {
            Self::Tombstone(_) => None,
            Self::Live(row) => Some(*row),
        }
    }
}

fn validate_program(
    program: &PositionMaterializationProgram,
) -> Result<(), PositionMaterializationError> {
    if program.frozen_position.game_id == Felt::ZERO
        || program.frozen_position.position_family == u16::MAX
        || program.exclusive_high_watermark == 0
    {
        return Err(PositionMaterializationError::Program);
    }
    Ok(())
}

fn validate_coordinates(
    program: &PositionMaterializationProgram,
    witness: &PositionMaterializationWitness,
) -> Result<(), PositionMaterializationError> {
    validate_coordinate_value(program, witness.coordinates)?;
    if witness.slots.len() != usize::from(witness.coordinates.item_count)
        || witness.claimed_leaves.len() != witness.slots.len()
    {
        return Err(PositionMaterializationError::Coordinates);
    }
    Ok(())
}

fn validate_coordinate_value(
    program: &PositionMaterializationProgram,
    coordinates: MaterializationCoordinates,
) -> Result<(), PositionMaterializationError> {
    let expected = materialization_coordinates(program.exclusive_high_watermark)
        .map_err(|_| PositionMaterializationError::Coordinates)?
        .get(
            usize::try_from(coordinates.chunk_index)
                .map_err(|_| PositionMaterializationError::Coordinates)?,
        )
        .copied()
        .ok_or(PositionMaterializationError::Coordinates)?;
    if coordinates != expected {
        return Err(PositionMaterializationError::Coordinates);
    }
    Ok(())
}

fn derive_position_rows(
    program: &PositionMaterializationProgram,
    slots: &[PositionSlotWitness],
    coordinates: MaterializationCoordinates,
) -> Result<Vec<DerivedPositionRow>, PositionMaterializationError> {
    if slots.len() != usize::from(coordinates.item_count) {
        return Err(PositionMaterializationError::Coordinates);
    }
    slots
        .iter()
        .enumerate()
        .map(|(leaf_index, slot)| {
            let source_index = coordinates.start_index + leaf_index as u64;
            derive_position_row(program, coordinates, leaf_index as u8, source_index, slot)
        })
        .collect()
}

fn derive_position_row(
    program: &PositionMaterializationProgram,
    coordinates: MaterializationCoordinates,
    leaf_index: u8,
    source_index: u64,
    slot: &PositionSlotWitness,
) -> Result<DerivedPositionRow, PositionMaterializationError> {
    match slot {
        PositionSlotWitness::Tombstone(tombstone) => {
            if tombstone.source_index != source_index
                || tombstone.authenticated_empty_slot_hash
                    != hash_tombstone_reference_slot(program, source_index)
            {
                return Err(PositionMaterializationError::Tombstone);
            }
            Ok(DerivedPositionRow::Tombstone(build_leaf(
                program,
                coordinates,
                leaf_index,
                source_index,
                true,
                Felt::ZERO,
                Felt::ZERO,
            )))
        }
        PositionSlotWitness::Live(position) => {
            validate_live_position_identity(program, position, source_index)?;
            let output = execute_frozen_position(&program.frozen_position, position)
                .map_err(map_position_error)?;
            let leaf = build_leaf(
                program,
                coordinates,
                leaf_index,
                source_index,
                false,
                hash_exit_claim(&output.claim),
                hash_payout_legs(&output.legs),
            );
            Ok(DerivedPositionRow::Live(Box::new(
                PositionMaterializedRow {
                    leaf,
                    claim: output.claim,
                    legs: output.legs,
                },
            )))
        }
    }
}

fn validate_live_position_identity(
    program: &PositionMaterializationProgram,
    position: &FrozenPositionWitness,
    source_index: u64,
) -> Result<(), PositionMaterializationError> {
    if position.position_id != source_index
        || position.frozen_block_number != program.frozen_block_number
        || position.final_outbox_cursor != program.final_outbox_cursor
    {
        return Err(PositionMaterializationError::Position);
    }
    Ok(())
}

fn map_position_error(_: FrozenPositionError) -> PositionMaterializationError {
    PositionMaterializationError::Position
}

fn build_leaf(
    program: &PositionMaterializationProgram,
    coordinates: MaterializationCoordinates,
    leaf_index: u8,
    source_index: u64,
    tombstone: bool,
    exit_claim_hash: Felt,
    legs_hash: Felt,
) -> DormantExitLeaf {
    DormantExitLeaf {
        deployment_id: program.frozen_position.deployment_id,
        frozen_checkpoint_hash: program.frozen_checkpoint_hash,
        game_id: program.frozen_position.game_id,
        index_family: program.frozen_position.position_family,
        source_index,
        chunk_index: coordinates.chunk_index,
        leaf_index,
        tombstone,
        exit_claim_hash,
        legs_hash,
    }
}

fn derive_parent_totals(
    program: &PositionMaterializationProgram,
    rows: &[PositionMaterializedRow],
) -> Result<Vec<BackingTotal>, PositionMaterializationError> {
    let mut totals = BTreeMap::<(Felt, Felt, u8, u32, Felt), WideU256>::new();
    for leg in rows.iter().flat_map(|row| &row.legs) {
        let key = (
            program.frozen_position.deployment_id,
            program.frozen_position.game_id,
            leg.asset_mode,
            leg.asset_id,
            leg.backing_pool_id,
        );
        let next = totals
            .get(&key)
            .copied()
            .unwrap_or(WideU256::ZERO)
            .checked_add(to_wide(leg.amount_or_token_id))
            .ok_or(PositionMaterializationError::Arithmetic)?;
        totals.insert(key, next);
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
    program: &PositionMaterializationProgram,
    witness: &PositionMaterializationWitness,
    leaves: &[DormantExitLeaf],
    rows: &[PositionMaterializedRow],
    parent_totals: &[BackingTotal],
    chunk_root: Felt,
) -> VerifiedMaterializationOutput {
    VerifiedMaterializationOutput {
        deployment_id: program.frozen_position.deployment_id,
        frozen_checkpoint_hash: program.frozen_checkpoint_hash,
        game_id: program.frozen_position.game_id,
        index_family: program.frozen_position.position_family,
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
    program: &PositionMaterializationProgram,
    verified: &VerifiedMaterializationOutput,
    chunk_root: Felt,
) -> PositionMaterializationJournal {
    PositionMaterializationJournal {
        program_hash: hash_program(program),
        verified_output_hash: hash_encoded("POSITION_MATERIALIZATION_OUTPUT_V1", verified),
        chunk_root,
        live_preimages_hash: verified.live_preimages_hash,
        live_totals_hash: verified.live_totals_hash,
    }
}

fn hash_items(leaves: &[DormantExitLeaf]) -> Felt {
    let mut preimage = vec![domain("DORMANT_EXIT_ITEMS_V1"), Felt::from(leaves.len())];
    preimage.extend(leaves.iter().map(hash_dormant_exit_leaf));
    crate::poseidon_hash_many(&preimage)
}

fn hash_live_preimages(rows: &[PositionMaterializedRow]) -> Felt {
    let mut preimage = vec![domain("DORMANT_EXIT_PREIMAGES_V1"), Felt::from(rows.len())];
    for row in rows {
        preimage.push(crate::poseidon_hash_many(&[
            domain("DORMANT_EXIT_PREIMAGE_V1"),
            hash_dormant_exit_leaf(&row.leaf),
            hash_exit_claim(&row.claim),
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

fn hash_dormant_exit_leaf(leaf: &DormantExitLeaf) -> Felt {
    hash_encoded("DORMANT_EXIT_LEAF_V1", leaf)
}

fn position_tree() -> Result<FixedDepthTree, PositionMaterializationError> {
    FixedDepthTree::new(
        CHUNK_TREE_DEPTH,
        domain("DORMANT_EMPTY_LEAF_V1"),
        domain("DORMANT_NODE_V1"),
    )
    .map_err(|_| PositionMaterializationError::Tree)
}

fn hash_program(program: &PositionMaterializationProgram) -> Felt {
    let frozen = &program.frozen_position;
    crate::poseidon_hash_many(&[
        domain("POSITION_MATERIALIZATION_PROGRAM_V1"),
        frozen.deployment_id,
        program.frozen_checkpoint_hash,
        frozen.game_id,
        Felt::from(frozen.position_family),
        Felt::from(program.frozen_block_number),
        Felt::from(program.final_outbox_cursor),
        Felt::from(program.exclusive_high_watermark),
        frozen.world,
        frozen.class_hash,
        frozen.schema_hash,
        frozen.layout_hash,
    ])
}

fn hash_encoded(domain_name: &str, value: &impl CanonicalEncode) -> Felt {
    let mut preimage = vec![domain(domain_name)];
    preimage.extend(value.encode());
    crate::poseidon_hash_many(&preimage)
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
        .unwrap_or_else(|| panic!("unregistered position materialization domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}
