use eternum::models::production::{Production, ProductionRateTrait};
use eternum::models::resources::Resource;
use eternum::models::owner::Owner;
use eternum::models::owner::EntityOwner;

//todo we need to define border of innner hexes

#[derive(Model, PartialEq, Copy, Drop, Serde, PrintTrait)]
struct Building {
    #[key]
    outer_col: u128,
    #[key]
    outer_row: u128,
    #[key]
    inner_col: u128,
    #[key]
    inner_row: u128,
    id: u128,
    category: BuildingCategory
}

#[derive(PartialEq, Copy, Drop, Serde, PrintTrait)]
enum BuildingCategory {
    Castle,
    Resource,
    Farm,
    FishingVillage
}

#[generate_trait]
impl BuildingProductionImpl of BuildingProductionTrait {

    fn activate(ref self: Building, world: IWorldDispatcher, resource_id: u128) {
        assert!(building.category == BuildingCategory::Resource);
        


        // // get the entity owner
        // let mut owner = get!(world, (self.world_row, self.world_col), LandOwner);

        // // -------- PRODUCTION RATE --------
        // // this is what this building produces
        // let test_resource = 1;

        // let mut production: Production = get!(world, (owner.entity_id, test_resource), Production);

        // let mut resource_to_produce: Resource = get!(
        //     world, (owner.entity_id, test_resource, Resource)
        // );
        // production.increase_production_rate(PRODUCTION_RATE, ref resource_to_produce);

        // // -------- CONSUMPTION RATE --------
        // // @dev: this is what the building consumes

        // // this is what the building consumes
        // let consumed_resource_one = 1;

        // let mut consumption_one: Production = get!(
        //     world, (owner.entity_id, consumed_resource_one), Production
        // );
        // let mut resource_to_consume: Resource = get!(
        //     world, (owner.entity_id, consumed_resource_one, Resource)
        // );
        // consumption_one.increase_consumed_rate(CONSUMPTION_RATE, ref resource_to_consume);
    }

    fn get_production_boost(ref self: Building, value: u128) -> u128 {
        (self.production_boost_numerator() * value) / self.production_boost_denominator()
    }

    fn production_boost_numerator(ref self: BuildingCategory) -> u128 {
        match self {
            BuildingCategory::Castle => self.production_boost_denominator(),
            BuildingCategory::Resource => self.production_boost_denominator(),
            BuildingCategory::Farm => 1_000, // 10% boost
            BuildingCategory::FishingVillage => self.production_boost_denominator(),
        }
    }

    fn production_boost_denominator(ref self: BuildingCategory) -> u128 {
        10_000
    }
}
