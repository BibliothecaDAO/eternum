#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct HyperStructure {
    #[key]
    entity_id: u128,
    created_at: u64,
    completed_at: u64,
    resource_count: usize
}



#[derive(Component, Copy, Drop, Serde)]
struct HyperStructureResource {
    #[key]
    entity_id: u128,
    #[key]
    index: usize,
    resource_type: u8,
    amount: usize
}
