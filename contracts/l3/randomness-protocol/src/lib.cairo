pub mod entrypoint;
use core::poseidon::poseidon_hash_span;

const ACTION_TAG: felt252 = 'ETERNUM_ACTION';
const ENVELOPE_TAG: felt252 = 'ETERNUM_ENTROPY';

#[derive(Drop, Debug, PartialEq, Serde)]
pub struct Intent {
    pub chain: felt252,
    pub deployment: felt252,
    pub game: felt252,
    pub actor: felt252,
    pub nonce: u64,
    pub command: felt252,
    pub rules: felt252,
    pub valid_from: u64,
    pub valid_until: u64,
    pub last_order: u64,
    pub arguments: Array<felt252>,
}

#[derive(Drop, PartialEq, Serde)]
pub struct Envelope {
    pub action: felt252,
    pub order: u64,
    pub predecessor: felt252,
    pub preceding_state: felt252,
    pub timestamp: u64,
    pub execution_config: felt252,
    pub l2_gas: u64,
    pub root: u256,
}

pub fn encode_intent(intent: @Intent) -> Array<felt252> {
    assert!(intent.valid_from <= intent.valid_until, "invalid validity");
    assert!(*intent.last_order > 0, "invalid last order");
    assert!(intent.arguments.len() <= 256, "too many arguments");
    let mut fields = array![ACTION_TAG, 1];
    intent.serialize(ref fields);
    fields
}

pub fn decode_intent(mut fields: Span<felt252>) -> Option<Intent> {
    if *fields.pop_front()? != ACTION_TAG || *fields.pop_front()? != 1 {
        return Option::None;
    }
    let intent: Intent = Serde::deserialize(ref fields)?;
    if !fields.is_empty()
        || intent.valid_from > intent.valid_until
        || intent.last_order == 0
        || intent.arguments.len() > 256 {
        return Option::None;
    }
    Option::Some(intent)
}

pub fn action_identity(intent: @Intent) -> felt252 {
    poseidon_hash_span(encode_intent(intent).span())
}

pub fn encode_envelope(envelope: @Envelope) -> Array<felt252> {
    assert!(*envelope.order > 0 && *envelope.l2_gas > 0, "invalid execution bounds");
    let mut fields = array![ENVELOPE_TAG, 1];
    envelope.serialize(ref fields);
    fields
}

pub fn decode_envelope(mut fields: Span<felt252>) -> Option<Envelope> {
    if *fields.pop_front()? != ENVELOPE_TAG || *fields.pop_front()? != 1 {
        return Option::None;
    }
    let envelope: Envelope = Serde::deserialize(ref fields)?;
    if !fields.is_empty() || envelope.order == 0 || envelope.l2_gas == 0 {
        return Option::None;
    }
    Option::Some(envelope)
}

pub fn envelope_binding(envelope: @Envelope) -> felt252 {
    poseidon_hash_span(encode_envelope(envelope).span())
}

pub fn encode_bytes(fields: Span<felt252>) -> Array<u8> {
    let mut bytes = array![];
    for field in fields {
        let value: u256 = (*field).into();
        for limb in array![value.high, value.low] {
            let mut divisor: u128 = 0x1000000000000000000000000000000;
            for _ in 0_u32..16 {
                bytes.append(((limb / divisor) % 256).try_into().unwrap());
                divisor /= 256;
            }
        }
    }
    bytes
}

pub fn decode_bytes(bytes: Span<u8>) -> Option<Array<felt252>> {
    if bytes.len() % 32 != 0 {
        return Option::None;
    }
    let mut fields = array![];
    for index in 0..bytes.len() / 32 {
        let mut value: u256 = 0;
        for byte in bytes.slice(index * 32, 32) {
            value = value * 256 + (*byte).into();
        }
        fields.append(value.try_into()?);
    }
    Option::Some(fields)
}
