use eternum_settlement::mmr_plan::{
    MedianSource, MmrFormulaPolicy, MmrPlanClaim, MmrPlanWitness, execute_mmr_update_plan,
    verify_mmr_plan_journal,
};
use eternum_settlement::types::{
    MmrCurrentFormulaAux, MmrFormulaInput, MmrSnapshotEntry, RankingCommitment, RankingEntry, U256,
};
use starknet_crypto::Felt;

const MMR_SCALE: u128 = 1_000_000_000_000_000_000;

#[test]
fn locked_snapshot_derives_odd_median_and_ordinal_plan() {
    let witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );

    let output = execute_mmr_update_plan(7, &witness).expect("valid MMR update plan");

    assert_eq!(output.journal.sequence, 7);
    assert_eq!(output.journal.median, 1_000);
    assert_eq!(output.entries.len(), 7);
    assert_eq!(
        output.entries[0].ranking_entry_hash,
        witness.formula_inputs[0].ranking_entry_hash
    );
    assert_eq!(
        output.entries[1].mmr_identity,
        witness.snapshots[1].mmr_identity
    );
    assert_eq!(output.entries[6].starting_mmr_logical, 1_200);
}

#[test]
fn verifier_rejects_a_substituted_plan_root() {
    let witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );
    let output = execute_mmr_update_plan(7, &witness).expect("valid MMR update plan");
    let claim = MmrPlanClaim {
        sequence: output.journal.sequence,
        ranking: output.journal.ranking.clone(),
        snapshot_commitment: output.journal.snapshot_commitment,
        plan_root: output.journal.plan_root + Felt::ONE,
        median: output.journal.median,
        module_aux_hash: output.journal.module_aux_hash,
    };

    assert!(!verify_mmr_plan_journal(&claim, &output.journal));
}

#[test]
fn guest_rejects_bad_snapshot_order_and_formula_commitments() {
    let witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );

    let mut bad_snapshot = witness.clone();
    bad_snapshot.snapshots[3].starting_mmr_logical += 1;
    assert!(execute_mmr_update_plan(7, &bad_snapshot).is_err());

    let mut bad_order = witness.clone();
    bad_order.ranking_entries.swap(0, 1);
    assert!(execute_mmr_update_plan(7, &bad_order).is_err());

    let mut bad_formula = witness;
    bad_formula.policy.max_delta += 1;
    assert!(execute_mmr_update_plan(7, &bad_formula).is_err());
}

#[test]
fn formula_ordinals_are_one_based_and_contiguous() {
    let witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );

    execute_mmr_update_plan(7, &witness).expect("one-based ordinal inputs");

    let mut zero_ordinal = witness;
    zero_ordinal.formula_inputs[0].ordinal_index = 0;
    assert!(execute_mmr_update_plan(7, &zero_ordinal).is_err());
}

#[test]
fn plan_binds_the_complete_ranking_commitment() {
    let witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );

    let mut wrong_game = witness.clone();
    wrong_game.ranking.game_id += Felt::ONE;
    assert!(execute_mmr_update_plan(7, &wrong_game).is_err());

    let mut wrong_result = witness.clone();
    wrong_result.ranking.result_hash += Felt::ONE;
    assert!(execute_mmr_update_plan(7, &wrong_result).is_err());

    let mut wrong_participant_count = witness.clone();
    wrong_participant_count.ranking.participant_count -= 1;
    assert!(execute_mmr_update_plan(7, &wrong_participant_count).is_err());

    let mut wrong_root = witness;
    wrong_root.ranking.root += Felt::ONE;
    assert!(execute_mmr_update_plan(7, &wrong_root).is_err());
}

#[test]
fn legacy_source_uses_the_stored_median_and_locked_full_policy() {
    let mut witness = future_witness(
        [800, 900, 950, 1_000, 1_050, 1_100, 1_200],
        [1, 2, 3, 4, 5, 6, 7],
    );
    witness.aux.median_source = MedianSource::LegacyStored as u8;
    witness.aux.game_median = 975;
    witness.aux.formula_inputs_root = eternum_settlement::mmr_plan::hash_formula_inputs(
        MedianSource::LegacyStored,
        &witness.formula_inputs,
    );

    let output = execute_mmr_update_plan(9, &witness).expect("locked legacy MMR policy");

    assert_eq!(output.journal.median, 975);
    assert_eq!(output.journal.ranking, witness.ranking);
}

#[test]
fn competition_ties_and_gaps_preserve_even_snapshot_median() {
    let witness = future_witness([900, 1_000, 1_000, 1_100, 1_200, 1_300], [1, 1, 3, 4, 5, 6]);

    let output = execute_mmr_update_plan(8, &witness).expect("valid tied MMR update plan");

    assert_eq!(output.journal.median, 1_050);
    assert_eq!(output.entries.len(), 6);
    assert_eq!(
        output
            .entries
            .iter()
            .map(|entry| entry.new_mmr_logical)
            .collect::<Vec<_>>(),
        vec![934, 1_031, 1_013, 1_100, 1_187, 1_276]
    );
}

fn future_witness<const N: usize>(mmrs: [u128; N], ranks: [u16; N]) -> MmrPlanWitness {
    let ranking_entries = ranks
        .into_iter()
        .enumerate()
        .map(|(index, rank)| RankingEntry {
            game_id: Felt::from(11_u8),
            player_l2: Felt::from((index + 1) as u64),
            recipient_l1: Felt::from((index + 11) as u64),
            participation_id: Felt::from((index + 21) as u64),
            rank,
            score: U256 {
                low: (N - index) as u128,
                high: 0,
            },
            result_hash: Felt::from(31_u8),
        })
        .collect::<Vec<_>>();
    let ranking_hashes = ranking_entries
        .iter()
        .map(eternum_settlement::mmr_plan::hash_ranking_entry)
        .collect::<Vec<_>>();
    let formula_inputs = ranking_hashes
        .iter()
        .enumerate()
        .map(|(index, ranking_entry_hash)| MmrFormulaInput {
            ordinal_index: (index + 1) as u16,
            ranking_entry_hash: *ranking_entry_hash,
            formula_rank: ranks[index],
        })
        .collect::<Vec<_>>();
    let snapshots = mmrs
        .into_iter()
        .enumerate()
        .map(|(index, logical)| MmrSnapshotEntry {
            ranking_entry_hash: ranking_hashes[index],
            mmr_identity: Felt::from((index + 11) as u64),
            starting_mmr_scaled: U256 {
                low: logical * MMR_SCALE,
                high: 0,
            },
            starting_mmr_logical: logical,
        })
        .collect::<Vec<_>>();
    let ranking_root = eternum_settlement::tree::FixedDepthTree::new(
        32,
        domain("RANKING_EMPTY_LEAF_V1"),
        domain("RANKING_NODE_V1"),
    )
    .expect("ranking tree")
    .root(&ranking_hashes)
    .expect("ranking root");
    let ranking = RankingCommitment {
        game_id: Felt::from(11_u8),
        root: ranking_root,
        participant_count: N as u16,
        result_hash: Felt::from(31_u8),
        first_rank: ranks[0],
        last_rank: ranks[N - 1],
        tie_break_policy_hash: Felt::from(41_u8),
    };
    let policy = MmrFormulaPolicy::default_blitz();
    let aux = MmrCurrentFormulaAux {
        median_source: 2,
        game_median: 0,
        participant_count: N as u16,
        formula_inputs_root: eternum_settlement::mmr_plan::hash_formula_inputs(
            MedianSource::LockedSnapshot,
            &formula_inputs,
        ),
        formula_policy_hash: policy.hash(),
    };

    MmrPlanWitness {
        ranking,
        ranking_entries,
        formula_inputs,
        snapshots,
        aux,
        policy,
    }
}

fn domain(name: &str) -> Felt {
    let selector = eternum_settlement::schema_vector::hash_domain_selector(name)
        .expect("registered test domain");
    Felt::from_hex(selector).expect("valid test domain")
}
