use starknet_types_core::{
    felt::Felt,
    hash::{Poseidon, StarkHash},
};

const ACTION_TAG: Felt = Felt::from_hex_unchecked("0x455445524e554d5f414354494f4e");
const ENVELOPE_TAG: Felt = Felt::from_hex_unchecked("0x455445524e554d5f454e54524f5059");
const EPOCH_TAG: Felt = Felt::from_hex_unchecked("0x455445524e554d5f45504f4348");
const VERSION: Felt = Felt::ONE;
pub const ENVELOPE_VERSION: u64 = 5;
pub(crate) const MAX_ARGUMENTS: usize = 256;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ProtocolError {
    #[error("invalid action encoding")]
    Action,
    #[error("invalid entropy envelope")]
    Envelope,
    #[error("noncanonical felt bytes")]
    Bytes,
}

/// The signed action excludes transport identifiers and the sampled root.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Intent {
    pub chain: Felt,
    pub deployment: Felt,
    pub game: Felt,
    pub actor: Felt,
    pub nonce: u64,
    pub command: Felt,
    pub rules: Felt,
    pub valid_from: u64,
    pub valid_until: u64,
    pub last_order: u64,
    pub arguments: Vec<Felt>,
}

impl Intent {
    pub fn encode(&self) -> Result<Vec<Felt>, ProtocolError> {
        if self.valid_from > self.valid_until || self.last_order == 0 || self.arguments.len() > MAX_ARGUMENTS {
            return Err(ProtocolError::Action);
        }
        let mut fields = vec![
            ACTION_TAG,
            VERSION,
            self.chain,
            self.deployment,
            self.game,
            self.actor,
            self.nonce.into(),
            self.command,
            self.rules,
            self.valid_from.into(),
            self.valid_until.into(),
            self.last_order.into(),
            Felt::from(self.arguments.len() as u64),
        ];
        fields.extend_from_slice(&self.arguments);
        Ok(fields)
    }

    pub fn decode(fields: &[Felt]) -> Result<Self, ProtocolError> {
        if fields.len() < 13 || fields[0] != ACTION_TAG || fields[1] != VERSION {
            return Err(ProtocolError::Action);
        }
        let count = u64::try_from(fields[12]).map_err(|_| ProtocolError::Action)?;
        if count > MAX_ARGUMENTS as u64 || fields.len() != 13 + count as usize {
            return Err(ProtocolError::Action);
        }
        let intent = Self {
            chain: fields[2],
            deployment: fields[3],
            game: fields[4],
            actor: fields[5],
            nonce: fields[6].try_into().map_err(|_| ProtocolError::Action)?,
            command: fields[7],
            rules: fields[8],
            valid_from: fields[9].try_into().map_err(|_| ProtocolError::Action)?,
            valid_until: fields[10].try_into().map_err(|_| ProtocolError::Action)?,
            last_order: fields[11].try_into().map_err(|_| ProtocolError::Action)?,
            arguments: fields[13..].to_vec(),
        };
        intent.encode()?;
        Ok(intent)
    }

    pub(crate) fn from_calldata(fields: &[Felt]) -> Result<Self, ProtocolError> {
        let mut encoded = vec![ACTION_TAG, VERSION];
        encoded.extend_from_slice(fields);
        Self::decode(&encoded)
    }

    pub fn identity(&self) -> Result<Felt, ProtocolError> {
        Ok(Poseidon::hash_array(&self.encode()?))
    }
}

/// An assigned context is volatile until its execution is recorded by the chain.
#[derive(Clone, PartialEq, Eq)]
pub struct Envelope {
    pub action: Felt,
    /// Position in the action's own game, starting at one.
    pub order: u64,
    pub timestamp: u64,
    pub execution_config: Felt,
    /// The sequencing account's randomness epoch whose secret derived the root.
    pub epoch: u64,
    pub root: [u8; 32],
}

impl Envelope {
    pub fn encode(&self) -> Result<Vec<Felt>, ProtocolError> {
        if self.order == 0 {
            return Err(ProtocolError::Envelope);
        }
        let (low, high) = root_limbs(self.root);
        Ok(vec![
            ENVELOPE_TAG,
            ENVELOPE_VERSION.into(),
            self.action,
            self.order.into(),
            self.timestamp.into(),
            self.execution_config,
            self.epoch.into(),
            low.into(),
            high.into(),
        ])
    }

    pub fn decode(fields: &[Felt]) -> Result<Self, ProtocolError> {
        if fields.len() != 9 || fields[0] != ENVELOPE_TAG || fields[1] != Felt::from(ENVELOPE_VERSION) {
            return Err(ProtocolError::Envelope);
        }
        let low: u128 = fields[7].try_into().map_err(|_| ProtocolError::Envelope)?;
        let high: u128 = fields[8].try_into().map_err(|_| ProtocolError::Envelope)?;
        let mut root = [0; 32];
        root[..16].copy_from_slice(&high.to_be_bytes());
        root[16..].copy_from_slice(&low.to_be_bytes());
        let envelope = Self {
            action: fields[2],
            order: fields[3].try_into().map_err(|_| ProtocolError::Envelope)?,
            timestamp: fields[4].try_into().map_err(|_| ProtocolError::Envelope)?,
            execution_config: fields[5],
            epoch: fields[6].try_into().map_err(|_| ProtocolError::Envelope)?,
            root,
        };
        envelope.encode()?;
        Ok(envelope)
    }

    pub fn binding(&self) -> Result<Felt, ProtocolError> {
        Ok(Poseidon::hash_array(&self.encode()?))
    }
}

pub fn epoch_commitment(secret: [u8; 32]) -> Felt {
    let (low, high) = root_limbs(secret);
    Poseidon::hash_array(&[EPOCH_TAG, Felt::ONE, low.into(), high.into()])
}

/// Each game draws from its own order, so one game's roots never depend on another's.
pub fn epoch_root(secret: [u8; 32], game: Felt, order: u64) -> [u8; 32] {
    let (low, high) = root_limbs(secret);
    Poseidon::hash_array(&[low.into(), high.into(), game, order.into()]).to_bytes_be()
}

pub fn root_limbs(root: [u8; 32]) -> (u128, u128) {
    let high = u128::from_be_bytes(root[..16].try_into().expect("fixed root half"));
    let low = u128::from_be_bytes(root[16..].try_into().expect("fixed root half"));
    (low, high)
}

pub fn encode_bytes(fields: &[Felt]) -> Vec<u8> {
    fields.iter().flat_map(Felt::to_bytes_be).collect()
}

pub fn decode_bytes(bytes: &[u8]) -> Result<Vec<Felt>, ProtocolError> {
    if bytes.len() % 32 != 0 {
        return Err(ProtocolError::Bytes);
    }
    bytes
        .chunks_exact(32)
        .map(|chunk| {
            let bytes: [u8; 32] = chunk.try_into().expect("fixed chunk size");
            let felt = Felt::from_bytes_be(&bytes);
            if felt.to_bytes_be() != bytes {
                return Err(ProtocolError::Bytes);
            }
            Ok(felt)
        })
        .collect()
}
