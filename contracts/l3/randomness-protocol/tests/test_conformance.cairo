use eternum_randomness_protocol::authority::{
    ISequencingAccountSafeDispatcher, ISequencingAccountSafeDispatcherTrait, ISequencingAuthorityDispatcher,
    ISequencingAuthorityDispatcherTrait,
};
use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait, accepted_context_matches,
    timestamp_in_bounds,
};
mod fixture;
use eternum_randomness_protocol::{action_identity, encode_envelope, envelope_binding};
use fixture::{
    IFixtureDispatcher, IFixtureDispatcherTrait, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait, context, envelope, intent, outcome, pair,
    setup, terminal_arguments,
};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    start_cheat_account_contract_address, start_cheat_block_timestamp, start_cheat_block_timestamp_global,
    start_cheat_caller_address, start_cheat_resource_bounds, start_cheat_signature, start_cheat_transaction_hash,
    start_cheat_transaction_version,
};
use starknet::ResourcesBounds;
use starknet::account::Call;

#[derive(Drop, Serde)]
struct ContextVector {
    recorded: u64,
    block_time: u64,
    valid_from: u64,
    valid_until: u64,
    order: u64,
    last_order: u64,
    l2_gas: u64,
    accepted: bool,
    executable: bool,
}

#[test]
fn cross_language_context_boundaries() {
    let input = read_txt(@FileTrait::new("tests/fixtures/context-v1.txt"));
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
        recorded.l2_gas = vector.l2_gas;
        assert!(accepted_context_matches(@action, @recorded) == vector.accepted, "acceptance boundary");
        assert!(
            timestamp_in_bounds(vector.recorded, vector.block_time) == vector.executable, "future timestamp boundary",
        );
    }
}

#[test]
#[feature("safe_dispatcher")]
fn rejects_malformed_envelope_authority_and_authorization_witness() {
    for case in 0_u32..6 {
        let address = setup();
        let action = intent(address);
        let recorded = envelope(@action);
        let (mut r, s) = pair().sign(action_identity(@action)).unwrap();
        let mut witness = context(@recorded);
        match case {
            0 => { witness.authority_epoch = 2; },
            1 => { witness.accepted_public_key = 1; },
            2 => { r = 1; },
            3 => {
                witness.envelope = array!['ETERNUM_ENTROPY', 2];
                witness.envelope.append_span(encode_envelope(@recorded).span().slice(2, 9));
            },
            4 => { witness.envelope.append(0); },
            _ => {
                witness.envelope = array!['ETERNUM_ENTROPY', 1];
                witness.envelope.append_span(encode_envelope(@recorded).span().slice(2, 6));
                witness.envelope.append(0);
                witness.envelope.append_span(encode_envelope(@recorded).span().slice(9, 2));
            },
        }
        assert!(
            IRecordedExecutionSafeDispatcher { contract_address: address }.execute(action, witness, r, s).is_err(),
            "malformed witness accepted",
        );
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
    let (order, _, _, time, root) = IFixtureDispatcher { contract_address: address }.progress();
    assert!(order == 1 && time == 1005 && root == recorded.root, "recorded execution");
    assert!(
        IRecordedExecutionSafeDispatcher { contract_address: address }
            .execute(intent(address), context(@recorded), r, s)
            .is_err(),
        "duplicate consumed",
    );
}

#[test]
#[feature("safe_dispatcher")]
fn rejects_invalid_context_without_changing_progress() {
    for case in 0_u32..9 {
        let address = setup();
        let action = intent(address);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        let mut recorded = envelope(@action);
        match case {
            0 => { recorded.action = 0; },
            1 => { recorded.order = 2; },
            2 => { recorded.predecessor = 1; },
            3 => { recorded.preceding_state = 1; },
            4 => { recorded.execution_config = 1; },
            5 => { recorded.timestamp = 999; },
            6 => { recorded.timestamp = 1011; },
            7 => { start_cheat_block_timestamp(address, 1004); },
            _ => { start_cheat_caller_address(address, 456.try_into().unwrap()); },
        }
        assert!(
            IRecordedExecutionSafeDispatcher { contract_address: address }
                .execute(action, context(@recorded), r, s)
                .is_err(),
            "invalid context accepted",
        );
        let (order, _, _, _, _) = IFixtureDispatcher { contract_address: address }.progress();
        assert!(order == 0, "rejected execution effect");
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
    for case in 0_u32..6 {
        let address = setup();
        let action = intent(address);
        let recorded = envelope(@action);
        let (r, s) = pair().sign(action_identity(@action)).unwrap();
        match case {
            0 => { start_cheat_signature(address, array![].span()); },
            1 => {
                let (forged_r, forged_s) = pair().sign(999).unwrap();
                start_cheat_signature(address, array![forged_r, forged_s].span());
            },
            2 => { start_cheat_transaction_hash(address, 998); },
            3 => { start_cheat_transaction_version(address, 0x100000000000000000000000000000003); },
            4 => { start_cheat_account_contract_address(address, 456.try_into().unwrap()); },
            _ => {
                start_cheat_resource_bounds(
                    address,
                    array![ResourcesBounds { resource: 'L2_GAS', max_amount: 0, max_price_per_unit: 0 }].span(),
                );
            },
        }
        assert!(
            IRecordedExecutionSafeDispatcher { contract_address: address }
                .execute(action, context(@recorded), r, s)
                .is_err(),
            "preview context accepted",
        );
        let (order, _, _, _, _) = IFixtureDispatcher { contract_address: address }.progress();
        assert!(order == 0, "preview changed state");
    }
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
        let (order, _, _, _, _) = IFixtureDispatcher { contract_address: address }.progress();
        assert!(order == 0, "unbound call effect");
    }
}

#[test]
#[feature("safe_dispatcher")]
fn pending_binding_survives_authority_credential_rotation() {
    let address = setup();
    let account = IFixtureDispatcher { contract_address: address }.authority();
    let action = intent(address);
    let recorded = envelope(@action);
    let (r, s) = pair().sign(action_identity(@action)).unwrap();
    let replacement: StarkCurveKeyPair = KeyPairTrait::from_secret_key(67890);
    ISequencingAuthorityDispatcher { contract_address: account }.rotate(replacement.public_key, 2);
    assert!(
        IRecordedExecutionSafeDispatcher { contract_address: address }
            .execute(intent(address), context(@recorded), r, s)
            .is_err(),
        "stale authority accepted",
    );
    let mut witness = context(@recorded);
    witness.authority_epoch = 2;
    let (new_r, new_s) = replacement.sign(1000).unwrap();
    start_cheat_transaction_hash(address, 1000);
    start_cheat_signature(address, array![new_r, new_s].span());
    IRecordedExecutionDispatcher { contract_address: address }.execute(action, witness, r, s);
    let (order, _, _, timestamp, root) = IFixtureDispatcher { contract_address: address }.progress();
    assert!(order == 1 && timestamp == recorded.timestamp && root == recorded.root, "rotation changed binding");
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
        let result = IRecordedExecutionViewsDispatcher { contract_address: address }.get_result(1);
        assert!(result.status == if terminal {
            2
        } else {
            1
        }, "terminal status");
        assert!(result.binding == envelope_binding(@recorded), "terminal binding");
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
        let (order, _, _, timestamp, root) = IFixtureDispatcher { contract_address: address }.progress();
        assert!(
            order == 1 && timestamp == recorded.timestamp && root == recorded.root, "delay changed recorded context",
        );
        let actual = outcome(address);
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
    assert!(views.get_result(1).status == 2, "original rejection retained");
    let next = views.get_admission(7, 456);
    assert!(next.order == 2 && next.nonce == 1, "delayed ticket blocked successor");
    assert!(next.timestamp == recorded.timestamp + 86400, "fresh admission must observe recovery time");
    let mut successor = intent(address);
    successor.nonce = next.nonce;
    successor.valid_from = next.timestamp;
    successor.valid_until = next.timestamp + 10;
    terminal_arguments(ref successor);
    let mut fresh = envelope(@successor);
    fresh.timestamp = next.timestamp;
    fresh.root = recorded.root ^ 1;
    fresh.order = next.order;
    fresh.predecessor = next.predecessor;
    fresh.preceding_state = next.preceding_state;
    let (r, s) = pair().sign(action_identity(@successor)).unwrap();
    IRecordedExecutionDispatcher { contract_address: address }.execute(successor, context(@fresh), r, s);
    let (order, _, _, timestamp, root) = IFixtureDispatcher { contract_address: address }.progress();
    assert!(order == 2 && timestamp == fresh.timestamp && root == fresh.root, "fresh context not retained");
    assert!(views.get_result(1).binding == envelope_binding(@recorded), "recovery rewrote old binding");
    assert!(views.get_admission(7, 456).nonce == 2, "fresh ticket did not consume its nonce");
}
