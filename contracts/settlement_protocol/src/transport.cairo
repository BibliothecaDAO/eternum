use core::poseidon::poseidon_hash_span;
use crate::schema_vector::{ETERNUM_ENVELOPE_V1, ETERNUM_MESSAGE_V1, ETERNUM_TYPED_BODY_V1};
use crate::types::ProtocolEnvelope;

pub const MAINNET_TO_APPCHAIN: u8 = 1;
pub const APPCHAIN_TO_MAINNET: u8 = 2;

pub fn typed_body_hash(protocol_version: u16, action: u16, body_felts: Span<felt252>) -> felt252 {
    let mut preimage = array![ETERNUM_TYPED_BODY_V1, protocol_version.into(), action.into(), body_felts.len().into()];
    append_felts(ref preimage, body_felts);
    poseidon_hash_span(preimage.span())
}

pub fn protocol_envelope_hash(envelope: ProtocolEnvelope) -> felt252 {
    let mut envelope_felts = array![];
    envelope.serialize(ref envelope_felts);

    let mut preimage = array![ETERNUM_ENVELOPE_V1, envelope_felts.len().into()];
    append_felts(ref preimage, envelope_felts.span());
    poseidon_hash_span(preimage.span())
}

pub fn derive_message_id(
    direction: u8, deployment_id: felt252, transport_nonce: u64, typed_body_hash: felt252,
) -> felt252 {
    assert_valid_direction(direction);
    poseidon_hash_span(
        array![ETERNUM_MESSAGE_V1, direction.into(), deployment_id, transport_nonce.into(), typed_body_hash].span(),
    )
}

fn append_felts(ref target: Array<felt252>, values: Span<felt252>) {
    for value in values {
        target.append(*value);
    }
}

fn assert_valid_direction(direction: u8) {
    assert!(direction == MAINNET_TO_APPCHAIN || direction == APPCHAIN_TO_MAINNET, "INVALID_DIRECTION");
}
