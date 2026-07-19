use core::serde::Serde;
use settlement_protocol::interfaces::{
    IHardenedInboxRuntimeDispatcher, IHardenedInboxRuntimeDispatcherTrait, IHardenedInboxRuntimeSafeDispatcher,
    IHardenedInboxRuntimeSafeDispatcherTrait,
};
use settlement_protocol::types::{
    CancelledInboxMarker, CancelledSlotRelayResult, FinalizedStarknetHeader, StarknetHeaderSourcePolicy,
};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare, get_class_hash};
use starknet::ContractAddress;
use super::hardened_inbox_runtime::{
    BinaryNode, ContractData, ContractStateProof, EdgeNode, TrieNode, cancelled_marker_hash,
    cancelled_marker_storage_key, compute_root, contract_state_hash, piltover_storage_layout_hash, state_commitment,
    trie_node_hash,
};
use super::hardened_inbox_runtime_mocks::finality_proof_commitment;

const CHAIN_ID: felt252 = 'SN_SEPOLIA';
const DEPLOYMENT_ID: felt252 = 77;
const PILTOVER_ADDRESS: felt252 = 555;
const PILTOVER_CLASS_HASH: felt252 = 777;
const CANCELLED_MARKER_BASE: felt252 = 999;
const INITIAL_BLOCK_NUMBER: u64 = 100;
const INITIAL_BLOCK_HASH: felt252 = 1000;

#[starknet::interface]
trait ISeasonIngressCancellationMockView<TContractState> {
    fn consumed(self: @TContractState) -> (u64, u64, felt252);
}

#[derive(Drop)]
struct Fixture {
    runtime: IHardenedInboxRuntimeDispatcher,
    season_ingress: ISeasonIngressCancellationMockViewDispatcher,
}

#[test]
fn finalized_header_and_exact_cancelled_slot_apply_once() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let finality_proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, finality_proof.span());
    let first = fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
    let second = fixture.runtime.relay_cancelled_slot(header_hash, marker(0, 2000, 3000), storage_proof.span());

    match first {
        CancelledSlotRelayResult::Applied((message_id, nonce)) => {
            assert!(message_id == 2000);
            assert!(nonce == 1);
        },
        _ => panic!("EXPECTED_APPLIED"),
    }
    match second {
        CancelledSlotRelayResult::AlreadyApplied((
            message_id, nonce,
        )) => {
            assert!(message_id == 2000);
            assert!(nonce == 1);
        },
        _ => panic!("EXPECTED_ALREADY_APPLIED"),
    }
    assert!(fixture.runtime.next_inbox_nonce() == 1);
    assert!(fixture.runtime.get_cancelled_slot(0).unwrap().typed_body_hash == 3000);
    assert!(fixture.season_ingress.consumed() == (1, 0, 2000));
}

#[test]
fn old_exact_replay_returns_its_original_exclusive_cursor() {
    let fixture = setup();
    let marker_zero = marker(0, 2000, 3000);
    let (header_one, proof_zero) = header_and_storage_proof(@marker_zero, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_one_hash = header_one.block_hash;
    let finality_one = finality_proof(@header_one);
    fixture.runtime.submit_finalized_header(header_one, finality_one.span());
    fixture.runtime.relay_cancelled_slot(header_one_hash, marker_zero, proof_zero.span());

    let marker_one = marker(1, 2001, 3001);
    let (header_two_base, proof_one) = header_and_storage_proof(
        @marker_one, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE,
    );
    let header_two = FinalizedStarknetHeader {
        block_number: INITIAL_BLOCK_NUMBER + 2,
        block_hash: 1002,
        parent_hash: header_one_hash,
        finalized_l1_block_number: 602,
        finalized_l1_block_hash: 603,
        ..header_two_base,
    };
    let header_two_hash = header_two.block_hash;
    let finality_two = finality_proof_from(header_one_hash, INITIAL_BLOCK_NUMBER + 1, @header_two);
    fixture.runtime.submit_finalized_header(header_two, finality_two.span());
    fixture.runtime.relay_cancelled_slot(header_two_hash, marker_one, proof_one.span());

    let replay = fixture.runtime.relay_cancelled_slot(header_one_hash, marker(0, 2000, 3000), array![].span());
    match replay {
        CancelledSlotRelayResult::AlreadyApplied((
            message_id, resulting_cursor,
        )) => {
            assert!(message_id == 2000);
            assert!(resulting_cursor == 1);
        },
        _ => panic!("EXPECTED_ALREADY_APPLIED"),
    }
    assert!(fixture.runtime.next_inbox_nonce() == 2);
    assert!(fixture.season_ingress.consumed() == (2, 1, 2001));
}

#[test]
#[feature("safe_dispatcher")]
fn rejected_ingress_callback_rolls_back_marker_and_cursor() {
    let fixture = setup_with_ingress("RevertingSeasonIngressCancellationMock");
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let finality = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, finality.span());
    let safe_runtime = IHardenedInboxRuntimeSafeDispatcher { contract_address: fixture.runtime.contract_address };

    assert!(safe_runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span()).is_err());
    assert!(fixture.runtime.next_inbox_nonce() == 0);
    assert!(fixture.runtime.get_cancelled_slot(0).is_none());
}

#[test]
#[should_panic(expected: "FINALITY_PROOF_EMPTY")]
fn empty_finality_proof_is_rejected() {
    let fixture = setup();
    let marker = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);

    fixture.runtime.submit_finalized_header(header, array![].span());
}

#[test]
#[should_panic(expected: "HEADER_PARENT_MISMATCH")]
fn forked_parent_header_is_rejected() {
    let fixture = setup();
    let marker = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let forked = FinalizedStarknetHeader { parent_hash: 123456, ..header };
    let proof = finality_proof(@forked);

    fixture.runtime.submit_finalized_header(forked, proof.span());
}

#[test]
#[should_panic(expected: "FINALIZED_HEADER_UNKNOWN")]
fn unverified_trusted_checkpoint_anchor_cannot_authorize_storage() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (_, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);

    fixture.runtime.relay_cancelled_slot(INITIAL_BLOCK_HASH, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "L1_ANCHOR_NOT_MONOTONIC")]
fn regressing_l1_finality_anchor_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let regressed = FinalizedStarknetHeader { finalized_l1_block_number: 499, ..header };
    let proof = finality_proof(@regressed);

    fixture.runtime.submit_finalized_header(regressed, proof.span());
}

#[test]
#[should_panic(expected: "L1_ANCHOR_HASH_MISMATCH")]
fn same_height_l1_anchor_cannot_change_hash() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let forked_anchor = FinalizedStarknetHeader {
        finalized_l1_block_number: 500, finalized_l1_block_hash: 999999, ..header,
    };
    let proof = finality_proof(@forked_anchor);

    fixture.runtime.submit_finalized_header(forked_anchor, proof.span());
}

#[test]
#[should_panic(expected: "PILTOVER_CLASS_MISMATCH")]
fn wrong_piltover_contract_class_is_rejected() {
    let fixture = setup();
    let marker = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker, 778, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, marker, storage_proof.span());
}

#[test]
#[should_panic(expected: "CONTRACT_STATE_VERSION_MISMATCH")]
fn nonzero_contract_state_hash_version_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof_with_version(
        @marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE, 1,
    );
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "CANCELLATION_AFTER_STARKNET_HEADER")]
fn cancellation_marker_cannot_postdate_its_starknet_header() {
    let fixture = setup();
    let marker_value = CancelledInboxMarker {
        cancellation_finalized_at_l1: INITIAL_BLOCK_NUMBER + 2, ..marker(0, 2000, 3000),
    };
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "PATRICIA_NODE_HASH_INVALID")]
fn wrong_marker_body_is_rejected() {
    let fixture = setup();
    let proved_marker = marker(0, 2000, 3000);
    let supplied_marker = marker(0, 2000, 3001);
    let (header, storage_proof) = header_and_storage_proof(@proved_marker, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, supplied_marker, storage_proof.span());
}

#[test]
#[should_panic(expected: "PATRICIA_PATH_MISMATCH")]
fn wrong_piltover_storage_layout_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(
        @marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE + 1,
    );
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);

    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "HEADER_CHAIN_MISMATCH")]
fn header_from_another_chain_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let wrong_chain = FinalizedStarknetHeader { chain_id: 'SN_MAIN', ..header };
    let proof = finality_proof(@wrong_chain);

    fixture.runtime.submit_finalized_header(wrong_chain, proof.span());
}

#[test]
#[should_panic(expected: "HEADER_NOT_MONOTONIC")]
fn stale_header_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let stale = FinalizedStarknetHeader { block_number: INITIAL_BLOCK_NUMBER, ..header };
    let proof = finality_proof(@stale);

    fixture.runtime.submit_finalized_header(stale, proof.span());
}

#[test]
#[should_panic(expected: "FINALITY_PROOF_TOO_LARGE")]
fn oversized_finality_proof_is_rejected_before_verifier_dispatch() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);

    fixture.runtime.submit_finalized_header(header, repeated_felts(17).span());
}

#[test]
#[should_panic(expected: "FINALIZED_HEADER_UNKNOWN")]
fn unverified_header_cannot_authorize_a_cancelled_slot() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (_, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);

    fixture.runtime.relay_cancelled_slot(123456, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "STORAGE_PROOF_EMPTY")]
fn missing_storage_proof_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, array![].span());
}

#[test]
#[should_panic(expected: "STORAGE_PROOF_TOO_LARGE")]
fn oversized_storage_proof_is_rejected_before_decoding() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, _) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, repeated_felts(65).span());
}

#[test]
#[should_panic(expected: "CANCELLED_SLOT_OUT_OF_ORDER")]
fn future_cancelled_slot_is_rejected() {
    let fixture = setup();
    let marker_value = marker(1, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "OLD_MARKER_MISMATCH")]
fn replay_with_a_different_marker_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, proof.span());
    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker(0, 2001, 3000), storage_proof.span());
}

#[test]
#[should_panic(expected: "STARKNET_STATE_ROOT_MISMATCH")]
fn proof_from_a_different_state_root_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, storage_proof) = header_and_storage_proof(@marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE);
    let wrong_root = FinalizedStarknetHeader { state_root: header.state_root + 1, ..header };
    let header_hash = wrong_root.block_hash;
    let proof = finality_proof(@wrong_root);
    fixture.runtime.submit_finalized_header(wrong_root, proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
#[should_panic(expected: "STORAGE_PROOF_TRAILING_DATA")]
fn trailing_storage_proof_data_is_rejected() {
    let fixture = setup();
    let marker_value = marker(0, 2000, 3000);
    let (header, mut storage_proof) = header_and_storage_proof(
        @marker_value, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE,
    );
    storage_proof.append(123456);
    let header_hash = header.block_hash;
    let proof = finality_proof(@header);
    fixture.runtime.submit_finalized_header(header, proof.span());

    fixture.runtime.relay_cancelled_slot(header_hash, marker_value, storage_proof.span());
}

#[test]
fn binary_terminal_node_reconstructs_the_exact_root() {
    let terminal = TrieNode::Binary(BinaryNode { left: 123, right: 456 });
    let root = TrieNode::Edge(EdgeNode { path: 2, child: trie_node_hash(@terminal), length: 250 });

    assert!(compute_root(5, 456, array![root, terminal]) == trie_node_hash(@root));
}

#[test]
#[should_panic(expected: "PATRICIA_NODE_HASH_INVALID")]
fn malformed_multi_node_proof_is_rejected() {
    let terminal = TrieNode::Binary(BinaryNode { left: 123, right: 456 });
    let root = TrieNode::Edge(EdgeNode { path: 2, child: trie_node_hash(@terminal), length: 250 });

    compute_root(5, 457, array![root, terminal]);
}

#[test]
fn independently_captured_starknet_piltover_contract_proof_reconstructs() {
    let piltover = 0x6e1745e4c94abba8bf4dbde2b4d10f2e26495a085f451422e3ea52ba90950a1;
    let class_hash = 0x28078dda04ff5d0cc6e361d7c3ce22e6f8855655cee15ff387aa7d9e2a5716f;
    let storage_root = 0x66bbc65f814126ca1c813bdf3edf45610ab47fba30d6ab8e8727b36a2ac0334;
    let contract_leaf = 0x2a988a29d5c602ebbb17e68132435c5e43e92c2c6b26e43d12ef0c0b79228f0;
    let contracts_root = 0x5ec8f3e415abf4e31d6ff8c66826c99842d0c1034cb88da02dcacd179aaef57;
    let classes_root = 0x66db14fed264333f9cae1ca52d9e467ac1706193ccf73b59c5beaac5a54736a;
    let state_root = 0x790a64c9fa7815bbd3435146bc940af66dad9105850a5cdcfe443937203fad8;

    assert!(contract_state_hash(class_hash, storage_root, 0, 0) == contract_leaf);
    assert!(state_commitment(contracts_root, classes_root) == state_root);
    assert!(compute_root(piltover, contract_leaf, captured_piltover_contract_proof()) == contracts_root);
}

fn captured_piltover_contract_proof() -> Array<TrieNode> {
    array![
        TrieNode::Binary(
            BinaryNode {
                left: 0x483705da3a62f0296eba8cd9eff049f01a48030ce76fb14f822c8a3e4e2c54e,
                right: 0x14ad0581b07bd6e902ec5c8df61b23602ee7268feb97c6f2d10d05732ccbe44,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x5a05f9fd6edad8695890d02054c192440468650ef1604948e0b8746b6580ded,
                right: 0x30fea9c07ebfed9b126a27e0390d2c338b3a4f1b87aab28ab61d6215e01b81,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x3ff4ddd6c6a0206b076fe95d7e9324fe85e9bd487ad8f4776c8afbbbbd22176,
                right: 0x15b7dc596658e7d416b185f2c894adf866cf7f1ceb13c55a4de121a5d752cc2,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x51037eda940e64403fa64ae2cd70acfa0d2af437b61d9b10f52dcb2c4fe383b,
                right: 0x288cbbeaa18ec6a626a48b33ac5d65a0b3c6dfa42a79e16ffd1a5363111bef2,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x176847691b9b5a62095345ba1d19fdd72fed91281d9f77e275bb7394aa49a87,
                right: 0x2d0ab382a9cf0fd572c9e64366df4616f8d693336d7134c34d5802297974ace,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x26d83466b1c0e4ec4a8d3ae9c5b5f13c801f90e84961f3771b51ed73c335ea0,
                right: 0x1acdac0dad1dc365ecab7729474b9bb77b94833d2867c8d83eb0d6c851c75e0,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x5a7544886619d565edeb2fee293ff0bdb0640527876d2bdc04b82d476992aa5,
                right: 0x29106a3f2ec189148427c9806d11b00c84e9117169e938ef280787e67590b63,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x53304972c08437d5cf0c6c292357f17f7550f081c5c5344486bedb51f308fd,
                right: 0x4e89a0c0e718d6fd997804d1cd75656a614386c485cf8247b1e4a55708478ad,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x3ce92dd7c39a5877929451dca54d1573455f7cb99f740fe809eaf519b7aff71,
                right: 0x2fde66d8b52d8c3525dfd12906fb1bd26cfcc1b8304a5a8fdc4197fc09bd43,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x41339b8180d37f48ae5c08b753562d206336273a59696f43dab46243128d7ce,
                right: 0x55c3a0fbf7c71522232e2e117f91842e6b8e3e87a22b67136c7f52c10ab2477,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x7a717dae72b9ef5260e19a0dc5f04315bd2816b48e7d21c2d5c7f85984ee3d6,
                right: 0x5cced8a8ba82b1e5ce17f52f8824915fc910120c9b4a008dd23503b6a2bfd0b,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x4681c8bab5d63dc21df0a23b9b6112aa59233acfa77bf5e40f5fa121a30415f,
                right: 0x71691f4f3daf8b755aaecd14cc4dbcfbee3f34b6dbc2feb101628036e11585f,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x4d37654880519e2361f35752f5c80510983dde72da6f9f6e9e0470e9ad8d506,
                right: 0x39b58e26531a1ce34b34d66ae2b4fc416d390c83782b1dbbd7e4b5f99bba2db,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x691bc4448665728b59321f3dbb6f6a0cf81a1e02353306df85a8dce3de5beae,
                right: 0x67a6dfe17506bbf8004bc06c0bf563f3686e1080a80df5534ca790e527bb18a,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x4f3e65d0cfbd949a1d5e8ab48de18722ad2152a311c7f4db643e4246a47daef,
                right: 0x10653806c5e18bac997361659c75558e1f8c3384d2d21777d1611185a9eae6,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x46d21f275274fbb1c3cc99f375cac6526b8d56b1f1a48f0f13cce8fe9761fe0,
                right: 0x177c251b5ea68123563613067482f7f8106789c3e002275eff64a7db9762b11,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x4eb3e48267d14e9718687ca44597393caa02d360fea501d928dc5c46677d065,
                right: 0x2ea79c5316136786e3f387def124e16d4fcabb431ed111a92c35969e747c6e0,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x557d4214b8f60514cd2e55931148b0fdb105f797643eeb37621d64a434bfac8,
                right: 0x16f5e750c120e0c23fca2812529a3db3bd0ace84c9aa9d1b46f575ae19f5cd6,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x23b1e0e5699a29924256fba02f4ffc45890d9c2e4742f99554edc39cfd97086,
                right: 0x1183d11001059e0d7fdebf578487bb734ea76b38587ccd48cc2c85502baf26c,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x57fa442da5958c75624dfa87c125948ba67011498faf09326493f8adc4463d2,
                right: 0x35cadab256d8504d7c50f5c852df0e5528c6c4df33738f9d7389938203b5432,
            },
        ),
        TrieNode::Binary(
            BinaryNode {
                left: 0x58da6fc6717955d97fdf87dc9b40b7ef3aabfaa4919b60c51ffeab477d19a95,
                right: 0x733d7705aa076571ba943120629f9a09e0fa440df71ce8d7785fddd136c1d80,
            },
        ),
        TrieNode::Edge(
            EdgeNode {
                path: 0x1e4c94abba8bf4dbde2b4d10f2e26495a085f451422e3ea52ba90950a1,
                child: 0x2a988a29d5c602ebbb17e68132435c5e43e92c2c6b26e43d12ef0c0b79228f0,
                length: 230,
            },
        ),
    ]
}

fn setup() -> Fixture {
    setup_with_ingress("SeasonIngressCancellationMock")
}

fn setup_with_ingress(season_ingress_contract: ByteArray) -> Fixture {
    let verifier = deploy("FinalityVerifierMock", array![]);
    let verifier_class_hash: felt252 = get_class_hash(verifier).into();
    let season_ingress = deploy(season_ingress_contract, array![]);
    let season_ingress_class_hash: felt252 = get_class_hash(season_ingress).into();
    let policy = StarknetHeaderSourcePolicy {
        chain_id: CHAIN_ID,
        recursive_finality_verifier: verifier,
        initial_trusted_header_hash: INITIAL_BLOCK_HASH,
        initial_trusted_block_number: INITIAL_BLOCK_NUMBER,
        hardened_piltover_l1: PILTOVER_ADDRESS,
        piltover_storage_layout_hash: piltover_storage_layout_hash(
            PILTOVER_ADDRESS, PILTOVER_CLASS_HASH, CANCELLED_MARKER_BASE,
        ),
        max_finality_proof_felts: 16,
        max_storage_proof_felts: 64,
    };
    let initial_header = FinalizedStarknetHeader {
        chain_id: CHAIN_ID,
        block_number: INITIAL_BLOCK_NUMBER,
        block_hash: INITIAL_BLOCK_HASH,
        parent_hash: 999,
        state_root: 111,
        finalized_l1_block_number: 500,
        finalized_l1_block_hash: 501,
    };
    let mut calldata = array![DEPLOYMENT_ID];
    Serde::serialize(@policy, ref calldata);
    Serde::serialize(@initial_header, ref calldata);
    calldata.append(verifier_class_hash);
    calldata.append(PILTOVER_CLASS_HASH);
    calldata.append(CANCELLED_MARKER_BASE);
    calldata.append(season_ingress.into());
    calldata.append(season_ingress_class_hash);
    Fixture {
        runtime: IHardenedInboxRuntimeDispatcher { contract_address: deploy("HardenedInboxRuntimeSpike", calldata) },
        season_ingress: ISeasonIngressCancellationMockViewDispatcher { contract_address: season_ingress },
    }
}

fn marker(transport_nonce: u64, message_id: felt252, typed_body_hash: felt252) -> CancelledInboxMarker {
    CancelledInboxMarker {
        protocol_version: 1,
        deployment_id: DEPLOYMENT_ID,
        transport_nonce,
        message_id,
        typed_body_hash,
        cancellation_finalized_at_l1: INITIAL_BLOCK_NUMBER + 1,
    }
}

fn header_and_storage_proof(
    marker: @CancelledInboxMarker, class_hash: felt252, marker_base: felt252,
) -> (FinalizedStarknetHeader, Array<felt252>) {
    header_and_storage_proof_with_version(marker, class_hash, marker_base, 0)
}

fn header_and_storage_proof_with_version(
    marker: @CancelledInboxMarker, class_hash: felt252, marker_base: felt252, contract_state_hash_version: felt252,
) -> (FinalizedStarknetHeader, Array<felt252>) {
    let storage_key = cancelled_marker_storage_key(marker_base, *marker.transport_nonce);
    let storage_leaf = TrieNode::Edge(
        EdgeNode { path: storage_key, child: cancelled_marker_hash(marker), length: 251 },
    );
    let storage_root = trie_node_hash(@storage_leaf);
    let contract_hash = contract_state_hash(class_hash, storage_root, 0, contract_state_hash_version);
    let contract_leaf = TrieNode::Edge(EdgeNode { path: PILTOVER_ADDRESS, child: contract_hash, length: 251 });
    let contracts_root = trie_node_hash(@contract_leaf);
    let proof = ContractStateProof {
        class_commitment: 444,
        contract_proof: array![contract_leaf],
        contract_data: ContractData {
            class_hash, nonce: 0, contract_state_hash_version, storage_proof: array![storage_leaf],
        },
    };
    let mut encoded = array![];
    Serde::serialize(@proof, ref encoded);
    (
        FinalizedStarknetHeader {
            chain_id: CHAIN_ID,
            block_number: INITIAL_BLOCK_NUMBER + 1,
            block_hash: 1001,
            parent_hash: INITIAL_BLOCK_HASH,
            state_root: state_commitment(contracts_root, 444),
            finalized_l1_block_number: 601,
            finalized_l1_block_hash: 602,
        },
        encoded,
    )
}

fn finality_proof(header: @FinalizedStarknetHeader) -> Array<felt252> {
    finality_proof_from(INITIAL_BLOCK_HASH, INITIAL_BLOCK_NUMBER, header)
}

fn finality_proof_from(
    previous_header_hash: felt252, previous_block_number: u64, header: @FinalizedStarknetHeader,
) -> Array<felt252> {
    array![finality_proof_commitment(previous_header_hash, previous_block_number, header)]
}

fn repeated_felts(count: u32) -> Array<felt252> {
    let mut values = array![];
    for value in 0..count {
        values.append(value.into());
    }
    values
}

fn deploy(name: ByteArray, calldata: Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}
