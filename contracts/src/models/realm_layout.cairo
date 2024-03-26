use eternum::models::production::{Production, ProductionRateTrait};
use eternum::models::resources::Resource;

// WIP THIS IS ALL DUMMY

const PRODUCTION_RATE: u64 = 100;

const CONSUMPTION_RATE: u64 = 10;

#[derive(Model, Copy, Drop, Serde)]
struct LandOwner {
    #[key]
    world_row: u128,
    #[key]
    world_col: u128,
    entity_id: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct RealmLayout {
    #[key]
    world_row: u128,
    #[key]
    world_col: u128,
    #[key]
    internal_row: u128,
    #[key]
    internal_col: u128,
    building_id: u8,
}


#[generate_trait]
impl RealmLayoutImpl of RealmLayoutTrait {
    fn activate_building(ref self: RealmLayout, building_id: u8) {
        // get the entity owner
        let mut owner: Production = get!(world, (self.world_row, self.world_col), LandOwner);

        // -------- PRODUCTION RATE --------
        // this is what this building produces
        let test_resource = 1;

        let mut production: Production = get!(world, (owner.entity_id, test_resource), Production);

        let mut resource_to_produce: Resource = get!(
            world, (owner.entity_id, test_resource, Resource)
        );
        production.increase_production_rate(PRODUCTION_RATE, ref resource_to_produce);

        // -------- CONSUMPTION RATE --------
        // @dev: this is what the building consumes

        // this is what the building consumes
        let consumed_resource_one = 1;

        let mut consumption_one: Production = get!(
            world, (owner.entity_id, consumed_resource_one), Production
        );
        let mut resource_to_consume: Resource = get!(
            world, (owner.entity_id, consumed_resource_one, Resource)
        );
        consumption_one.increase_consumed_rate(CONSUMPTION_RATE, ref resource_to_consume);
    }
}
