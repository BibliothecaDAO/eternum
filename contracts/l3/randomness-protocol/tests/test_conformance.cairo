mod receipts;
use eternum_randomness_protocol::authority::{
    ISequencingAccountSafeDispatcher, ISequencingAccountSafeDispatcherTrait, ISequencingAuthorityDispatcher,
    ISequencingAuthorityDispatcherTrait,
};
use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait, RecordedAction, accepted_context_matches,
    timestamp_in_bounds,
};
use eternum_randomness_protocol::epochs::{
    IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait, epoch_commitment, epoch_root,
};
use eternum_randomness_protocol::recording::following_state;
use receipts::RecordedReceiptsTrait;
mod fixture;
use eternum_randomness_protocol::{action_identity, encode_envelope};
use fixture::{
    IFixtureDispatcher, IFixtureDispatcherTrait, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait, context, envelope, intent, outcome, pair,
    reject_execution, setup, terminal_arguments,
};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    start_cheat_account_contract_address, start_cheat_block_timestamp, start_cheat_block_timestamp_global,
    start_cheat_caller_address, start_cheat_signature, start_cheat_transaction_hash, start_cheat_transaction_version,
};
use starknet::account::Call;

#[test]
fn definitive_failure_is_recorded_and_the_next_ticket_executes() {
    let address = setup();
    let action = intent(address);
    let recorded = envelope(@action);
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    reject_execution(address, action, context(@recorded), r, s).unwrap();
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let failed = views.recorded_outcome(1).unwrap();
    assert!(failed.status == 2 && failed.reason == 'EXECUTION_FAILED' && failed.nonce_consumed, "missing failure");
    assert!(views.get_admission(7, 456).nonce == 1, "failure did not consume current nonce");

    let mut next = intent(address);
    next.nonce = 1;
    let mut next_context = envelope(@next);
    next_context.order = 2;
    let (r, s) = pair().sign(action_identity(@next)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(next, context(@next_context), r, s);
    assert!(views.get_head().order == 2 && views.get_admission(7, 456).nonce == 2, "successor blocked");
    assert!(views.recorded_outcome(2).unwrap().status == 1, "successor rejected");
}

#[test]
#[feature("safe_dispatcher")]
fn failure_recording_rejects_forgery_and_preserves_a_stale_nonce() {
    let address = setup();
    let action = intent(address);
    let recorded = envelope(@action);
    let (_, s) = pair().sign(action_identity(@action)).unwrap();
    assert!(reject_execution(address, action, context(@recorded), 1, s).is_err(), "forged failure consumed a ticket");
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    assert!(views.get_head().order == 0 && views.get_admission(7, 456).nonce == 0, "forgery changed progress");
    for order in 1_u64..3 {
        let action = intent(address);
        let mut recorded = envelope(@action);
        recorded.order = order;
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        reject_execution(address, action, context(@recorded), r, s).unwrap();
        let failed = views.recorded_outcome(order).unwrap();
        assert!(failed.status == 2 && failed.reason == 'EXECUTION_FAILED', "missing terminal outcome");
        assert!(failed.nonce_consumed == (order == 1), "stale nonce consumed twice");
        assert!(views.get_admission(7, 456).nonce == 1, "failure moved stale nonce");
    }
}

#[derive(Drop, Serde)]
struct ContextVector {
    recorded: u64,
    block_time: u64,
    valid_from: u64,
    valid_until: u64,
    order: u64,
    last_order: u64,
    accepted: bool,
    executable: bool,
}

#[test]
fn cross_language_context_boundaries() {
    let input = read_txt(@FileTrait::new("tests/fixtures/context-v2.txt"));
    let mut fields = input.span();
    let vectors: Array<ContextVector> = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing context vector");
    for vector in vectors {
        let mut action = intent(123.try_into().unwrap());
        action.valid_from = vector.valid_from;
        action.valid_until = vector.valid_until;
        action.last_order = vector.last_order;
        let mut recorded = envelope(@action);
        recorded.timestamp = vector.recorded;
        recorded.order = vector.order;
        assert!(accepted_context_matches(@action, @recorded) == vector.accepted, "acceptance boundary");
        assert!(
            timestamp_in_bounds(vector.recorded, vector.block_time) == vector.executable, "future timestamp boundary",
        );
    }
}

#[test]
#[feature("safe_dispatcher")]
fn malformed_transport_consumes_nothing_and_invalid_action_signature_is_terminal() {
    for case in 0_u32..5 {
        let address = setup();
        let action = intent(address);
        let recorded = envelope(@action);
        let (mut r, s) = pair().sign(action_identity(@action)).unwrap();
        let mut witness = context(@recorded);
        match case {
            0 => { r = 1; },
            1 => {
                witness.envelope = array!['ETERNUM_ENTROPY', 2];
                witness.envelope.append_span(encode_envelope(@recorded).span().slice(2, 6));
            },
            2 => { witness.envelope.append(0); },
            3 => { witness.envelope = array!['ETERNUM_ENTROPY', 3, recorded.action]; },
            _ => {
                witness.envelope = array!['ETERNUM_ENTROPY', 3, recorded.action, 0];
                witness.envelope.append_span(encode_envelope(@recorded).span().slice(4, 4));
            },
        }
        let result = IRecordedExecutionSafeDispatcher { contract_address: address }.execute(action, witness, r, s);
        let views = IRecordedExecutionViewsDispatcher { contract_address: address };
        if case == 0 {
            assert!(result.is_ok(), "authenticated invalid signature blocked order");
            let rejected = views.recorded_outcome(1).unwrap();
            assert!(rejected.status == 2 && rejected.reason == 'INVALID_SIGNATURE', "missing signature reason");
            assert!(
                views.get_admission(7, 456).nonce == 0 && !rejected.nonce_consumed, "forgery consumed player nonce",
            );
        } else {
            assert!(result.is_err() && views.get_head().order == 0, "malformed witness consumed order");
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn delayed_execution_uses_recorded_time_after_intent_expiry_and_rejects_duplicate() {
    let address = setup();
    let action = intent(address);
    let recorded = envelope(@action);
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), r, s);
    let head = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head();
    let order = head.order;
    let time = head.timestamp;
    assert!(
        order == 1
            && time == 1005
            && head
                .state == following_state(
                    0,
                    @recorded,
                    IRecordedExecutionViewsDispatcher { contract_address: address }.recorded_outcome(order).unwrap(),
                ),
        "recorded execution",
    );
    assert!(
        IRecordedExecutionSafeDispatcher { contract_address: address }
            .execute(intent(address), context(@recorded), r, s)
            .is_err(),
        "duplicate consumed",
    );
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_transport_is_non_consuming_and_invalid_acceptance_is_terminal() {
    for case in 0_u32..8 {
        let address = setup();
        let action = intent(address);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        let mut recorded = envelope(@action);
        match case {
            0 => { recorded.action = 0; },
            1 => { recorded.order = 2; },
            2 => { recorded.order = 11; },
            3 => { recorded.execution_config = 1; },
            4 => { recorded.timestamp = 999; },
            5 => { recorded.timestamp = 1011; },
            6 => { start_cheat_block_timestamp(address, 1004); },
            _ => { start_cheat_caller_address(address, 456.try_into().unwrap()); },
        }
        let result = IRecordedExecutionSafeDispatcher { contract_address: address }
            .execute(action, context(@recorded), r, s);
        let order = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head().order;
        if case == 4 || case == 5 {
            assert!(result.is_ok() && order == 1, "invalid acceptance blocked order");
            let rejected = IRecordedExecutionViewsDispatcher { contract_address: address }.recorded_outcome(1).unwrap();
            assert!(rejected.status == 2 && rejected.reason == 'INVALID_ACCEPTANCE', "missing acceptance reason");
        } else {
            assert!(result.is_err() && order == 0, "invalid transport changed progress");
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn rejects_changed_signed_fields_and_foreign_identities() {
    for case in 0_u32..7 {
        let address = setup();
        let mut action = intent(address);
        let recorded = envelope(@action);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        match case {
            0 => { action.chain = 'OTHER'; },
            1 => { action.deployment = 1; },
            2 => { action.game_id = 8; },
            3 => { action.actor = 999; },
            4 => { action.rules = 1; },
            5 => { action.arguments = array![2, 1]; },
            _ => { action.nonce = 1; },
        }
        assert!(
            IRecordedExecutionSafeDispatcher { contract_address: address }
                .execute(action, context(@recorded), r, s)
                .is_err(),
            "altered intent accepted",
        );
    }
}

#[test]
#[feature("safe_dispatcher")]
fn simulation_context_cannot_bypass_transaction_authorization() {
    for case in 0_u32..5 {
        let address = setup();
        let account = IFixtureDispatcher { contract_address: address }.authority();
        let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
        let (r, s) = signer.sign(999).unwrap();
        start_cheat_caller_address(account, 0.try_into().unwrap());
        start_cheat_account_contract_address(account, account);
        start_cheat_transaction_version(account, 3);
        start_cheat_transaction_hash(account, 999);
        start_cheat_signature(account, array![r, s].span());
        match case {
            0 => { start_cheat_signature(account, array![].span()); },
            1 => {
                let (forged_r, forged_s) = pair().sign(999).unwrap();
                start_cheat_signature(account, array![forged_r, forged_s].span());
            },
            2 => { start_cheat_transaction_hash(account, 998); },
            3 => { start_cheat_transaction_version(account, 0x100000000000000000000000000000003); },
            _ => { start_cheat_account_contract_address(account, 456.try_into().unwrap()); },
        }
        let calls = array![
            Call { to: address, selector: selector!("execute"), calldata: signed_calldata(address).span() },
        ];
        assert!(
            ISequencingAccountSafeDispatcher { contract_address: account }.__execute__(calls).is_err(),
            "preview context accepted",
        );
        assert!(
            IRecordedExecutionViewsDispatcher { contract_address: address }.get_head().order == 0,
            "preview changed state",
        );
    }
}

fn signed_calldata(address: starknet::ContractAddress) -> Array<felt252> {
    let action = intent(address);
    let recorded = envelope(@action);
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    let mut calldata = array![];
    action.serialize(ref calldata);
    context(@recorded).serialize(ref calldata);
    calldata.append(r);
    calldata.append(s);
    calldata
}

#[test]
#[feature("safe_dispatcher")]
fn authority_rejects_multicalls_callbacks_and_foreign_targets() {
    for case in 0_u32..4 {
        let address = setup();
        let account = IFixtureDispatcher { contract_address: address }.authority();
        let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
        let (r, s) = signer.sign(999).unwrap();
        start_cheat_caller_address(account, 0.try_into().unwrap());
        start_cheat_account_contract_address(account, account);
        start_cheat_transaction_version(account, 3);
        start_cheat_transaction_hash(account, 999);
        start_cheat_signature(account, array![r, s].span());
        let call = Call { to: address, selector: selector!("execute"), calldata: array![].span() };
        let calls = match case {
            0 => array![],
            1 => array![call, call],
            2 => array![Call { to: 456.try_into().unwrap(), ..call }],
            _ => {
                start_cheat_caller_address(account, 456.try_into().unwrap());
                array![call]
            },
        };
        assert!(
            ISequencingAccountSafeDispatcher { contract_address: account }.__execute__(calls).is_err(),
            "unbound call accepted",
        );
        let order = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head().order;
        assert!(order == 0, "unbound call effect");
    }
}

#[test]
#[feature("safe_dispatcher")]
fn pending_binding_survives_authority_credential_rotation() {
    let address = setup();
    let account = IFixtureDispatcher { contract_address: address }.authority();
    let recorded = envelope(@intent(address));
    let replacement: StarkCurveKeyPair = KeyPairTrait::from_secret_key(67890);
    ISequencingAuthorityDispatcher { contract_address: account }.rotate(replacement.public_key);
    start_cheat_caller_address(account, 0.try_into().unwrap());
    start_cheat_account_contract_address(account, account);
    start_cheat_transaction_version(account, 3);
    start_cheat_transaction_hash(account, 1000);
    let original: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let (old_r, old_s) = original.sign(1000).unwrap();
    start_cheat_signature(account, array![old_r, old_s].span());
    let call = Call { to: address, selector: selector!("execute"), calldata: signed_calldata(address).span() };
    assert!(
        ISequencingAccountSafeDispatcher { contract_address: account }.__execute__(array![call]).is_err(),
        "stale authority accepted",
    );
    let (new_r, new_s) = replacement.sign(1000).unwrap();
    start_cheat_signature(account, array![new_r, new_s].span());
    ISequencingAccountSafeDispatcher { contract_address: account }.__execute__(array![call]).unwrap();
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let head = views.get_head();
    assert!(
        head.order == 1
            && head.timestamp == recorded.timestamp
            && head.state == following_state(0, @recorded, views.recorded_outcome(1).unwrap()),
        "rotation changed binding",
    );
}

#[test]
#[feature("safe_dispatcher")]
fn losses_and_terminal_rejections_consume_the_original_nonce() {
    for terminal in array![false, true] {
        let address = setup();
        let mut action = intent(address);
        if terminal {
            terminal_arguments(ref action);
        }
        let mut recorded = envelope(@action);
        recorded.root = 1;
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), r, s);
        let result = IRecordedExecutionViewsDispatcher { contract_address: address }.recorded_outcome(1).unwrap();
        assert!(result.status == if terminal {
            2
        } else {
            1
        }, "terminal status");
        assert!(
            IRecordedExecutionViewsDispatcher { contract_address: address }
                .get_head()
                .state == following_state(0, @recorded, result),
            "terminal binding",
        );
        let next = IRecordedExecutionViewsDispatcher { contract_address: address }.get_admission(7, 456);
        assert!(next.nonce == 1 && next.order == 2, "terminal consumption");
        let mut replay = intent(address);
        if terminal {
            terminal_arguments(ref replay);
        }
        assert!(
            IRecordedExecutionSafeDispatcher { contract_address: address }
                .execute(replay, context(@recorded), r, s)
                .is_err(),
            "terminal result granted retry",
        );
    }
}

#[test]
fn accepted_execution_after_a_day_matches_immediate_execution() {
    let mut expected = None;
    for delay in array![0_u64, 86400, 1000000] {
        let address = setup();
        let action = intent(address);
        let recorded = envelope(@action);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        start_cheat_block_timestamp_global(recorded.timestamp + delay);
        start_cheat_block_timestamp(address, recorded.timestamp + delay);
        IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), r, s);
        let head = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head();
        let order = head.order;
        let timestamp = head.timestamp;
        assert!(
            order == 1
                && timestamp == recorded.timestamp
                && head
                    .state == following_state(
                        0,
                        @recorded,
                        IRecordedExecutionViewsDispatcher { contract_address: address }
                            .recorded_outcome(order)
                            .unwrap(),
                    ),
            "delay changed recorded context",
        );
        let actual = outcome(address).span();
        if let Some(previous) = expected {
            assert!(actual == previous, "delay changed gameplay outcome");
        }
        expected = Some(actual);
    }
}

#[test]
fn outage_recovery_consumes_the_accepted_prefix_before_fresh_work() {
    let address = setup();
    let mut action = intent(address);
    terminal_arguments(ref action);
    let recorded = envelope(@action);
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    start_cheat_block_timestamp_global(recorded.timestamp + 86400);
    start_cheat_block_timestamp(address, recorded.timestamp + 86400);
    IRecordedExecutionDispatcher { contract_address: address }.execute(action, context(@recorded), r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    assert!(views.recorded_outcome(1).unwrap().status == 2, "original rejection retained");
    let next = views.get_admission(7, 456);
    assert!(next.order == 2 && next.nonce == 1, "delayed ticket blocked successor");
    assert!(next.timestamp == recorded.timestamp + 86400, "fresh admission must observe recovery time");
    let mut successor = intent(address);
    successor.nonce = next.nonce;
    successor.valid_from = next.timestamp;
    successor.valid_until = next.timestamp + 10;
    terminal_arguments(ref successor);
    let previous_state = views.get_head().state;
    let mut fresh = envelope(@successor);
    fresh.timestamp = next.timestamp;
    fresh.root = recorded.root ^ 1;
    fresh.order = next.order;
    let (r, s) = pair().sign(action_identity(@successor)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(successor, context(@fresh), r, s);
    let head = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head();
    let order = head.order;
    let timestamp = head.timestamp;
    assert!(
        order == 2
            && timestamp == fresh.timestamp
            && head
                .state == following_state(
                    previous_state,
                    @fresh,
                    IRecordedExecutionViewsDispatcher { contract_address: address }.recorded_outcome(order).unwrap(),
                ),
        "fresh context not retained",
    );
    assert!(views.recorded_outcome(1).unwrap().status == 2, "recovery rewrote old outcome");
    assert!(views.get_admission(7, 456).nonce == 2, "fresh ticket did not consume its nonce");
}

fn invalid_action_keys_and_nonces_cannot_block_a_valid_successor(case: u32) {
    let address = setup();
    let mut rejected = intent(address);
    let reason = match case {
        0 => {
            rejected.game_id = 0x100000000;
            'INVALID_GAME'
        },
        1 => {
            rejected.actor = 0x800000000000000000000000000000000000000000000000000000000000000;
            'INVALID_ACTOR'
        },
        2 => {
            rejected.game_id = 0;
            'INVALID_GAME'
        },
        3 => {
            rejected.actor = 0;
            'INVALID_ACTOR'
        },
        4 => {
            rejected.nonce = 1;
            'STALE_NONCE'
        },
        _ => {
            rejected.rules = 1;
            'INVALID_RULES'
        },
    };
    let recorded = envelope(@rejected);
    let (r, s) = pair().sign(action_identity(@rejected)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(rejected, context(@recorded), r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let result = views.recorded_outcome(1).unwrap();
    assert!(result.status == 2 && result.reason == reason, "terminal reason mismatch");
    assert!(
        IRecordedExecutionViewsDispatcher { contract_address: address }
            .get_head()
            .state == following_state(0, @recorded, result),
        "terminal ticket changed",
    );
    let next = views.get_admission(7, 456);
    assert!(next.order == 2, "rejection blocked stream");
    assert!(next.nonce == if case == 5 {
        1
    } else {
        0
    }, "rejection changed unrelated nonce");
    let mut successor = intent(address);
    successor.nonce = next.nonce;
    let mut following = envelope(@successor);
    following.order = next.order;
    let (r, s) = pair().sign(action_identity(@successor)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(successor, context(@following), r, s);
    assert!(views.recorded_outcome(2).unwrap().status == 1, "valid successor failed");
    assert!(views.get_admission(7, 456).nonce == next.nonce + 1, "successor nonce not consumed");
}

#[test]
fn oversized_game_id_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(0);
}

#[test]
fn oversized_actor_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(1);
}

#[test]
fn zero_game_id_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(2);
}

#[test]
fn zero_actor_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(3);
}

#[test]
fn future_actor_nonce_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(4);
}

#[test]
fn invalid_rules_cannot_block_a_valid_successor() {
    invalid_action_keys_and_nonces_cannot_block_a_valid_successor(5);
}

#[test]
fn stale_nonce_after_consumption_does_not_invalidate_the_next_action() {
    let address = setup();
    let mut first = intent(address);
    terminal_arguments(ref first);
    let recorded = envelope(@first);
    let (r, s) = pair().sign(action_identity(@first)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(first, context(@recorded), r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let next = views.get_admission(7, 456);
    let stale = intent(address);
    let mut recorded = envelope(@stale);
    recorded.order = next.order;
    let (r, s) = pair().sign(action_identity(@stale)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(stale, context(@recorded), r, s);
    assert!(views.recorded_outcome(2).unwrap().reason == 'STALE_NONCE', "stale nonce reason missing");
    let next = views.get_admission(7, 456);
    assert!(next.order == 3 && next.nonce == 1, "stale ticket consumed a future nonce");
    let mut successor = intent(address);
    successor.nonce = 1;
    let mut recorded = envelope(@successor);
    recorded.order = next.order;
    let (r, s) = pair().sign(action_identity(@successor)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(successor, context(@recorded), r, s);
    assert!(views.recorded_outcome(3).unwrap().status == 1, "successor invalidated by stale ticket");
}

#[test]
fn submitter_cannot_substitute_a_gameplay_key() {
    let address = setup();
    let action = intent(address);
    let recorded = envelope(@action);
    let attacker: StarkCurveKeyPair = KeyPairTrait::from_secret_key(777);
    let (r, s) = attacker.sign(action_identity(@action)).unwrap();
    let witness = context(@recorded);
    IRecordedExecutionDispatcher { contract_address: address }.execute(action, witness, r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let rejected = views.recorded_outcome(1).unwrap();
    assert!(rejected.status == 2 && rejected.reason == 'INVALID_SIGNATURE', "substituted key authorized gameplay");
    assert!(
        views.get_admission(7, 456).nonce == 0 && !rejected.nonce_consumed, "substituted key consumed player nonce",
    );
}

#[test]
#[feature("safe_dispatcher")]
fn recorded_time_never_moves_backwards_and_equal_time_is_valid() {
    let address = setup();
    let first = intent(address);
    let recorded = envelope(@first);
    let (r, s) = pair().sign(action_identity(@first)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(first, context(@recorded), r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let next = views.get_admission(7, 456);
    let mut action = intent(address);
    action.nonce = next.nonce;
    terminal_arguments(ref action);
    let mut backwards = envelope(@action);
    backwards.order = next.order;
    backwards.timestamp = recorded.timestamp - 1;
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    assert!(
        IRecordedExecutionSafeDispatcher { contract_address: address }
            .execute(action, context(@backwards), r, s)
            .is_err(),
        "backwards time accepted",
    );
    let unchanged = views.get_admission(7, 456);
    assert!(unchanged.order == next.order && unchanged.nonce == next.nonce, "invalid context consumed ticket");
    let mut retry = intent(address);
    retry.nonce = next.nonce;
    terminal_arguments(ref retry);
    backwards.timestamp = recorded.timestamp;
    IRecordedExecutionDispatcher { contract_address: address }.execute(retry, context(@backwards), r, s);
    assert!(views.recorded_outcome(2).unwrap().status == 2, "equal recorded timestamp did not execute terminal action");
    assert!(views.get_admission(7, 456).nonce == 2, "equal recorded timestamp did not consume nonce");
}

fn unauthenticated_action_leaves_nonce_for_successor(case: u32) {
    let address = setup();
    let mut action = intent(address);
    let mut recorded = envelope(@action);
    if case == 2 {
        action.chain = 'OTHER';
    }
    if case == 3 {
        action.deployment = 1;
    }
    recorded.action = action_identity(@action);
    let signing_pair = if case == 1 {
        KeyPairTrait::from_secret_key(777)
    } else {
        pair()
    };
    let (mut r, s) = signing_pair.sign(action_identity(@action)).unwrap();
    let witness = context(@recorded);
    if case == 0 {
        r = 1;
    }
    IRecordedExecutionDispatcher { contract_address: address }.execute(action, witness, r, s);
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let rejected = views.recorded_outcome(1).unwrap();
    let reason = if case == 2 {
        'FOREIGN_CHAIN'
    } else if case == 3 {
        'FOREIGN_DEPLOYMENT'
    } else {
        'INVALID_SIGNATURE'
    };
    assert!(rejected.status == 2 && rejected.reason == reason && !rejected.nonce_consumed, "authentication outcome");
    let next = views.get_admission(7, 456);
    assert!(next.nonce == 0 && next.order == 2, "authentication changed player nonce or blocked order");
    let successor = intent(address);
    let mut following = envelope(@successor);
    following.order = next.order;
    let (r, s) = pair().sign(action_identity(@successor)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(successor, context(@following), r, s);
    let succeeded = views.recorded_outcome(2).unwrap();
    assert!(succeeded.status == 1 && succeeded.nonce_consumed, "valid successor did not execute");
    assert!(views.get_admission(7, 456).nonce == 1, "valid successor did not consume its nonce");
}

#[test]
fn forged_signature_leaves_nonce_for_a_valid_successor() {
    unauthenticated_action_leaves_nonce_for_successor(0);
}

#[test]
fn wrong_gameplay_key_leaves_nonce_for_a_valid_successor() {
    unauthenticated_action_leaves_nonce_for_successor(1);
}

#[test]
fn foreign_chain_leaves_nonce_for_a_valid_successor() {
    unauthenticated_action_leaves_nonce_for_successor(2);
}

#[test]
fn foreign_deployment_leaves_nonce_for_a_valid_successor() {
    unauthenticated_action_leaves_nonce_for_successor(3);
}


#[feature("safe_dispatcher")]
fn sequencing_call(
    address: starknet::ContractAddress, selector: felt252, calldata: Array<felt252>,
) -> Result<Array<Span<felt252>>, Array<felt252>> {
    let account = IFixtureDispatcher { contract_address: address }.authority();
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let (r, s) = signer.sign(999).unwrap();
    snforge_std::cheat_caller_address(account, 0.try_into().unwrap(), snforge_std::CheatSpan::TargetCalls(1));
    start_cheat_account_contract_address(account, account);
    start_cheat_transaction_version(account, 3);
    start_cheat_transaction_hash(account, 999);
    start_cheat_signature(account, array![r, s].span());
    ISequencingAccountSafeDispatcher { contract_address: account }
        .__execute__(
            array![
                Call {
                    to: if selector == selector!("open_randomness_epoch")
                        || selector == selector!("reveal_randomness_epoch") {
                        account
                    } else {
                        address
                    },
                    selector,
                    calldata: calldata.span(),
                },
            ],
        )
}

#[test]
#[feature("safe_dispatcher")]
fn batch_records_each_outcome_and_only_authenticated_current_nonces() {
    let address = setup();
    let mut actions = array![];
    let mut envelopes = array![];
    for order in 1_u64..5 {
        let mut action = intent(address);
        action.nonce = if order <= 2 {
            0
        } else {
            1
        };
        // A forged first action cannot make the valid second action stale.
        // The third is an authenticated gameplay rejection; the fourth is stale.
        if order >= 3 {
            terminal_arguments(ref action);
        }
        let mut recorded = envelope(@action);
        recorded.order = order;
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        actions
            .append(
                RecordedAction { intent: action, context: context(@recorded), r: if order == 1 {
                    1
                } else {
                    r
                }, s },
            );
        envelopes.append(recorded);
    }
    let mut calldata = array![];
    actions.serialize(ref calldata);
    sequencing_call(address, selector!("execute_batch"), calldata).unwrap();
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let mut state = 0;
    for recorded in envelopes {
        let result = views.recorded_outcome(recorded.order).unwrap();
        let consumed = recorded.order == 2 || recorded.order == 3;
        assert!(result.nonce_consumed == consumed, "wrong per-ticket nonce consumption");
        assert!(result.status == if recorded.order == 2 {
            1
        } else {
            2
        }, "wrong per-ticket status");
        if recorded.order == 1 {
            assert!(result.reason == 'INVALID_SIGNATURE', "forged signature reason");
        }
        if recorded.order == 4 {
            assert!(result.reason == 'STALE_NONCE', "stale nonce reason");
        }
        state = following_state(state, @recorded, result);
    }
    let head = views.get_head();
    assert!(head.order == 4 && head.state == state, "batch omitted intermediate heads");
    assert!(views.get_admission(7, 456).nonce == 2, "batch consumed wrong player nonce");
}

#[test]
#[feature("safe_dispatcher")]
fn out_of_order_batch_rolls_back_every_ticket() {
    let address = setup();
    let mut actions = array![];
    for order in array![1_u64, 3] {
        let mut action = intent(address);
        action.nonce = if order == 1 {
            0
        } else {
            1
        };
        terminal_arguments(ref action);
        let mut recorded = envelope(@action);
        recorded.order = order;
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        actions.append(RecordedAction { intent: action, context: context(@recorded), r, s });
    }
    let mut calldata = array![];
    actions.serialize(ref calldata);
    assert!(sequencing_call(address, selector!("execute_batch"), calldata).is_err(), "out of order batch accepted");
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    assert!(views.get_head().order == 0 && views.get_admission(7, 456).nonce == 0, "partial batch effects escaped");
}

#[test]
#[feature("safe_dispatcher")]
fn epoch_reveal_reproduces_roots_and_never_allows_a_revealed_secret_again() {
    let address = setup();
    let account = IFixtureDispatcher { contract_address: address }.authority();
    let epochs = IRandomnessEpochsDispatcher { contract_address: account };
    let secret: u256 = 123456;
    assert!(
        sequencing_call(address, selector!("reveal_randomness_epoch"), array![secret.low.into(), secret.high.into()])
            .is_err(),
        "early epoch reveal accepted",
    );
    assert!(
        sequencing_call(address, selector!("open_randomness_epoch"), array![epoch_commitment(654321), 20]).is_err(),
        "unrevealed epoch replaced",
    );
    let mut actions = array![];
    let mut envelopes = array![];
    for order in 1_u64..11 {
        let mut action = intent(address);
        action.nonce = order - 1;
        terminal_arguments(ref action);
        let mut recorded = envelope(@action);
        recorded.order = order;
        recorded.root = epoch_root(secret, order);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        actions.append(RecordedAction { intent: action, context: context(@recorded), r, s });
        envelopes.append(recorded);
    }
    let mut calldata = array![];
    actions.serialize(ref calldata);
    sequencing_call(address, selector!("execute_batch"), calldata).unwrap();
    assert!(
        sequencing_call(address, selector!("reveal_randomness_epoch"), array![1, 0]).is_err(), "wrong secret accepted",
    );
    sequencing_call(address, selector!("reveal_randomness_epoch"), array![secret.low.into(), secret.high.into()])
        .unwrap();
    let epoch = epochs.get_randomness_epoch(1);
    let revealed = epoch.revealed_secret.unwrap();
    assert!(
        epoch.first_order == 1 && epoch.last_order == 10 && epoch.commitment == epoch_commitment(revealed),
        "epoch commitment changed",
    );
    let views = IRecordedExecutionViewsDispatcher { contract_address: address };
    let mut state = 0;
    for recorded in envelopes {
        assert!(recorded.root == epoch_root(revealed, recorded.order), "recorded root cannot be reproduced");
        state = following_state(state, @recorded, views.recorded_outcome(recorded.order).unwrap());
    }
    assert!(views.get_head().state == state && views.get_head().order == 10, "recorded roots not bound in head");
    assert!(
        sequencing_call(address, selector!("open_randomness_epoch"), array![epoch.commitment, 20]).is_err(),
        "revealed secret reused",
    );
    sequencing_call(address, selector!("open_randomness_epoch"), array![epoch_commitment(654321), 20]).unwrap();
    let next = epochs.get_randomness_epoch(2);
    assert!(
        epochs.current_randomness_epoch() == 2
            && next.first_order == 11
            && next.last_order == 20
            && next.revealed_secret.is_none(),
        "epoch transition lost order",
    );
    assert!(epochs.get_randomness_epoch(1).revealed_secret == Some(secret), "historical reveal lost");
}
