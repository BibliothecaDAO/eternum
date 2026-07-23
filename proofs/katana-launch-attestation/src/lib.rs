use sha3::{Digest, Keccak256};
use starknet_crypto::{Felt, poseidon_hash_many};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KatanaLaunchAttestationBindingV1<'a> {
    pub game_stack_id: &'a str,
    pub deployment_id: &'a str,
    pub runtime_instance_id: &'a str,
    pub l3_chain_id: &'a str,
    pub genesis_hash: &'a str,
    pub ruleset_id: &'a str,
    pub release_bundle_hash: &'a str,
    pub release_identity_sha256: &'a str,
    pub vm_asset_digest: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KatanaLaunchAttestationBindingError {
    NonCanonicalField(&'static str),
}

pub fn hash_katana_launch_attestation_binding_v1(
    binding: KatanaLaunchAttestationBindingV1<'_>,
) -> Result<Felt, KatanaLaunchAttestationBindingError> {
    validate_binding(binding)?;
    Ok(poseidon_hash_many(&[
        starknet_keccak("KATANA_LAUNCH_ATTESTATION_BINDING_V1"),
        starknet_keccak(binding.game_stack_id),
        starknet_keccak(binding.deployment_id),
        starknet_keccak(binding.runtime_instance_id),
        starknet_keccak(binding.l3_chain_id),
        starknet_keccak(binding.genesis_hash),
        starknet_keccak(binding.ruleset_id),
        starknet_keccak(binding.release_bundle_hash),
        starknet_keccak(binding.release_identity_sha256),
        starknet_keccak(binding.vm_asset_digest),
    ]))
}

fn validate_binding(
    binding: KatanaLaunchAttestationBindingV1<'_>,
) -> Result<(), KatanaLaunchAttestationBindingError> {
    require(
        identifier_is_canonical(binding.game_stack_id),
        "gameStackId",
    )?;
    require(felt_is_canonical(binding.deployment_id), "deploymentId")?;
    require(
        uuid_is_canonical(binding.runtime_instance_id),
        "runtimeInstanceId",
    )?;
    require(felt_is_canonical(binding.l3_chain_id), "l3ChainId")?;
    require(felt_is_canonical(binding.genesis_hash), "genesisHash")?;
    require(felt_is_canonical(binding.ruleset_id), "rulesetId")?;
    require(
        felt_is_canonical(binding.release_bundle_hash),
        "releaseBundleHash",
    )?;
    require(
        lowercase_hex_is_exact(binding.release_identity_sha256, 64),
        "releaseIdentitySha256",
    )?;
    require(
        binding
            .vm_asset_digest
            .strip_prefix("sha256:")
            .is_some_and(|value| lowercase_hex_is_exact(value, 64)),
        "vmAssetDigest",
    )
}

fn require(valid: bool, field: &'static str) -> Result<(), KatanaLaunchAttestationBindingError> {
    valid
        .then_some(())
        .ok_or(KatanaLaunchAttestationBindingError::NonCanonicalField(
            field,
        ))
}

fn identifier_is_canonical(value: &str) -> bool {
    let bytes = value.as_bytes();
    (1..=64).contains(&bytes.len())
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-')
        && bytes.first() != Some(&b'-')
        && bytes.last() != Some(&b'-')
}

fn felt_is_canonical(value: &str) -> bool {
    let Some(hex) = value.strip_prefix("0x") else {
        return false;
    };
    !hex.is_empty()
        && (hex == "0" || !hex.starts_with('0'))
        && hex
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        && Felt::from_hex(value).is_ok()
}

fn uuid_is_canonical(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && [8, 13, 18, 23].iter().all(|index| bytes[*index] == b'-')
        && (b'1'..=b'8').contains(&bytes[14])
        && b"89ab".contains(&bytes[19])
        && bytes.iter().enumerate().all(|(index, byte)| {
            [8, 13, 18, 23].contains(&index)
                || byte.is_ascii_digit()
                || (b'a'..=b'f').contains(byte)
        })
}

fn lowercase_hex_is_exact(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn starknet_keccak(value: &str) -> Felt {
    let mut digest = Keccak256::digest(value.as_bytes());
    digest[0] &= 0x03;
    Felt::from_bytes_be_slice(&digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPECTED_HASH: &str =
        "0x06a7abad0946e574edebbcabe2402cd05bbb99c184f11c0f5fea8f689e6c6844";

    #[test]
    fn matches_the_typescript_control_plane_binding_vector() {
        assert_eq!(
            hash_katana_launch_attestation_binding_v1(reference_binding())
                .expect("canonical reference binding"),
            Felt::from_hex(EXPECTED_HASH).expect("valid expected hash"),
        );
    }

    #[test]
    fn changed_genesis_fails_the_reference_vector() {
        let changed = KatanaLaunchAttestationBindingV1 {
            genesis_hash: "0x6dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            ..reference_binding()
        };
        assert_ne!(
            hash_katana_launch_attestation_binding_v1(changed).expect("canonical changed binding"),
            Felt::from_hex(EXPECTED_HASH).expect("valid expected hash"),
        );
    }

    #[test]
    fn rejects_noncanonical_field_values() {
        for (changed, expected_field) in [
            (
                KatanaLaunchAttestationBindingV1 {
                    deployment_id: "0x04242",
                    ..reference_binding()
                },
                "deploymentId",
            ),
            (
                KatanaLaunchAttestationBindingV1 {
                    runtime_instance_id: "9C71925B-E87D-4A26-85CF-E5476274B451",
                    ..reference_binding()
                },
                "runtimeInstanceId",
            ),
            (
                KatanaLaunchAttestationBindingV1 {
                    release_identity_sha256: "A84822D44DB5BB9E0F6652A2A7CF7B851AC9A65EAA76BB991D642679FBB7DBF2",
                    ..reference_binding()
                },
                "releaseIdentitySha256",
            ),
        ] {
            assert_eq!(
                hash_katana_launch_attestation_binding_v1(changed),
                Err(KatanaLaunchAttestationBindingError::NonCanonicalField(
                    expected_field
                )),
            );
        }
    }

    fn reference_binding() -> KatanaLaunchAttestationBindingV1<'static> {
        KatanaLaunchAttestationBindingV1 {
            game_stack_id: "blitz-season-42",
            deployment_id: "0x4242",
            runtime_instance_id: "9c71925b-e87d-4a26-85cf-e5476274b451",
            l3_chain_id: "0x534e5f424c49545a",
            genesis_hash: "0x6cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            ruleset_id: "0x77",
            release_bundle_hash: "0x88",
            release_identity_sha256: "184822d44db5bb9e0f6652a2a7cf7b851ac9a65eaa76bb991d642679fbb7dbf2",
            vm_asset_digest: "sha256:7a518422e8fbb5517b36f230a4dd3fa55f880969b6f51f5f41815549414b8767",
        }
    }
}
