use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::{ResourceAmount, ResourceKey, ResourceSlot};

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum Stage {
    Foundation,
    Construction,
    Complete,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum ConstructionAccess {
    Public,
    Private,
    GuildOnly,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Hyperstructure {
    pub stage: Stage,
    pub access: ConstructionAccess,
    pub seed: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ConstructionResource {
    pub resource_type: u8,
    pub minimum: u32,
    pub maximum: u32,
    pub points: u64,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct HyperstructureRules {
    pub initialize_shards: u128,
    pub resources: Span<ConstructionResource>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Share {
    pub player: ContractAddress,
    pub bps: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ShareAllocation {
    pub start_at: u64,
    pub multiplier: u8,
    pub shareholders: Span<Share>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Contribution {
    pub hyperstructure_id: u32,
    pub from_structure_id: u32,
    pub resources: Span<ResourceAmount>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AllocateShares {
    pub hyperstructure_id: u32,
    pub shareholders: Span<Share>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetConstructionAccess {
    pub hyperstructure_id: u32,
    pub access: ConstructionAccess,
}

#[starknet::interface]
pub trait IHyperstructures<T> {
    fn configure_hyperstructures(ref self: T, game_id: u32, rules: HyperstructureRules);
    fn hyperstructure_rules(self: @T, game_id: u32) -> HyperstructureRules;
    fn hyperstructure(self: @T, key: ResourceKey) -> Option<Hyperstructure>;
    fn hyperstructure_progress(self: @T, key: ResourceSlot) -> u128;
    fn hyperstructure_requirement(self: @T, key: ResourceSlot) -> u128;
    fn hyperstructure_shares(self: @T, key: ResourceKey) -> ShareAllocation;
    fn hyperstructure_count(self: @T, game_id: u32) -> u32;
    fn completed_hyperstructure_count(self: @T, game_id: u32) -> u32;
    fn settle_completed_hyperstructures(ref self: T, game_id: u32, timestamp: u64) -> u32;
    fn settle_final_hyperstructures(ref self: T, game_id: u32, timestamp: u64) -> u32;
    fn record_hyperstructure(ref self: T, key: ResourceKey, seed: felt252, completed: bool);
    fn initialize_hyperstructure(ref self: T, game_id: u32, actor: ContractAddress, id: u32, context: ExecutionContext);
    fn contribute_hyperstructure(
        ref self: T, game_id: u32, actor: ContractAddress, contribution: Contribution, context: ExecutionContext,
    );
    fn allocate_hyperstructure_shares(
        ref self: T, game_id: u32, actor: ContractAddress, command: AllocateShares, context: ExecutionContext,
    );
    fn set_construction_access(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetConstructionAccess, context: ExecutionContext,
    );
}

pub fn required_amount(seed: felt252, cost: ConstructionResource) -> u128 {
    let extra = if cost.minimum == cost.maximum {
        0
    } else {
        let seed: u256 = seed.into();
        (seed / cost.resource_type.into() % (cost.maximum - cost.minimum).into()).try_into().unwrap()
    };
    Into::<u32, u128>::into(cost.minimum + extra) * crate::rules::RESOURCE_PRECISION
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SharePoints {
    pub player: ContractAddress,
    pub points: u128,
}
