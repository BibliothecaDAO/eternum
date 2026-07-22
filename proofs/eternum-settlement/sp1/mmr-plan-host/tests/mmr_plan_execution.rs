use eternum_settlement::{
    mmr_plan::MmrPlanError,
    mmr_plan_sp1_fixture::{
        MmrPlanSp1FixtureError, assert_bad_snapshot_mmr_plan_fixture,
        assert_substituted_plan_root_mmr_plan_fixture,
    },
};
use serde::Serialize;
use sp1_sdk::{
    Elf, SP1Stdin,
    blocking::{CpuProver, Prover, ProverClient},
    include_elf,
};
use std::{
    sync::OnceLock,
    time::{Duration, Instant},
};

const MMR_PLAN_ELF: Elf = include_elf!("eternum-mmr-plan-program");
const EXPECTED_JOURNAL_HASH: [u8; 32] = [
    1, 245, 17, 231, 105, 197, 12, 242, 79, 170, 181, 156, 114, 53, 247, 14, 150, 142, 157, 68,
    136, 166, 145, 186, 192, 43, 158, 190, 119, 202, 206, 252,
];

#[test]
fn mmr_plan_sp1_execution_emits_normative_journal_evidence() {
    let suite_started = Instant::now();
    let bad_snapshot = assert_bad_snapshot_rejects();
    let substituted_root = assert_substituted_plan_root_rejects();
    let guest_execution = execute_valid_guest().expect("valid SP1 execution");

    assert_eq!(guest_execution.public_values, EXPECTED_JOURNAL_HASH);

    let evidence = A13Sp1ExecutionEvidence {
        schema: "eternum.a13.sp1-execution.v1",
        prover_initialization_ms: shared_prover().initialization_elapsed.as_millis(),
        guest_execution: guest_execution.evidence(),
        native_negative_assertions: vec![bad_snapshot, substituted_root],
        suite_elapsed_ms: suite_started.elapsed().as_millis(),
    };
    println!(
        "A13_SP1_EXECUTION_EVIDENCE={}",
        serde_json::to_string(&evidence).expect("serialize A13 execution evidence")
    );
}

#[derive(Debug)]
struct GuestExecution {
    public_values: Vec<u8>,
    instructions: u64,
    syscalls: u64,
    elapsed: Duration,
}

impl GuestExecution {
    fn evidence(&self) -> GuestExecutionEvidence {
        GuestExecutionEvidence {
            name: "valid-tie-gap",
            status: "accepted",
            public_journal_hash_hex: encode_hex(&self.public_values),
            elapsed_ms: self.elapsed.as_millis(),
            instructions: self.instructions,
            syscalls: self.syscalls,
            total_cycles: self.instructions + self.syscalls,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct A13Sp1ExecutionEvidence {
    schema: &'static str,
    prover_initialization_ms: u128,
    guest_execution: GuestExecutionEvidence,
    native_negative_assertions: Vec<NativeNegativeEvidence>,
    suite_elapsed_ms: u128,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GuestExecutionEvidence {
    name: &'static str,
    status: &'static str,
    public_journal_hash_hex: String,
    elapsed_ms: u128,
    instructions: u64,
    syscalls: u64,
    total_cycles: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeNegativeEvidence {
    name: &'static str,
    status: &'static str,
    exact_error: &'static str,
    elapsed_ms: u128,
}

struct SharedProver {
    prover: CpuProver,
    initialization_elapsed: Duration,
}

fn shared_prover() -> &'static SharedProver {
    static PROVER: OnceLock<SharedProver> = OnceLock::new();

    PROVER.get_or_init(|| {
        let started = Instant::now();
        let prover = ProverClient::builder().cpu().build();
        SharedProver {
            prover,
            initialization_elapsed: started.elapsed(),
        }
    })
}

fn execute_valid_guest() -> Result<GuestExecution, String> {
    let shared = shared_prover();
    let started = Instant::now();

    match shared.prover.execute(MMR_PLAN_ELF, SP1Stdin::new()).run() {
        Ok((public_values, report)) => Ok(GuestExecution {
            public_values: public_values.to_vec(),
            instructions: report.total_instruction_count(),
            syscalls: report.total_syscall_count(),
            elapsed: started.elapsed(),
        }),
        Err(error) => Err(error.to_string()),
    }
}

fn assert_bad_snapshot_rejects() -> NativeNegativeEvidence {
    let started = Instant::now();
    assert_eq!(
        assert_bad_snapshot_mmr_plan_fixture(),
        Err(MmrPlanSp1FixtureError::InvalidPlan(MmrPlanError::Snapshot))
    );
    NativeNegativeEvidence {
        name: "bad-snapshot",
        status: "rejected",
        exact_error: "invalid-plan:snapshot",
        elapsed_ms: started.elapsed().as_millis(),
    }
}

fn assert_substituted_plan_root_rejects() -> NativeNegativeEvidence {
    let started = Instant::now();
    assert_eq!(
        assert_substituted_plan_root_mmr_plan_fixture(),
        Err(MmrPlanSp1FixtureError::SubstitutedPlanRoot)
    );
    NativeNegativeEvidence {
        name: "substituted-plan-root",
        status: "rejected",
        exact_error: "substituted-plan-root",
        elapsed_ms: started.elapsed().as_millis(),
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(2 + bytes.len() * 2);
    encoded.push_str("0x");
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}
