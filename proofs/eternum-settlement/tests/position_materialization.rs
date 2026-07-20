use eternum_settlement::frozen_position::{
    ActivePosition, FrozenPositionProgram, FrozenPositionWitness, SourcePosition,
    hash_katana_reference_state,
};
use eternum_settlement::materialization::MaterializationCoordinates;
use eternum_settlement::position_materialization::{
    PositionMaterializationError, PositionMaterializationJournal, PositionMaterializationProgram,
    PositionMaterializationWitness, PositionSlotWitness, TombstonePositionWitness,
    derive_position_leaves, execute_position_materialization,
    hash_position_materialization_journal, hash_tombstone_reference_slot, position_chunk_root,
};
use eternum_settlement::types::U256;
use starknet_crypto::Felt;

#[test]
fn ordinary_materialization_keeps_live_positions_and_explicit_tombstones() {
    let program = position_program();
    let witness = materialization_fixture(&program);

    let output = execute_position_materialization(&program, &witness).expect("materialization");

    assert_eq!(output.leaves.len(), 3);
    assert!(output.leaves[0].tombstone);
    assert!(!output.leaves[1].tombstone);
    assert!(output.leaves[2].tombstone);
    assert_eq!(output.rows.len(), 1);
    assert_eq!(output.rows[0].claim.position_id, 1);
    assert_eq!(output.verified.live_liability_count, 1);
    assert_ne!(
        hash_position_materialization_journal(&output.journal),
        Felt::ZERO
    );
}

#[test]
fn ordinary_materialization_rejects_wrong_range_tombstone_state_leaf_and_root() {
    let program = position_program();
    let witness = materialization_fixture(&program);

    assert_error(
        &program,
        changed(&witness, |candidate| candidate.coordinates.item_count = 2),
        PositionMaterializationError::Coordinates,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            let PositionSlotWitness::Tombstone(tombstone) = &mut candidate.slots[0] else {
                unreachable!()
            };
            tombstone.authenticated_empty_slot_hash += Felt::ONE;
        }),
        PositionMaterializationError::Tombstone,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            let PositionSlotWitness::Live(position) = &mut candidate.slots[1] else {
                unreachable!()
            };
            position.state_root += Felt::ONE;
        }),
        PositionMaterializationError::Position,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.claimed_leaves[1].exit_claim_hash += Felt::ONE
        }),
        PositionMaterializationError::Leaf,
    );
    assert_error(
        &program,
        changed(&witness, |candidate| {
            candidate.expected_chunk_root += Felt::ONE
        }),
        PositionMaterializationError::ChunkRoot,
    );
}

#[test]
fn rust_matches_the_cairo_and_typescript_position_materialization_journal() {
    let journal = PositionMaterializationJournal {
        program_hash: felt(5001),
        verified_output_hash: felt(5002),
        chunk_root: felt(5003),
        live_preimages_hash: felt(5004),
        live_totals_hash: felt(5005),
    };

    assert_eq!(
        hash_position_materialization_journal(&journal),
        Felt::from_hex("0x1f0cfc118469d26eac0b3d226cf0af1edf09eb6051e1d39ef0e15d6d1f9d9e2")
            .unwrap(),
    );
}

fn position_program() -> PositionMaterializationProgram {
    PositionMaterializationProgram {
        frozen_position: FrozenPositionProgram::reference_blitz_resource_v1(),
        frozen_checkpoint_hash: felt(300),
        frozen_block_number: 700,
        final_outbox_cursor: 19,
        exclusive_high_watermark: 3,
    }
}

fn materialization_fixture(
    program: &PositionMaterializationProgram,
) -> PositionMaterializationWitness {
    let coordinates = MaterializationCoordinates {
        chunk_index: 0,
        start_index: 0,
        item_count: 3,
    };
    let slots = vec![
        tombstone_slot(program, 0),
        PositionSlotWitness::Live(Box::new(active_position(&program.frozen_position, 1))),
        tombstone_slot(program, 2),
    ];
    let claimed_leaves = derive_position_leaves(program, &slots, coordinates).expect("leaves");
    let expected_chunk_root = position_chunk_root(&claimed_leaves).expect("root");
    PositionMaterializationWitness {
        coordinates,
        slots,
        claimed_leaves,
        expected_chunk_root,
    }
}

fn tombstone_slot(
    program: &PositionMaterializationProgram,
    source_index: u64,
) -> PositionSlotWitness {
    PositionSlotWitness::Tombstone(TombstonePositionWitness {
        source_index,
        authenticated_empty_slot_hash: hash_tombstone_reference_slot(program, source_index),
    })
}

fn active_position(program: &FrozenPositionProgram, position_id: u64) -> FrozenPositionWitness {
    let mut witness = FrozenPositionWitness {
        chain_id: program.chain_id,
        frozen_block_number: 700,
        state_root: Felt::ZERO,
        layout_hash: program.layout_hash,
        world: program.world,
        game_id: program.game_id,
        position_family: program.position_family,
        position_id,
        position_generation: 3,
        owner_l2: felt(77),
        recipient_l1: felt(88),
        recovery_policy_hash: program.withdrawal_policy.hash,
        source: SourcePosition::Active(ActivePosition {
            amount: U256 {
                low: 10_000,
                high: 0,
            },
            resource_class: 1,
            hyperstructures_completed: 0,
        }),
        final_outbox_cursor: 19,
    };
    witness.state_root = hash_katana_reference_state(program, &witness);
    witness
}

fn changed(
    witness: &PositionMaterializationWitness,
    mutate: impl FnOnce(&mut PositionMaterializationWitness),
) -> PositionMaterializationWitness {
    let mut candidate = witness.clone();
    mutate(&mut candidate);
    candidate
}

fn assert_error(
    program: &PositionMaterializationProgram,
    witness: PositionMaterializationWitness,
    expected: PositionMaterializationError,
) {
    assert_eq!(
        execute_position_materialization(program, &witness),
        Err(expected)
    );
}

fn felt(value: u64) -> Felt {
    Felt::from(value)
}
