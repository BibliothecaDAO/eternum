#![no_main]

use eternum_settlement::mmr_plan_sp1_fixture::execute_valid_mmr_plan_sp1_fixture;

sp1_zkvm::entrypoint!(main);

pub fn main() {
    let journal_hash =
        execute_valid_mmr_plan_sp1_fixture().expect("valid A13 MMR-plan fixture execution");

    sp1_zkvm::io::commit_slice(&journal_hash);
}
