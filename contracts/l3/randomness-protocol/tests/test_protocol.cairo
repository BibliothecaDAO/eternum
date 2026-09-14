use core::poseidon::poseidon_hash_span;
use eternum_randomness_protocol::{
    action_identity, decode_bytes, decode_envelope, decode_intent, encode_bytes, encode_envelope, encode_intent,
    envelope_binding,
};
use snforge_std::fs::{FileTrait, read_txt};

#[derive(Drop, Serde)]
struct Draw {
    salt: u128,
    bound: u128,
    expected: u128,
}

#[derive(Drop, Serde)]
struct Vector {
    intent: Array<felt252>,
    action: felt252,
    envelope: Array<felt252>,
    binding: felt252,
    root_bytes: Array<u8>,
    canonical_bytes: Array<u8>,
    draws: Array<Draw>,
}

#[test]
fn canonical_cross_language_vectors() {
    let input = read_txt(@FileTrait::new("tests/fixtures/v1.txt"));
    let mut fields = input.span();
    let vectors: Array<Vector> = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing fixture data");
    for vector in vectors {
        let intent = decode_intent(vector.intent.span()).unwrap();
        assert!(encode_intent(@intent) == vector.intent, "intent roundtrip");
        assert!(action_identity(@intent) == vector.action, "action identity");
        let envelope = decode_envelope(vector.envelope.span()).unwrap();
        assert!(encode_envelope(@envelope) == vector.envelope, "envelope roundtrip");
        assert!(envelope_binding(@envelope) == vector.binding, "binding");
        assert!(envelope.action == vector.action, "action binding");
        let mut combined = vector.intent.clone();
        combined.append_span(vector.envelope.span());
        assert!(encode_bytes(combined.span()) == vector.canonical_bytes, "canonical byte encoding");
        assert!(decode_bytes(vector.canonical_bytes.span()).unwrap() == combined, "canonical byte decoding");
        let mut root: u256 = 0;
        for byte in vector.root_bytes {
            root = root * 256 + byte.into();
        }
        assert!(envelope.root == root, "root byte order");
        for draw in vector.draws {
            let hash: u256 = poseidon_hash_span(array![root.low.into(), root.high.into(), draw.salt.into()].span())
                .into();
            assert!(hash % draw.bound.into() == draw.expected.into(), "current derivation");
        }
    }
}

#[test]
fn rejects_noncanonical_bytes() {
    assert!(decode_bytes(array![0_u8].span()).is_none(), "partial felt");
    let mut bytes = array![];
    for _ in 0_u32..32 {
        bytes.append(255_u8);
    }
    assert!(decode_bytes(bytes.span()).is_none(), "out of field");
    let prime = encode_bytes(array![-1].span());
    let mut last = array![];
    last.append_span(prime.span().slice(0, 31));
    last.append(*prime.at(31) + 1);
    assert!(decode_bytes(last.span()).is_none(), "field modulus");
}

#[test]
fn rejects_malformed_envelopes() {
    let input = read_txt(@FileTrait::new("tests/fixtures/v1.txt"));
    let mut fields = input.span();
    let vectors: Array<Vector> = Serde::deserialize(ref fields).unwrap();
    for vector in vectors {
        for length in 0..vector.envelope.len() {
            assert!(decode_envelope(vector.envelope.span().slice(0, length)).is_none(), "truncated envelope");
        }
        for bad_index in array![0, 1, 3, 6, 8, 9, 10] {
            let malformed = replace(vector.envelope.span(), bad_index, -1);
            assert!(decode_envelope(malformed.span()).is_none(), "invalid field");
        }
        for zero_index in array![3, 8] {
            let malformed = replace(vector.envelope.span(), zero_index, 0);
            assert!(decode_envelope(malformed.span()).is_none(), "zero order or bounds");
        }
        let mut trailing = vector.envelope;
        trailing.append(0);
        assert!(decode_envelope(trailing.span()).is_none(), "trailing envelope data");
    }
}

#[test]
fn rejects_malformed_intents() {
    let input = read_txt(@FileTrait::new("tests/fixtures/v1.txt"));
    let mut fields = input.span();
    let vectors: Array<Vector> = Serde::deserialize(ref fields).unwrap();
    for vector in vectors {
        for length in 0..vector.intent.len() {
            assert!(decode_intent(vector.intent.span().slice(0, length)).is_none(), "truncated intent");
        }
        for bad_index in array![0, 1, 6, 9, 10, 11, 12] {
            let malformed = replace(vector.intent.span(), bad_index, -1);
            assert!(decode_intent(malformed.span()).is_none(), "invalid intent field");
        }
        let mut trailing = vector.intent;
        trailing.append(0);
        assert!(decode_intent(trailing.span()).is_none(), "trailing intent data");
    }
}

fn replace(fields: Span<felt252>, index: u32, value: felt252) -> Array<felt252> {
    let mut result = array![];
    for position in 0..fields.len() {
        result.append(if position == index {
            value
        } else {
            *fields.at(position)
        });
    }
    result
}
