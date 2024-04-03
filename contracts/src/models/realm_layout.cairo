use core::num::traits::zero::Zero;
use core::zeroable::Zeroable;
use eternum::models::production::{Production, ProductionRateTrait, ProductionConfig};
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::owner::Owner;
use eternum::models::owner::EntityOwner;
use eternum::constants::ResourceTypes;
use eternum::models::position::{Coord, Position};
use dojo::world::IWorldDispatcherTrait;

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
    category: BuildingCategory,
    entity_id: u128,
}

#[derive(PartialEq, Copy, Drop, Serde, PrintTrait)]
enum BuildingCategory {
    Castle,
    Resource: u8,
    Farm,
    FishingVillage
}

#[generate_trait]
impl BuildingCategoryImpl of BuildingCategoryTrait {
    // fn one
    fn get_produced_resource(self: BuildingCategory) -> u8 {
        match self {
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource(_type) => _type,
            BuildingCategory::Farm  => ResourceTypes::WHEAT,
            BuildingCategory::FishingVillage  => ResourceTypes::FISH,
        }
    }

    fn get_production_multiplier(self: BuildingCategory) -> u128 {
        match self {
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource(_type) => 0,
            BuildingCategory::Farm  => 10_000, // 10%
            BuildingCategory::FishingVillage  => 0,
        }
    }
}

#[generate_trait]
impl BuildingProductionImpl of BuildingProductionTrait {


    fn create(world: IWorldDispatcher, outer_entity_id: u128, category: BuildingCategory, inner_coord: Coord) {
        let outer_entity_owner = get!(world, outer_entity_id, Owner);
        assert!(
            outer_entity_owner.address == starknet::get_caller_address(),
                "caller not outer entity owner"
        );

        // check that the entity has a position
        let outer_entity_position = get!(world, outer_entity_id, Position);
        assert!(
            outer_entity_position.x != 0 || outer_entity_position.y != 0, 
                "outer entity's position is not set"
        );

        // todo@credence: ensure that the bounds are within the inner realm bounds

        // ensure that inner coordinate is not occupied
        let inner_entity_position = get!(world, inner_entity_id, Position);
        assert!(
            inner_entity_position.x == 0 && inner_entity_position.y == 0, 
                "inner entity's position is occupied"
        );



        // set building 
        let building = Building {
            outer_col: outer_entity_position.y,
            outer_row: outer_entity_position.x,
            inner_col: inner_coord.y,
            inner_row: inner_coord.x,
            entity_id: world.uuid().into(),
            category: category
        };


        set!(world, (building));


        let resource_type = building.category.get_produced_resource();
        if resource_type.is_non_zero() {
            let production_config: ProductionConfig = get!(world, resource_type, ProductionConfig);

            let mut produced_resource = get!(world, (outer_entity_id, resource_type), Resource);
            let mut production: Production = get!(world, (outer_entity_id, resource_type), Production);

            if !production.is_active() {
                production
                    .set_rate(production_config.amount_per_tick);
            }
            production.increase_building_count(ref produced_resource); 


            // increase consumption rate of first payment resource
            let mut cost_1_production: Production 
                = get!(world, (outer_entity_id, production_config.cost_resource_type_1), Production);
            cost_1_production
                .increase_consumed_rate(
                    ref produced_resource,production_config.cost_resource_type_1_amount);

            // increase consumption rate of second payment resource
            let mut cost_2_production: Production 
                = get!(world, (outer_entity_id, production_config.cost_resource_type_2), Production);
            cost_2_production
                .increase_consumed_rate(
                    ref produced_resource,production_config.cost_resource_type_2_amount);

            set!(world, (produced_resource));
            set!(world, (production));
            set!(world, (cost_1_production, cost_2_production));
        }
    }


    fn remove(world: IWorldDispatcher, outer_entity_id: u128, inner_coord: Coord) {
        let outer_entity_owner = get!(world, outer_entity_id, Owner);
        assert!(
            outer_entity_owner.address == starknet::get_caller_address(),
                "caller not outer entity owner"
        );

        // check that the outer entity has a position
        let outer_entity_position = get!(world, outer_entity_id, Position);
        assert!(
            outer_entity_position.x != 0 || outer_entity_position.y != 0, 
                "outer entity's position is not set"
        );

        // todo@credence: ensure that the bounds are within the inner realm bounds

        // ensure that inner coordinates are  occupied
        let building : Building 
            = get!(world, (outer_entity_position.x. outer_entity_position.y, inner_coord.x, inner_coord.y), Building);
        assert!(building.entity_id != 0, "building does not exist");


        let resource_type = building.category.get_produced_resource();
        if resource_type.is_non_zero() {
            let production_config: ProductionConfig = get!(world, resource_type, ProductionConfig);

            let mut produced_resource = get!(world, (outer_entity_id, resource_type), Resource);
            let mut production: Production = get!(world, (outer_entity_id, resource_type), Production);

            production.decrease_building_count(ref produced_resource);
            
            // decrease consumption rate of first payment resource
            let mut cost_1_production: Production 
                = get!(world, (outer_entity_id, production_config.cost_resource_type_1), Production);
            cost_1_production
                .decrease_consumed_rate(
                    ref produced_resource,production_config.cost_resource_type_1_amount);

            // increase consumption rate of second payment resource
            let mut cost_2_production: Production 
                = get!(world, (outer_entity_id, production_config.cost_resource_type_2), Production);
            cost_2_production
                .decrease_consumed_rate(
                    ref produced_resource,production_config.cost_resource_type_2_amount);

            set!(world, (produced_resource));
            set!(world, (production));
            set!(world, (cost_1_production, cost_2_production));
        }
    }
}
