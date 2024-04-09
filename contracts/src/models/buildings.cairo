use eternum::models::position::CoordTrait;
use core::zeroable::Zeroable;
use eternum::models::production::{Production,ProductionInput, ProductionRateTrait, ProductionBonusPercentageImpl};
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::models::owner::Owner;
use eternum::models::owner::EntityOwner;
use eternum::constants::ResourceTypes;
use eternum::models::position::{Coord, Position, Direction};
use core::poseidon::poseidon_hash_span as hash;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{ProductionConfig};

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
    produced_resource_type: u8,
    entity_id: u128,
    outer_entity_id: u128,
}

#[derive(PartialEq, Copy, Drop, Serde, PrintTrait, Introspect)]
enum BuildingCategory {
    None,
    Castle,
    Resource,
    Farm,
    FishingVillage,
    Barracks,
    Market,
    ArcheryRange,
    Stable,
}

impl DirectionIntoFelt252 of Into<BuildingCategory, felt252> {
    fn into(self: BuildingCategory) -> felt252 {
        match self {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 1,
            BuildingCategory::Resource => 2,
            BuildingCategory::Farm => 3,
            BuildingCategory::FishingVillage => 4,
            BuildingCategory::Barracks => 5,
            BuildingCategory::Market => 6,
            BuildingCategory::ArcheryRange => 7,
            BuildingCategory::Stable => 8,
        }
    }
}


#[generate_trait]
impl BuildingProductionImpl of BuildingProductionTrait {
    fn is_resource_producer(self: Building) -> bool {
        let produced_resource = self.produced_resource();
        return produced_resource.is_non_zero();
    }

    fn is_production_multiplier(self: Building) -> bool {
        let multiplier = self.production_multiplier();
        return multiplier.is_non_zero();
    }

    fn produced_resource(self: Building) -> u8 {
        match self.category {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource => self.produced_resource_type,
            BuildingCategory::Farm => ResourceTypes::WHEAT,
            BuildingCategory::FishingVillage => ResourceTypes::FISH,
            BuildingCategory::Barracks => ResourceTypes::KNIGHT,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => ResourceTypes::CROSSBOWMAN,
            BuildingCategory::Stable => ResourceTypes::PALADIN,
        }
    }

    fn production_multiplier(self: Building) -> u128 {
        match self.category {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource => 0,
            BuildingCategory::Farm => ProductionBonusPercentageImpl::_10(), // 10%
            BuildingCategory::FishingVillage => 0,
            BuildingCategory::Barracks => 0,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => 0,
            BuildingCategory::Stable => 0,
        }
    }


    fn start_production(ref self: Building, world: IWorldDispatcher) {
        if self.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource 
                = ResourceImpl::get(world, (self.outer_entity_id, produced_resource_type));

            // add resource production settings
            let production_config: ProductionConfig = get!(
                world, produced_resource_type, ProductionConfig
            );
            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );
            resource_production.set_rate(production_config.amount);
            resource_production.increase_building_count(ref produced_resource, @tick);

            set!(world, (produced_resource));
            set!(world, (resource_production));

            // make payment for production by increase input resources consumption rates
            let mut count = 0;
            loop {
                if count == production_config.input_count {
                    break;
                }

                let production_input: ProductionInput = get!(
                    world, (produced_resource_type, count), ProductionInput
                );
                let (input_resource_type, input_resource_amount) = (
                    production_input.input_resource_type, production_input.input_resource_amount
                );
                let mut input_resource: Resource 
                    = ResourceImpl::get(world, (self.outer_entity_id, input_resource_type));
                let mut input_production: Production = get!(
                    world, (self.outer_entity_id, input_resource_type), Production
                );

                input_production
                    .increase_consumption_rate(ref input_resource, @tick, input_resource_amount);
                count += 1;

                set!(world, (input_production, input_resource));
            };
        }

        // receive bonuses from surrounding buildings that give bonuses
        self.update_bonuses_received(world, true);
        // give out bonuses to surrounding buildings if this building is a bonus supplier
        self.update_bonuses_supplied(world, true);
    }


    fn stop_production(ref self: Building, world: IWorldDispatcher) {
        if self.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource 
                = ResourceImpl::get(world, (self.outer_entity_id, produced_resource_type));

            // stop resource production
            let production_config: ProductionConfig = get!(
                world, produced_resource_type, ProductionConfig
            );
            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );
            resource_production.decrease_building_count(ref produced_resource, @tick);

            // stop payment for production and decrease consumption rate

            let mut count = 0;
            loop {
                if count == production_config.input_count {
                    break;
                }

                let production_input: ProductionInput = get!(
                    world, (produced_resource_type, count), ProductionInput
                );
                let (input_resource_type, input_resource_amount) = (
                    production_input.input_resource_type, production_input.input_resource_amount
                );
                let mut input_resource: Resource 
                    = ResourceImpl::get(world, (self.outer_entity_id, input_resource_type));
                
                let mut input_production: Production = get!(
                    world, (self.outer_entity_id, input_resource_type), Production
                );
                input_production
                    .decrease_consumption_rate(ref input_resource, @tick, input_resource_amount);

                // reset production stop time
                resource_production.set_end_tick(@input_production, @input_resource, @tick);

                count += 1;

                set!(world, (input_production, input_resource));
            };

            set!(world, (produced_resource));
            set!(world, (resource_production));
        }

        // stop receiving bonus from surrounding buildings
        self.update_bonuses_received(world, false);
        // stop giving out bonuses to surrounding buildings 
        // if this building is a bonus supplier
        self.update_bonuses_supplied(world, false);
    }


    fn update_bonuses_received(self: @Building, world: IWorldDispatcher, sign: bool) {
        let self = *self;
        // get bonuses from all buildings surronding this building if the offer boosts
        let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

        if self.is_resource_producer() {
            let produced_resource_type = self.produced_resource();
            let mut building_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );

            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::East), world, sign
                );
            self
                ._update_bonus_received_from(
                    ref building_production,
                    building_coord.neighbor(Direction::NorthEast),
                    world,
                    sign
                );
            self
                ._update_bonus_received_from(
                    ref building_production,
                    building_coord.neighbor(Direction::NorthWest),
                    world,
                    sign
                );
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::West), world, sign
                );
            self
                ._update_bonus_received_from(
                    ref building_production,
                    building_coord.neighbor(Direction::SouthWest),
                    world,
                    sign
                );
            self
                ._update_bonus_received_from(
                    ref building_production,
                    building_coord.neighbor(Direction::SouthEast),
                    world,
                    sign
                );
        }
    }


    fn update_bonuses_supplied(self: @Building, world: IWorldDispatcher, sign: bool) {
        let self = *self;

        // remove bonus from surrounding buildings if building is a boost multiplier
        // e.g if building is a farm
        if self.is_production_multiplier() {
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


    fn _update_bonus_received_from(
        self: @Building,
        ref production: Production,
        inner_coord: Coord,
        world: IWorldDispatcher,
        sign: bool
    ) {
        let building_at_coord: Building = get!(
            world, ((*self).outer_col, (*self).outer_row, inner_coord.x, inner_coord.y), Building
        );
        if sign {
            production.increase_boost_percentage(building_at_coord.production_multiplier());
        } else {
            production.decrease_boost_percentage(building_at_coord.production_multiplier());
        }
    }

    fn _update_bonus_supplied_to(
        self: Building, inner_coord: Coord, world: IWorldDispatcher, sign: bool
    ) {
        let building_at_coord: Building = get!(
            world, (self.outer_col, self.outer_row, inner_coord.x, inner_coord.y), Building
        );
        if building_at_coord.is_resource_producer() {
            let produced_resource_type = self.produced_resource();
            let mut production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );
            if sign {
                production.increase_boost_percentage(self.production_multiplier());
            } else {
                production.decrease_boost_percentage(self.production_multiplier());
            }

            set!(world, (production));
        }
    }
}

#[generate_trait]
impl BuildingImpl of BuildingTrait {
    fn create(
        world: IWorldDispatcher,
        outer_entity_id: u128,
        category: BuildingCategory,
        produce_resource_type: Option<u8>,
        inner_coord: Coord
    ) -> Building {
        let outer_entity_owner: Owner = get!(world, outer_entity_id, Owner);
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

        // ensure that building is not occupied
        let mut building: Building = get!(
            world,
            (outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y),
            Building
        );

        assert!(!building.is_occupied(), "building is occupied");

        // set building 
        building.entity_id = world.uuid().into();
        building.category = category;
        building.outer_entity_id = outer_entity_id;
        match produce_resource_type {
            Option::Some(resource_type) => {
                assert!(
                    building.category == BuildingCategory::Resource, "wrong produced resource type"
                );
                building.produced_resource_type = resource_type;
            },
            Option::None => ()
        }

        set!(world, (building));

        // start production related to building
        building.start_production(world);

        return building;
    }


    fn destroy(world: IWorldDispatcher, outer_entity_id: u128, inner_coord: Coord) {
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

        // ensure that inner coordinate is occupied
        let mut building: Building = get!(
            world,
            (outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y),
            Building
        );
        assert!(building.entity_id != 0, "building does not exist");

        // stop production related to building
        building.stop_production(world);

        // remove building 
        building.entity_id = 0;
        building.category = BuildingCategory::None;
        building.outer_entity_id = 0;

        set!(world, (building));
    }

    fn is_occupied(self: Building) -> bool {
        self.entity_id != 0
    }
}
