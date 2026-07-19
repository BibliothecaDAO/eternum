use core::num::traits::CheckedAdd;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum ActiveExitBackingError {
    ZeroAmount,
    InsufficientFreeBacking,
    InsufficientActivePosition,
    InsufficientProductionReserve,
    InsufficientUnsealedPending,
    InsufficientAssignedOpen,
    ArithmeticOverflow,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub struct ActiveExitBackingState {
    pub allocated_backing: u128,
    pub free_backing: u128,
    pub active_positions: u128,
    pub production_reserve: u128,
    pub unsealed_pending: u128,
    pub assigned_open: u128,
    pub cumulative_outbox: u128,
    pub transfer_count: u64,
}

pub trait ActiveExitBackingTrait {
    fn reserve_genesis(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn reserve_spawn(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn reserve_production_ceiling(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn settle_production(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn release_production_ceiling(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn transfer_position(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn destroy_position(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn request_withdrawal(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn assign_open_batch(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
    fn seal_assigned_withdrawal(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError>;
}

pub impl ActiveExitBackingImpl of ActiveExitBackingTrait {
    fn reserve_genesis(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        reserve_active_position(self, amount)
    }

    fn reserve_spawn(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        reserve_active_position(self, amount)
    }

    fn reserve_production_ceiling(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_reservation(self, amount)?;
        Ok(
            ActiveExitBackingState {
                free_backing: self.free_backing - amount,
                production_reserve: checked_add(self.production_reserve, amount)?,
                ..self,
            },
        )
    }

    fn settle_production(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_amount(amount)?;
        if amount > self.production_reserve {
            return Err(ActiveExitBackingError::InsufficientProductionReserve);
        }
        Ok(
            ActiveExitBackingState {
                production_reserve: self.production_reserve - amount,
                active_positions: checked_add(self.active_positions, amount)?,
                ..self,
            },
        )
    }

    fn release_production_ceiling(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_amount(amount)?;
        if amount > self.production_reserve {
            return Err(ActiveExitBackingError::InsufficientProductionReserve);
        }
        Ok(
            ActiveExitBackingState {
                production_reserve: self.production_reserve - amount,
                free_backing: checked_add(self.free_backing, amount)?,
                ..self,
            },
        )
    }

    fn transfer_position(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_active_position(self, amount)?;
        Ok(ActiveExitBackingState { transfer_count: self.transfer_count + 1, ..self })
    }

    fn destroy_position(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_active_position(self, amount)?;
        Ok(
            ActiveExitBackingState {
                active_positions: self.active_positions - amount,
                free_backing: checked_add(self.free_backing, amount)?,
                ..self,
            },
        )
    }

    fn request_withdrawal(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_active_position(self, amount)?;
        Ok(
            ActiveExitBackingState {
                active_positions: self.active_positions - amount,
                unsealed_pending: checked_add(self.unsealed_pending, amount)?,
                ..self,
            },
        )
    }

    fn assign_open_batch(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_amount(amount)?;
        if amount > self.unsealed_pending {
            return Err(ActiveExitBackingError::InsufficientUnsealedPending);
        }
        Ok(
            ActiveExitBackingState {
                unsealed_pending: self.unsealed_pending - amount,
                assigned_open: checked_add(self.assigned_open, amount)?,
                ..self,
            },
        )
    }

    fn seal_assigned_withdrawal(
        self: ActiveExitBackingState, amount: u128,
    ) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
        validate_amount(amount)?;
        if amount > self.assigned_open {
            return Err(ActiveExitBackingError::InsufficientAssignedOpen);
        }
        Ok(
            ActiveExitBackingState {
                assigned_open: self.assigned_open - amount,
                cumulative_outbox: checked_add(self.cumulative_outbox, amount)?,
                ..self,
            },
        )
    }
}

pub fn new_active_exit_backing(allocated_backing: u128) -> ActiveExitBackingState {
    ActiveExitBackingState {
        allocated_backing,
        free_backing: allocated_backing,
        active_positions: 0,
        production_reserve: 0,
        unsealed_pending: 0,
        assigned_open: 0,
        cumulative_outbox: 0,
        transfer_count: 0,
    }
}

pub fn active_exit_total(state: ActiveExitBackingState) -> u128 {
    state.active_positions + state.production_reserve + state.unsealed_pending + state.assigned_open
}

pub fn backing_is_conserved(state: ActiveExitBackingState) -> bool {
    state.free_backing + active_exit_total(state) + state.cumulative_outbox == state.allocated_backing
}

fn reserve_active_position(
    state: ActiveExitBackingState, amount: u128,
) -> Result<ActiveExitBackingState, ActiveExitBackingError> {
    validate_reservation(state, amount)?;
    Ok(
        ActiveExitBackingState {
            free_backing: state.free_backing - amount,
            active_positions: checked_add(state.active_positions, amount)?,
            ..state,
        },
    )
}

fn validate_reservation(state: ActiveExitBackingState, amount: u128) -> Result<(), ActiveExitBackingError> {
    validate_amount(amount)?;
    if amount > state.free_backing {
        return Err(ActiveExitBackingError::InsufficientFreeBacking);
    }
    Ok(())
}

fn validate_active_position(state: ActiveExitBackingState, amount: u128) -> Result<(), ActiveExitBackingError> {
    validate_amount(amount)?;
    if amount > state.active_positions {
        return Err(ActiveExitBackingError::InsufficientActivePosition);
    }
    Ok(())
}

fn validate_amount(amount: u128) -> Result<(), ActiveExitBackingError> {
    if amount == 0 {
        Err(ActiveExitBackingError::ZeroAmount)
    } else {
        Ok(())
    }
}

fn checked_add(left: u128, right: u128) -> Result<u128, ActiveExitBackingError> {
    left.checked_add(right).ok_or(ActiveExitBackingError::ArithmeticOverflow)
}
