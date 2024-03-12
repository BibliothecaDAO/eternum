use core::traits::Into;

#[derive(Serde, Copy, Drop, Print)]
struct Characteristics {
    age: u8,
    role: u8,
    sex: u8,
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npc {
    #[key]
    entity_id: u128,
    characteristics: felt252,
    character_trait: felt252,
    full_name: felt252,
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct Npcs {
    #[key]
    realm_entity_id: u128,
    num_npcs: u8,
    npc_0: u128, // entity_id: points to the relevant entity
    npc_1: u128,
    npc_2: u128,
    npc_3: u128,
    npc_4: u128
}
