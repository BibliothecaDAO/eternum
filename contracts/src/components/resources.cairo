// Used as helper struct throughout the world
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Resource {
    // This is compound key of entity_id and resource_type
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct ResourceCost {
    #[key]
    entity_id: u128,
    #[key]
    index: usize,
    resource_type: u8,
    amount: u128
}

// TODO: need to change the whole vault logic
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Vault {
    // This is compound key of entity_id and resource_type
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}
