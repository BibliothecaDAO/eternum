use crate::frozen_recovery_verifier_spike::{
    DeploymentRefundMaterializationJournal, FrozenRecoveryJournal, PositionMaterializationJournal,
    hash_deployment_refund_materialization_journal, hash_frozen_recovery_journal, hash_position_materialization_journal,
    verify_deployment_refund_materialization_journal, verify_frozen_recovery_journal,
    verify_position_materialization_journal,
};

const RECOVERY_HASH: felt252 = 0x40aea6316d38fddec50d6a2ba770a77babc95603c124e2ba6356644004b5afa;
const DEPLOYMENT_HASH: felt252 = 0x4aaed4fdfc7127f25f78d7b21d6875604cb2173fdbaf4f89656644f5ab7e43d;
const POSITION_HASH: felt252 = 0x1f0cfc118469d26eac0b3d226cf0af1edf09eb6051e1d39ef0e15d6d1f9d9e2;

#[test]
fn cairo_matches_the_rust_and_typescript_a21_journals() {
    let recovery = recovery_journal();
    let deployment = deployment_journal();
    let position = position_journal();

    assert!(hash_frozen_recovery_journal(recovery) == RECOVERY_HASH);
    assert!(hash_deployment_refund_materialization_journal(deployment) == DEPLOYMENT_HASH);
    assert!(hash_position_materialization_journal(position) == POSITION_HASH);
    assert!(verify_frozen_recovery_journal(recovery, RECOVERY_HASH));
    assert!(verify_deployment_refund_materialization_journal(deployment, DEPLOYMENT_HASH));
    assert!(verify_position_materialization_journal(position, POSITION_HASH));
}

#[test]
fn cairo_rejects_changed_a21_public_outputs() {
    let mut recovery = recovery_journal();
    recovery.routes_hash += 1;
    assert!(!verify_frozen_recovery_journal(recovery, RECOVERY_HASH));

    let mut deployment = deployment_journal();
    deployment.terminal_refund_source_hash += 1;
    assert!(!verify_deployment_refund_materialization_journal(deployment, DEPLOYMENT_HASH));

    let mut position = position_journal();
    position.chunk_root += 1;
    assert!(!verify_position_materialization_journal(position, POSITION_HASH));
}

fn recovery_journal() -> FrozenRecoveryJournal {
    FrozenRecoveryJournal {
        program_hash: 3001,
        state_root: 3002,
        summary_hash: 3003,
        sources_hash: 3004,
        dispositions_hash: 3005,
        game_returns_hash: 3006,
        routes_hash: 3007,
    }
}

fn deployment_journal() -> DeploymentRefundMaterializationJournal {
    DeploymentRefundMaterializationJournal {
        program_hash: 4001,
        terminal_refund_source_hash: 4002,
        recovery_journal_hash: 4003,
        verified_output_hash: 4004,
        chunk_root: 4005,
        live_preimages_hash: 4006,
        live_totals_hash: 4007,
    }
}

fn position_journal() -> PositionMaterializationJournal {
    PositionMaterializationJournal {
        program_hash: 5001,
        verified_output_hash: 5002,
        chunk_root: 5003,
        live_preimages_hash: 5004,
        live_totals_hash: 5005,
    }
}
