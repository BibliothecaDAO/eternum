use realms_vrf_verifier::vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};
use snforge_std::{DeclareResultTrait, declare, start_cheat_signature_global, start_cheat_transaction_hash_global};
use super::frame_fixture;

// Public known-answer data only; comparison excludes vector-file parsing.
fn answer() -> (Point, felt252, Proof, felt252) {
    (
        Point {
            x: 0x374c6ec55ab8251b30f178c4f8ed2f020fb6fa9a4d0e1964bcbc8a15769289e,
            y: 0x9c9f62bfac1fba4858cd721b3a66b5b62d4bbe91d3ea9ca51eba4169cb7ed9,
        },
        0x5c505d787a53eea3555061aadbb94d774d00ed97c8ac1625ab53d9dac61d729,
        Proof {
            gamma: Point {
                x: 0xd88cf3fb155cfd53ce9b60a04ea5634b00938abfb0d2842b8ae00bd258880b,
                y: 0x597d10260cfa8644aa55d90e73085902e06922822d9bd9242c73bc202636700,
            },
            c: 0x65518e579087fd744cdead45d7aa3df901761a761af6c599b34982e42451f1d,
            s: 0x7968992917e6ec9df0a8f34855ece8a84e77d232902adf160835939442cac1f,
            sqrt_ratio_hint: 0x6b38acc4f7989a77fbabe147adf49faf5053ecf73d2a953aa7e95dd4c1806b6,
        },
        0x730ad76f87e0a8202f637e9a81f386e0ba4538e7d793859d7dda4df633386a6,
    )
}
#[test]
fn one_verification_inline_gas() {
    let (key, seed, proof, root) = answer();
    assert!(ECVRFImpl::new(key).verify(proof, array![seed].span()).unwrap() == root, "root differs");
}
#[test]
fn one_verification_library_gas() {
    let (key, seed, proof, root) = answer();
    frame_fixture::fixed_frame();
    let class = *declare("Verifier").unwrap().contract_class().class_hash;
    let mut signature = array![1, 2, 3, realms_vrf_verifier::STAMP_TAG];
    proof.serialize(ref signature);
    start_cheat_signature_global(signature.span());
    start_cheat_transaction_hash_global(seed);
    let result = starknet::syscalls::library_call_syscall(
        class, selector!("verify"), array![key.x, key.y, 1200000000].span(),
    )
        .unwrap();
    assert!(result.len() == 1 && *result[0] == root, "library root differs");
}

#[test]
fn library_setup_baseline_gas() {
    let (_key, seed, proof, _root) = answer();
    frame_fixture::fixed_frame();
    let class = *declare("Verifier").unwrap().contract_class().class_hash;
    let class_value: felt252 = class.into();
    assert!(class_value != 0, "declared class required");
    let mut signature = array![1, 2, 3, realms_vrf_verifier::STAMP_TAG];
    proof.serialize(ref signature);
    start_cheat_signature_global(signature.span());
    start_cheat_transaction_hash_global(seed);
    assert!(signature.len() == 9, "signature frame required");
}
