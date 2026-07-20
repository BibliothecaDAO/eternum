use core::poseidon::poseidon_hash_span;

const FROZEN_RECOVERY_JOURNAL_V1: felt252 = 0xdd14a3202f2847c8c6a83b77912734b421bda98560dcd50fd817ff5e50adc7;
const DEPLOYMENT_REFUND_MATERIALIZATION_JOURNAL_V1: felt252 =
    0x2bf93c17b3dfa56421b181339a2a7aad9fcfd75d5b021decf01f10ec29bd76;
const POSITION_MATERIALIZATION_JOURNAL_V1: felt252 = 0x25336c5155b15d436863158c8e415f915152721ddfbdff6521295c07452986f;

#[derive(Copy, Drop)]
pub struct FrozenRecoveryJournal {
    pub program_hash: felt252,
    pub state_root: felt252,
    pub summary_hash: felt252,
    pub sources_hash: felt252,
    pub dispositions_hash: felt252,
    pub game_returns_hash: felt252,
    pub routes_hash: felt252,
}

#[derive(Copy, Drop)]
pub struct DeploymentRefundMaterializationJournal {
    pub program_hash: felt252,
    pub terminal_refund_source_hash: felt252,
    pub recovery_journal_hash: felt252,
    pub verified_output_hash: felt252,
    pub chunk_root: felt252,
    pub live_preimages_hash: felt252,
    pub live_totals_hash: felt252,
}

#[derive(Copy, Drop)]
pub struct PositionMaterializationJournal {
    pub program_hash: felt252,
    pub verified_output_hash: felt252,
    pub chunk_root: felt252,
    pub live_preimages_hash: felt252,
    pub live_totals_hash: felt252,
}

pub fn hash_frozen_recovery_journal(journal: FrozenRecoveryJournal) -> felt252 {
    poseidon_hash_span(
        array![
            FROZEN_RECOVERY_JOURNAL_V1, journal.program_hash, journal.state_root, journal.summary_hash,
            journal.sources_hash, journal.dispositions_hash, journal.game_returns_hash, journal.routes_hash,
        ]
            .span(),
    )
}

pub fn hash_deployment_refund_materialization_journal(journal: DeploymentRefundMaterializationJournal) -> felt252 {
    poseidon_hash_span(
        array![
            DEPLOYMENT_REFUND_MATERIALIZATION_JOURNAL_V1, journal.program_hash, journal.terminal_refund_source_hash,
            journal.recovery_journal_hash, journal.verified_output_hash, journal.chunk_root,
            journal.live_preimages_hash, journal.live_totals_hash,
        ]
            .span(),
    )
}

pub fn hash_position_materialization_journal(journal: PositionMaterializationJournal) -> felt252 {
    poseidon_hash_span(
        array![
            POSITION_MATERIALIZATION_JOURNAL_V1, journal.program_hash, journal.verified_output_hash, journal.chunk_root,
            journal.live_preimages_hash, journal.live_totals_hash,
        ]
            .span(),
    )
}

pub fn verify_frozen_recovery_journal(journal: FrozenRecoveryJournal, verified_journal_hash: felt252) -> bool {
    hash_frozen_recovery_journal(journal) == verified_journal_hash
}

pub fn verify_deployment_refund_materialization_journal(
    journal: DeploymentRefundMaterializationJournal, verified_journal_hash: felt252,
) -> bool {
    hash_deployment_refund_materialization_journal(journal) == verified_journal_hash
}

pub fn verify_position_materialization_journal(
    journal: PositionMaterializationJournal, verified_journal_hash: felt252,
) -> bool {
    hash_position_materialization_journal(journal) == verified_journal_hash
}
