#[derive(Model, Copy, Drop, Serde)]
struct Army {
    #[key]
    entity_id: u128,
    infantry_qty: u128,
    cavalry_qty: u128,
    mage_qty: u128
}