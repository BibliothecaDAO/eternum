#[derive(Model, Copy, Drop, Serde)]
struct LaborBuilding {
    #[key]
    realm_entity_id: u128,
    building_type: u8,
    labor_count: u128,
    level: u128,
}
