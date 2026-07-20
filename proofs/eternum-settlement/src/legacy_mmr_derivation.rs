use std::collections::BTreeSet;

use starknet_crypto::Felt;

use crate::protocol_hash::{domain, fixed_depth_root, hash_counted_list, hash_encoded, poseidon};
use crate::types::{
    GameResult, LegacyImportedMmrJob, LegacyMmrPendingResultProjection,
    LegacyMmrProvedSourceInventory, LegacyMmrSourceParticipant, LegacyMmrWorldDisposition,
    LegacyMmrWorldInventoryLeaf, MmrFormulaInput, RankingCommitment, RankingEntry,
};

const SUPPORTED_SETTLEMENT_CHUNK_SIZES: [u8; 6] = [1, 2, 4, 8, 16, 32];

const IMPORTED_PENDING_DISPOSITION_STATUS: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
enum LegacyApplicationMode {
    Pending = 1,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyMmrDerivationProgram {
    pub mmr_token: Felt,
    pub freeze_marker_hash: Felt,
    pub cutover_id: Felt,
    pub funding_owner: Felt,
    pub module_binding_hash: Felt,
    pub tie_break_policy_hash: Felt,
    pub settlement_chunk_size: u8,
    pub max_reward_units: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyMmrWorldSource {
    pub world: LegacyMmrWorldInventoryLeaf,
    pub projection: LegacyMmrPendingResultProjection,
    pub participants: Vec<LegacyMmrSourceParticipant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacySourceCommitments {
    pub world_count: u32,
    pub worlds_root: Felt,
    pub raw_projection_count: u32,
    pub raw_projections_root: Felt,
    pub source_participant_count: u64,
    pub source_participants_root: Felt,
    pub pending_import_job_count: u32,
    pub pending_import_reward_units: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyMmrDerivationOutput {
    pub proved_source_inventory_hash: Felt,
    pub freeze_marker_hash: Felt,
    pub synthetic_deployment_id: Felt,
    pub dispositions: Vec<LegacyMmrWorldDisposition>,
    pub dispositions_root: Felt,
    pub imports: Vec<LegacyMmrDerivedImport>,
    pub imported_jobs_root: Felt,
    pub pending_import_reward_units: u64,
    pub funding_scope_id: Felt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyMmrDerivedImport {
    pub job: LegacyImportedMmrJob,
    pub ranking_entries: Vec<RankingEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LegacyDerivationError {
    Program,
    WorldCount,
    WorldOrder,
    PendingProjection,
    ParticipantCount,
    ParticipantOrder,
    ParticipantIdentity,
    ParticipantRank,
    SourceCommitment,
    RewardBound,
    Arithmetic,
    Tree,
}

struct DerivedSource {
    disposition: LegacyMmrWorldDisposition,
    imported: LegacyMmrDerivedImport,
}

struct PendingSourceCommitments {
    projection_hashes: Vec<Felt>,
    participant_hashes: Vec<Felt>,
    reward_units: u64,
}

struct DerivedRanking {
    ranking_id: Felt,
    ranking: RankingCommitment,
    result: GameResult,
    entries: Vec<RankingEntry>,
}

struct DerivedFormula {
    inputs_root: Felt,
    module_aux_hash: Felt,
}

struct ImportContext {
    synthetic_deployment_id: Felt,
    import_index: u32,
    imported_game_id: Felt,
}

pub fn compute_source_commitments(
    sources: &[LegacyMmrWorldSource],
) -> Result<LegacySourceCommitments, LegacyDerivationError> {
    validate_world_order(sources)?;
    let pending = collect_pending_source_commitments(sources)?;
    build_source_commitments(sources, pending)
}

fn collect_pending_source_commitments(
    sources: &[LegacyMmrWorldSource],
) -> Result<PendingSourceCommitments, LegacyDerivationError> {
    let mut projection_hashes = Vec::new();
    let mut participant_hashes = Vec::new();
    let mut reward_units = 0_u64;

    for source in sources {
        validate_pending_source(&source.world, &source.projection, &source.participants)?;
        projection_hashes.push(hash_pending_projection(&source.projection));
        participant_hashes.extend(source.participants.iter().map(hash_source_participant));
        reward_units = add_source_reward_units(reward_units, &source.projection)?;
    }

    Ok(PendingSourceCommitments {
        projection_hashes,
        participant_hashes,
        reward_units,
    })
}

fn build_source_commitments(
    sources: &[LegacyMmrWorldSource],
    pending: PendingSourceCommitments,
) -> Result<LegacySourceCommitments, LegacyDerivationError> {
    Ok(LegacySourceCommitments {
        world_count: checked_u32(sources.len())?,
        worlds_root: hash_counted_list(
            "LEGACY_MMR_WORLDS_V1",
            sources
                .iter()
                .map(|source| hash_encoded("LEGACY_MMR_WORLD_LEAF_V1", &source.world)),
        ),
        raw_projection_count: checked_u32(pending.projection_hashes.len())?,
        raw_projections_root: hash_counted_list(
            "LEGACY_MMR_RAW_PROJECTIONS_V1",
            pending.projection_hashes,
        ),
        source_participant_count: pending
            .participant_hashes
            .len()
            .try_into()
            .map_err(|_| LegacyDerivationError::Arithmetic)?,
        source_participants_root: hash_counted_list(
            "LEGACY_MMR_ALL_SOURCE_PARTICIPANTS_V1",
            pending.participant_hashes,
        ),
        pending_import_job_count: checked_u32(sources.len())?,
        pending_import_reward_units: pending.reward_units,
    })
}

pub fn execute_legacy_mmr_derivation(
    program: &LegacyMmrDerivationProgram,
    source_inventory: &LegacyMmrProvedSourceInventory,
    sources: &[LegacyMmrWorldSource],
) -> Result<LegacyMmrDerivationOutput, LegacyDerivationError> {
    validate_program(program, source_inventory)?;
    let commitments = compute_source_commitments(sources)?;
    validate_proved_source_inventory(source_inventory, &commitments)?;
    if commitments.pending_import_reward_units > program.max_reward_units.into() {
        return Err(LegacyDerivationError::RewardBound);
    }
    derive_typed_imports(program, source_inventory, sources, &commitments)
}

pub fn legacy_result_key(projection: &LegacyMmrPendingResultProjection) -> Felt {
    poseidon(&[
        domain("LEGACY_MMR_RESULT_KEY_V1"),
        projection.factory,
        Felt::from(projection.factory_event_index),
        projection.world,
        projection.mmr_system,
        projection.game_or_trial_id,
        projection.game_meta_hash,
        projection.pre_application_claimed_hash,
        projection.legacy_result_state_hash,
    ])
}

fn derive_typed_imports(
    program: &LegacyMmrDerivationProgram,
    source_inventory: &LegacyMmrProvedSourceInventory,
    sources: &[LegacyMmrWorldSource],
    commitments: &LegacySourceCommitments,
) -> Result<LegacyMmrDerivationOutput, LegacyDerivationError> {
    let synthetic_deployment_id = poseidon(&[
        domain("LEGACY_MMR_DEPLOYMENT_V1"),
        program.mmr_token,
        program.freeze_marker_hash,
    ]);
    let mut dispositions = Vec::with_capacity(sources.len());
    let mut imports = Vec::with_capacity(commitments.pending_import_job_count as usize);

    for source in sources {
        let derived = derive_source(
            program,
            synthetic_deployment_id,
            source,
            checked_u32(imports.len())?,
        )?;
        imports.push(derived.imported);
        dispositions.push(derived.disposition);
    }

    let dispositions_root = fixed_tree_root(
        "LEGACY_MMR_DISPOSITION_EMPTY_V1",
        "LEGACY_MMR_DISPOSITION_NODE_V1",
        dispositions
            .iter()
            .map(|value| hash_encoded("LEGACY_MMR_DISPOSITION_LEAF_V1", value))
            .collect::<Vec<_>>(),
    )?;
    let imported_jobs_root = fixed_tree_root(
        "LEGACY_IMPORTED_MMR_JOB_EMPTY_V1",
        "LEGACY_IMPORTED_MMR_JOB_NODE_V1",
        imports
            .iter()
            .map(|value| hash_encoded("LEGACY_IMPORTED_MMR_JOB_LEAF_V1", &value.job))
            .collect::<Vec<_>>(),
    )?;
    let funding_scope_id = poseidon(&[
        domain("LEGACY_MMR_FUNDING_SCOPE_V1"),
        program.mmr_token,
        program.freeze_marker_hash,
        imported_jobs_root,
        program.funding_owner,
    ]);
    Ok(LegacyMmrDerivationOutput {
        proved_source_inventory_hash: hash_encoded(
            "LEGACY_MMR_PROVED_SOURCE_INVENTORY_V1",
            source_inventory,
        ),
        freeze_marker_hash: program.freeze_marker_hash,
        synthetic_deployment_id,
        dispositions,
        dispositions_root,
        imports,
        imported_jobs_root,
        pending_import_reward_units: commitments.pending_import_reward_units,
        funding_scope_id,
    })
}

fn derive_source(
    program: &LegacyMmrDerivationProgram,
    synthetic_deployment_id: Felt,
    source: &LegacyMmrWorldSource,
    import_index: u32,
) -> Result<DerivedSource, LegacyDerivationError> {
    validate_source_chunk_size(program, &source.projection)?;
    let imported_game_id = imported_game_id(&source.projection);
    let source_participants_root = hash_source_participants(&source.participants);
    let derived_ranking = derive_ranking(
        program,
        synthetic_deployment_id,
        imported_game_id,
        source_participants_root,
        &source.projection,
        &source.participants,
    )?;
    let DerivedRanking {
        ranking_id,
        ranking,
        result,
        entries,
    } = derived_ranking;
    let formula = derive_formula(&source.projection, &entries);
    let context = ImportContext {
        synthetic_deployment_id,
        import_index,
        imported_game_id,
    };
    let job = build_imported_job(
        program, context, source, ranking_id, ranking, result, formula,
    )?;
    let imported_job_hash = hash_encoded("LEGACY_IMPORTED_MMR_JOB_V1", &job);

    Ok(DerivedSource {
        disposition: build_imported_disposition(&source.world, imported_job_hash),
        imported: LegacyMmrDerivedImport {
            ranking_entries: entries,
            job,
        },
    })
}

fn build_imported_disposition(
    world: &LegacyMmrWorldInventoryLeaf,
    imported_job_hash: Felt,
) -> LegacyMmrWorldDisposition {
    LegacyMmrWorldDisposition {
        disposition_index: world.disposition_index,
        factory: world.factory,
        factory_event_index: world.factory_event_index,
        world: world.world,
        mmr_system: world.mmr_system,
        game_or_trial_id: world.game_or_trial_id,
        game_meta_hash: world.game_meta_hash,
        claimed_hash: world.claimed_hash,
        status: IMPORTED_PENDING_DISPOSITION_STATUS,
        imported_job_hash,
    }
}

fn validate_source_chunk_size(
    program: &LegacyMmrDerivationProgram,
    projection: &LegacyMmrPendingResultProjection,
) -> Result<(), LegacyDerivationError> {
    if projection.settlement_chunk_size != program.settlement_chunk_size {
        return Err(LegacyDerivationError::PendingProjection);
    }
    Ok(())
}

fn hash_source_participants(participants: &[LegacyMmrSourceParticipant]) -> Felt {
    hash_counted_list(
        "LEGACY_MMR_SOURCE_PARTICIPANTS_V1",
        participants.iter().map(hash_source_participant),
    )
}

fn derive_ranking(
    program: &LegacyMmrDerivationProgram,
    synthetic_deployment_id: Felt,
    imported_game_id: Felt,
    source_participants_root: Felt,
    projection: &LegacyMmrPendingResultProjection,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<DerivedRanking, LegacyDerivationError> {
    let result_hash = game_result_hash(
        synthetic_deployment_id,
        imported_game_id,
        projection,
        source_participants_root,
    );
    let entries = build_ranking_entries(
        synthetic_deployment_id,
        imported_game_id,
        result_hash,
        participants,
    );
    let ranking_root = ranking_root(&entries)?;
    let ranking_id = ranking_id(
        program,
        synthetic_deployment_id,
        imported_game_id,
        ranking_root,
        result_hash,
        projection,
    );
    Ok(DerivedRanking {
        ranking_id,
        ranking: build_ranking_commitment(
            imported_game_id,
            ranking_root,
            result_hash,
            projection,
            program,
        ),
        result: build_game_result(
            imported_game_id,
            result_hash,
            ranking_id,
            source_participants_root,
            projection,
        ),
        entries,
    })
}

fn ranking_root(entries: &[RankingEntry]) -> Result<Felt, LegacyDerivationError> {
    fixed_tree_root(
        "RANKING_EMPTY_LEAF_V1",
        "RANKING_NODE_V1",
        entries
            .iter()
            .map(|entry| hash_encoded("RANKING_LEAF_V1", entry))
            .collect(),
    )
}

fn ranking_id(
    program: &LegacyMmrDerivationProgram,
    synthetic_deployment_id: Felt,
    imported_game_id: Felt,
    ranking_root: Felt,
    result_hash: Felt,
    projection: &LegacyMmrPendingResultProjection,
) -> Felt {
    poseidon(&[
        domain("ETERNUM_RANKING_V1"),
        synthetic_deployment_id,
        imported_game_id,
        ranking_root,
        Felt::from(projection.participant_count),
        result_hash,
        Felt::from(projection.first_rank),
        Felt::from(projection.last_rank),
        program.tie_break_policy_hash,
    ])
}

fn build_ranking_commitment(
    imported_game_id: Felt,
    ranking_root: Felt,
    result_hash: Felt,
    projection: &LegacyMmrPendingResultProjection,
    program: &LegacyMmrDerivationProgram,
) -> RankingCommitment {
    RankingCommitment {
        game_id: imported_game_id,
        root: ranking_root,
        participant_count: projection.participant_count,
        result_hash,
        first_rank: projection.first_rank,
        last_rank: projection.last_rank,
        tie_break_policy_hash: program.tie_break_policy_hash,
    }
}

fn build_game_result(
    imported_game_id: Felt,
    result_hash: Felt,
    ranking_id: Felt,
    source_participants_root: Felt,
    projection: &LegacyMmrPendingResultProjection,
) -> GameResult {
    GameResult {
        game_id: imported_game_id,
        winner_l2: projection.winner_l2,
        ended_at: projection.ended_at,
        result_hash,
        valid_result: true,
        abort_reason: 0,
        participant_root: source_participants_root,
        ranking_id,
    }
}

fn derive_formula(
    projection: &LegacyMmrPendingResultProjection,
    entries: &[RankingEntry],
) -> DerivedFormula {
    let inputs_root = hash_counted_list(
        "LEGACY_MMR_FORMULA_INPUTS_V1",
        entries.iter().enumerate().map(|(index, entry)| {
            hash_encoded(
                "LEGACY_MMR_FORMULA_INPUT_V1",
                &MmrFormulaInput {
                    ordinal_index: (index + 1) as u16,
                    ranking_entry_hash: hash_encoded("RANKING_LEAF_V1", entry),
                    formula_rank: entry.rank,
                },
            )
        }),
    );
    let module_aux_hash = poseidon(&[
        domain("LEGACY_MMR_MODULE_AUX_V1"),
        Felt::from(projection.legacy_game_median),
        Felt::from(projection.participant_count),
        inputs_root,
        projection.legacy_formula_policy_hash,
    ]);
    DerivedFormula {
        inputs_root,
        module_aux_hash,
    }
}

fn build_imported_job(
    program: &LegacyMmrDerivationProgram,
    context: ImportContext,
    source: &LegacyMmrWorldSource,
    ranking_id: Felt,
    ranking: RankingCommitment,
    result: GameResult,
    formula: DerivedFormula,
) -> Result<LegacyImportedMmrJob, LegacyDerivationError> {
    let projection = &source.projection;
    let funding_job_id = poseidon(&[
        domain("LEGACY_MMR_FUNDING_JOB_V1"),
        program.cutover_id,
        Felt::from(context.import_index),
        context.imported_game_id,
        ranking_id,
    ]);
    Ok(LegacyImportedMmrJob {
        disposition_index: source.world.disposition_index,
        import_index: context.import_index,
        factory: projection.factory,
        factory_event_index: projection.factory_event_index,
        world: projection.world,
        mmr_system: projection.mmr_system,
        game_or_trial_id: projection.game_or_trial_id,
        game_meta_hash: projection.game_meta_hash,
        claimed_hash: projection.current_claimed_hash,
        legacy_source_projection_hash: hash_pending_projection(projection),
        legacy_source_participants_root: hash_source_participants(&source.participants),
        legacy_game_median: projection.legacy_game_median,
        legacy_formula_inputs_root: formula.inputs_root,
        legacy_formula_policy_hash: projection.legacy_formula_policy_hash,
        settlement_chunk_size: projection.settlement_chunk_size,
        legacy_synthetic_deployment_id: context.synthetic_deployment_id,
        imported_game_id: context.imported_game_id,
        ranking_id,
        ranking,
        result,
        module_binding_hash: program.module_binding_hash,
        module_aux_hash: formula.module_aux_hash,
        funding_job_id,
        maximum_reward_units: legacy_maximum_reward_units(
            projection.participant_count,
            projection.settlement_chunk_size,
        )?,
    })
}

fn validate_program(
    program: &LegacyMmrDerivationProgram,
    source_inventory: &LegacyMmrProvedSourceInventory,
) -> Result<(), LegacyDerivationError> {
    if !program_has_required_identities(program)
        || !source_inventory_has_required_identities(source_inventory)
        || program.cutover_id != source_inventory.cutover_id
        || !SUPPORTED_SETTLEMENT_CHUNK_SIZES.contains(&program.settlement_chunk_size)
    {
        return Err(LegacyDerivationError::Program);
    }
    Ok(())
}

fn program_has_required_identities(program: &LegacyMmrDerivationProgram) -> bool {
    program.mmr_token != Felt::ZERO
        && program.freeze_marker_hash != Felt::ZERO
        && program.cutover_id != Felt::ZERO
        && program.funding_owner != Felt::ZERO
        && program.module_binding_hash != Felt::ZERO
        && program.tie_break_policy_hash != Felt::ZERO
}

fn source_inventory_has_required_identities(source: &LegacyMmrProvedSourceInventory) -> bool {
    source.finalized_state_root_anchor_hash != Felt::ZERO
        && source.inventory_program_id != Felt::ZERO
        && source.inventory_verification_key_hash != Felt::ZERO
        && source.quiescence_marker_hash != Felt::ZERO
        && source.pre_freeze_witness_manifest_hash != Felt::ZERO
}

fn add_source_reward_units(
    current: u64,
    projection: &LegacyMmrPendingResultProjection,
) -> Result<u64, LegacyDerivationError> {
    current
        .checked_add(
            legacy_maximum_reward_units(
                projection.participant_count,
                projection.settlement_chunk_size,
            )?
            .into(),
        )
        .ok_or(LegacyDerivationError::Arithmetic)
}

fn validate_world_order(sources: &[LegacyMmrWorldSource]) -> Result<(), LegacyDerivationError> {
    for (index, source) in sources.iter().enumerate() {
        if source.world.disposition_index as usize != index {
            return Err(LegacyDerivationError::WorldOrder);
        }
        if index > 0 && world_key(&sources[index - 1].world) >= world_key(&source.world) {
            return Err(LegacyDerivationError::WorldOrder);
        }
    }
    Ok(())
}

fn validate_pending_source(
    world: &LegacyMmrWorldInventoryLeaf,
    projection: &LegacyMmrPendingResultProjection,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<(), LegacyDerivationError> {
    validate_projection_identity(world, projection)?;
    validate_pending_application(projection)?;
    validate_pending_result(projection)?;
    validate_participant_count(projection, participants)?;
    validate_participants(world, projection, participants)
}

fn validate_projection_identity(
    world: &LegacyMmrWorldInventoryLeaf,
    projection: &LegacyMmrPendingResultProjection,
) -> Result<(), LegacyDerivationError> {
    let matches_world = projection.factory == world.factory
        && projection.factory_event_index == world.factory_event_index
        && projection.world == world.world
        && projection.mmr_system == world.mmr_system
        && projection.game_or_trial_id == world.game_or_trial_id
        && projection.game_meta_hash == world.game_meta_hash
        && projection.current_claimed_hash == world.claimed_hash;
    if projection.result_key != legacy_result_key(projection) || !matches_world {
        return Err(LegacyDerivationError::PendingProjection);
    }
    Ok(())
}

fn validate_pending_application(
    projection: &LegacyMmrPendingResultProjection,
) -> Result<(), LegacyDerivationError> {
    let is_pending = projection.application_mode == LegacyApplicationMode::Pending as u8
        && projection.current_claimed_hash == projection.pre_application_claimed_hash
        && projection.application_nonce == 0
        && projection.application_hash == Felt::ZERO;
    if !is_pending {
        return Err(LegacyDerivationError::PendingProjection);
    }
    Ok(())
}

fn validate_pending_result(
    projection: &LegacyMmrPendingResultProjection,
) -> Result<(), LegacyDerivationError> {
    if !projection.valid_result
        || projection.abort_reason != 0
        || projection.settlement_chunk_size == 0
    {
        return Err(LegacyDerivationError::PendingProjection);
    }
    Ok(())
}

fn validate_participant_count(
    projection: &LegacyMmrPendingResultProjection,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<(), LegacyDerivationError> {
    if participants.is_empty()
        || participants.len() != projection.participant_count as usize
        || projection.legacy_ranking_highwater != participants.len() as u32
    {
        return Err(LegacyDerivationError::ParticipantCount);
    }
    Ok(())
}

fn validate_participants(
    world: &LegacyMmrWorldInventoryLeaf,
    projection: &LegacyMmrPendingResultProjection,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<(), LegacyDerivationError> {
    let mut legacy_player_keys = BTreeSet::new();
    for (index, participant) in participants.iter().enumerate() {
        validate_participant_index(index, participant)?;
        validate_participant_identity(world, participant, &mut legacy_player_keys)?;
        validate_participant_rank(projection, participant)?;
        validate_participant_order(index, participants)?;
    }
    validate_rank_bounds_and_winner(projection, participants)
}

fn validate_participant_index(
    index: usize,
    participant: &LegacyMmrSourceParticipant,
) -> Result<(), LegacyDerivationError> {
    if participant.source_index as usize != index {
        return Err(LegacyDerivationError::ParticipantOrder);
    }
    Ok(())
}

fn validate_participant_identity(
    world: &LegacyMmrWorldInventoryLeaf,
    participant: &LegacyMmrSourceParticipant,
    legacy_player_keys: &mut BTreeSet<Felt>,
) -> Result<(), LegacyDerivationError> {
    let matches_world = participant.factory == world.factory
        && participant.factory_event_index == world.factory_event_index
        && participant.world == world.world
        && participant.game_or_trial_id == world.game_or_trial_id;
    let preserves_legacy_identity = participant.player_l2 == participant.legacy_player_key
        && participant.recipient_l1 == participant.legacy_player_key
        && participant.legacy_player_key != Felt::ZERO
        && participant.legacy_participation_key != Felt::ZERO;
    if !matches_world
        || !preserves_legacy_identity
        || !legacy_player_keys.insert(participant.legacy_player_key)
    {
        return Err(LegacyDerivationError::ParticipantIdentity);
    }
    Ok(())
}

fn validate_participant_rank(
    projection: &LegacyMmrPendingResultProjection,
    participant: &LegacyMmrSourceParticipant,
) -> Result<(), LegacyDerivationError> {
    if participant.formula_rank == 0 || participant.formula_rank > projection.participant_count {
        return Err(LegacyDerivationError::ParticipantRank);
    }
    Ok(())
}

fn validate_participant_order(
    index: usize,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<(), LegacyDerivationError> {
    if index > 0
        && participant_key(&participants[index - 1]) >= participant_key(&participants[index])
    {
        return Err(LegacyDerivationError::ParticipantOrder);
    }
    Ok(())
}

fn validate_rank_bounds_and_winner(
    projection: &LegacyMmrPendingResultProjection,
    participants: &[LegacyMmrSourceParticipant],
) -> Result<(), LegacyDerivationError> {
    if participants.first().unwrap().formula_rank != projection.first_rank
        || participants.last().unwrap().formula_rank != projection.last_rank
        || !participants
            .iter()
            .any(|participant| participant.player_l2 == projection.winner_l2)
    {
        return Err(LegacyDerivationError::ParticipantRank);
    }
    Ok(())
}

fn validate_proved_source_inventory(
    source: &LegacyMmrProvedSourceInventory,
    commitments: &LegacySourceCommitments,
) -> Result<(), LegacyDerivationError> {
    if source.world_count != commitments.world_count {
        return Err(LegacyDerivationError::WorldCount);
    }
    let matches_commitments = source.worlds_root == commitments.worlds_root
        && source.raw_projection_count == commitments.raw_projection_count
        && source.raw_projections_root == commitments.raw_projections_root
        && source.source_participant_count == commitments.source_participant_count
        && source.source_participants_root == commitments.source_participants_root
        && source.pending_import_job_count == commitments.pending_import_job_count
        && source.pending_import_reward_units == commitments.pending_import_reward_units;
    if !matches_commitments {
        return Err(LegacyDerivationError::SourceCommitment);
    }
    Ok(())
}

fn imported_game_id(projection: &LegacyMmrPendingResultProjection) -> Felt {
    poseidon(&[
        domain("LEGACY_MMR_GAME_V1"),
        projection.factory,
        Felt::from(projection.factory_event_index),
        projection.world,
        projection.game_or_trial_id,
    ])
}

fn game_result_hash(
    synthetic_deployment_id: Felt,
    imported_game_id: Felt,
    projection: &LegacyMmrPendingResultProjection,
    participant_root: Felt,
) -> Felt {
    poseidon(&[
        domain("ETERNUM_GAME_RESULT_V1"),
        synthetic_deployment_id,
        imported_game_id,
        projection.winner_l2,
        Felt::from(projection.ended_at),
        Felt::ONE,
        Felt::ZERO,
        participant_root,
    ])
}

fn build_ranking_entries(
    synthetic_deployment_id: Felt,
    imported_game_id: Felt,
    result_hash: Felt,
    participants: &[LegacyMmrSourceParticipant],
) -> Vec<RankingEntry> {
    participants
        .iter()
        .map(|participant| RankingEntry {
            game_id: imported_game_id,
            player_l2: participant.player_l2,
            recipient_l1: participant.recipient_l1,
            participation_id: poseidon(&[
                domain("LEGACY_MMR_IMPORTED_PARTICIPATION_V1"),
                synthetic_deployment_id,
                imported_game_id,
                hash_source_participant(participant),
            ]),
            rank: participant.formula_rank,
            score: participant.score,
            result_hash,
        })
        .collect()
}

pub fn legacy_maximum_reward_units(
    participant_count: u16,
    chunk_size: u8,
) -> Result<u32, LegacyDerivationError> {
    if participant_count == 0 || chunk_size == 0 {
        return Err(LegacyDerivationError::ParticipantCount);
    }
    let chunks = u32::from(participant_count).div_ceil(u32::from(chunk_size));
    chunks
        .checked_mul(2)
        .and_then(|value| value.checked_add(4))
        .ok_or(LegacyDerivationError::Arithmetic)
}

fn hash_pending_projection(projection: &LegacyMmrPendingResultProjection) -> Felt {
    hash_encoded("LEGACY_MMR_PENDING_SOURCE_PROJECTION_V1", projection)
}

fn hash_source_participant(participant: &LegacyMmrSourceParticipant) -> Felt {
    hash_encoded("LEGACY_MMR_SOURCE_PARTICIPANT_V1", participant)
}

fn world_key(world: &LegacyMmrWorldInventoryLeaf) -> (Felt, u64, Felt, Felt) {
    (
        world.factory,
        world.factory_event_index,
        world.world,
        world.game_or_trial_id,
    )
}

fn participant_key(participant: &LegacyMmrSourceParticipant) -> (u16, Felt, Felt) {
    (
        participant.formula_rank,
        participant.recipient_l1,
        participant.legacy_participation_key,
    )
}

fn fixed_tree_root(
    empty_domain: &str,
    node_domain: &str,
    leaves: Vec<Felt>,
) -> Result<Felt, LegacyDerivationError> {
    fixed_depth_root(32, empty_domain, node_domain, &leaves)
        .map_err(|_| LegacyDerivationError::Tree)
}

fn checked_u32(value: usize) -> Result<u32, LegacyDerivationError> {
    value
        .try_into()
        .map_err(|_| LegacyDerivationError::Arithmetic)
}
