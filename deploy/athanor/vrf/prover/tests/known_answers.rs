use ark_ec::short_weierstrass::Affine;
use ark_ff::PrimeField;
use realms_stark_vrf_math::{BaseField, ScalarField, StarkCurve, StarkVRF};
use starknet_crypto::Felt;
use std::fs;

#[test]
fn rust_and_cairo_verify_the_same_sixty_four_public_answers() {
    let input = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../../contracts/l3/vrf-verifier/tests/vectors.txt"
    ))
    .unwrap();
    let fields: Vec<&str> = input.split_whitespace().collect();
    assert!(fields.len() == 1 + 64 * 9 && fields[0] == "0x40");
    for row in fields[1..].chunks_exact(9) {
        let base = |index: usize| {
            BaseField::from_be_bytes_mod_order(&Felt::from_hex(row[index]).unwrap().to_bytes_be())
        };
        let key: Affine<StarkCurve> = Affine::new_unchecked(base(0), base(1));
        let gamma: Affine<StarkCurve> = Affine::new_unchecked(base(3), base(4));
        assert!(key.is_on_curve() && gamma.is_on_curve());
        let proof = (
            gamma,
            ScalarField::from_be_bytes_mod_order(&Felt::from_hex(row[5]).unwrap().to_bytes_be()),
            ScalarField::from_be_bytes_mod_order(&Felt::from_hex(row[6]).unwrap().to_bytes_be()),
        );
        let verifier = StarkVRF::new(key).unwrap();
        assert!(verifier.verify(&proof, &[base(2)]).is_ok());
        assert!(verifier.proof_to_hash(&proof).unwrap() == base(8));
        assert!(verifier.hash_to_sqrt_ratio_hint(&[base(2)]) == base(7));
        assert!(
            verifier
                .verify(&proof, &[base(2) + BaseField::from(1u64)])
                .is_err()
        );
    }
}
