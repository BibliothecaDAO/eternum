#[derive(Copy, Drop, Serde)]
pub struct ActionSchema {
    pub code: u16,
    pub name: felt252,
    pub body_schema: felt252,
    pub direction: u8,
    pub game_id_scope: u8,
}

#[derive(Copy, Drop, Serde)]
pub struct ClaimKindSchema {
    pub code: u16,
    pub index: u8,
    pub name: felt252,
    pub auxiliary_body_schema: felt252,
}

#[derive(Copy, Drop, Debug, PartialEq)]
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

    match code {
        0x0001 => action(code, 'CANCELLED_INBOX_SLOT', 'CancelledInboxMarker', 0, 0),
        0x0101 => action(code, 'PLAYER_BIND_REQUEST', 'PlayerBindingRequest', 1, 0),
        0x0110 => action(code, 'RESOURCE_DEPOSIT', 'ResourceDepositMessage', 1, 1),
        0x0111 => action(code, 'SCARCE_DEPOSIT', 'ScarceDepositMessage', 1, 1),
        0x0112 => action(code, 'ENTITLEMENT_DEPOSIT', 'EntitlementDepositMessage', 1, 1),
        0x0113 => action(code, 'TEMP_CREDENTIAL_LOCK', 'TempCredentialMessage', 1, 1),
        0x0114 => action(code, 'FUNDING_GRANT', 'FundingGrantMessage', 1, 1),
        0x0115 => action(code, 'BLITZ_ENTRY_PURCHASE', 'BlitzEntryMessage', 1, 1),
        0x0120 => action(code, 'FORCED_EXIT_REQUEST', 'ForcedExitMessage', 1, 0),
        0x0121 => action(code, 'INGRESS_CLOSE', 'IngressCloseMessage', 1, 0),
        0x0122 => action(code, 'GAME_FREEZE', 'GameFreezeMessage', 1, 2),
        0x0123 => action(code, 'SERIES_ADVANCE_ACK', 'SeriesAdvanceAck', 1, 0),
        0x0124 => action(code, 'GAME_ACTIVATION_ACK', 'GameActivationAck', 1, 1),
        0x0125 => action(code, 'FINALIZATION_BARRIER', 'FinalizationBarrierMessage', 1, 0),
        0x0201 => action(code, 'SETTLEMENT_ROOT', 'SettlementRootMessage', 2, 0),
        0x0202 => action(code, 'GAME_REGISTRATION', 'GameRegistration', 2, 1),
        0x0203 => action(code, 'RANKING_COMMITMENT', 'RankingCommitment', 2, 1),
        0x0204 => action(code, 'FINAL_SUMMARY', 'FinalSettlementSummary', 2, 0),
        0x0205 => action(code, 'SERIES_RESULT', 'SeriesResult', 2, 0),
        0x0206 => action(code, 'GAME_RESULT', 'GameResult', 2, 1),
        _ => Err(RegistryError::UnregisteredAction),
    }
}

pub fn get_claim_kind(code: u16) -> Result<ClaimKindSchema, RegistryError> {
    match code {
        0x1001 => claim_kind(code, 0, 'CONTROL_PLAYER_BINDING_ACK', 'PlayerBindingAckAux'),
        0x1003 => claim_kind(code, 1, 'CONTROL_FORCED_EXIT_COMPLETED', 'ForcedExitCompletedAux'),
        0x1010 => claim_kind(code, 2, 'PAYOUT_RESOURCE', 'ResourcePayoutAux'),
        0x1011 => claim_kind(code, 3, 'PAYOUT_SCARCE', 'ScarcePayoutAux'),
        0x1012 => claim_kind(code, 4, 'PAYOUT_LP_COMPOSITE', 'LpCompositePayoutAux'),
        0x1020 => claim_kind(code, 5, 'PAYOUT_FUNGIBLE_OUTCOME', 'FungibleOutcomePayoutAux'),
        0x1021 => claim_kind(code, 6, 'PAYOUT_OUTCOME_NFT', 'OutcomeNftPayoutAux'),
        0x1022 => claim_kind(code, 7, 'PAYOUT_TEMP_CREDENTIAL_RELEASE', 'TempCredentialReleaseAux'),
        0x1023 => claim_kind(code, 8, 'PAYOUT_ABORT_REFUND', 'AbortRefundAux'),
        0x1030 => claim_kind(code, 9, 'PAYOUT_FEE_DISTRIBUTION', 'FeeDistributionPayoutAux'),
        _ => Err(RegistryError::UnregisteredClaimKind),
    }
}

pub fn validate_emitter_count(count: u8) -> Result<u8, RegistryError> {
    if count == 0 || count > 8 {
        Err(RegistryError::InvalidEmitterCount)
    } else {
        Ok(count)
    }
}

fn action(
    code: u16, name: felt252, body_schema: felt252, direction: u8, game_id_scope: u8,
) -> Result<ActionSchema, RegistryError> {
    Ok(ActionSchema { code, name, body_schema, direction, game_id_scope })
}

fn claim_kind(
    code: u16, index: u8, name: felt252, auxiliary_body_schema: felt252,
) -> Result<ClaimKindSchema, RegistryError> {
    Ok(ClaimKindSchema { code, index, name, auxiliary_body_schema })
}
