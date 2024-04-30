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

// Hyperstructure Design

// Hyperstructures are created on Hexes and project energy Fields in a radius around them.
// Within the Energy Field anyone can build Settlements. Settlements are like Realms, however their resources get depleted over time. Settlements also cost $lords.
// When a settlement is created the cost of the Settlement is sent to the Hyperstructure. The owner of the hyperstructure can then claim these lords.

// How do we define the Cost of a Settlement?
// The owner of the hyperstructure does this

#[derive(Model, Copy, Drop, Serde)]
struct HyperStructureV2 {
    #[key]
    entity_id: u128,
    owner: u128,
    completed: bool,
    settlement_cost: u32,
    settlment_tax: u32,
}


#[generate_trait]
impl HyperStructureV2Impl of HyperStructureV2Trait {
    fn construct(self: HyperStructureV2) {}
    fn destruct(self: HyperStructureV2) {}
    fn cost(self: HyperStructureV2, row: u32, col: u32) -> u32 {
        // this would return the cost of the hyperstructure relative to the distance from the center of the map
        0
    }
    fn swap_ownership(ref self: HyperStructureV2, new_owner: u128) {
        self.owner = new_owner;
    }
}
