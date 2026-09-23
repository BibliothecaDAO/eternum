use anyhow::Context;
use serde_json::{json, Value};
use sha3::{Digest, Keccak256};
use starknet_crypto::rfc6979_generate_k;
use starknet_types_core::{
    felt::Felt,
    hash::{Poseidon, StarkHash},
};

const INVOKE_PREFIX: Felt = Felt::from_hex_unchecked("0x696e766f6b65");

/// The sequencing account's invoke v3: no tip, no paymaster, L1 data availability and only an L2 gas bound.
pub(crate) struct Invoke {
    pub sender: Felt,
    pub nonce: Felt,
    pub calldata: Vec<Felt>,
    pub l2_gas: u64,
}

impl Invoke {
    /// One call from the account: `[1, to, selector, payload length, ...payload]`.
    pub fn single_call(sender: Felt, nonce: Felt, to: Felt, entrypoint: &str, payload: Vec<Felt>, l2_gas: u64) -> Self {
        let mut calldata = vec![Felt::ONE, to, selector(entrypoint), Felt::from(payload.len() as u64)];
        calldata.extend(payload);
        Self { sender, nonce, calldata, l2_gas }
    }

    /// Starknet's v3 invoke hash, as Madara computes it for a transaction without proof facts.
    pub fn hash(&self, chain: Felt) -> Felt {
        let gas = Poseidon::hash_array(&[
            Felt::ZERO,
            resource_bound(b"\0\0L1_GAS", 0),
            resource_bound(b"\0\0L2_GAS", self.l2_gas),
            resource_bound(b"\0L1_DATA", 0),
        ]);
        let empty = Poseidon::hash_array(&[]);
        Poseidon::hash_array(&[
            INVOKE_PREFIX,
            Felt::THREE,
            self.sender,
            gas,
            empty,
            chain,
            self.nonce,
            Felt::ZERO,
            empty,
            Poseidon::hash_array(&self.calldata),
        ])
    }

    /// The signed JSON-RPC body for `starknet_addInvokeTransaction`, and its hash.
    pub fn signed(&self, chain: Felt, key: Felt) -> anyhow::Result<(Felt, Value)> {
        let hash = self.hash(chain);
        let [r, s] = sign(key, hash)?;
        let zero = json!({ "max_amount": "0x0", "max_price_per_unit": "0x0" });
        let body = json!({
            "type": "INVOKE",
            "version": "0x3",
            "sender_address": self.sender.to_hex_string(),
            "calldata": self.calldata.iter().map(Felt::to_hex_string).collect::<Vec<_>>(),
            "signature": [r.to_hex_string(), s.to_hex_string()],
            "nonce": self.nonce.to_hex_string(),
            "resource_bounds": {
                "l1_gas": zero,
                "l2_gas": { "max_amount": format!("{:#x}", self.l2_gas), "max_price_per_unit": "0x0" },
                "l1_data_gas": zero,
            },
            "tip": "0x0",
            "paymaster_data": [],
            "account_deployment_data": [],
            "nonce_data_availability_mode": "L1",
            "fee_data_availability_mode": "L1",
        });
        Ok((hash, body))
    }
}

fn resource_bound(prefix: &[u8; 8], max_amount: u64) -> Felt {
    let mut bytes = [0; 32];
    bytes[..8].copy_from_slice(prefix);
    bytes[8..16].copy_from_slice(&max_amount.to_be_bytes());
    Felt::from_bytes_be(&bytes)
}

pub fn sign(key: Felt, message: Felt) -> anyhow::Result<[Felt; 2]> {
    let k = rfc6979_generate_k(&message, &key, None);
    let signature = starknet_crypto::sign(&key, &message, &k).context("sign with the sequencing key")?;
    Ok([signature.r, signature.s])
}

/// Starknet's entry point and event selector: Keccak-256 of the name, truncated to 250 bits.
pub fn selector(name: &str) -> Felt {
    let mut hash: [u8; 32] = Keccak256::digest(name.as_bytes()).into();
    hash[0] &= 0x03;
    Felt::from_bytes_be(&hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Computed independently with starknet.js `hash.calculateInvokeTransactionHash` (v3, L1 modes).
    #[test]
    fn matches_an_independent_invoke_v3_hash_and_selector() {
        let invoke = Invoke {
            sender: Felt::from_hex_unchecked("0x123"),
            nonce: Felt::from(7),
            calldata: vec![Felt::ONE, Felt::from_hex_unchecked("0x456"), selector("execute_batch"), Felt::TWO],
            l2_gas: 1_200_000_000,
        };
        assert_eq!(selector("execute_batch"), Felt::from_hex_unchecked(EXECUTE_BATCH_SELECTOR));
        assert_eq!(invoke.hash(Felt::from_hex_unchecked("0x534e5f5345504f4c4941")), Felt::from_hex_unchecked(HASH));
    }

    const EXECUTE_BATCH_SELECTOR: &str = "0x379e57611873318fae62d15487497a64bfd3f6e5c35a30af1fe167f090a83a3";
    const HASH: &str = "0x1e10fbbaddb72bc134f9987e90b0b983c11b4480d5089ba68454f0285d6709e";
}
