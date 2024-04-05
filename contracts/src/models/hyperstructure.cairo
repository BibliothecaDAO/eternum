#[derive(Model, Copy, Drop, Serde)]
struct HyperStructure {
    #[key]
    entity_id: u128,
    hyperstructure_type: u8,
    controlling_order: u8,
    completed: bool,
    completion_cost_id: u128,
    completion_resource_count: u32,
}
