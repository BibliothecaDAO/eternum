use core::num::traits::CheckedAdd;

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum CallerClass {
    ResourceSystem,
    ArrivalSystem,
    CombatSystem,
    BankSystem,
    SeasonSettlementHub,
    GameForcedExitAdapter,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum CapabilityFamily {
    Resource,
    Arrival,
    MilitaryAndCargo,
    AmmAndLp,
    SettlementCallback,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub enum EconomicSpikeError {
    UnauthorizedCaller,
    InsufficientActiveBacking,
    ArithmeticOverflow,
}

#[derive(Copy, Drop, Debug, PartialEq)]
pub struct EconomicSpikeState {
    pub allocated_backing: u128,
    pub active_backing: u128,
    pub cumulative_outbox: u128,
    pub released_backing: u128,
    pub mutation_count: u64,
    pub resource_version: u64,
    pub arrival_high_watermark: u64,
    pub military_version: u64,
    pub bank_version: u64,
    pub sealed_batch_count: u64,
}

pub trait EconomicStateSpikeTrait {
    fn transfer_resource(
        self: EconomicSpikeState, caller: CallerClass,
    ) -> Result<EconomicSpikeState, EconomicSpikeError>;
    fn create_arrival(self: EconomicSpikeState, caller: CallerClass) -> Result<EconomicSpikeState, EconomicSpikeError>;
    fn resolve_combat_loss(
        self: EconomicSpikeState, caller: CallerClass, destroyed_backing: u128,
    ) -> Result<EconomicSpikeState, EconomicSpikeError>;
    fn swap_bank_reserves(
        self: EconomicSpikeState, caller: CallerClass,
    ) -> Result<EconomicSpikeState, EconomicSpikeError>;
    fn promote_sealed_batch(
        self: EconomicSpikeState, caller: CallerClass, amount: u128,
    ) -> Result<EconomicSpikeState, EconomicSpikeError>;
}

pub impl EconomicStateSpikeImpl of EconomicStateSpikeTrait {
    fn transfer_resource(
        self: EconomicSpikeState, caller: CallerClass,
    ) -> Result<EconomicSpikeState, EconomicSpikeError> {
        authorize(caller, CapabilityFamily::Resource)?;
        Ok(record_resource_transfer(self))
    }

    fn create_arrival(self: EconomicSpikeState, caller: CallerClass) -> Result<EconomicSpikeState, EconomicSpikeError> {
        authorize(caller, CapabilityFamily::Arrival)?;
        Ok(record_arrival_creation(self))
    }

    fn resolve_combat_loss(
        self: EconomicSpikeState, caller: CallerClass, destroyed_backing: u128,
    ) -> Result<EconomicSpikeState, EconomicSpikeError> {
        authorize(caller, CapabilityFamily::MilitaryAndCargo)?;
        release_destroyed_backing(self, destroyed_backing)
    }

    fn swap_bank_reserves(
        self: EconomicSpikeState, caller: CallerClass,
    ) -> Result<EconomicSpikeState, EconomicSpikeError> {
        authorize(caller, CapabilityFamily::AmmAndLp)?;
        Ok(record_bank_swap(self))
    }

    fn promote_sealed_batch(
        self: EconomicSpikeState, caller: CallerClass, amount: u128,
    ) -> Result<EconomicSpikeState, EconomicSpikeError> {
        authorize(caller, CapabilityFamily::SettlementCallback)?;
        promote_active_backing(self, amount)
    }
}

pub fn new_economic_spike_state(allocated_backing: u128) -> EconomicSpikeState {
    EconomicSpikeState {
        allocated_backing,
        active_backing: allocated_backing,
        cumulative_outbox: 0,
        released_backing: 0,
        mutation_count: 0,
        resource_version: 0,
        arrival_high_watermark: 0,
        military_version: 0,
        bank_version: 0,
        sealed_batch_count: 0,
    }
}

pub fn backing_is_conserved(state: EconomicSpikeState) -> bool {
    state.active_backing + state.cumulative_outbox + state.released_backing == state.allocated_backing
}

fn authorize(caller: CallerClass, family: CapabilityFamily) -> Result<(), EconomicSpikeError> {
    if caller_is_authorized(caller, family) {
        Ok(())
    } else {
        Err(EconomicSpikeError::UnauthorizedCaller)
    }
}

fn caller_is_authorized(caller: CallerClass, family: CapabilityFamily) -> bool {
    match family {
        CapabilityFamily::Resource => {
            caller == CallerClass::ResourceSystem || caller == CallerClass::GameForcedExitAdapter
        },
        CapabilityFamily::Arrival => {
            caller == CallerClass::ArrivalSystem || caller == CallerClass::GameForcedExitAdapter
        },
        CapabilityFamily::MilitaryAndCargo => {
            caller == CallerClass::CombatSystem || caller == CallerClass::GameForcedExitAdapter
        },
        CapabilityFamily::AmmAndLp => {
            caller == CallerClass::BankSystem || caller == CallerClass::GameForcedExitAdapter
        },
        CapabilityFamily::SettlementCallback => caller == CallerClass::SeasonSettlementHub,
    }
}

fn record_resource_transfer(state: EconomicSpikeState) -> EconomicSpikeState {
    EconomicSpikeState {
        mutation_count: state.mutation_count + 1, resource_version: state.resource_version + 1, ..state,
    }
}

fn record_arrival_creation(state: EconomicSpikeState) -> EconomicSpikeState {
    EconomicSpikeState {
        mutation_count: state.mutation_count + 1, arrival_high_watermark: state.arrival_high_watermark + 1, ..state,
    }
}

fn record_bank_swap(state: EconomicSpikeState) -> EconomicSpikeState {
    EconomicSpikeState { mutation_count: state.mutation_count + 1, bank_version: state.bank_version + 1, ..state }
}

fn release_destroyed_backing(
    state: EconomicSpikeState, amount: u128,
) -> Result<EconomicSpikeState, EconomicSpikeError> {
    if amount > state.active_backing {
        return Err(EconomicSpikeError::InsufficientActiveBacking);
    }
    let released_backing = state.released_backing.checked_add(amount).ok_or(EconomicSpikeError::ArithmeticOverflow)?;
    Ok(
        EconomicSpikeState {
            active_backing: state.active_backing - amount,
            released_backing,
            mutation_count: state.mutation_count + 1,
            military_version: state.military_version + 1,
            ..state,
        },
    )
}

fn promote_active_backing(state: EconomicSpikeState, amount: u128) -> Result<EconomicSpikeState, EconomicSpikeError> {
    if amount > state.active_backing {
        return Err(EconomicSpikeError::InsufficientActiveBacking);
    }
    let cumulative_outbox = state.cumulative_outbox.checked_add(amount).ok_or(EconomicSpikeError::ArithmeticOverflow)?;
    Ok(
        EconomicSpikeState {
            active_backing: state.active_backing - amount,
            cumulative_outbox,
            mutation_count: state.mutation_count + 1,
            sealed_batch_count: state.sealed_batch_count + 1,
            ..state,
        },
    )
}
