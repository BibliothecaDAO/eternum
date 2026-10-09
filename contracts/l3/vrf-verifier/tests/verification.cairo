use realms_vrf_verifier::vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};
use realms_vrf_verifier::{IVrfVerifierDispatcherTrait, IVrfVerifierLibraryDispatcher};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{DeclareResultTrait, declare, start_cheat_signature_global, start_cheat_transaction_hash_global};
use super::frame_fixture;

fn vectors() -> Span<felt252> {
    read_txt(@FileTrait::new("tests/vectors.txt")).span()
}
fn read_vector(ref values: Span<felt252>) -> (Point, felt252, Proof, felt252) {
    Serde::deserialize(ref values).expect('malformed vector')
}
#[test]
fn sixty_four_known_answers_verify_in_the_owned_math() {
    let mut values = vectors();
    let count: u32 = Serde::deserialize(ref values).unwrap();
    assert!(count == 64, "64 vectors required");
    for _ in 0..count {
        let (key, seed, proof, expected) = read_vector(ref values);
        assert!(ECVRFImpl::new(key).verify(proof, array![seed].span()).unwrap() == expected, "known answer differs");
    }
    assert!(values.is_empty(), "trailing vector fields");
}
#[test]
fn every_proof_field_flip_and_foreign_seed_or_key_refuses() {
    let mut values = vectors();
    let count: u32 = Serde::deserialize(ref values).unwrap();
    for _ in 0..count {
        let (key, seed, proof, _) = read_vector(ref values);
        let verifier = ECVRFImpl::new(key);
        let fields = array![proof.gamma.x, proof.gamma.y, proof.c, proof.s, proof.sqrt_ratio_hint];
        for index in 0_usize..5 {
            let changed = fields.clone();
            let old = *changed.at(index);
            let mut replaced = array![];
            for i in 0_usize..5 {
                replaced.append(if i == index {
                    old + 1
                } else {
                    *changed.at(i)
                });
            }
            let mut slice = replaced.span();
            let corrupted: Proof = Serde::deserialize(ref slice).unwrap();
            assert!(verifier.verify(corrupted, array![seed].span()).is_err(), "flipped proof accepted");
        }
        assert!(verifier.verify(proof.clone(), array![seed + 1].span()).is_err(), "foreign seed accepted");
        assert!(
            ECVRFImpl::new(Point { x: key.x, y: -key.y }).verify(proof, array![seed].span()).is_err(),
            "foreign key accepted",
        );
    }
}
#[test]
fn zero_maximum_and_off_curve_inputs_refuse_as_errors() {
    let mut values = vectors();
    let _: u32 = Serde::deserialize(ref values).unwrap();
    let (key, seed, proof, _) = read_vector(ref values);
    let verifier = ECVRFImpl::new(key);
    for bad in array![0, 0x800000000000011000000000000000000000000000000000000000000000000] {
        assert!(
            verifier.verify(Proof { gamma: Point { x: bad, y: bad }, ..proof.clone() }, array![seed].span()).is_err(),
            "invalid point accepted",
        );
        assert!(
            verifier.verify(Proof { c: bad, ..proof.clone() }, array![seed].span()).is_err(),
            "invalid challenge accepted",
        );
        assert!(
            verifier.verify(Proof { s: bad, ..proof.clone() }, array![seed].span()).is_err(), "invalid scalar accepted",
        );
        assert!(
            verifier.verify(Proof { sqrt_ratio_hint: bad, ..proof.clone() }, array![seed].span()).is_err(),
            "invalid hint accepted",
        );
    }
}

#[test]
fn hint_sign_cannot_change_the_output() {
    let mut values = vectors();
    let count: u32 = Serde::deserialize(ref values).unwrap();
    for _ in 0..count {
        let (key, seed, proof, expected) = read_vector(ref values);
        let flipped = Proof { sqrt_ratio_hint: -proof.sqrt_ratio_hint, ..proof };
        assert!(
            ECVRFImpl::new(key).verify(flipped, array![seed].span()).unwrap() == expected, "hint chose another root",
        );
    }
}

#[test]
fn library_verification_reads_the_tagged_signature_and_exact_transaction_hash() {
    let mut values = vectors();
    let _: u32 = Serde::deserialize(ref values).unwrap();
    let (key, seed, proof, expected) = read_vector(ref values);
    frame_fixture::fixed_frame();
    let class = *declare("Verifier").unwrap().contract_class().class_hash;
    let mut signature = array![1, 2, 3, realms_vrf_verifier::STAMP_TAG];
    proof.serialize(ref signature);
    start_cheat_signature_global(signature.span());
    start_cheat_transaction_hash_global(seed);
    let result = IVrfVerifierLibraryDispatcher { class_hash: class }.verify(key, 1200000000);
    assert!(result == expected, "library root differs");
}
#[test]
fn library_rejects_another_transaction_or_missing_stamp() {
    let mut values = vectors();
    let _: u32 = Serde::deserialize(ref values).unwrap();
    let (key, seed, proof, _) = read_vector(ref values);
    frame_fixture::fixed_frame();
    let class = *declare("Verifier").unwrap().contract_class().class_hash;
    let mut signature = array![1, 2, 3, realms_vrf_verifier::STAMP_TAG];
    proof.serialize(ref signature);
    start_cheat_signature_global(signature.span());
    start_cheat_transaction_hash_global(seed + 1);
    assert!(
        starknet::syscalls::library_call_syscall(class, selector!("verify"), array![key.x, key.y, 1200000000].span())
            .is_err(),
        "foreign transaction accepted",
    );
    start_cheat_transaction_hash_global(seed);
    start_cheat_signature_global(array![1, 2, 3].span());
    assert!(
        starknet::syscalls::library_call_syscall(class, selector!("verify"), array![key.x, key.y, 1200000000].span())
            .is_err(),
        "missing stamp accepted",
    );
}
