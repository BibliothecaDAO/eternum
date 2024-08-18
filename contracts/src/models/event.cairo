use eternum::{alias::ID, models::combat::BattleSide};
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
enum EventType {
    BattleStart,
    BattleJoin,
    BattleLeave,
}

#[derive(Introspect, Copy, Drop, Serde)]
enum EventData {
    BattleStart: BattleStartData,
    BattleJoin: BattleJoinData,
    BattleLeave: BattleLeaveData,
}

#[derive(Introspect, Copy, Drop, Serde)]
struct BattleStartData {
    attacker: ContractAddress,
    attacker_army_entity_id: ID,
    defender: ContractAddress,
    defender_army_entity_id: ID,
    duration_left: u64
}

#[derive(Introspect, Copy, Drop, Serde)]
struct BattleJoinData {
    joiner: ContractAddress,
    joiner_army_entity_id: ID,
    joiner_side: BattleSide,
    duration_left: u64,
}

#[derive(Introspect, Copy, Drop, Serde)]
struct BattleLeaveData {
    leaver: ContractAddress,
    leaver_army_entity_id: ID,
    leaver_side: BattleSide,
    duration_left: u64,
}
