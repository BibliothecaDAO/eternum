use ark_ec::hashing::HashToCurveError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("couldn't map hash to curve: {0}")]
    HashToCurveError(HashToCurveError),
    #[error("couldn't verify proof")]
    ProofVerificationError,
    #[error("invalid secret key")]
    InvalidSecretKey,
}

pub type Result<T> = std::result::Result<T, Error>;

impl From<HashToCurveError> for Error {
    fn from(value: HashToCurveError) -> Self {
        Self::HashToCurveError(value)
    }
}
