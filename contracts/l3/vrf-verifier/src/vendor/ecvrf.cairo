use core::ec::{EcPoint, EcPointImpl, ec_point_unwrap, stark_curve};
use core::felt252_div;
use core::num::traits::Zero;
use core::option::OptionTrait;
use core::poseidon::poseidon_hash_span;
use core::traits::TryInto;
use super::error::Error;
use super::math::{A, B, Z, sqrt_ratio};

#[derive(Copy, Drop, Serde)]
pub struct Point {
    pub x: felt252,
    pub y: felt252,
}

#[derive(Clone, Drop, Serde)]
pub struct Proof {
    pub gamma: Point,
    pub c: felt252,
    pub s: felt252,
    pub sqrt_ratio_hint: felt252,
}

#[derive(Drop)]
pub struct ECVRF {
    pub pk: Point,
    g: EcPoint,
}

#[generate_trait]
pub impl ECVRFImpl of ECVRFTrait {
    fn new(pk: Point) -> ECVRF {
        ECVRF { pk, g: EcPointImpl::new(stark_curve::GEN_X, stark_curve::GEN_Y).unwrap() }
    }

    fn verify(self: @ECVRF, proof: Proof, seed: Span<felt252>) -> Result<felt252, Error> {
        let Proof { gamma, c, s, sqrt_ratio_hint } = proof.clone();
        let Point { x: gamma_x, y: gamma_y } = gamma;

        let scalar_order: u256 = 0x800000000000010fffffffffffffffffb781126dcae7b2321e66a241adc64d2f;
        let c_integer: u256 = c.into();
        let s_integer: u256 = s.into();
        if c_integer >= scalar_order || s_integer >= scalar_order {
            return Err(Error::NonCanonicalScalar);
        }
        let pk = *self.pk;
        let ec_pk = EcPointImpl::new(pk.x, pk.y).ok_or(Error::PointAtInfinity)?;

        let g = *self.g;
        let h = hash_to_curve(pk, seed, sqrt_ratio_hint)?;
        let (h_x, h_y) = ec_point_unwrap(h.try_into().ok_or(Error::PointAtInfinity)?);

        let u = g.mul(s) - ec_pk.mul(c);
        let (u_x, u_y) = ec_point_unwrap(u.try_into().ok_or(Error::PointAtInfinity)?);

        let gamma = EcPointImpl::new(gamma_x, gamma_y).ok_or(Error::PointAtInfinity)?;

        let v = h.mul(s) - gamma.mul(c);
        let (v_x, v_y) = ec_point_unwrap(v.try_into().ok_or(Error::PointAtInfinity)?);

        let mut challenge = ArrayTrait::new();
        challenge.append(2);
        let Point { x: pk_x, y: pk_y } = pk;
        challenge.append(pk_x);
        challenge.append(pk_y);
        challenge.append(h_x);
        challenge.append(h_y);
        challenge.append(gamma_x);
        challenge.append(gamma_y);
        challenge.append(u_x);
        challenge.append(u_y);
        challenge.append(v_x);
        challenge.append(v_y);
        challenge.append(0);
        let c_prim = poseidon_hash_span(challenge.span());

        if c == c_prim {
            self.proof_to_hash(proof)
        } else {
            Result::Err(Error::ProofVerificationError)
        }
    }

    fn proof_to_hash(self: @ECVRF, proof: Proof) -> Result<felt252, Error> {
        // cofactor is 1, we can simply use gamma
        let mut beta = ArrayTrait::new();
        beta.append(3);
        let Point { x, y } = proof.gamma;
        beta.append(x);
        beta.append(y);
        beta.append(0);
        Result::Ok(poseidon_hash_span(beta.span()))
    }
}

pub fn hash_to_curve(pk: Point, a: Span<felt252>, sqrt_ratio_hint: felt252) -> Result<EcPoint, Error> {
    let Point { x, y } = pk;

    let mut buf = ArrayTrait::new();
    buf.append(x);
    buf.append(y);
    buf.append(1);
    buf.append_span(a);

    let mut hash = poseidon_hash_span(buf.span());
    map_to_curve(hash, sqrt_ratio_hint)
}

// map_to_curve_simple_swu(u)
//   Input: u, an element of F.
//   Output: (x, y), a point on E.
fn map_to_curve(u: felt252, sqrt_ratio_hint: felt252) -> Result<EcPoint, Error> {
    let tv1 = Z * u * u;
    let tv2 = tv1 * tv1 + tv1;
    let tv3 = B * (tv2 + 1);
    let tv4 = if tv2.is_zero() {
        Z
    } else {
        -tv2
    };
    let tv4 = A * tv4;
    let tv2 = tv3 * tv3;
    let tv6 = tv4 * tv4;
    let tv5 = A * tv6;
    let tv2 = tv2 + tv5;
    let tv2 = tv2 * tv3;
    let tv6 = tv6 * tv4;
    let tv5 = B * tv6;
    let tv2 = tv2 + tv5;
    let x = tv1 * tv3;
    let (is_gx1_square, y1) = sqrt_ratio(tv2, tv6, sqrt_ratio_hint)?;
    let y = tv1 * u;
    let y = y * y1;
    let (x, y) = if is_gx1_square {
        (tv3, y1)
    } else {
        (x, y)
    };

    let u_256: u256 = u.into();
    let y_256: u256 = y.into();
    let y = if (u_256 % 2) == (y_256 % 2) {
        y
    } else {
        -y
    };

    let x = felt252_div(x, tv4.try_into().ok_or(Error::InvalidHint)?);
    EcPointImpl::new(x, y).ok_or(Error::PointAtInfinity)
}
