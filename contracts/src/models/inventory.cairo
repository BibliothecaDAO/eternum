#[derive(Model, Copy, Drop, Serde)]
struct Inventory {
    #[key]
    entity_id: u128,
    #[key]
    category: u128,
    items_count: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct InventoryItem {
    #[key]
    entity_id: u128,
    #[key]
    category: u128,
    #[key]
    index: u128,
    item_id: u128,
}


mod InventoryCategory {
    const RESOURCE_CHEST : u128 = 1;
}