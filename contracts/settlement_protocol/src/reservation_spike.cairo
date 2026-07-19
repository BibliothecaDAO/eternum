use core::poseidon::poseidon_hash_span;

// Starknet selector for ETERNUM_GLOBAL_NULLIFIER_V1 in the frozen A3 domain registry.
const ETERNUM_GLOBAL_NULLIFIER_V1: felt252 = 0x1d6026c417e35eb257352165e6ee80d8635aea72ecb7a5aca9518a2e839bb71;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum ReservationRoute {
    Root,
    FrozenExit,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum ReservationError {
    ZeroAmount,
    InsufficientCustody,
    ReservationExists,
    ReservationMissing,
    RouteMismatch,
    AmountMismatch,
    NullifierConsumed,
    InvalidNullifier,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub struct ScarceReservation {
    pub custody_units: u128,
    pub reserved_units: u128,
    pub paid_units: u128,
    pub route: Option<ReservationRoute>,
    pub expected_nullifier: felt252,
    pub consumed_nullifier: felt252,
}

pub trait ScarceReservationTrait {
    fn reserve(
        self: ScarceReservation, amount: u128, route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError>;
    fn retag(
        self: ScarceReservation, expected_route: ReservationRoute, replacement_route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError>;
    fn settle(
        self: ScarceReservation, nullifier: felt252, amount: u128, route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError>;
}

pub impl ScarceReservationImpl of ScarceReservationTrait {
    fn reserve(
        self: ScarceReservation, amount: u128, route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError> {
        if amount == 0 {
            return Err(ReservationError::ZeroAmount);
        }
        if self.consumed_nullifier != 0 || self.reserved_units != 0 {
            return Err(ReservationError::ReservationExists);
        }
        if amount > self.custody_units - self.paid_units {
            return Err(ReservationError::InsufficientCustody);
        }

        Ok(ScarceReservation { reserved_units: amount, route: Option::Some(route), ..self })
    }

    fn retag(
        self: ScarceReservation, expected_route: ReservationRoute, replacement_route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError> {
        if self.reserved_units == 0 {
            return Err(ReservationError::ReservationMissing);
        }
        if self.route != Option::Some(expected_route) {
            return Err(ReservationError::RouteMismatch);
        }

        Ok(ScarceReservation { route: Option::Some(replacement_route), ..self })
    }

    fn settle(
        self: ScarceReservation, nullifier: felt252, amount: u128, route: ReservationRoute,
    ) -> Result<ScarceReservation, ReservationError> {
        if self.consumed_nullifier != 0 {
            return Err(ReservationError::NullifierConsumed);
        }
        if nullifier == 0 || nullifier != self.expected_nullifier {
            return Err(ReservationError::InvalidNullifier);
        }
        if self.reserved_units == 0 {
            return Err(ReservationError::ReservationMissing);
        }
        if self.route != Option::Some(route) {
            return Err(ReservationError::RouteMismatch);
        }
        if amount == 0 || amount != self.reserved_units {
            return Err(if amount == 0 {
                ReservationError::ZeroAmount
            } else {
                ReservationError::AmountMismatch
            });
        }

        Ok(
            ScarceReservation {
                reserved_units: 0,
                paid_units: self.paid_units + amount,
                route: Option::None,
                consumed_nullifier: nullifier,
                ..self,
            },
        )
    }
}

pub fn new_scarce_reservation(custody_units: u128, deployment_id: felt252, liability_id: felt252) -> ScarceReservation {
    ScarceReservation {
        custody_units,
        reserved_units: 0,
        paid_units: 0,
        route: Option::None,
        expected_nullifier: global_nullifier(deployment_id, liability_id),
        consumed_nullifier: 0,
    }
}

pub fn global_nullifier(deployment_id: felt252, liability_id: felt252) -> felt252 {
    poseidon_hash_span(array![ETERNUM_GLOBAL_NULLIFIER_V1, deployment_id, liability_id].span())
}
