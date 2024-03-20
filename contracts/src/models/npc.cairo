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
    current_realm_entity_id: u128,
    characteristics: felt252,
    character_trait: felt252,
    full_name: felt252,
}

#[derive(Model, Serde, Copy, Drop, Print)]
struct RealmRegistry {
    #[key]
    realm_entity_id: u128,
    num_resident_npcs: u8,
    num_native_npcs: u8,
}
