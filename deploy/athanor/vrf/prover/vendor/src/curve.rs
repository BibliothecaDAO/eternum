use ark_ec::{
    hashing::curve_maps::swu::SWUConfig,
    short_weierstrass::{Affine, SWCurveConfig},
    CurveConfig,
};
use ark_ff::{BigInt, BigInteger, Fp256, MontBackend, MontConfig, MontFp, PrimeField};
use starknet_crypto::Felt;

#[derive(MontConfig)]
#[modulus = "3618502788666131213697322783095070105623107215331596699973092056135872020481"]
#[generator = "3"]
pub struct BaseFieldConfig;

#[derive(MontConfig)]
#[modulus = "3618502788666131213697322783095070105526743751716087489154079457884512865583"]
#[generator = "3"]
pub struct ScalarFieldConfig;

pub type BaseField = Fp256<MontBackend<BaseFieldConfig, 4>>;
pub type ScalarField = Fp256<MontBackend<ScalarFieldConfig, 4>>;

pub struct StarkCurve;

impl CurveConfig for StarkCurve {
    const COFACTOR: &'static [u64] = &[1];
    const COFACTOR_INV: ScalarField = MontFp!("1");

    type BaseField = BaseField;
    type ScalarField = ScalarField;
}

impl SWCurveConfig for StarkCurve {
    const COEFF_A: BaseField = MontFp!("1");
    const COEFF_B: BaseField =
        MontFp!("3141592653589793238462643383279502884197169399375105820974944592307816406665");
    const GENERATOR: Affine<Self> = Affine {
        x: MontFp!("874739451078007766457464989774322083649278607533249481151382481072868806602"),
        y: MontFp!("152666792071518830868575557812948353041420400780739481342941381225525861407"),
        infinity: false,
    };
}

impl SWUConfig for StarkCurve {
    const ZETA: BaseField = MontFp!("19");
}

pub fn base_field_from_field_element(value: &Felt) -> BaseField {
    let mont = BigInt::from_bits_le(&value.to_bits_le());
    <StarkCurve as CurveConfig>::BaseField::from_bigint(mont).unwrap()
}

pub fn scalar_field_from_field_element(value: &Felt) -> ScalarField {
    let mont = BigInt::from_bits_le(&value.to_bits_le());
    <StarkCurve as CurveConfig>::ScalarField::from_bigint(mont).unwrap()
}

pub fn field_element_from_base_field(value: &BaseField) -> Felt {
    let bytes = value.into_bigint().to_bytes_be();
    Felt::from_bytes_be_slice(&bytes)
}

pub fn field_element_from_scalar_field(value: &ScalarField) -> Felt {
    let bytes = value.into_bigint().to_bytes_be();
    Felt::from_bytes_be(bytes.as_slice().try_into().unwrap())
}
