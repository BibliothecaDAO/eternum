#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Caravan {
    #[key]
    entity_id: u128,
    caravan_id: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CaravanMembers {
    #[key]
    entity_id: u128,
    key: u128,
    count: usize,
}
