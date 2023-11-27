#[derive(Model, Copy, Drop, Serde)]
struct HyperStructure {
    #[key]
    entity_id: u128,
    hyperstructure_type: u8,
    order: u8,
    level: u32,
    max_level: u32
}