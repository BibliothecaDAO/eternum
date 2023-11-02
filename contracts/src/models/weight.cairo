#[derive(Model, Copy, Drop, Serde)]
struct Weight {
    #[key]
    entity_id: u128,
    value: u128,
}