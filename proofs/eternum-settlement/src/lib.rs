pub mod codec;
pub mod emergency_sealed;
pub mod frozen_position;
pub mod golden_vectors;
pub mod mmr_plan;
pub mod schema_vector;
pub mod tree;
pub mod tree_vectors;
pub mod types;

use starknet_crypto::{Felt, poseidon_hash_many};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionDirection {
    TransportReserved,
    MainnetToAppchain,
    AppchainToMainnet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GameIdScope {
    Season,
    Game,
    BodyDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ActionSchema {
    pub code: u16,
    pub name: &'static str,
    pub body: &'static str,
    pub direction: ActionDirection,
    pub game_id_scope: GameIdScope,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClaimKindSchema {
    pub code: u16,
    pub index: u8,
    pub name: &'static str,
    pub auxiliary_body: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistryError {
    UnsupportedProtocolVersion,
    UnregisteredAction,
    UnregisteredClaimKind,
    InvalidEmitterCount,
}

pub fn get_action_schema(version: u16, code: u16) -> Result<ActionSchema, RegistryError> {
    if version != 1 {
        return Err(RegistryError::UnsupportedProtocolVersion);
    }

    use ActionDirection::{AppchainToMainnet, MainnetToAppchain, TransportReserved};
    use GameIdScope::{BodyDefined, Game, Season};

    match code {
        0x0001 => action(
            code,
            "CANCELLED_INBOX_SLOT",
            "CancelledInboxMarker",
            TransportReserved,
            Season,
        ),
        0x0101 => action(
            code,
            "PLAYER_BIND_REQUEST",
            "PlayerBindingRequest",
            MainnetToAppchain,
            Season,
        ),
        0x0110 => action(
            code,
            "RESOURCE_DEPOSIT",
            "ResourceDepositMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0111 => action(
            code,
            "SCARCE_DEPOSIT",
            "ScarceDepositMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0112 => action(
            code,
            "ENTITLEMENT_DEPOSIT",
            "EntitlementDepositMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0113 => action(
            code,
            "TEMP_CREDENTIAL_LOCK",
            "TempCredentialMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0114 => action(
            code,
            "FUNDING_GRANT",
            "FundingGrantMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0115 => action(
            code,
            "BLITZ_ENTRY_PURCHASE",
            "BlitzEntryMessage",
            MainnetToAppchain,
            Game,
        ),
        0x0120 => action(
            code,
            "FORCED_EXIT_REQUEST",
            "ForcedExitMessage",
            MainnetToAppchain,
            Season,
        ),
        0x0121 => action(
            code,
            "INGRESS_CLOSE",
            "IngressCloseMessage",
            MainnetToAppchain,
            Season,
        ),
        0x0122 => action(
            code,
            "GAME_FREEZE",
            "GameFreezeMessage",
            MainnetToAppchain,
            BodyDefined,
        ),
        0x0123 => action(
            code,
            "SERIES_ADVANCE_ACK",
            "SeriesAdvanceAck",
            MainnetToAppchain,
            Season,
        ),
        0x0124 => action(
            code,
            "GAME_ACTIVATION_ACK",
            "GameActivationAck",
            MainnetToAppchain,
            Game,
        ),
        0x0125 => action(
            code,
            "FINALIZATION_BARRIER",
            "FinalizationBarrierMessage",
            MainnetToAppchain,
            Season,
        ),
        0x0201 => action(
            code,
            "SETTLEMENT_ROOT",
            "SettlementRootMessage",
            AppchainToMainnet,
            Season,
        ),
        0x0202 => action(
            code,
            "GAME_REGISTRATION",
            "GameRegistration",
            AppchainToMainnet,
            Game,
        ),
        0x0203 => action(
            code,
            "RANKING_COMMITMENT",
            "RankingCommitment",
            AppchainToMainnet,
            Game,
        ),
        0x0204 => action(
            code,
            "FINAL_SUMMARY",
            "FinalSettlementSummary",
            AppchainToMainnet,
            Season,
        ),
        0x0205 => action(
            code,
            "SERIES_RESULT",
            "SeriesResult",
            AppchainToMainnet,
            Season,
        ),
        0x0206 => action(code, "GAME_RESULT", "GameResult", AppchainToMainnet, Game),
        _ => Err(RegistryError::UnregisteredAction),
    }
}

pub fn get_claim_kind(code: u16) -> Result<ClaimKindSchema, RegistryError> {
    match code {
        0x1001 => claim_kind(code, 0, "CONTROL_PLAYER_BINDING_ACK", "PlayerBindingAckAux"),
        0x1003 => claim_kind(
            code,
            1,
            "CONTROL_FORCED_EXIT_COMPLETED",
            "ForcedExitCompletedAux",
        ),
        0x1010 => claim_kind(code, 2, "PAYOUT_RESOURCE", "ResourcePayoutAux"),
        0x1011 => claim_kind(code, 3, "PAYOUT_SCARCE", "ScarcePayoutAux"),
        0x1012 => claim_kind(code, 4, "PAYOUT_LP_COMPOSITE", "LpCompositePayoutAux"),
        0x1020 => claim_kind(
            code,
            5,
            "PAYOUT_FUNGIBLE_OUTCOME",
            "FungibleOutcomePayoutAux",
        ),
        0x1021 => claim_kind(code, 6, "PAYOUT_OUTCOME_NFT", "OutcomeNftPayoutAux"),
        0x1022 => claim_kind(
            code,
            7,
            "PAYOUT_TEMP_CREDENTIAL_RELEASE",
            "TempCredentialReleaseAux",
        ),
        0x1023 => claim_kind(code, 8, "PAYOUT_ABORT_REFUND", "AbortRefundAux"),
        0x1030 => claim_kind(
            code,
            9,
            "PAYOUT_FEE_DISTRIBUTION",
            "FeeDistributionPayoutAux",
        ),
        _ => Err(RegistryError::UnregisteredClaimKind),
    }
}

pub fn validate_emitter_count(count: u8) -> Result<u8, RegistryError> {
    if (1..=8).contains(&count) {
        Ok(count)
    } else {
        Err(RegistryError::InvalidEmitterCount)
    }
}

pub fn compute_schema_registry_hash() -> Felt {
    let preimage = schema_vector::SCHEMA_REGISTRY_PREIMAGE
        .iter()
        .map(|value| parse_generated_felt(value))
        .collect::<Vec<_>>();
    poseidon_hash_many(&preimage)
}

fn parse_generated_felt(value: &str) -> Felt {
    if value.starts_with("0x") {
        Felt::from_hex(value).expect("generated schema felt must be canonical")
    } else {
        Felt::from_dec_str(value).expect("generated schema felt must be canonical")
    }
}

fn action(
    code: u16,
    name: &'static str,
    body: &'static str,
    direction: ActionDirection,
    game_id_scope: GameIdScope,
) -> Result<ActionSchema, RegistryError> {
    Ok(ActionSchema {
        code,
        name,
        body,
        direction,
        game_id_scope,
    })
}

fn claim_kind(
    code: u16,
    index: u8,
    name: &'static str,
    auxiliary_body: &'static str,
) -> Result<ClaimKindSchema, RegistryError> {
    Ok(ClaimKindSchema {
        code,
        index,
        name,
        auxiliary_body,
    })
}

#[cfg(test)]
mod tests {
    use starknet_crypto::Felt;

    use crate::codec::CanonicalEncode;
    use crate::types::{ClaimLeg, SettlementRootMessage, U256};

    use super::{
        compute_schema_registry_hash, get_action_schema, get_claim_kind, validate_emitter_count,
    };

    #[test]
    fn resolves_registered_action_and_dense_claim_kind() {
        let action = get_action_schema(1, 0x0110).unwrap();
        assert_eq!(action.name, "RESOURCE_DEPOSIT");
        assert_eq!(action.body, "ResourceDepositMessage");

        let claim_kind = get_claim_kind(0x1030).unwrap();
        assert_eq!(claim_kind.index, 9);
    }

    #[test]
    fn every_action_and_claim_kind_matches_the_frozen_registry() {
        for &(code, name, body, direction, scope) in crate::schema_vector::ACTION_VECTORS {
            let action = get_action_schema(1, code).unwrap();
            assert_eq!(action.name, name);
            assert_eq!(action.body, body);
            assert_eq!(action.direction as u8, direction);
            assert_eq!(action.game_id_scope as u8, scope);
        }
        for &(code, index, name, auxiliary_body) in crate::schema_vector::CLAIM_KIND_VECTORS {
            let claim_kind = get_claim_kind(code).unwrap();
            assert_eq!(claim_kind.index, index);
            assert_eq!(claim_kind.name, name);
            assert_eq!(claim_kind.auxiliary_body, auxiliary_body);
        }
    }

    #[test]
    fn emitter_count_accepts_one_and_eight_and_rejects_zero_and_nine() {
        assert_eq!(validate_emitter_count(1).unwrap(), 1);
        assert_eq!(validate_emitter_count(8).unwrap(), 8);
        assert!(validate_emitter_count(0).is_err());
        assert!(validate_emitter_count(9).is_err());
    }

    #[test]
    fn recomputes_the_frozen_full_registry_hash() {
        let small_vector = super::poseidon_hash_many(&[Felt::ONE, Felt::TWO]);
        let expected_small =
            Felt::from_hex("0x371cb6995ea5e7effcd2e174de264b5b407027a75a231a70c2c8d196107f0e7")
                .unwrap();
        assert_eq!(small_vector, expected_small);
        let expected = Felt::from_hex(super::schema_vector::SCHEMA_REGISTRY_HASH).unwrap();
        assert_eq!(compute_schema_registry_hash(), expected);
    }

    #[test]
    fn encodes_u256_as_explicit_low_and_high_limbs() {
        let leg = ClaimLeg {
            asset_mode: 1,
            asset_id: 37,
            backing_pool_id: Felt::from(2_u8),
            recipient: Felt::from(3_u8),
            amount_or_token_id: U256 { low: 5, high: 1 },
            policy_key: Felt::from(4_u8),
        };
        assert_eq!(
            leg.encode(),
            [1_u8, 37, 2, 3, 5, 1, 4].map(Felt::from).to_vec()
        );
    }

    #[test]
    fn pins_the_full_settlement_root_count_before_hash_order() {
        let root = SettlementRootMessage {
            batch_id: 1,
            previous_batch_hash: Felt::from(2_u8),
            leaf_count: 3,
            root: Felt::from(4_u8),
            asset_totals_hash: Felt::from(5_u8),
            ingress_activation_count: 6,
            ingress_activations_hash: Felt::from(7_u8),
            nft_reservation_count: 8,
            nft_reservations_hash: Felt::from(9_u8),
            deployment_refund_count: 10,
            deployment_refunds_hash: Felt::from(11_u8),
            lot_share_promotion_count: 12,
            lot_share_promotions_hash: Felt::from(13_u8),
        };
        assert_eq!(
            root.encode(),
            (1_u8..=13).map(Felt::from).collect::<Vec<_>>()
        );
    }

    #[test]
    fn every_declared_struct_and_empty_tree_matches_the_golden_vectors() {
        crate::golden_vectors::assert_all_golden_vectors();
    }

    #[test]
    fn fixed_depth_roots_match_all_reference_vectors() {
        for vector in crate::tree_vectors::TREE_VECTORS {
            let tree = crate::tree::FixedDepthTree::new(
                vector.depth,
                Felt::from_hex(vector.empty_leaf_domain).unwrap(),
                Felt::from_hex(vector.node_domain).unwrap(),
            )
            .unwrap();
            let leaves = vector
                .leaf_hashes
                .iter()
                .map(|leaf| Felt::from_hex(leaf).unwrap())
                .collect::<Vec<_>>();
            assert_eq!(
                tree.root(&leaves).unwrap(),
                Felt::from_hex(vector.root).unwrap()
            );
            for &(leaf_index, expected_siblings) in vector.proofs {
                let proof = tree.proof(&leaves, leaf_index).unwrap();
                let expected = expected_siblings
                    .iter()
                    .map(|sibling| Felt::from_hex(sibling).unwrap())
                    .collect::<Vec<_>>();
                assert_eq!(proof, expected, "{}:{leaf_index}", vector.name);
                assert!(
                    tree.verify(
                        leaves[leaf_index],
                        leaf_index,
                        &proof,
                        Felt::from_hex(vector.root).unwrap(),
                    )
                    .unwrap()
                );
            }
        }
    }

    #[test]
    fn fixed_depth_tree_rejects_overflow_and_malformed_proofs() {
        use crate::tree::TreeError;

        assert!(matches!(
            crate::tree::FixedDepthTree::new(0, Felt::ONE, Felt::TWO),
            Err(TreeError::InvalidDepth)
        ));

        let vector = crate::tree_vectors::TREE_VECTORS
            .iter()
            .find(|vector| vector.name == "full")
            .unwrap();
        let tree = crate::tree::FixedDepthTree::new(
            vector.depth,
            Felt::from_hex(vector.empty_leaf_domain).unwrap(),
            Felt::from_hex(vector.node_domain).unwrap(),
        )
        .unwrap();
        let leaves = vector
            .leaf_hashes
            .iter()
            .map(|leaf| Felt::from_hex(leaf).unwrap())
            .collect::<Vec<_>>();
        let proof = tree.proof(&leaves, 0).unwrap();
        let root = Felt::from_hex(vector.root).unwrap();

        let mut overflow = leaves.clone();
        overflow.push(Felt::ONE);
        assert_eq!(tree.root(&overflow), Err(TreeError::CapacityExceeded));
        assert_eq!(
            tree.verify(leaves[0], 0, &proof[1..], root),
            Err(TreeError::WrongProofLength)
        );
        assert_eq!(
            tree.verify(leaves[0], 64, &proof, root),
            Err(TreeError::IndexOutsideCapacity)
        );
        let mut wrong = proof;
        wrong[0] += Felt::ONE;
        assert!(!tree.verify(leaves[0], 0, &wrong, root).unwrap());
    }
}
