use num_bigint::BigUint;
use realms_gateway::protocol::{
    decode_bytes, encode_bytes, epoch_commitment, epoch_root, root_limbs, Envelope, Intent, ProtocolError,
};
use starknet_types_core::{
    felt::Felt,
    hash::{Poseidon, StarkHash},
};

struct Fixture {
    fields: std::vec::IntoIter<Felt>,
}

impl Fixture {
    fn next(&mut self) -> Felt {
        self.fields.next().expect("fixture field")
    }
    fn array(&mut self) -> Vec<Felt> {
        let count = usize::try_from(self.next()).unwrap();
        (0..count).map(|_| self.next()).collect()
    }
}

#[test]
fn canonical_cross_language_vectors() {
    let mut fixture = Fixture {
        fields: include_str!("../../../contracts/l3/randomness-protocol/tests/fixtures/v4.txt")
            .split_whitespace()
            .map(|field| Felt::from_hex(field).unwrap())
            .collect::<Vec<_>>()
            .into_iter(),
    };
    let count = usize::try_from(fixture.next()).unwrap();
    for _ in 0..count {
        let intent_fields = fixture.array();
        let intent = Intent::decode(&intent_fields).unwrap();
        assert_eq!(intent.encode().unwrap(), intent_fields);
        assert_eq!(intent.identity().unwrap(), fixture.next());
        let envelope_fields = fixture.array();
        let envelope = Envelope::decode(&envelope_fields).unwrap();
        assert_eq!(envelope.encode().unwrap(), envelope_fields);
        assert_eq!(envelope.action, intent.identity().unwrap());
        assert_eq!(envelope.binding().unwrap(), fixture.next());
        let root: Vec<u8> = fixture.array().iter().map(|felt| u8::try_from(*felt).unwrap()).collect();
        assert_eq!(envelope.root.as_slice(), root);
        let canonical_bytes: Vec<u8> = fixture.array().iter().map(|felt| u8::try_from(*felt).unwrap()).collect();
        let combined = [intent_fields.as_slice(), envelope_fields.as_slice()].concat();
        assert_eq!(encode_bytes(&combined), canonical_bytes);
        assert_eq!(decode_bytes(&canonical_bytes).unwrap(), combined);
        for fields in [&intent_fields, &envelope_fields] {
            let bytes = encode_bytes(fields);
            assert_eq!(bytes.len(), fields.len() * 32);
            assert_eq!(decode_bytes(&bytes).unwrap(), *fields);
        }
        let (low, high) = root_limbs(envelope.root);
        let draws = usize::try_from(fixture.next()).unwrap();
        for _ in 0..draws {
            let salt = fixture.next();
            let bound = fixture.next();
            let expected = fixture.next();
            let hash = Poseidon::hash_array(&[low.into(), high.into(), salt]);
            let actual = BigUint::from_bytes_be(&hash.to_bytes_be()) % BigUint::from_bytes_be(&bound.to_bytes_be());
            assert_eq!(actual, BigUint::from_bytes_be(&expected.to_bytes_be()));
        }
    }
    let epochs = usize::try_from(fixture.next()).unwrap();
    for _ in 0..epochs {
        let [low, high, commitment, game, order, root_low, root_high] = [(); 7].map(|_| fixture.next());
        let mut secret = [0; 32];
        secret[..16].copy_from_slice(&u128::try_from(high).unwrap().to_be_bytes());
        secret[16..].copy_from_slice(&u128::try_from(low).unwrap().to_be_bytes());
        assert_eq!(epoch_commitment(secret), commitment);
        let root = epoch_root(secret, game, u64::try_from(order).unwrap());
        assert_eq!(root_limbs(root), (u128::try_from(root_low).unwrap(), u128::try_from(root_high).unwrap()));
    }
    assert!(fixture.fields.next().is_none());
}

#[test]
fn rejects_noncanonical_bytes_and_framing() {
    assert_eq!(decode_bytes(&[0; 31]), Err(ProtocolError::Bytes));
    assert_eq!(decode_bytes(&[255; 32]), Err(ProtocolError::Bytes));
    let mut prime = Felt::MAX.to_bytes_be();
    prime[31] += 1;
    assert_eq!(decode_bytes(&prime), Err(ProtocolError::Bytes));
    assert_eq!(encode_bytes(&[Felt::ONE]), [vec![0; 31], vec![1]].concat());
    let intent = sample_intent();
    let fields = intent.encode().unwrap();
    for length in 0..fields.len() {
        assert!(Intent::decode(&fields[..length]).is_err());
    }
    let mut trailing = fields.clone();
    trailing.push(Felt::ZERO);
    assert!(Intent::decode(&trailing).is_err());
    for index in [0, 1, 6, 9, 10, 11, 12] {
        let mut malformed = fields.clone();
        malformed[index] = Felt::MAX;
        assert!(Intent::decode(&malformed).is_err());
    }
}

#[test]
fn every_signed_field_changes_action_identity() {
    let fields = sample_intent().encode().unwrap();
    let original = Poseidon::hash_array(&fields);
    for index in 2..fields.len() {
        let mut changed = fields.clone();
        changed[index] += Felt::ONE;
        assert_ne!(Poseidon::hash_array(&changed), original);
    }
}

#[test]
fn rejects_invalid_envelopes_and_binds_execution_context() {
    let envelope = Envelope {
        action: sample_intent().identity().unwrap(),
        order: 1,
        timestamp: 2,
        execution_config: Felt::ONE,
        epoch: 1,
        root: [255; 32],
    };
    let fields = envelope.encode().unwrap();
    for length in 0..fields.len() {
        assert!(Envelope::decode(&fields[..length]).is_err());
    }
    let mut trailing = fields.clone();
    trailing.push(Felt::ZERO);
    assert!(Envelope::decode(&trailing).is_err());
    for index in [0, 1, 3, 4, 6, 7, 8] {
        let mut malformed = fields.clone();
        malformed[index] = Felt::MAX;
        assert!(Envelope::decode(&malformed).is_err());
    }
    let mut zero_order = fields.clone();
    zero_order[3] = Felt::ZERO;
    assert!(Envelope::decode(&zero_order).is_err());
    for index in 2..fields.len() {
        let mut changed = fields.clone();
        changed[index] += Felt::ONE;
        assert_ne!(Poseidon::hash_array(&changed), envelope.binding().unwrap());
    }
}

fn sample_intent() -> Intent {
    Intent {
        chain: Felt::ONE,
        deployment: Felt::TWO,
        game: Felt::ONE,
        actor: Felt::TWO,
        nonce: 0,
        command: Felt::ONE,
        rules: Felt::ONE,
        valid_from: 0,
        valid_until: 100,
        last_order: 100,
        arguments: vec![Felt::ONE, Felt::MAX],
    }
}
