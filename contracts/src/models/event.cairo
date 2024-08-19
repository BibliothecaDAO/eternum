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
    data: EventData,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub enum EventType {
    BattleStart,
    BattleJoin,
    BattleLeave,
    BattleClaim,
    BattlePillage,
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
pub struct BattleStartData {
    battle_entity_id: ID,
    attacker: ContractAddress,
    attacker_army_entity_id: ID,
    defender: ContractAddress,
    defender_army_entity_id: ID,
    duration_left: u64,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BattleJoinData {
    battle_entity_id: ID,
    joiner: ContractAddress,
    joiner_army_entity_id: ID,
    joiner_side: BattleSide,
    duration_left: u64,
    x: u32,
    y: u32,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BattleLeaveData {
    battle_entity_id: ID,
    leaver: ContractAddress,
    leaver_army_entity_id: ID,
    leaver_side: BattleSide,
    duration_left: u64,
    x: u32,
    y: u32,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BattleClaimData {
    structure_entity_id: ID,
    claimer: ContractAddress,
    claimer_army_entity_id: ID,
    previous_owner: ContractAddress,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct BattlePillageData {
    pillager: ContractAddress,
    pillager_army_entity_id: ID,
    pillaged_structure_owner: ContractAddress,
    pillaged_structure_entity_id: ID,
    winner: BattleSide,
    x: u32,
    y: u32,
    structure_type: StructureCategory,
    pillaged_resources: Span<(u8, u128)>,
}
