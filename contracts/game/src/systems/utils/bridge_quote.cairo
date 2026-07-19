const BASIS_POINTS_DENOMINATOR: u256 = 10_000;
const LOSS_PERCENT_DENOMINATOR: u256 = 100;
const MAX_PROGRESSION_INDEX: u32 = 5;

#[derive(Copy, Drop, Serde)]
pub enum BridgeDirection {
    Deposit,
    Withdrawal,
}

#[derive(Copy, Drop, Serde)]
pub enum BridgeRecipientClass {
    Realm,
    Village,
    Bank,
}

#[derive(Copy, Drop, Serde)]
pub enum BridgeResourceClass {
    Lords,
    Troop,
    Other,
}

#[derive(Copy, Drop, Serde)]
pub struct BridgeFeePolicy {
    pub velords_deposit_bps: u16,
    pub velords_withdrawal_bps: u16,
    pub season_deposit_bps: u16,
    pub season_withdrawal_bps: u16,
    pub client_deposit_bps: u16,
    pub client_withdrawal_bps: u16,
    pub internal_deposit_bps: u16,
    pub internal_withdrawal_bps: u16,
}

#[derive(Copy, Drop, Serde)]
pub struct BridgeQuoteRequest {
    pub direction: BridgeDirection,
    pub amount: u256,
    pub token_precision: u256,
    pub resource_precision: u256,
    pub recipient_class: BridgeRecipientClass,
    pub resource_class: BridgeResourceClass,
    pub hyperstructures_completed: u32,
    pub client_fee_redirected_to_velords: bool,
    pub fee_policy: BridgeFeePolicy,
}

#[derive(Copy, Drop, Serde)]
pub struct BridgeQuote {
    pub direction: BridgeDirection,
    pub input_amount: u256,
    pub loss_amount: u256,
    pub amount_after_loss: u256,
    pub gross_token_amount: u256,
    pub gross_resource_amount: u256,
    pub velords_fee_token: u256,
    pub season_fee_token: u256,
    pub client_fee_token: u256,
    pub client_fee_redirected_to_velords: bool,
    pub platform_fee_total_token: u256,
    pub internal_fee_resource: u256,
    pub net_token_amount: u256,
    pub net_resource_amount: u256,
}

pub fn quote_bridge(request: BridgeQuoteRequest) -> BridgeQuote {
    assert_valid_precisions(request);

    match request.direction {
        BridgeDirection::Deposit => quote_deposit(request),
        BridgeDirection::Withdrawal => quote_withdrawal(request),
    }
}

fn quote_deposit(request: BridgeQuoteRequest) -> BridgeQuote {
    assert_deposit_recipient(request.recipient_class);

    let loss_amount = calculate_loss(request.amount, request.resource_class, request.hyperstructures_completed);
    let gross_token_amount = request.amount - loss_amount;
    let gross_resource_amount = token_to_resource(request, gross_token_amount);
    let platform_fees = calculate_deposit_platform_fees(request, gross_token_amount);
    let internal_fee_resource = calculate_internal_fee(
        gross_resource_amount, request.recipient_class, request.fee_policy.internal_deposit_bps,
    );
    let token_after_platform_fees = gross_token_amount - platform_fees.total;
    let net_resource_amount = token_to_resource(request, token_after_platform_fees) - internal_fee_resource;

    build_quote(
        request,
        loss_amount,
        gross_token_amount,
        gross_resource_amount,
        platform_fees,
        internal_fee_resource,
        token_after_platform_fees - resource_to_token(request, internal_fee_resource),
        net_resource_amount,
    )
}

fn quote_withdrawal(request: BridgeQuoteRequest) -> BridgeQuote {
    let loss_amount = calculate_loss(request.amount, request.resource_class, request.hyperstructures_completed);
    let gross_resource_amount = request.amount - loss_amount;
    let gross_token_amount = resource_to_token(request, gross_resource_amount);
    let platform_fees = calculate_withdrawal_platform_fees(request, gross_token_amount);
    let internal_fee_resource = calculate_internal_fee(
        gross_resource_amount, request.recipient_class, request.fee_policy.internal_withdrawal_bps,
    );
    let token_after_platform_fees = gross_token_amount - platform_fees.total;
    let net_resource_amount = token_to_resource(request, token_after_platform_fees) - internal_fee_resource;

    build_quote(
        request,
        loss_amount,
        gross_token_amount,
        gross_resource_amount,
        platform_fees,
        internal_fee_resource,
        token_after_platform_fees - resource_to_token(request, internal_fee_resource),
        net_resource_amount,
    )
}

fn assert_valid_precisions(request: BridgeQuoteRequest) {
    assert!(request.token_precision != 0, "Bridge quote: token precision is zero");
    assert!(request.resource_precision != 0, "Bridge quote: resource precision is zero");
}

fn assert_deposit_recipient(recipient_class: BridgeRecipientClass) {
    match recipient_class {
        BridgeRecipientClass::Bank => { panic!("Bridge quote: bank deposit is unsupported"); },
        BridgeRecipientClass::Realm | BridgeRecipientClass::Village => {},
    }
}

fn calculate_loss(amount: u256, resource_class: BridgeResourceClass, hyperstructures_completed: u32) -> u256 {
    amount * loss_percentage(resource_class, hyperstructures_completed).into() / LOSS_PERCENT_DENOMINATOR
}

fn loss_percentage(resource_class: BridgeResourceClass, hyperstructures_completed: u32) -> u8 {
    match resource_class {
        BridgeResourceClass::Lords => 0,
        BridgeResourceClass::Troop => troop_loss_at(progression_index(hyperstructures_completed)),
        BridgeResourceClass::Other => non_troop_loss_at(progression_index(hyperstructures_completed)),
    }
}

fn progression_index(hyperstructures_completed: u32) -> u32 {
    if hyperstructures_completed > MAX_PROGRESSION_INDEX {
        MAX_PROGRESSION_INDEX
    } else {
        hyperstructures_completed
    }
}

fn troop_loss_at(index: u32) -> u8 {
    match index {
        0 => 100,
        1 => 75,
        2 => 50,
        3 => 30,
        4 => 15,
        _ => 5,
    }
}

fn non_troop_loss_at(index: u32) -> u8 {
    match index {
        0 => 75,
        1 => 50,
        2 => 30,
        3 => 15,
        _ => 5,
    }
}

#[derive(Copy, Drop)]
struct PlatformFees {
    velords: u256,
    season: u256,
    client: u256,
    total: u256,
}

fn calculate_deposit_platform_fees(request: BridgeQuoteRequest, amount: u256) -> PlatformFees {
    calculate_platform_fees(
        amount,
        request.fee_policy.velords_deposit_bps,
        request.fee_policy.season_deposit_bps,
        request.fee_policy.client_deposit_bps,
    )
}

fn calculate_withdrawal_platform_fees(request: BridgeQuoteRequest, amount: u256) -> PlatformFees {
    calculate_platform_fees(
        amount,
        request.fee_policy.velords_withdrawal_bps,
        request.fee_policy.season_withdrawal_bps,
        request.fee_policy.client_withdrawal_bps,
    )
}

fn calculate_platform_fees(amount: u256, velords_bps: u16, season_bps: u16, client_bps: u16) -> PlatformFees {
    let velords_fee = calculate_fee(amount, velords_bps);
    let season_fee = calculate_fee(amount, season_bps);
    let client_fee = calculate_fee(amount, client_bps);
    let total = velords_fee + season_fee + client_fee;

    PlatformFees { velords: velords_fee, season: season_fee, client: client_fee, total }
}

fn calculate_internal_fee(amount: u256, recipient_class: BridgeRecipientClass, fee_bps: u16) -> u256 {
    match recipient_class {
        BridgeRecipientClass::Realm => 0,
        BridgeRecipientClass::Village | BridgeRecipientClass::Bank => calculate_fee(amount, fee_bps),
    }
}

fn calculate_fee(amount: u256, fee_bps: u16) -> u256 {
    amount * fee_bps.into() / BASIS_POINTS_DENOMINATOR
}

fn token_to_resource(request: BridgeQuoteRequest, amount: u256) -> u256 {
    amount * request.resource_precision / request.token_precision
}

fn resource_to_token(request: BridgeQuoteRequest, amount: u256) -> u256 {
    amount * request.token_precision / request.resource_precision
}

fn build_quote(
    request: BridgeQuoteRequest,
    loss_amount: u256,
    gross_token_amount: u256,
    gross_resource_amount: u256,
    platform_fees: PlatformFees,
    internal_fee_resource: u256,
    net_token_amount: u256,
    net_resource_amount: u256,
) -> BridgeQuote {
    BridgeQuote {
        direction: request.direction,
        input_amount: request.amount,
        loss_amount,
        amount_after_loss: request.amount - loss_amount,
        gross_token_amount,
        gross_resource_amount,
        velords_fee_token: platform_fees.velords,
        season_fee_token: platform_fees.season,
        client_fee_token: platform_fees.client,
        client_fee_redirected_to_velords: request.client_fee_redirected_to_velords,
        platform_fee_total_token: platform_fees.total,
        internal_fee_resource,
        net_token_amount,
        net_resource_amount,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BridgeDirection, BridgeFeePolicy, BridgeQuoteRequest, BridgeRecipientClass, BridgeResourceClass, quote_bridge,
    };

    const TOKEN_PRECISION: u256 = 10_000_000;
    const RESOURCE_PRECISION: u256 = 1_000_000;

    fn fee_policy() -> BridgeFeePolicy {
        BridgeFeePolicy {
            velords_deposit_bps: 100,
            velords_withdrawal_bps: 200,
            season_deposit_bps: 50,
            season_withdrawal_bps: 100,
            client_deposit_bps: 50,
            client_withdrawal_bps: 100,
            internal_deposit_bps: 500,
            internal_withdrawal_bps: 600,
        }
    }

    fn request(
        direction: BridgeDirection,
        amount: u256,
        recipient_class: BridgeRecipientClass,
        resource_class: BridgeResourceClass,
        hyperstructures_completed: u32,
        client_fee_redirected_to_velords: bool,
    ) -> BridgeQuoteRequest {
        BridgeQuoteRequest {
            direction,
            amount,
            token_precision: TOKEN_PRECISION,
            resource_precision: RESOURCE_PRECISION,
            recipient_class,
            resource_class,
            hyperstructures_completed,
            client_fee_redirected_to_velords,
            fee_policy: fee_policy(),
        }
    }

    #[test]
    fn quote_realm_lords_deposit_matches_same_chain_baseline() {
        let quote = quote_bridge(
            request(
                BridgeDirection::Deposit,
                1_000 * TOKEN_PRECISION,
                BridgeRecipientClass::Realm,
                BridgeResourceClass::Lords,
                0,
                false,
            ),
        );

        assert_eq!(quote.loss_amount, 0);
        assert_eq!(quote.velords_fee_token, 10 * 10_000_000);
        assert_eq!(quote.season_fee_token, 5 * 10_000_000);
        assert_eq!(quote.client_fee_token, 5 * 10_000_000);
        assert_eq!(quote.internal_fee_resource, 0);
        assert_eq!(quote.net_resource_amount, 980 * 1_000_000);
    }

    #[test]
    fn quote_realm_lords_withdrawal_matches_same_chain_baseline() {
        let quote = quote_bridge(
            request(
                BridgeDirection::Withdrawal,
                1_000 * RESOURCE_PRECISION,
                BridgeRecipientClass::Realm,
                BridgeResourceClass::Lords,
                0,
                false,
            ),
        );

        assert_eq!(quote.loss_amount, 0);
        assert_eq!(quote.velords_fee_token, 20 * 10_000_000);
        assert_eq!(quote.season_fee_token, 10 * 10_000_000);
        assert_eq!(quote.client_fee_token, 10 * 10_000_000);
        assert_eq!(quote.internal_fee_resource, 0);
        assert_eq!(quote.net_token_amount, 960 * 10_000_000);
    }

    #[test]
    fn quote_village_deposit_keeps_internal_fee_in_resource_units() {
        let quote = quote_bridge(
            request(
                BridgeDirection::Deposit,
                1_000 * TOKEN_PRECISION,
                BridgeRecipientClass::Village,
                BridgeResourceClass::Lords,
                0,
                false,
            ),
        );

        assert_eq!(quote.internal_fee_resource, 50 * RESOURCE_PRECISION);
        assert_eq!(quote.platform_fee_total_token, 20 * TOKEN_PRECISION);
        assert_eq!(quote.net_resource_amount, 930 * RESOURCE_PRECISION);
    }

    #[test]
    fn quote_bank_withdrawal_keeps_internal_fee_in_resource_units() {
        let quote = quote_bridge(
            request(
                BridgeDirection::Withdrawal,
                1_000 * RESOURCE_PRECISION,
                BridgeRecipientClass::Bank,
                BridgeResourceClass::Lords,
                0,
                true,
            ),
        );

        assert_eq!(quote.internal_fee_resource, 60 * RESOURCE_PRECISION);
        assert_eq!(quote.platform_fee_total_token, 40 * TOKEN_PRECISION);
        assert_eq!(quote.net_token_amount, 900 * TOKEN_PRECISION);
    }

    #[test]
    fn quote_preserves_client_fee_amount_and_redirect_instruction() {
        let quote = quote_bridge(
            request(
                BridgeDirection::Deposit,
                1_000 * TOKEN_PRECISION,
                BridgeRecipientClass::Realm,
                BridgeResourceClass::Lords,
                0,
                true,
            ),
        );

        assert_eq!(quote.velords_fee_token, 10 * TOKEN_PRECISION);
        assert_eq!(quote.client_fee_token, 5 * TOKEN_PRECISION);
        assert!(quote.client_fee_redirected_to_velords);
    }

    #[test]
    fn quote_preserves_and_clamps_frozen_loss_schedules() {
        assert_loss(BridgeResourceClass::Troop, 0, 100);
        assert_loss(BridgeResourceClass::Troop, 1, 75);
        assert_loss(BridgeResourceClass::Troop, 2, 50);
        assert_loss(BridgeResourceClass::Troop, 3, 30);
        assert_loss(BridgeResourceClass::Troop, 4, 15);
        assert_loss(BridgeResourceClass::Troop, 5, 5);
        assert_loss(BridgeResourceClass::Troop, 99, 5);

        assert_loss(BridgeResourceClass::Other, 0, 75);
        assert_loss(BridgeResourceClass::Other, 1, 50);
        assert_loss(BridgeResourceClass::Other, 2, 30);
        assert_loss(BridgeResourceClass::Other, 3, 15);
        assert_loss(BridgeResourceClass::Other, 4, 5);
        assert_loss(BridgeResourceClass::Other, 5, 5);
        assert_loss(BridgeResourceClass::Other, 99, 5);
    }

    #[test]
    fn pure_quote_allows_legitimate_rounded_zero_fee_components() {
        let quote = quote_bridge(
            request(BridgeDirection::Deposit, 1, BridgeRecipientClass::Realm, BridgeResourceClass::Lords, 0, false),
        );

        assert_eq!(quote.velords_fee_token, 0);
        assert_eq!(quote.season_fee_token, 0);
        assert_eq!(quote.client_fee_token, 0);
        assert_eq!(quote.platform_fee_total_token, 0);
    }

    fn assert_loss(resource_class: BridgeResourceClass, completed: u32, expected_percentage: u256) {
        let quote = quote_bridge(
            request(BridgeDirection::Deposit, 100, BridgeRecipientClass::Realm, resource_class, completed, false),
        );
        assert_eq!(quote.loss_amount, expected_percentage);
    }
}
