use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::ContractAddress;

// Used as helper struct throughout the world
#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Bank {
    #[key]
    entity_id: u128,
    owner_fee_num: u128,
    owner_fee_denom: u128,
    exists: bool,
}

