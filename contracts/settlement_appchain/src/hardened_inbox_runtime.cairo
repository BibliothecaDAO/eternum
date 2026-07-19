use core::hash::HashStateTrait;
use core::pedersen::PedersenTrait;
use core::poseidon::{PoseidonTrait, poseidon_hash_span};
use core::serde::Serde;
use settlement_protocol::types::CancelledInboxMarker;
use starknet::storage_access::storage_base_address_from_felt252;

const INBOX_CANCELLED_V1: felt252 = 0x29364c9bc322a000a8d7e3cb6f4c9bd0d6edf2999f822677ad5bc07140ff73;
const TRIE_HEIGHT: u16 = 251;

#[derive(Copy, Drop, Serde)]
pub struct BinaryNode {
    pub left: felt252,
    pub right: felt252,
}

#[derive(Copy, Drop, Serde)]
pub struct EdgeNode {
    pub path: felt252,
    pub child: felt252,
    pub length: u8,
}

#[derive(Copy, Drop, Serde)]
pub enum TrieNode {
    Binary: BinaryNode,
    Edge: EdgeNode,
}

#[derive(Destruct, Serde)]
pub struct ContractData {
    pub class_hash: felt252,
    pub nonce: felt252,
    pub contract_state_hash_version: felt252,
    pub storage_proof: Array<TrieNode>,
}

#[derive(Destruct, Serde)]
pub struct ContractStateProof {
    pub class_commitment: felt252,
    pub contract_proof: Array<TrieNode>,
    pub contract_data: ContractData,
}

pub fn cancelled_marker_hash(marker: @CancelledInboxMarker) -> felt252 {
    poseidon_hash_span(
        array![
            INBOX_CANCELLED_V1, (*marker.protocol_version).into(), *marker.deployment_id,
            (*marker.transport_nonce).into(), *marker.message_id, *marker.typed_body_hash,
            (*marker.cancellation_finalized_at_l1).into(),
        ]
            .span(),
    )
}

pub fn cancelled_marker_storage_key(marker_base: felt252, transport_nonce: u64) -> felt252 {
    let raw = pedersen_hash(marker_base, transport_nonce.into());
    let normalized = storage_base_address_from_felt252(raw);
    normalized.into()
}

pub fn piltover_storage_layout_hash(
    hardened_piltover_l1: felt252, expected_class_hash: felt252, cancelled_marker_storage_base: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![INBOX_CANCELLED_V1, hardened_piltover_l1, expected_class_hash, cancelled_marker_storage_base].span(),
    )
}

pub fn contract_state_hash(
    class_hash: felt252, storage_root: felt252, nonce: felt252, contract_state_hash_version: felt252,
) -> felt252 {
    PedersenTrait::new(class_hash).update(storage_root).update(nonce).update(contract_state_hash_version).finalize()
}

pub fn state_commitment(contracts_root: felt252, class_commitment: felt252) -> felt252 {
    PoseidonTrait::new().update('STARKNET_STATE_V0').update(contracts_root).update(class_commitment).finalize()
}

pub fn trie_node_hash(node: @TrieNode) -> felt252 {
    match node {
        TrieNode::Binary(binary) => pedersen_hash(*binary.left, *binary.right),
        TrieNode::Edge(edge) => pedersen_hash(*edge.child, *edge.path) + (*edge.length).into(),
    }
}

fn verify_piltover_storage_value(
    expected_state_commitment: felt252,
    piltover_address: felt252,
    storage_address: felt252,
    expected_class_hash: felt252,
    expected_storage_value: felt252,
    encoded_proof: Span<felt252>,
) {
    let mut encoded_proof = encoded_proof;
    let proof: ContractStateProof = Serde::deserialize(ref encoded_proof).expect('INVALID_STORAGE_PROOF');
    assert!(encoded_proof.is_empty(), "STORAGE_PROOF_TRAILING_DATA");
    assert!(proof.contract_data.class_hash == expected_class_hash, "PILTOVER_CLASS_MISMATCH");
    assert!(proof.contract_data.contract_state_hash_version == 0, "CONTRACT_STATE_VERSION_MISMATCH");

    let contract_data = proof.contract_data;
    let storage_root = compute_root(storage_address, expected_storage_value, contract_data.storage_proof);
    let expected_contract_hash = contract_state_hash(
        contract_data.class_hash, storage_root, contract_data.nonce, contract_data.contract_state_hash_version,
    );
    let contracts_root = compute_root(piltover_address, expected_contract_hash, proof.contract_proof);
    assert!(
        state_commitment(contracts_root, proof.class_commitment) == expected_state_commitment,
        "STARKNET_STATE_ROOT_MISMATCH",
    );
}

pub fn compute_root(expected_path: felt252, expected_leaf: felt252, proof: Array<TrieNode>) -> felt252 {
    let mut nodes = proof.span();
    assert!(!nodes.is_empty(), "EMPTY_PATRICIA_PROOF");
    let mut expected_hash = expected_leaf;
    let mut path = 0;
    let mut path_length = 0;
    let mut path_length_pow2 = 1;
    let expected_path_u256: u256 = expected_path.into();

    loop {
        match nodes.pop_back() {
            Option::Some(node) => {
                match node {
                    TrieNode::Binary(binary) => {
                        assert!(path_length < TRIE_HEIGHT, "PATRICIA_PATH_TOO_DEEP");
                        if expected_path_u256 & path_length_pow2.into() > 0 {
                            assert!(expected_hash == *binary.right, "PATRICIA_NODE_HASH_INVALID");
                            path += path_length_pow2;
                        } else {
                            assert!(expected_hash == *binary.left, "PATRICIA_NODE_HASH_INVALID");
                        }
                        path_length += 1;
                        path_length_pow2 *= 2;
                    },
                    TrieNode::Edge(edge) => {
                        assert_edge_path(*edge.path, *edge.length);
                        assert!(expected_hash == *edge.child, "PATRICIA_NODE_HASH_INVALID");
                        assert!(path_length + (*edge.length).into() <= TRIE_HEIGHT, "PATRICIA_PATH_TOO_DEEP");
                        path += *edge.path * path_length_pow2;
                        path_length += (*edge.length).into();
                        path_length_pow2 *= pow2((*edge.length).into());
                    },
                }
                expected_hash = trie_node_hash(node);
            },
            Option::None => { break; },
        }
    }
    assert!(path_length == TRIE_HEIGHT, "PATRICIA_PATH_WRONG_HEIGHT");
    assert!(expected_path == path, "PATRICIA_PATH_MISMATCH");
    expected_hash
}

fn assert_edge_path(path: felt252, length: u8) {
    assert!(length != 0, "PATRICIA_ZERO_EDGE");
    let path_u256: u256 = path.into();
    let bound_u256: u256 = pow2(length.into()).into();
    assert!(path_u256 < bound_u256, "PATRICIA_EDGE_PATH_OVERFLOW");
}

fn pow2(exponent: u16) -> felt252 {
    let mut result = 1;
    let mut cursor = 0;
    loop {
        if cursor == exponent {
            return result;
        }
        result *= 2;
        cursor += 1;
    }
}

fn pedersen_hash(left: felt252, right: felt252) -> felt252 {
    PedersenTrait::new(left).update(right).finalize()
}

#[starknet::contract]
pub mod HardenedInboxRuntimeSpike {
    use settlement_protocol::interfaces::{
        IHardenedInboxRuntime, IRecursiveStarknetFinalityVerifierDispatcher,
        IRecursiveStarknetFinalityVerifierDispatcherTrait, ISeasonIngressCancellationDispatcher,
        ISeasonIngressCancellationDispatcherTrait,
    };
    use settlement_protocol::types::{
        CancelledInboxMarker, CancelledSlotRelayResult, FinalizedStarknetHeader, StarknetHeaderSourcePolicy,
    };
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, SyscallResultTrait};
    use super::{
        cancelled_marker_hash, cancelled_marker_storage_key, piltover_storage_layout_hash,
        verify_piltover_storage_value,
    };

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredPolicy {
        chain_id: felt252,
        recursive_finality_verifier: ContractAddress,
        initial_trusted_header_hash: felt252,
        initial_trusted_block_number: u64,
        hardened_piltover_l1: felt252,
        piltover_storage_layout_hash: felt252,
        max_finality_proof_felts: u16,
        max_storage_proof_felts: u16,
    }

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredHeader {
        chain_id: felt252,
        block_number: u64,
        block_hash: felt252,
        parent_hash: felt252,
        state_root: felt252,
        finalized_l1_block_number: u64,
        finalized_l1_block_hash: felt252,
    }

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredMarker {
        protocol_version: u16,
        deployment_id: felt252,
        transport_nonce: u64,
        message_id: felt252,
        typed_body_hash: felt252,
        cancellation_finalized_at_l1: u64,
    }

    #[storage]
    struct Storage {
        deployment_id: felt252,
        policy: StoredPolicy,
        latest_header: StoredHeader,
        header_exists: Map<felt252, bool>,
        headers: Map<felt252, StoredHeader>,
        expected_finality_verifier_class_hash: felt252,
        expected_piltover_class_hash: felt252,
        cancelled_marker_storage_base: felt252,
        season_ingress: ContractAddress,
        expected_season_ingress_class_hash: felt252,
        next_inbox_nonce: u64,
        marker_exists: Map<u64, bool>,
        marker_hashes: Map<u64, felt252>,
        markers: Map<u64, StoredMarker>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        FinalizedHeaderAccepted: FinalizedHeaderAccepted,
        CancelledSlotApplied: CancelledSlotApplied,
    }

    #[derive(Drop, starknet::Event)]
    struct FinalizedHeaderAccepted {
        #[key]
        block_hash: felt252,
        block_number: u64,
        state_root: felt252,
        finalized_l1_block_number: u64,
        finalized_l1_block_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct CancelledSlotApplied {
        #[key]
        message_id: felt252,
        transport_nonce: u64,
        marker_hash: felt252,
        finalized_header_hash: felt252,
        resulting_cursor: u64,
    }

    #[derive(Copy, Drop)]
    struct HeaderSubmissionContext {
        policy: StoredPolicy,
        latest: StoredHeader,
        candidate: StoredHeader,
    }

    #[derive(Copy, Drop)]
    struct CancellationContext {
        policy: StoredPolicy,
        header: StoredHeader,
        marker_hash: felt252,
        resulting_cursor: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        deployment_id: felt252,
        policy: StarknetHeaderSourcePolicy,
        initial_header: FinalizedStarknetHeader,
        expected_finality_verifier_class_hash: felt252,
        expected_piltover_class_hash: felt252,
        cancelled_marker_storage_base: felt252,
        season_ingress: ContractAddress,
        expected_season_ingress_class_hash: felt252,
    ) {
        assert!(deployment_id != 0, "ZERO_DEPLOYMENT_ID");
        assert!(policy.chain_id != 0, "ZERO_CHAIN_ID");
        assert!(policy.recursive_finality_verifier != 0.try_into().unwrap(), "ZERO_FINALITY_VERIFIER");
        assert!(policy.hardened_piltover_l1 != 0, "ZERO_PILTOVER_ADDRESS");
        assert!(policy.piltover_storage_layout_hash != 0, "ZERO_PILTOVER_LAYOUT");
        assert!(policy.max_finality_proof_felts != 0, "ZERO_FINALITY_BOUND");
        assert!(policy.max_storage_proof_felts != 0, "ZERO_STORAGE_BOUND");
        assert!(expected_finality_verifier_class_hash != 0, "ZERO_FINALITY_VERIFIER_CLASS");
        assert!(expected_piltover_class_hash != 0, "ZERO_PILTOVER_CLASS");
        assert!(cancelled_marker_storage_base != 0, "ZERO_MARKER_BASE");
        assert!(season_ingress != 0.try_into().unwrap(), "ZERO_SEASON_INGRESS");
        assert!(expected_season_ingress_class_hash != 0, "ZERO_SEASON_INGRESS_CLASS");
        assert!(
            policy
                .piltover_storage_layout_hash == piltover_storage_layout_hash(
                    policy.hardened_piltover_l1, expected_piltover_class_hash, cancelled_marker_storage_base,
                ),
            "PILTOVER_LAYOUT_MISMATCH",
        );
        assert!(initial_header.chain_id == policy.chain_id, "INITIAL_HEADER_CHAIN_MISMATCH");
        assert!(
            initial_header.block_hash != 0
                && initial_header.state_root != 0
                && initial_header.finalized_l1_block_hash != 0,
            "INITIAL_HEADER_ZERO_COMMITMENT",
        );
        assert!(initial_header.block_hash == policy.initial_trusted_header_hash, "INITIAL_HEADER_HASH_MISMATCH");
        assert!(initial_header.block_number == policy.initial_trusted_block_number, "INITIAL_HEADER_NUMBER_MISMATCH");
        assert_finality_verifier_class_address(
            policy.recursive_finality_verifier, expected_finality_verifier_class_hash,
        );
        assert_season_ingress_class_address(season_ingress, expected_season_ingress_class_hash);

        let stored_policy = store_policy(@policy);
        let stored_header = store_header(@initial_header);
        self.deployment_id.write(deployment_id);
        self.policy.write(stored_policy);
        self.latest_header.write(stored_header);
        self.expected_finality_verifier_class_hash.write(expected_finality_verifier_class_hash);
        self.expected_piltover_class_hash.write(expected_piltover_class_hash);
        self.cancelled_marker_storage_base.write(cancelled_marker_storage_base);
        self.season_ingress.write(season_ingress);
        self.expected_season_ingress_class_hash.write(expected_season_ingress_class_hash);
    }

    #[abi(embed_v0)]
    impl HardenedInboxRuntimeImpl of IHardenedInboxRuntime<ContractState> {
        fn submit_finalized_header(
            ref self: ContractState, header: FinalizedStarknetHeader, recursive_finality_proof: Span<felt252>,
        ) {
            let context = validate_header_submission(@self, @header, recursive_finality_proof);
            verify_finalized_extension(@self, context, header, recursive_finality_proof);
            persist_finalized_header(ref self, context.candidate);
        }

        fn relay_cancelled_slot(
            ref self: ContractState,
            finalized_header_hash: felt252,
            marker: CancelledInboxMarker,
            piltover_storage_proof: Span<felt252>,
        ) -> CancelledSlotRelayResult {
            assert_marker_shape(@self, @marker);
            let marker_hash = cancelled_marker_hash(@marker);
            let next_nonce = self.next_inbox_nonce.read();
            match replay_result(@self, @marker, marker_hash, next_nonce) {
                Option::Some(result) => { return result; },
                Option::None => {},
            }
            let context = validate_cancellation_request(
                @self, finalized_header_hash, @marker, marker_hash, next_nonce, piltover_storage_proof,
            );
            verify_cancellation_proof(@self, @marker, context, piltover_storage_proof);
            apply_cancelled_slot(ref self, finalized_header_hash, marker, context)
        }

        fn header_source_policy(self: @ContractState) -> StarknetHeaderSourcePolicy {
            load_policy(self.policy.read())
        }

        fn latest_finalized_header(self: @ContractState) -> FinalizedStarknetHeader {
            load_header(self.latest_header.read())
        }

        fn get_finalized_header(self: @ContractState, block_hash: felt252) -> Option<FinalizedStarknetHeader> {
            if self.header_exists.read(block_hash) {
                Option::Some(load_header(self.headers.read(block_hash)))
            } else {
                Option::None
            }
        }

        fn next_inbox_nonce(self: @ContractState) -> u64 {
            self.next_inbox_nonce.read()
        }

        fn get_cancelled_slot(self: @ContractState, transport_nonce: u64) -> Option<CancelledInboxMarker> {
            if self.marker_exists.read(transport_nonce) {
                Option::Some(load_marker(self.markers.read(transport_nonce)))
            } else {
                Option::None
            }
        }
    }

    fn validate_header_submission(
        self: @ContractState, header: @FinalizedStarknetHeader, recursive_finality_proof: Span<felt252>,
    ) -> HeaderSubmissionContext {
        let policy = self.policy.read();
        let latest = self.latest_header.read();
        assert!(!recursive_finality_proof.is_empty(), "FINALITY_PROOF_EMPTY");
        assert!(recursive_finality_proof.len() <= policy.max_finality_proof_felts.into(), "FINALITY_PROOF_TOO_LARGE");
        assert!(*header.chain_id == policy.chain_id, "HEADER_CHAIN_MISMATCH");
        assert!(*header.block_number > latest.block_number, "HEADER_NOT_MONOTONIC");
        assert!(*header.parent_hash == latest.block_hash, "HEADER_PARENT_MISMATCH");
        assert!(*header.finalized_l1_block_number >= latest.finalized_l1_block_number, "L1_ANCHOR_NOT_MONOTONIC");
        if *header.finalized_l1_block_number == latest.finalized_l1_block_number {
            assert!(*header.finalized_l1_block_hash == latest.finalized_l1_block_hash, "L1_ANCHOR_HASH_MISMATCH");
        }
        assert!(!self.header_exists.read(*header.block_hash), "HEADER_ALREADY_STORED");
        assert!(
            *header.block_hash != 0 && *header.state_root != 0 && *header.finalized_l1_block_hash != 0,
            "HEADER_ZERO_COMMITMENT",
        );
        HeaderSubmissionContext { policy, latest, candidate: store_header(header) }
    }

    fn verify_finalized_extension(
        self: @ContractState,
        context: HeaderSubmissionContext,
        header: FinalizedStarknetHeader,
        recursive_finality_proof: Span<felt252>,
    ) {
        assert_finality_verifier_class(self, context.policy.recursive_finality_verifier);
        let verifier = IRecursiveStarknetFinalityVerifierDispatcher {
            contract_address: context.policy.recursive_finality_verifier,
        };
        assert!(
            verifier
                .verify_finalized_extension(
                    context.latest.block_hash, context.latest.block_number, header, recursive_finality_proof,
                ),
            "FINALITY_EXTENSION_INVALID",
        );
    }

    fn persist_finalized_header(ref self: ContractState, header: StoredHeader) {
        self.header_exists.write(header.block_hash, true);
        self.headers.write(header.block_hash, header);
        self.latest_header.write(header);
        self
            .emit(
                FinalizedHeaderAccepted {
                    block_hash: header.block_hash,
                    block_number: header.block_number,
                    state_root: header.state_root,
                    finalized_l1_block_number: header.finalized_l1_block_number,
                    finalized_l1_block_hash: header.finalized_l1_block_hash,
                },
            );
    }

    fn replay_result(
        self: @ContractState, marker: @CancelledInboxMarker, marker_hash: felt252, next_nonce: u64,
    ) -> Option<CancelledSlotRelayResult> {
        if *marker.transport_nonce >= next_nonce {
            return Option::None;
        }
        assert!(self.marker_hashes.read(*marker.transport_nonce) == marker_hash, "OLD_MARKER_MISMATCH");
        Option::Some(CancelledSlotRelayResult::AlreadyApplied((*marker.message_id, *marker.transport_nonce + 1)))
    }

    fn validate_cancellation_request(
        self: @ContractState,
        finalized_header_hash: felt252,
        marker: @CancelledInboxMarker,
        marker_hash: felt252,
        next_nonce: u64,
        piltover_storage_proof: Span<felt252>,
    ) -> CancellationContext {
        assert!(*marker.transport_nonce == next_nonce, "CANCELLED_SLOT_OUT_OF_ORDER");
        assert!(self.header_exists.read(finalized_header_hash), "FINALIZED_HEADER_UNKNOWN");
        let policy = self.policy.read();
        assert!(!piltover_storage_proof.is_empty(), "STORAGE_PROOF_EMPTY");
        assert!(piltover_storage_proof.len() <= policy.max_storage_proof_felts.into(), "STORAGE_PROOF_TOO_LARGE");
        let header = self.headers.read(finalized_header_hash);
        assert!(*marker.cancellation_finalized_at_l1 <= header.block_number, "CANCELLATION_AFTER_STARKNET_HEADER");
        CancellationContext { policy, header, marker_hash, resulting_cursor: next_nonce + 1 }
    }

    fn verify_cancellation_proof(
        self: @ContractState,
        marker: @CancelledInboxMarker,
        context: CancellationContext,
        piltover_storage_proof: Span<felt252>,
    ) {
        let storage_key = cancelled_marker_storage_key(
            self.cancelled_marker_storage_base.read(), *marker.transport_nonce,
        );
        verify_piltover_storage_value(
            context.header.state_root,
            context.policy.hardened_piltover_l1,
            storage_key,
            self.expected_piltover_class_hash.read(),
            context.marker_hash,
            piltover_storage_proof,
        );
    }

    fn apply_cancelled_slot(
        ref self: ContractState,
        finalized_header_hash: felt252,
        marker: CancelledInboxMarker,
        context: CancellationContext,
    ) -> CancelledSlotRelayResult {
        let message_id = marker.message_id;
        let transport_nonce = marker.transport_nonce;
        let stored_marker = store_marker(@marker);
        consume_cancelled_slot(@self, marker);
        self.marker_exists.write(transport_nonce, true);
        self.marker_hashes.write(transport_nonce, context.marker_hash);
        self.markers.write(transport_nonce, stored_marker);
        self.next_inbox_nonce.write(context.resulting_cursor);
        self
            .emit(
                CancelledSlotApplied {
                    message_id,
                    transport_nonce,
                    marker_hash: context.marker_hash,
                    finalized_header_hash,
                    resulting_cursor: context.resulting_cursor,
                },
            );
        CancelledSlotRelayResult::Applied((message_id, context.resulting_cursor))
    }

    fn assert_marker_shape(self: @ContractState, marker: @CancelledInboxMarker) {
        assert!(*marker.protocol_version == 1, "MARKER_PROTOCOL_MISMATCH");
        assert!(*marker.deployment_id == self.deployment_id.read(), "MARKER_DEPLOYMENT_MISMATCH");
        assert!(*marker.message_id != 0, "ZERO_MARKER_MESSAGE");
        assert!(*marker.typed_body_hash != 0, "ZERO_MARKER_BODY");
        assert!(*marker.cancellation_finalized_at_l1 != 0, "ZERO_CANCELLATION_BLOCK");
    }

    fn assert_finality_verifier_class(self: @ContractState, verifier: ContractAddress) {
        assert_finality_verifier_class_address(verifier, self.expected_finality_verifier_class_hash.read());
    }

    fn consume_cancelled_slot(self: @ContractState, marker: CancelledInboxMarker) {
        let season_ingress = self.season_ingress.read();
        assert_season_ingress_class_address(season_ingress, self.expected_season_ingress_class_hash.read());
        ISeasonIngressCancellationDispatcher { contract_address: season_ingress }
            .consume_cancelled_transport_slot(marker);
    }

    fn assert_finality_verifier_class_address(address: ContractAddress, expected_class_hash: felt252) {
        let actual: felt252 = starknet::syscalls::get_class_hash_at_syscall(address).unwrap_syscall().into();
        assert!(actual == expected_class_hash, "FINALITY_VERIFIER_CLASS_MISMATCH");
    }

    fn assert_season_ingress_class_address(address: ContractAddress, expected_class_hash: felt252) {
        let actual: felt252 = starknet::syscalls::get_class_hash_at_syscall(address).unwrap_syscall().into();
        assert!(actual == expected_class_hash, "SEASON_INGRESS_CLASS_MISMATCH");
    }

    fn store_policy(policy: @StarknetHeaderSourcePolicy) -> StoredPolicy {
        StoredPolicy {
            chain_id: *policy.chain_id,
            recursive_finality_verifier: *policy.recursive_finality_verifier,
            initial_trusted_header_hash: *policy.initial_trusted_header_hash,
            initial_trusted_block_number: *policy.initial_trusted_block_number,
            hardened_piltover_l1: *policy.hardened_piltover_l1,
            piltover_storage_layout_hash: *policy.piltover_storage_layout_hash,
            max_finality_proof_felts: *policy.max_finality_proof_felts,
            max_storage_proof_felts: *policy.max_storage_proof_felts,
        }
    }

    fn load_policy(policy: StoredPolicy) -> StarknetHeaderSourcePolicy {
        StarknetHeaderSourcePolicy {
            chain_id: policy.chain_id,
            recursive_finality_verifier: policy.recursive_finality_verifier,
            initial_trusted_header_hash: policy.initial_trusted_header_hash,
            initial_trusted_block_number: policy.initial_trusted_block_number,
            hardened_piltover_l1: policy.hardened_piltover_l1,
            piltover_storage_layout_hash: policy.piltover_storage_layout_hash,
            max_finality_proof_felts: policy.max_finality_proof_felts,
            max_storage_proof_felts: policy.max_storage_proof_felts,
        }
    }

    fn store_header(header: @FinalizedStarknetHeader) -> StoredHeader {
        StoredHeader {
            chain_id: *header.chain_id,
            block_number: *header.block_number,
            block_hash: *header.block_hash,
            parent_hash: *header.parent_hash,
            state_root: *header.state_root,
            finalized_l1_block_number: *header.finalized_l1_block_number,
            finalized_l1_block_hash: *header.finalized_l1_block_hash,
        }
    }

    fn load_header(header: StoredHeader) -> FinalizedStarknetHeader {
        FinalizedStarknetHeader {
            chain_id: header.chain_id,
            block_number: header.block_number,
            block_hash: header.block_hash,
            parent_hash: header.parent_hash,
            state_root: header.state_root,
            finalized_l1_block_number: header.finalized_l1_block_number,
            finalized_l1_block_hash: header.finalized_l1_block_hash,
        }
    }

    fn store_marker(marker: @CancelledInboxMarker) -> StoredMarker {
        StoredMarker {
            protocol_version: *marker.protocol_version,
            deployment_id: *marker.deployment_id,
            transport_nonce: *marker.transport_nonce,
            message_id: *marker.message_id,
            typed_body_hash: *marker.typed_body_hash,
            cancellation_finalized_at_l1: *marker.cancellation_finalized_at_l1,
        }
    }

    fn load_marker(marker: StoredMarker) -> CancelledInboxMarker {
        CancelledInboxMarker {
            protocol_version: marker.protocol_version,
            deployment_id: marker.deployment_id,
            transport_nonce: marker.transport_nonce,
            message_id: marker.message_id,
            typed_body_hash: marker.typed_body_hash,
            cancellation_finalized_at_l1: marker.cancellation_finalized_at_l1,
        }
    }
}
