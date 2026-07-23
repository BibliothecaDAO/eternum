use starknet_crypto::Felt;

use crate::codec::CanonicalEncode;
use crate::protocol_hash::domain;
use crate::types::ProtocolEnvelope;

pub const MAINNET_TO_APPCHAIN: u8 = 1;
pub const APPCHAIN_TO_MAINNET: u8 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportHashError {
    UnsupportedDirection(u8),
}

pub fn typed_body_hash(protocol_version: u16, action: u16, body_felts: &[Felt]) -> Felt {
    let mut preimage = Vec::with_capacity(body_felts.len() + 4);
    preimage.extend([
        domain("ETERNUM_TYPED_BODY_V1"),
        Felt::from(protocol_version),
        Felt::from(action),
        Felt::from(body_felts.len() as u64),
    ]);
    preimage.extend_from_slice(body_felts);
    crate::poseidon_hash_many(&preimage)
}

pub fn protocol_envelope_hash(envelope: &ProtocolEnvelope) -> Felt {
    let envelope_felts = envelope.encode();
    let mut preimage = Vec::with_capacity(envelope_felts.len() + 2);
    preimage.extend([
        domain("ETERNUM_ENVELOPE_V1"),
        Felt::from(envelope_felts.len() as u64),
    ]);
    preimage.extend(envelope_felts);
    crate::poseidon_hash_many(&preimage)
}

pub fn derive_message_id(
    direction: u8,
    deployment_id: Felt,
    transport_nonce: u64,
    typed_body_hash: Felt,
) -> Result<Felt, TransportHashError> {
    validate_direction(direction)?;
    Ok(crate::poseidon_hash_many(&[
        domain("ETERNUM_MESSAGE_V1"),
        Felt::from(direction),
        deployment_id,
        Felt::from(transport_nonce),
        typed_body_hash,
    ]))
}

fn validate_direction(direction: u8) -> Result<(), TransportHashError> {
    if direction != MAINNET_TO_APPCHAIN && direction != APPCHAIN_TO_MAINNET {
        return Err(TransportHashError::UnsupportedDirection(direction));
    }
    Ok(())
}
