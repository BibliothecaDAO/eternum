use starknet::ContractAddress;
use cubit::f128::types::fixed::{Fixed, FixedTrait};

// Used as helper struct throughout the world
#[derive(Model, Copy, Drop, Serde)]
struct Bank {
    #[key]
    entity_id: u128,
    owner_fee_scaled: u128,
    exists: bool,
}

// Used as helper struct throughout the world
#[derive(Model, Copy, Drop, Serde)]
struct BankAccounts {
    #[key]
    bank_entity_id: u128,
    #[key]
    owner: ContractAddress,
    entity_id: u128,
}
