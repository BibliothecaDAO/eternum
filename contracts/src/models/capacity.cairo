#[derive(Model, Copy, Drop, Serde)]
struct Capacity {
    #[key]
    entity_id: u128,
    weight_gram: u128,
}
