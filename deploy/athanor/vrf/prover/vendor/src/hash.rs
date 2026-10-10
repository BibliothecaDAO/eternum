use ark_ec::{short_weierstrass::SWCurveConfig, CurveConfig};
use ark_ff::{BigInt, BigInteger, PrimeField};
use starknet_crypto::{poseidon_hash_many, Felt};

use crate::curve::{StarkCurve, field_element_from_base_field};
pub trait HashToField<Curve>
where
    Curve: SWCurveConfig,
    Curve::BaseField: From<BigInt<4>> + Into<BigInt<4>>,
    Curve::ScalarField: From<BigInt<4>> + Into<BigInt<4>>,
{
    fn new() -> Self;
    fn hash_private(&self, msg: &[Curve::BaseField]) -> BigInt<4>;
    fn hash_to_base(&self, msg: &[Curve::BaseField]) -> Curve::BaseField;
    fn hash_to_scalar(&self, msg: &[Curve::BaseField]) -> Curve::ScalarField;
}

pub struct PoseidonHash;

impl HashToField<StarkCurve> for PoseidonHash {
    fn new() -> Self {
        Self
    }

    fn hash_private(&self, msg: &[<StarkCurve as CurveConfig>::BaseField]) -> BigInt<4> {
        let msg: Vec<Felt> = msg
            .iter()
            .map(field_element_from_base_field)
            .collect();
        let result = poseidon_hash_many(&msg);
        BigInt::from_bits_le(&result.to_bits_le())
    }

    fn hash_to_scalar(
        &self,
        msg: &[<StarkCurve as CurveConfig>::BaseField],
    ) -> <StarkCurve as CurveConfig>::ScalarField {
        let mont = self.hash_private(msg);
        <StarkCurve as CurveConfig>::ScalarField::from_bigint(mont).unwrap()
    }

    fn hash_to_base(
        &self,
        msg: &[<StarkCurve as CurveConfig>::BaseField],
    ) -> <StarkCurve as CurveConfig>::BaseField {
        let mont = self.hash_private(msg);
        <StarkCurve as CurveConfig>::BaseField::from_bigint(mont).unwrap()
    }
}
