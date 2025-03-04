use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[derive(Introspect, Copy, Drop, Serde)]
pub enum EventType {
    // BattleStart,
    // BattleJoin,
    // BattleLeave,
    // BattleClaim,
    // BattlePillage,
    SettleRealm,
}

// #[derive(Introspect, Copy, Drop, Serde)]
// pub enum EventData {
//     BattleStart: BattleStartData,
//     BattleJoin: BattleJoinData,
//     BattleLeave: BattleLeaveData,
//     BattleClaim: BattleClaimData,
//     BattlePillage: BattlePillageData,
// }

// #[derive(Introspect, Copy, Drop, Serde)]
// #[dojo::event(historical: false)]
// pub struct BattleStartData {
//     #[key]
//     id: ID,
//     #[key]
//     event_id: EventType,
//     battle_entity_id: ID,
//     attacker: ContractAddress,
//     attacker_name: felt252,
//     attacker_army_entity_id: ID,
//     defender_name: felt252,
//     defender: ContractAddress,
//     defender_army_entity_id: ID,
//     duration_left: u64,
//     x: u32,
//     y: u32,
//     structure_type: StructureCategory,
//     timestamp: u64,
// }

// #[derive(Introspect, Copy, Drop, Serde)]
// #[dojo::event(historical: false)]
// pub struct BattleJoinData {
//     #[key]
//     id: ID,
//     #[key]
//     event_id: EventType,
//     battle_entity_id: ID,
//     joiner: ContractAddress,
//     joiner_name: felt252,
//     joiner_army_entity_id: ID,
//     joiner_side: BattleSide,
//     duration_left: u64,
//     x: u32,
//     y: u32,
//     timestamp: u64,
// }

// #[derive(Introspect, Copy, Drop, Serde)]
// #[dojo::event(historical: false)]
// pub struct BattleLeaveData {
//     #[key]
//     id: ID,
//     #[key]
//     event_id: EventType,
//     battle_entity_id: ID,
//     leaver: ContractAddress,
//     leaver_name: felt252,
//     leaver_army_entity_id: ID,
//     leaver_side: BattleSide,
//     duration_left: u64,
//     x: u32,
//     y: u32,
//     timestamp: u64,
// }

// #[derive(Introspect, Copy, Drop, Serde)]
// #[dojo::event(historical: false)]
// pub struct BattleClaimData {
//     #[key]
//     id: ID,
//     #[key]
//     event_id: EventType,
//     structure_entity_id: ID,
//     claimer: ContractAddress,
//     claimer_name: felt252,
//     claimer_army_entity_id: ID,
//     claimee_address: ContractAddress,
//     claimee_name: felt252,
//     x: u32,
//     y: u32,
//     structure_type: StructureCategory,
//     timestamp: u64,
// }

// #[derive(Introspect, Copy, Drop, Serde)]
// #[dojo::event(historical: false)]
// pub struct BattlePillageData {
//     #[key]
//     id: ID,
//     #[key]
//     event_id: EventType,
//     pillager: ContractAddress,
//     pillager_name: felt252,
//     pillager_realm_entity_id: ID,
//     pillager_army_entity_id: ID,
//     pillaged_structure_owner: ContractAddress,
//     pillaged_structure_entity_id: ID,
//     attacker_lost_troops: Troops,
//     structure_lost_troops: Troops,
//     pillaged_structure_owner_name: felt252,
//     winner: BattleSide,
//     x: u32,
//     y: u32,
//     structure_type: StructureCategory,
//     pillaged_resources: Span<(u8, u128)>,
//     destroyed_building_category: BuildingCategory,
//     timestamp: u64,
// }

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::event(historical: false)]
pub struct SettleRealmData {
    #[key]
    pub id: ID,
    #[key]
    pub event_id: EventType,
    pub entity_id: ID,
    pub owner_address: ContractAddress,
    pub owner_name: felt252,
    pub realm_name: felt252,
    pub produced_resources: u128,
    pub cities: u8,
    pub harbors: u8,
    pub rivers: u8,
    pub regions: u8,
    pub wonder: u8,
    pub order: u8,
    pub x: u32,
    pub y: u32,
    pub timestamp: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
pub struct CreateGuild {
    #[key]
    pub guild_entity_id: ID,
    pub guild_name: felt252,
    pub timestamp: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event(historical: false)]
pub struct JoinGuild {
    #[key]
    pub guild_entity_id: ID,
    #[key]
    pub address: ContractAddress,
    pub guild_name: felt252,
    pub timestamp: u64,
}
