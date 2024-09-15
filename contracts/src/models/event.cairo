use eternum::models::buildings::BuildingCategory;
use eternum::{alias::ID, models::combat::BattleSide, models::structure::StructureCategory};
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct EternumEvent {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    timestamp: u64,
    // data: EventData,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub enum EventType {
    BattleStart,
    BattleJoin,
    BattleLeave,
    BattleClaim,
    BattlePillage,
    SettleRealm,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub enum EventData {
    BattleStart: BattleStartData,
    BattleJoin: BattleJoinData,
    BattleLeave: BattleLeaveData,
    BattleClaim: BattleClaimData,
    BattlePillage: BattlePillageData,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct BattleStartData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    battle_entity_id: ID,
    attacker: ContractAddress,
    attacker_name: felt252,
    attacker_army_entity_id: ID,
    defender_name: felt252,
    defender: ContractAddress,
    defender_army_entity_id: ID,
    duration_left: u64,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
    timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct BattleJoinData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    battle_entity_id: ID,
    joiner: ContractAddress,
    joiner_name: felt252,
    joiner_army_entity_id: ID,
    joiner_side: BattleSide,
    duration_left: u64,
    x: u32,
    y: u32,
    timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct BattleLeaveData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    battle_entity_id: ID,
    leaver: ContractAddress,
    leaver_name: felt252,
    leaver_army_entity_id: ID,
    leaver_side: BattleSide,
    duration_left: u64,
    x: u32,
    y: u32,
    timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct BattleClaimData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    structure_entity_id: ID,
    claimer: ContractAddress,
    claimer_name: felt252,
    claimer_army_entity_id: ID,
    previous_owner: ContractAddress,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
    timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct BattlePillageData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    pillager: ContractAddress,
    pillager_name: felt252,
    pillager_realm_entity_id: ID,
    pillager_army_entity_id: ID,
    pillaged_structure_owner: ContractAddress,
    pillaged_structure_entity_id: ID,
    winner: BattleSide,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
    pillaged_resources: Span<(u8, u128)>,
    destroyed_building_category: BuildingCategory,
    timestamp: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event]
#[dojo::model]
pub struct SettleRealmData {
    #[key]
    id: ID,
    #[key]
    event_id: EventType,
    entity_id: ID,
    owner_name: felt252,
    realm_name: felt252,
    resource_types_packed: u128,
    resource_types_count: u8,
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    wonder: u8,
    order: u8,
    x: u32,
    y: u32,
    timestamp: u64,
}
