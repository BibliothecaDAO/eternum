#[derive(Model, Copy, Drop, Serde)]
struct Inventory {
    #[key]
    entity_id: u128,
    items_key: felt252,
    items_count: u128,
}