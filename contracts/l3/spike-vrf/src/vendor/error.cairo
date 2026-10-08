#[derive(Drop, Debug)]
pub enum Error {
    ProofVerificationError,
    PointAtInfinity,
}
