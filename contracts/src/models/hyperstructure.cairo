#[derive(Model, Copy, Drop, Serde)]
struct HyperStructure {
    #[key]
    entity_id: u128,
    hyperstructure_type: u8,
    initialization_resource_id: u128,
    initialization_resource_count: u32,
    construction_resource_id: u128,
    construction_resource_count: u32,
    initialized_at: u64,
    completed_at: u64,
    coord_x: u32,
    coord_y: u32
}