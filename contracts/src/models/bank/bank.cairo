use cubit::f128::types::fixed::{Fixed, FixedTrait};
use eternum::alias::ID;
use starknet::ContractAddress;

// Used as helper struct throughout the world
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Bank {
    #[key]
    entity_id: ID,
    owner_fee_num: u128,
    owner_fee_denom: u128,
    owner_bridge_fee_dpt_percent: u16,
    owner_bridge_fee_wtdr_percent: u16,
    exists: bool,
}

