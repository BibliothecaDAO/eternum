#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Capacity {
    #[key]
    entity_id: u128,
    weight_gram: u128,
}
