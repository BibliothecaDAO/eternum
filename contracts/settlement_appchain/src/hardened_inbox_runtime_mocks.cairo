#[starknet::contract]
pub mod FinalityVerifierMock {
    use settlement_protocol::interfaces::IRecursiveStarknetFinalityVerifier;
    use settlement_protocol::types::FinalizedStarknetHeader;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl FinalityVerifierMockImpl of IRecursiveStarknetFinalityVerifier<ContractState> {
        fn verify_finalized_extension(
            self: @ContractState,
            previous_header_hash: felt252,
            previous_block_number: u64,
            header: FinalizedStarknetHeader,
            recursive_finality_proof: Span<felt252>,
        ) -> bool {
            if recursive_finality_proof.len() != 1 {
                return false;
            }
            if header.block_number != previous_block_number + 1 || header.parent_hash != previous_header_hash {
                return false;
            }
            let expected = super::finality_proof_commitment(previous_header_hash, previous_block_number, @header);
            *recursive_finality_proof[0] == expected
        }
    }
}

#[starknet::contract]
pub mod SeasonIngressCancellationMock {
    use settlement_protocol::interfaces::ISeasonIngressCancellation;
    use settlement_protocol::types::CancelledInboxMarker;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        consume_count: u64,
        last_transport_nonce: u64,
        last_message_id: felt252,
    }

    #[abi(embed_v0)]
    impl SeasonIngressCancellationMockImpl of ISeasonIngressCancellation<ContractState> {
        fn consume_cancelled_transport_slot(ref self: ContractState, marker: CancelledInboxMarker) {
            self.consume_count.write(self.consume_count.read() + 1);
            self.last_transport_nonce.write(marker.transport_nonce);
            self.last_message_id.write(marker.message_id);
        }
    }

    #[generate_trait]
    #[abi(per_item)]
    impl SeasonIngressCancellationMockViewImpl of SeasonIngressCancellationMockViewTrait {
        #[external(v0)]
        fn consumed(self: @ContractState) -> (u64, u64, felt252) {
            (self.consume_count.read(), self.last_transport_nonce.read(), self.last_message_id.read())
        }
    }
}

#[starknet::contract]
pub mod RevertingSeasonIngressCancellationMock {
    use settlement_protocol::interfaces::ISeasonIngressCancellation;
    use settlement_protocol::types::CancelledInboxMarker;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl RevertingSeasonIngressCancellationMockImpl of ISeasonIngressCancellation<ContractState> {
        fn consume_cancelled_transport_slot(ref self: ContractState, marker: CancelledInboxMarker) {
            let _marker = marker;
            panic!("INGRESS_CALLBACK_REJECTED");
        }
    }
}

pub fn finality_proof_commitment(
    previous_header_hash: felt252,
    previous_block_number: u64,
    header: @settlement_protocol::types::FinalizedStarknetHeader,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array![
            'FINALITY_PROOF_SPIKE_V1', previous_header_hash, previous_block_number.into(), *header.chain_id,
            (*header.block_number).into(), *header.block_hash, *header.parent_hash, *header.state_root,
            (*header.finalized_l1_block_number).into(), *header.finalized_l1_block_hash,
        ]
            .span(),
    )
}
