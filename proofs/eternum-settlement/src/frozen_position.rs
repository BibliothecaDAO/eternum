use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::types::{ClaimLeg, ExitClaim, U256};

const BASIS_POINTS: u128 = 10_000;
const MAX_CLAIM_LEGS: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WithdrawalPolicy {
    pub hash: Felt,
    pub asset_mode: u8,
    pub asset_id: u32,
    pub backing_pool_id: Felt,
    pub player_policy_key: Felt,
    pub velords_policy_key: Felt,
    pub season_policy_key: Felt,
    pub client_policy_key: Felt,
    pub velords_recipient: Felt,
    pub season_recipient: Felt,
    pub velords_bps: u16,
    pub season_bps: u16,
    pub client_bps: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenPositionProgram {
    pub deployment_id: Felt,
    pub chain_id: Felt,
    pub game_id: Felt,
    pub world: Felt,
    pub class_hash: Felt,
    pub schema_hash: Felt,
    pub layout_hash: Felt,
    pub position_family: u16,
    pub liability_source_kind: u8,
    pub withdrawal_policy: WithdrawalPolicy,
}

impl FrozenPositionProgram {
    pub fn reference_blitz_resource_v1() -> Self {
        Self {
            deployment_id: Felt::from(11_u8),
            chain_id: Felt::ONE,
            game_id: Felt::from(12_u8),
            world: Felt::from(10_u8),
            class_hash: Felt::from(201_u16),
            schema_hash: Felt::from(202_u16),
            layout_hash: Felt::from(203_u16),
            position_family: 7,
            liability_source_kind: 1,
            withdrawal_policy: WithdrawalPolicy {
                hash: Felt::from(501_u16),
                asset_mode: 1,
                asset_id: 37,
                backing_pool_id: Felt::from(500_u16),
                player_policy_key: Felt::from(601_u16),
                velords_policy_key: Felt::from(602_u16),
                season_policy_key: Felt::from(603_u16),
                client_policy_key: Felt::from(604_u16),
                velords_recipient: Felt::from(92_u8),
                season_recipient: Felt::from(93_u8),
                velords_bps: 100,
                season_bps: 150,
                client_bps: 50,
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivePosition {
    pub amount: U256,
    pub resource_class: u8,
    pub hyperstructures_completed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingPosition {
    pub recipient_l1: Felt,
    pub recovery_policy_hash: Felt,
    pub auxiliary_body_hash: Felt,
    pub parent_shares_hash: Felt,
    pub lot_shares_hash: Felt,
    pub legs: Vec<ClaimLeg>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BatchAssignment {
    pub pending: PendingPosition,
    pub batch_id: u64,
    pub leaf_index: u8,
    pub batch_sealed: bool,
    pub in_active_exit_totals: bool,
    pub represented_before_final_cursor: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SourcePosition {
    Active(ActivePosition),
    UnsealedPending(PendingPosition),
    BatchAssigned(BatchAssignment),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenPositionWitness {
    pub chain_id: Felt,
    pub frozen_block_number: u64,
    pub state_root: Felt,
    pub layout_hash: Felt,
    pub world: Felt,
    pub game_id: Felt,
    pub position_family: u16,
    pub position_id: u64,
    pub position_generation: u64,
    pub owner_l2: Felt,
    pub recipient_l1: Felt,
    pub recovery_policy_hash: Felt,
    pub source: SourcePosition,
    pub final_outbox_cursor: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenPositionJournal {
    pub program_hash: Felt,
    pub state_root: Felt,
    pub final_outbox_cursor: u64,
    pub claim_hash: Felt,
    pub payout_legs_hash: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrozenPositionOutput {
    pub claim: ExitClaim,
    pub legs: Vec<ClaimLeg>,
    pub journal: FrozenPositionJournal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrozenPositionError {
    Chain,
    Layout,
    World,
    Position,
    Owner,
    RecoveryPolicy,
    StateRoot,
    SourceState,
    SealedAssignment,
    CursorCovered,
    ActiveExitBacking,
    Arithmetic,
    TooManyLegs,
}

pub fn execute_frozen_position(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
) -> Result<FrozenPositionOutput, FrozenPositionError> {
    validate_program_binding(program, witness)?;
    let (source_state, recipient_l1, recovery_policy_hash, legs) =
        resolve_source(program, witness)?;
    validate_reference_state_root(program, witness)?;
    validate_legs(&legs)?;
    let payout_legs_hash = hash_payout_legs(&legs);
    let claim = build_exit_claim(
        program,
        witness,
        source_state,
        recipient_l1,
        recovery_policy_hash,
        payout_legs_hash,
    );
    let journal = build_journal(program, witness, &claim, payout_legs_hash);
    Ok(FrozenPositionOutput {
        claim,
        legs,
        journal,
    })
}

pub fn verify_frozen_position_journal(
    program: &FrozenPositionProgram,
    claim: &ExitClaim,
    legs: &[ClaimLeg],
    journal: &FrozenPositionJournal,
    verified_journal_hash: Felt,
) -> bool {
    if legs.is_empty() || legs.len() > MAX_CLAIM_LEGS {
        return false;
    }
    let payout_legs_hash = hash_payout_legs(legs);
    journal.program_hash == hash_program(program)
        && journal.claim_hash == hash_exit_claim(claim)
        && journal.payout_legs_hash == payout_legs_hash
        && claim.payout_legs_hash == payout_legs_hash
        && hash_frozen_position_journal(journal) == verified_journal_hash
}

pub fn hash_payout_legs(legs: &[ClaimLeg]) -> Felt {
    let mut preimage = Vec::with_capacity(legs.len() * 7 + 2);
    preimage.push(domain("CLAIM_LEGS_V1"));
    preimage.push(Felt::from(legs.len()));
    for leg in legs {
        preimage.extend(leg.encode());
    }
    crate::poseidon_hash_many(&preimage)
}

pub fn hash_exit_claim(claim: &ExitClaim) -> Felt {
    let mut preimage = vec![domain("EXIT_CLAIM_V1")];
    preimage.extend(claim.encode());
    crate::poseidon_hash_many(&preimage)
}

pub fn hash_frozen_position_journal(journal: &FrozenPositionJournal) -> Felt {
    crate::poseidon_hash_many(&[
        domain("FROZEN_POSITION_JOURNAL_V1"),
        journal.program_hash,
        journal.state_root,
        Felt::from(journal.final_outbox_cursor),
        journal.claim_hash,
        journal.payout_legs_hash,
    ])
}

pub fn hash_katana_reference_state(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
) -> Felt {
    let mut preimage = vec![
        domain("KATANA_REFERENCE_STATE_V1"),
        hash_program(program),
        witness.chain_id,
        Felt::from(witness.frozen_block_number),
        witness.layout_hash,
        witness.world,
        witness.game_id,
        Felt::from(witness.position_family),
        Felt::from(witness.position_id),
        Felt::from(witness.position_generation),
        witness.owner_l2,
        witness.recipient_l1,
        witness.recovery_policy_hash,
        Felt::from(witness.final_outbox_cursor),
    ];
    append_source_commitment(&mut preimage, &witness.source);
    crate::poseidon_hash_many(&preimage)
}

fn validate_program_binding(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
) -> Result<(), FrozenPositionError> {
    if witness.chain_id != program.chain_id {
        return Err(FrozenPositionError::Chain);
    }
    if witness.game_id != program.game_id {
        return Err(FrozenPositionError::World);
    }
    if witness.layout_hash != program.layout_hash {
        return Err(FrozenPositionError::Layout);
    }
    if witness.world != program.world {
        return Err(FrozenPositionError::World);
    }
    if witness.position_family != program.position_family || witness.position_id == 0 {
        return Err(FrozenPositionError::Position);
    }
    if witness.owner_l2 == Felt::ZERO {
        return Err(FrozenPositionError::Owner);
    }
    if witness.recovery_policy_hash != program.withdrawal_policy.hash {
        return Err(FrozenPositionError::RecoveryPolicy);
    }
    Ok(())
}

fn validate_reference_state_root(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
) -> Result<(), FrozenPositionError> {
    if witness.state_root == hash_katana_reference_state(program, witness) {
        Ok(())
    } else {
        Err(FrozenPositionError::StateRoot)
    }
}

fn resolve_source(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
) -> Result<(u8, Felt, Felt, Vec<ClaimLeg>), FrozenPositionError> {
    match &witness.source {
        SourcePosition::Active(position) => Ok((
            1,
            witness.recipient_l1,
            witness.recovery_policy_hash,
            quote_active_position(program, witness.recipient_l1, position)?,
        )),
        SourcePosition::UnsealedPending(pending) => Ok((
            2,
            validate_pending_position(witness, pending)?,
            pending.recovery_policy_hash,
            pending.legs.clone(),
        )),
        SourcePosition::BatchAssigned(assignment) => {
            validate_open_assignment(assignment)?;
            Ok((
                3,
                validate_pending_position(witness, &assignment.pending)?,
                assignment.pending.recovery_policy_hash,
                assignment.pending.legs.clone(),
            ))
        }
    }
}

fn validate_pending_position(
    witness: &FrozenPositionWitness,
    pending: &PendingPosition,
) -> Result<Felt, FrozenPositionError> {
    if pending.recipient_l1 != witness.recipient_l1 {
        return Err(FrozenPositionError::Owner);
    }
    if pending.recovery_policy_hash != witness.recovery_policy_hash {
        return Err(FrozenPositionError::RecoveryPolicy);
    }
    Ok(pending.recipient_l1)
}

fn validate_open_assignment(assignment: &BatchAssignment) -> Result<(), FrozenPositionError> {
    if assignment.batch_sealed {
        return Err(FrozenPositionError::SealedAssignment);
    }
    if assignment.represented_before_final_cursor {
        return Err(FrozenPositionError::CursorCovered);
    }
    if !assignment.in_active_exit_totals {
        return Err(FrozenPositionError::ActiveExitBacking);
    }
    Ok(())
}

fn quote_active_position(
    program: &FrozenPositionProgram,
    recipient_l1: Felt,
    position: &ActivePosition,
) -> Result<Vec<ClaimLeg>, FrozenPositionError> {
    if position.amount.high != 0 || position.resource_class != 1 {
        return Err(FrozenPositionError::SourceState);
    }
    let policy = &program.withdrawal_policy;
    let gross = position.amount.low;
    let velords = fee(gross, policy.velords_bps)?;
    let season = fee(gross, policy.season_bps)?;
    let client = fee(gross, policy.client_bps)?;
    let total_fees = velords
        .checked_add(season)
        .and_then(|value| value.checked_add(client))
        .ok_or(FrozenPositionError::Arithmetic)?;
    let net = gross
        .checked_sub(total_fees)
        .ok_or(FrozenPositionError::Arithmetic)?;
    Ok(vec![
        build_leg(policy, recipient_l1, net, policy.player_policy_key),
        build_leg(
            policy,
            policy.velords_recipient,
            velords,
            policy.velords_policy_key,
        ),
        build_leg(
            policy,
            policy.season_recipient,
            season,
            policy.season_policy_key,
        ),
        build_leg(
            policy,
            policy.velords_recipient,
            client,
            policy.client_policy_key,
        ),
    ])
}

fn fee(amount: u128, bps: u16) -> Result<u128, FrozenPositionError> {
    amount
        .checked_mul(u128::from(bps))
        .map(|value| value / BASIS_POINTS)
        .ok_or(FrozenPositionError::Arithmetic)
}

fn build_leg(
    policy: &WithdrawalPolicy,
    recipient: Felt,
    amount: u128,
    policy_key: Felt,
) -> ClaimLeg {
    ClaimLeg {
        asset_mode: policy.asset_mode,
        asset_id: policy.asset_id,
        backing_pool_id: policy.backing_pool_id,
        recipient,
        amount_or_token_id: U256 {
            low: amount,
            high: 0,
        },
        policy_key,
    }
}

fn validate_legs(legs: &[ClaimLeg]) -> Result<(), FrozenPositionError> {
    if legs.is_empty() || legs.len() > MAX_CLAIM_LEGS {
        return Err(FrozenPositionError::TooManyLegs);
    }
    if legs
        .iter()
        .any(|leg| leg.amount_or_token_id.low == 0 && leg.amount_or_token_id.high == 0)
    {
        return Err(FrozenPositionError::SourceState);
    }
    Ok(())
}

fn build_exit_claim(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
    source_state: u8,
    recipient_l1: Felt,
    recovery_policy_hash: Felt,
    payout_legs_hash: Felt,
) -> ExitClaim {
    ExitClaim {
        deployment_id: program.deployment_id,
        game_id: witness.game_id,
        frozen_block_number: witness.frozen_block_number,
        world: witness.world,
        class_hash: program.class_hash,
        schema_hash: program.schema_hash,
        position_family: witness.position_family,
        position_id: witness.position_id,
        position_generation: witness.position_generation,
        source_state,
        liability_id: derive_liability_id(program, witness),
        owner_l2: witness.owner_l2,
        recipient_l1,
        recovery_policy_hash,
        payout_legs_hash,
    }
}

fn derive_liability_id(program: &FrozenPositionProgram, witness: &FrozenPositionWitness) -> Felt {
    crate::poseidon_hash_many(&[
        domain("ETERNUM_LIABILITY_V1"),
        program.deployment_id,
        witness.game_id,
        Felt::from(program.liability_source_kind),
        Felt::from(witness.position_id),
        Felt::from(witness.position_generation),
    ])
}

fn build_journal(
    program: &FrozenPositionProgram,
    witness: &FrozenPositionWitness,
    claim: &ExitClaim,
    payout_legs_hash: Felt,
) -> FrozenPositionJournal {
    FrozenPositionJournal {
        program_hash: hash_program(program),
        state_root: witness.state_root,
        final_outbox_cursor: witness.final_outbox_cursor,
        claim_hash: hash_exit_claim(claim),
        payout_legs_hash,
    }
}

fn hash_program(program: &FrozenPositionProgram) -> Felt {
    let policy = &program.withdrawal_policy;
    crate::poseidon_hash_many(&[
        domain("FROZEN_POSITION_PROGRAM_V1"),
        program.deployment_id,
        program.chain_id,
        program.game_id,
        program.world,
        program.class_hash,
        program.schema_hash,
        program.layout_hash,
        Felt::from(program.position_family),
        Felt::from(program.liability_source_kind),
        policy.hash,
        Felt::from(policy.asset_mode),
        Felt::from(policy.asset_id),
        policy.backing_pool_id,
        policy.player_policy_key,
        policy.velords_policy_key,
        policy.season_policy_key,
        policy.client_policy_key,
        policy.velords_recipient,
        policy.season_recipient,
        Felt::from(policy.velords_bps),
        Felt::from(policy.season_bps),
        Felt::from(policy.client_bps),
    ])
}

fn append_source_commitment(preimage: &mut Vec<Felt>, source: &SourcePosition) {
    match source {
        SourcePosition::Active(position) => {
            preimage.push(Felt::ONE);
            preimage.push(Felt::from(position.amount.low));
            preimage.push(Felt::from(position.amount.high));
            preimage.push(Felt::from(position.resource_class));
            preimage.push(Felt::from(position.hyperstructures_completed));
        }
        SourcePosition::UnsealedPending(pending) => append_pending_commitment(preimage, 2, pending),
        SourcePosition::BatchAssigned(assignment) => {
            append_pending_commitment(preimage, 3, &assignment.pending);
            preimage.push(Felt::from(assignment.batch_id));
            preimage.push(Felt::from(assignment.leaf_index));
            preimage.push(Felt::from(u8::from(assignment.batch_sealed)));
            preimage.push(Felt::from(u8::from(assignment.in_active_exit_totals)));
            preimage.push(Felt::from(u8::from(
                assignment.represented_before_final_cursor,
            )));
        }
    }
}

fn append_pending_commitment(
    preimage: &mut Vec<Felt>,
    source_state: u8,
    pending: &PendingPosition,
) {
    preimage.push(Felt::from(source_state));
    preimage.push(pending.recipient_l1);
    preimage.push(pending.recovery_policy_hash);
    preimage.push(pending.auxiliary_body_hash);
    preimage.push(pending.parent_shares_hash);
    preimage.push(pending.lot_shares_hash);
    preimage.push(hash_payout_legs(&pending.legs));
}

fn domain(name: &str) -> Felt {
    let selector = crate::schema_vector::hash_domain_selector(name)
        .unwrap_or_else(|| panic!("unregistered frozen-position domain: {name}"));
    Felt::from_hex(selector).expect("valid generated domain selector")
}
