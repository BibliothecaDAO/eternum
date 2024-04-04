use eternum::models::position::CoordTrait;
use core::num::traits::zero::Zero;
use core::zeroable::Zeroable;
use eternum::models::production::{Production, ProductionRateTrait, ProductionConfig};
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::owner::Owner;
use eternum::models::owner::EntityOwner;
use eternum::constants::ResourceTypes;
use eternum::models::position::{Coord, Position, Direction};
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
    outer_entity_id: u128,
}

#[derive(PartialEq, Copy, Drop, Serde, PrintTrait)]
enum BuildingCategory {
    None,
    Castle,
    Resource: u8,
    Farm,
    FishingVillage,
    Barracks,
    Market,
    ArcheryRange,
    Stable,
}

#[generate_trait]
impl BuildingCategoryImpl of BuildingCategoryTrait {
    // fn one
    fn get_produced_resource(self: BuildingCategory) -> u8 {
        match self {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource(_type) => _type,
            BuildingCategory::Farm => ResourceTypes::WHEAT,
            BuildingCategory::FishingVillage => ResourceTypes::FISH,
            BuildingCategory::Barracks => ResourceTypes::KNIGHT,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => ResourceTypes::CROSSBOWMAN,
            BuildingCategory::Stable => ResourceTypes::PALADIN,
        }
    }

    fn get_production_multiplier(self: BuildingCategory) -> u128 {
        match self {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource(_type) => 0,
            BuildingCategory::Farm => 10_000, // 10%
            BuildingCategory::FishingVillage => 0,
            BuildingCategory::Barracks => 0,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => 0,
            BuildingCategory::Stable => 0,
        }
    }
}

#[generate_trait]
impl BuildingProductionImpl of BuildingProductionTrait {
    fn create(
        world: IWorldDispatcher,
        outer_entity_id: u128,
        category: BuildingCategory,
        inner_coord: Coord
    ) {
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
            category: category,
            outer_entity_id,
        };

        set!(world, (building));

        let resource_type = building.category.get_produced_resource();
        if resource_type.is_non_zero() {
            let production_config: ProductionConfig = get!(world, resource_type, ProductionConfig);

            let mut produced_resource = get!(world, (outer_entity_id, resource_type), Resource);
            let mut production: Production = get!(
                world, (outer_entity_id, resource_type), Production
            );

            if !production.is_active() {
                production.set_rate(production_config.amount_per_tick);
            }
            production.increase_building_count(ref produced_resource);

            // increase consumption rate of first payment resource
            let mut cost_1_production: Production = get!(
                world, (outer_entity_id, production_config.cost_resource_type_1), Production
            );
            cost_1_production
                .increase_consumed_rate(
                    ref produced_resource, production_config.cost_resource_type_1_amount
                );

            // increase consumption rate of second payment resource
            let mut cost_2_production: Production = get!(
                world, (outer_entity_id, production_config.cost_resource_type_2), Production
            );
            cost_2_production
                .increase_consumed_rate(
                    ref produced_resource, production_config.cost_resource_type_2_amount
                );

            // get bonuses from surrounding buildings
            building.update_bonuses_received(world, true);
            // give bonuses that this building supplies to nearby buildings if it 
            // supplies such. e.g if building is a farm
            if building.category.get_production_multiplier().is_non_zero() {
                building.update_bonuses_supplied(world, true);
            }

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
        let mut building: Building = get!(
            world,
            (outer_entity_position.x.outer_entity_position.y, inner_coord.x, inner_coord.y),
            Building
        );
        assert!(building.entity_id != 0, "building does not exist");

        let resource_type = building.category.get_produced_resource();
        if resource_type.is_non_zero() {
            let production_config: ProductionConfig = get!(world, resource_type, ProductionConfig);

            let mut produced_resource = get!(world, (outer_entity_id, resource_type), Resource);
            let mut production: Production = get!(
                world, (outer_entity_id, resource_type), Production
            );

            production.decrease_building_count(ref produced_resource);

            // decrease consumption rate of first payment resource
            let mut cost_1_production: Production = get!(
                world, (outer_entity_id, production_config.cost_resource_type_1), Production
            );
            cost_1_production
                .decrease_consumed_rate(
                    ref produced_resource, production_config.cost_resource_type_1_amount
                );

            // increase consumption rate of second payment resource
            let mut cost_2_production: Production = get!(
                world, (outer_entity_id, production_config.cost_resource_type_2), Production
            );
            cost_2_production
                .decrease_consumed_rate(
                    ref produced_resource, production_config.cost_resource_type_2_amount
                );

            set!(world, (produced_resource));
            set!(world, (production));
            set!(world, (cost_1_production, cost_2_production));
        }

        // remove bonuses that this building supplies to nearby buildings
        if building.category.get_production_multiplier().is_non_zero() {
            building.update_bonuses_supplied(world, false);
        }

        // remove any bonus boost this building has itself
        building.update_bonuses_received(world, false);

        // update building
        building.category = BuildingCategory::None;
        building.entity_id = 0;
        building.outer_entity_id = 0;
        set!(world, (building));
    }

    fn update_bonuses_received(self: @Building, world: IWorldDispatcher, sign: bool) {
        // get bonuses from all buildings surronding this building if the offer boosts
        // note: naming is bad. will be updated
        let building_coord: Coord = Coord { x: *self.inner_col, y: *self.inner_row };
        let mut building_production: Production = get!(
            world, (self.outer_entity_id, resource_type), Production
        );

        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::East), world, sign
            );
        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::NorthEast), world, sign
            );
        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::NorthWest), world, sign
            );
        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::West), world, sign
            );
        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::SouthWest), world, sign
            );
        self
            ._update_bonus_received_from(
                ref building_production, building_coord.neighbor(Direction::SouthEast), world, sign
            );
    }


    fn _update_bonus_received_from(
        self: @Building,
        ref production: Production,
        inner_coord: Coord,
        world: IWorldDispatcher,
        sign: bool
    ) {
        let building_at_coord: Building = get!(
            world, (self.outer_col, self.outer_row, inner_coord.x, inner_coord.y), Building
        );
        if sign {
            production
                .increase_boost_percentage(building_at_coord.category.get_production_multiplier());
        } else {
            production
                .decrease_boost_percentage(building_at_coord.category.get_production_multiplier());
        }
    }

    fn update_bonuses_supplied(self: Building, world: IWorldDispatcher, sign: bool) {
        // remove bonus from surrounding buildings if building is a boost multiplier
        // e.g if building is a farm
        if self.category.get_production_multiplier().is_non_zero() {
            let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };
            self._update_bonus_supplied_to(building_coord.neighbor(Direction::East), world, sign);
            self
                ._update_bonus_supplied_to(
                    building_coord.neighbor(Direction::NorthEast), world, sign
                );
            self
                ._update_bonus_supplied_to(
                    building_coord.neighbor(Direction::NorthWest), world, sign
                );
            self._update_bonus_supplied_to(building_coord.neighbor(Direction::West), world, sign);
            self
                ._update_bonus_supplied_to(
                    building_coord.neighbor(Direction::SouthWest), world, sign
                );
            self
                ._update_bonus_supplied_to(
                    building_coord.neighbor(Direction::SouthEast), world, sign
                );
        }
    }

    fn _update_bonus_supplied_to(
        self: Building, inner_coord: Coord, world: IWorldDispatcher, sign: bool
    ) {
        let building_at_coord: Building = get!(
            world, (self.outer_col, self.outer_row, inner_coord.x, inner_coord.y), Building
        );
        let produced_resource_type = building_at_coord.category.get_produced_resource();
        if produced_resource_type.is_non_zero() {
            let mut production: Production = get!(
                world, (self.outer_entity_id, resource_type), Production
            );
            if sign {
                production.increase_boost_percentage(self.category.get_production_multiplier());
            } else {
                production.decrease_boost_percentage(self.category.get_production_multiplier());
            }

            set!(world, (production));
        }
    }
}
