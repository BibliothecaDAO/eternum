#[derive(Model, Copy, Drop, Serde)]
struct Caravan {
    #[key]
    entity_id: felt252,
    caravan_id: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct CaravanMembers {
    #[key]
    entity_id: u128,
    key: u128,
    count: u32,
}