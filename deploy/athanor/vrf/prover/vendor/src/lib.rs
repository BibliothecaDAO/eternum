mod curve;
mod ecvrf;
pub mod error;
pub mod hash;

use ark_ec::{
    short_weierstrass::{Affine, SWCurveConfig},
    CurveConfig, CurveGroup,
};
pub use ark_ff::MontFp as ScalarValue;
pub use curve::*;
pub use ecvrf::*;

pub type StarkVRF = ECVRF<StarkCurve, hash::PoseidonHash>;

pub fn generate_public_key(
    secret: <curve::StarkCurve as CurveConfig>::ScalarField,
) -> Affine<StarkCurve> {
    (StarkCurve::GENERATOR * secret).into_affine()
}
