// Used as helper struct throughout the world
#[derive(Model, Copy, Drop, Serde)]
struct Resource {
    // This is compound key of entity_id and resource_type
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceAllowance {
    #[key]
    owner_entity_id: u128,
    #[key]
    approved_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceCost {
    #[key]
    entity_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    amount: u128
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceChest {
    #[key]
    entity_id: u128,
    locked_until: u64,
    resources_count: u32,
}

#[derive(Model, Copy, Drop, Serde)]
struct DetachedResource {
    #[key]
    entity_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    resource_amount: u128
}
