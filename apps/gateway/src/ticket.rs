use crate::protocol::{Envelope, Intent, ProtocolError};
use serde::{Deserialize, Serialize};
use starknet_types_core::felt::Felt;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActionRequest {
    pub intent: Vec<Felt>,
    pub public_key: Felt,
    pub r: Felt,
    pub s: Felt,
}

impl ActionRequest {
    /// Signature and scope are checked before acquiring an actor slot or reading node state.
    pub fn verify(&self, chain: Felt, deployment: Felt) -> anyhow::Result<Intent> {
        let intent = Intent::decode(&self.intent)?;
        anyhow::ensure!(intent.chain == chain && intent.deployment == deployment, "wrong signing domain");
        anyhow::ensure!(
            matches!(starknet_crypto::verify(&self.public_key, &intent.identity()?, &self.r, &self.s), Ok(true)),
            "invalid player signature"
        );
        Ok(intent)
    }
}

#[derive(Clone)]
pub(crate) struct RecordedTicket {
    pub intent: Intent,
    pub envelope: Envelope,
    pub r: Felt,
    pub s: Felt,
}

impl RecordedTicket {
    pub fn take_calldata(fields: &mut &[Felt]) -> anyhow::Result<Self> {
        let arguments: usize = (*fields.get(10).ok_or_else(|| anyhow::anyhow!("truncated intent"))?).try_into()?;
        anyhow::ensure!(arguments <= crate::protocol::MAX_ARGUMENTS, "too many intent arguments");
        let intent_len = 11 + arguments;
        let envelope_len: usize =
            (*fields.get(intent_len).ok_or_else(|| anyhow::anyhow!("truncated context"))?).try_into()?;
        anyhow::ensure!(envelope_len == 9, "invalid context length");
        let total = intent_len + 1 + envelope_len + 2;
        anyhow::ensure!(fields.len() >= total, "truncated recorded action");
        let intent = Intent::from_calldata(&fields[..intent_len])?;
        let envelope = Envelope::decode(&fields[intent_len + 1..total - 2])?;
        anyhow::ensure!(envelope.action == intent.identity()?, "recorded action commitment mismatch");
        let result = Self { intent, envelope, r: fields[total - 2], s: fields[total - 1] };
        *fields = &fields[total..];
        Ok(result)
    }

    pub fn calldata(&self) -> Result<Vec<Felt>, ProtocolError> {
        let mut payload = self.intent.encode()?[2..].to_vec();
        let envelope = self.envelope.encode()?;
        payload.push(Felt::from(envelope.len() as u64));
        payload.extend(envelope);
        payload.extend([self.r, self.s]);
        Ok(payload)
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ActionStatus {
    Queued { action: Felt },
    Accepted { action: Felt, order: u64 },
    Submitted { action: Felt, order: u64, transaction_hash: Felt },
    Recorded { action: Felt, order: u64, transaction_hash: Felt, succeeded: bool, reason: Felt, nonce_consumed: bool },
    Refused { action: Felt, reason: String },
}

impl ActionStatus {
    pub fn is_final(&self) -> bool {
        matches!(self, Self::Recorded { .. } | Self::Refused { .. })
    }
}

pub(crate) fn context_matches(intent: &Intent, order: u64, timestamp: u64) -> bool {
    order > 0 && order <= intent.last_order && (intent.valid_from..=intent.valid_until).contains(&timestamp)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transaction::sign;
    use starknet_crypto::get_public_key;

    #[test]
    fn verifies_every_request_before_admission() {
        let key = Felt::from(123);
        let intent = Intent {
            chain: Felt::ONE,
            deployment: Felt::TWO,
            game: Felt::ONE,
            actor: Felt::from(99),
            nonce: 0,
            command: Felt::ONE,
            rules: Felt::ONE,
            valid_from: 10,
            valid_until: 20,
            last_order: 5,
            arguments: vec![],
        };
        let [r, s] = sign(key, intent.identity().unwrap()).unwrap();
        let mut request = ActionRequest { intent: intent.encode().unwrap(), public_key: get_public_key(&key), r, s };
        assert_eq!(request.verify(Felt::ONE, Felt::TWO).unwrap(), intent);
        assert!(request.verify(Felt::TWO, Felt::TWO).is_err());
        assert!(request.verify(Felt::ONE, Felt::ONE).is_err());
        request.r += Felt::ONE;
        assert!(request.verify(Felt::ONE, Felt::TWO).is_err());
    }

    #[test]
    fn cross_language_context_boundaries() {
        let values: Vec<u64> = include_str!("../../../contracts/l3/randomness-protocol/tests/fixtures/context-v2.txt")
            .lines()
            .map(|line| u64::from_str_radix(line.trim_start_matches("0x"), 16).unwrap())
            .collect();
        assert_eq!(values.len(), 1 + values[0] as usize * 8);
        for vector in values[1..].chunks_exact(8) {
            let intent = Intent {
                chain: Felt::ONE,
                deployment: Felt::ONE,
                game: Felt::ONE,
                actor: Felt::ONE,
                nonce: 0,
                command: Felt::ONE,
                rules: Felt::ONE,
                valid_from: vector[2],
                valid_until: vector[3],
                last_order: vector[5],
                arguments: vec![],
            };
            assert_eq!(context_matches(&intent, vector[4], vector[0]), vector[6] == 1);
            assert_eq!(vector[0] <= vector[1], vector[7] == 1);
        }
    }
}
