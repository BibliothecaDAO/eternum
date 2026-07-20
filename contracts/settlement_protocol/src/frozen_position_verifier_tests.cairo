use crate::frozen_position_verifier_spike::{
    FrozenPositionJournal, hash_claim_legs, hash_exit_claim, hash_journal, verify_frozen_position_journal,
};
use crate::types::{ClaimLeg, ExitClaim};

const EXPECTED_LEGS_HASH: felt252 = 0x517b79f2017cab86758286645e1d32ba5f9b507f1260767dc3625e419f33082;
const EXPECTED_CLAIM_HASH: felt252 = 0x41c6f6d9243cada591946f7a9a945bb8b35e14a9eb1c029e71d0cef866e8fc;
const EXPECTED_JOURNAL_HASH: felt252 = 0x7d37e77b8cc5f0db16705e88b91ac862f125d684b8fa5644992eee730db58bc;

#[test]
fn cairo_matches_the_typescript_frozen_position_vectors() {
    let legs = active_legs();
    let claim = active_claim(77.try_into().unwrap());
    let journal = active_journal(@claim);

    assert!(hash_claim_legs(legs.span()) == EXPECTED_LEGS_HASH);
    assert!(hash_exit_claim(@claim) == EXPECTED_CLAIM_HASH);
    assert!(hash_journal(journal) == EXPECTED_JOURNAL_HASH);
    assert!(verify_frozen_position_journal(@claim, legs.span(), journal, EXPECTED_JOURNAL_HASH));
}

#[test]
fn cairo_rejects_owner_leg_cursor_and_receipt_substitution() {
    let legs = active_legs();
    let claim = active_claim(77.try_into().unwrap());
    let journal = active_journal(@claim);
    let wrong_owner_claim = active_claim(78.try_into().unwrap());
    let wrong_legs = array![leg(88, 9699, 601), leg(92, 100, 602), leg(93, 150, 603), leg(92, 50, 604)];
    let wrong_cursor = FrozenPositionJournal { final_outbox_cursor: 20, ..journal };

    assert!(!verify_frozen_position_journal(@wrong_owner_claim, legs.span(), journal, EXPECTED_JOURNAL_HASH));
    assert!(!verify_frozen_position_journal(@claim, wrong_legs.span(), journal, EXPECTED_JOURNAL_HASH));
    assert!(!verify_frozen_position_journal(@claim, legs.span(), wrong_cursor, EXPECTED_JOURNAL_HASH));
    assert!(!verify_frozen_position_journal(@claim, legs.span(), journal, EXPECTED_JOURNAL_HASH + 1));
    assert!(!verify_frozen_position_journal(@claim, array![].span(), journal, EXPECTED_JOURNAL_HASH));
    assert!(
        !verify_frozen_position_journal(
            @claim,
            array![
                leg(88, 9700, 601), leg(92, 100, 602), leg(93, 150, 603), leg(92, 50, 604), leg(88, 9700, 601),
                leg(92, 100, 602), leg(93, 150, 603), leg(92, 50, 604), leg(88, 9700, 601),
            ]
                .span(),
            journal,
            EXPECTED_JOURNAL_HASH,
        ),
    );
}

fn active_claim(owner_l2: starknet::ContractAddress) -> ExitClaim {
    ExitClaim {
        deployment_id: 11,
        game_id: 12,
        frozen_block_number: 700,
        world: 10.try_into().unwrap(),
        class_hash: 201,
        schema_hash: 202,
        position_family: 7,
        position_id: 42,
        position_generation: 3,
        source_state: 1,
        liability_id: 7001,
        owner_l2,
        recipient_l1: 88.try_into().unwrap(),
        recovery_policy_hash: 501,
        payout_legs_hash: EXPECTED_LEGS_HASH,
    }
}

fn active_journal(claim: @ExitClaim) -> FrozenPositionJournal {
    FrozenPositionJournal {
        program_hash: 3001,
        state_root: 3002,
        final_outbox_cursor: 19,
        claim_hash: hash_exit_claim(claim),
        payout_legs_hash: EXPECTED_LEGS_HASH,
    }
}

fn active_legs() -> Array<ClaimLeg> {
    array![leg(88, 9700, 601), leg(92, 100, 602), leg(93, 150, 603), leg(92, 50, 604)]
}

fn leg(recipient: felt252, amount: u128, policy_key: felt252) -> ClaimLeg {
    ClaimLeg {
        asset_mode: 1,
        asset_id: 37,
        backing_pool_id: 500,
        recipient: recipient.try_into().unwrap(),
        amount_or_token_id: amount.into(),
        policy_key,
    }
}
