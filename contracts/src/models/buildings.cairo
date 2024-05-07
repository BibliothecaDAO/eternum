use core::poseidon::poseidon_hash_span as hash;
use core::zeroable::Zeroable;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::ResourceTypes;
use eternum::models::config::{
    TickConfig, TickImpl, TickTrait, ProductionConfig, BuildingConfig, BuildingConfigImpl,
    PopulationConfigTrait
};
use eternum::models::owner::{Owner, OwnerTrait, EntityOwner};
use eternum::models::population::{Population, PopulationTrait};
use eternum::models::position::{Coord, Position, Direction, PositionTrait, CoordTrait};
use eternum::models::production::{
    Production, ProductionInput, ProductionRateTrait, ProductionInputImpl
};
use eternum::models::resources::ResourceTrait;
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};

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
    bonus_percent: u128,
    entity_id: u128,
    outer_entity_id: u128,
}

#[derive(Model, PartialEq, Copy, Drop, Serde, PrintTrait)]
struct BuildingQuantityv2 {
    #[key]
    entity_id: u128,
    #[key]
    category: BuildingCategory,
    value: u8
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
    DonkeyFarm,
    TradingPost,
    WorkersHut,
    WatchTower,
    Walls,
    Storehouse,
}

impl BuildingCategoryIntoFelt252 of Into<BuildingCategory, felt252> {
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
            BuildingCategory::DonkeyFarm => 9,
            BuildingCategory::TradingPost => 10,
            BuildingCategory::WorkersHut => 11,
            BuildingCategory::WatchTower => 12,
            BuildingCategory::Walls => 13,
            BuildingCategory::Storehouse => 14,
        }
    }
}


#[generate_trait]
impl BuildingQuantityv2TrackerImpl of BuildingQuantityv2TrackerTrait {
    fn salt() -> felt252 {
        'building_quantity'
    }
    fn key(entity_id: u128, category: felt252, resource_type: u8) -> felt252 {
        let q: Array<felt252> = array![
            entity_id.into(), BuildingQuantityv2TrackerImpl::salt(), category, resource_type.into()
        ];
        hash(q.span())
    }
}

#[generate_trait]
impl BonusPercentageImpl of BonusPercentageTrait {
    fn _1() -> u128 {
        100
    }

    fn _10() -> u128 {
        1_000
    }

    fn _100() -> u128 {
        10_000
    }
}


#[generate_trait]
impl BuildingProductionImpl of BuildingProductionTrait {
    fn is_resource_producer(self: Building) -> bool {
        self.produced_resource().is_non_zero()
    }

    fn is_adjacent_building_booster(self: Building) -> bool {
        self.boost_adjacent_building_production_by().is_non_zero()
    }

    fn produced_resource(self: Building) -> u8 {
        match self.category {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource => self.produced_resource_type,
            BuildingCategory::Farm => ResourceTypes::WHEAT,
            BuildingCategory::FishingVillage => ResourceTypes::FISH,
            BuildingCategory::Barracks => ResourceTypes::KNIGHT,
            BuildingCategory::Market => ResourceTypes::DONKEY,
            BuildingCategory::ArcheryRange => ResourceTypes::CROSSBOWMAN,
            BuildingCategory::Stable => ResourceTypes::PALADIN,
            BuildingCategory::DonkeyFarm => 0,
            BuildingCategory::TradingPost => 0,
            BuildingCategory::WorkersHut => 0,
            BuildingCategory::WatchTower => 0,
            BuildingCategory::Walls => 0,
            BuildingCategory::Storehouse => 0,
        }
    }

    fn boost_adjacent_building_production_by(self: Building) -> u128 {
        match self.category {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource => 0,
            BuildingCategory::Farm => BonusPercentageImpl::_10(), // 10%
            BuildingCategory::FishingVillage => 0,
            BuildingCategory::Barracks => 0,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => 0,
            BuildingCategory::Stable => 0,
            BuildingCategory::DonkeyFarm => 0,
            BuildingCategory::TradingPost => 0,
            BuildingCategory::WorkersHut => 0,
            BuildingCategory::WatchTower => 0,
            BuildingCategory::Walls => 0,
            BuildingCategory::Storehouse => 0,
        }
    }


    fn start_production(ref self: Building, world: IWorldDispatcher) {
        if self.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource = ResourceImpl::get(
                world, (self.outer_entity_id, produced_resource_type)
            );

            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );

            // increase production building count by 1
            resource_production.increase_building_count();

            // receive bonuses from surrounding buildings that give bonuses
            self
                .update_bonuses_received(
                    ref resource_production, ref produced_resource, world, delete: false
                );

            // add this building's contribution to global production rate
            resource_production
                .increase_production_rate(
                    ref produced_resource, @tick, self.production_amount(world)
                );

            // make payment for production by increasing input resources consumption rates
            let production_config: ProductionConfig = get!(
                world, produced_resource_type, ProductionConfig
            );
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
                let mut input_resource: Resource = ResourceImpl::get(
                    world, (self.outer_entity_id, input_resource_type)
                );
                let mut input_production: Production = get!(
                    world, (self.outer_entity_id, input_resource_type), Production
                );

                input_production
                    .increase_consumption_rate(ref input_resource, @tick, input_resource_amount);

                input_resource.save(world);
                set!(world, (input_production));

                count += 1;
            };

            // reset the time that materials used for production will finish
            let first_input_finish_tick = ProductionInputImpl::first_input_finish_tick(
                @resource_production, world
            );
            resource_production
                .set_input_finish_tick(ref produced_resource, @tick, first_input_finish_tick);
            produced_resource.save(world);

            set!(world, (resource_production));
        }

        if self.is_adjacent_building_booster() {
            // give out bonuses to surrounding buildings if this building is a bonus supplier
            self.update_bonuses_supplied(world, delete: false);
        }

        set!(world, (self));
    }


    fn stop_production(ref self: Building, world: IWorldDispatcher) {
        if self.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource = ResourceImpl::get(
                world, (self.outer_entity_id, produced_resource_type)
            );

            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );

            // remove this building's contribution from global production rate
            resource_production
                .decrease_production_rate(
                    ref produced_resource, @tick, self.production_amount(world)
                );

            // decrease production building count by 1
            resource_production.decrease_building_count();

            // stop receiving bonuses from surrounding buildings that give bonuses
            self
                .update_bonuses_received(
                    ref resource_production, ref produced_resource, world, delete: true
                );

            // stop payment for production by decreasing input resources consumption rates
            let production_config: ProductionConfig = get!(
                world, produced_resource_type, ProductionConfig
            );
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
                let mut input_resource: Resource = ResourceImpl::get(
                    world, (self.outer_entity_id, input_resource_type)
                );
                let mut input_production: Production = get!(
                    world, (self.outer_entity_id, input_resource_type), Production
                );

                input_production
                    .decrease_consumption_rate(ref input_resource, @tick, input_resource_amount);

                count += 1;
                input_resource.save(world);
                set!(world, (input_production));
            };

            // reset the time that materials used for production will finish
            let first_input_finish_tick = ProductionInputImpl::first_input_finish_tick(
                @resource_production, world
            );
            resource_production
                .set_input_finish_tick(ref produced_resource, @tick, first_input_finish_tick);
            produced_resource.save(world);
            set!(world, (resource_production));
        }

        if self.is_adjacent_building_booster() {
            // take back bonuses given to surrounding buildings if this building is a bonus supplier
            self.update_bonuses_supplied(world, delete: true);
        }

        set!(world, (self));
    }

    fn production_amount(self: @Building, world: IWorldDispatcher) -> u128 {
        if (*self).is_active() == false {
            return 0;
        }

        let produced_resource_type = (*self).produced_resource();
        let production_config: ProductionConfig = get!(
            world, produced_resource_type, ProductionConfig
        );

        let bonus_amount: u128 = (production_config.amount * *self.bonus_percent)
            / BonusPercentageImpl::_100();

        production_config.amount + bonus_amount
    }


    fn update_bonuses_received(
        ref self: Building,
        ref resource_production: Production,
        ref produced_resource: Resource,
        world: IWorldDispatcher,
        delete: bool
    ) {
        // get bonuses from all buildings surronding this building if the offer boosts
        let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

        let produced_resource_type = self.produced_resource();
        let mut produced_resource = get!(
            world, (self.outer_entity_id, produced_resource_type), Resource
        );
        let mut resource_production: Production = get!(
            world, (self.outer_entity_id, produced_resource_type), Production
        );
        let tick_config: TickConfig = TickImpl::get(world);

        if delete {
            // remove this building's contribution from global resource production
            let building_production_amount: u128 = self.production_amount(world);
            resource_production
                .decrease_production_rate(
                    ref produced_resource, @tick_config, building_production_amount
                );

            // clear building bonus
            self.bonus_percent = 0;
        } else {
            let mut bonus_percent = self
                .get_bonus_from(building_coord.neighbor(Direction::East), world);
            bonus_percent += self
                .get_bonus_from(building_coord.neighbor(Direction::NorthEast), world);
            bonus_percent += self
                .get_bonus_from(building_coord.neighbor(Direction::NorthWest), world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::West), world);
            bonus_percent += self
                .get_bonus_from(building_coord.neighbor(Direction::SouthWest), world);
            bonus_percent += self
                .get_bonus_from(building_coord.neighbor(Direction::SouthEast), world);

            // set new bonus percent
            self.bonus_percent = bonus_percent;

            // add this building's contribution to global resource production
            let building_production_amount: u128 = self.production_amount(world);
            resource_production
                .increase_production_rate(
                    ref produced_resource, @tick_config, building_production_amount
                );
        }
    }


    fn update_bonuses_supplied(self: @Building, world: IWorldDispatcher, delete: bool) {
        let self = *self;

        if self.is_adjacent_building_booster() {
            let self_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

            self.update_bonus_supplied_to(self_coord.neighbor(Direction::East), world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::NorthEast), world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::NorthWest), world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::West), world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::SouthWest), world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::SouthEast), world, delete);
        }
    }


    fn get_bonus_from(
        ref self: Building, giver_inner_coord: Coord, world: IWorldDispatcher
    ) -> u128 {
        get!(
            world,
            (self.outer_col, self.outer_row, giver_inner_coord.x, giver_inner_coord.y),
            Building
        )
            .boost_adjacent_building_production_by()
    }


    fn update_bonus_supplied_to(
        self: Building, receiver_inner_coord: Coord, world: IWorldDispatcher, delete: bool
    ) {
        let mut bonus_receiver_building: Building = get!(
            world,
            (self.outer_col, self.outer_row, receiver_inner_coord.x, receiver_inner_coord.y),
            Building
        );
        if bonus_receiver_building.is_active() && bonus_receiver_building.is_resource_producer() {
            let bonus_receiver_produced_resource_type = bonus_receiver_building.produced_resource();
            let mut bonus_receiver_produced_resource = get!(
                world, (self.outer_entity_id, bonus_receiver_produced_resource_type), Resource
            );
            let mut bonus_receiver_resource_production: Production = get!(
                world, (self.outer_entity_id, bonus_receiver_produced_resource_type), Production
            );
            let tick_config: TickConfig = TickImpl::get(world);

            // remove old building's contribution to global resource production
            let bonus_receiver_old_production_amount: u128 = bonus_receiver_building
                .production_amount(world);
            bonus_receiver_resource_production
                .decrease_production_rate(
                    ref bonus_receiver_produced_resource,
                    @tick_config,
                    bonus_receiver_old_production_amount
                );

            if delete {
                bonus_receiver_building
                    .bonus_percent -= self
                    .boost_adjacent_building_production_by();
            } else {
                bonus_receiver_building
                    .bonus_percent += self
                    .boost_adjacent_building_production_by();
            }
            set!(world, (bonus_receiver_building));

            // update building's contribution to global resource production
            let bonus_receiver_new_production_amount: u128 = bonus_receiver_building
                .production_amount(world);
            bonus_receiver_resource_production
                .increase_production_rate(
                    ref bonus_receiver_produced_resource,
                    @tick_config,
                    bonus_receiver_new_production_amount
                );
            bonus_receiver_produced_resource.save(world);
            set!(world, (bonus_receiver_resource_production));
        }
    }
}

#[generate_trait]
impl BuildingImpl of BuildingTrait {
    fn center() -> Coord {
        Coord { x: 4, y: 4 }
    }

    fn create(
        world: IWorldDispatcher,
        outer_entity_id: u128,
        category: BuildingCategory,
        produce_resource_type: Option<u8>,
        inner_coord: Coord
    ) -> Building {
        get!(world, outer_entity_id, Owner).assert_caller_owner();

        // check that the entity has a position
        let outer_entity_position = get!(world, outer_entity_id, Position);
        outer_entity_position.assert_not_zero();

        // todo@credence: ensure that the bounds are within the inner realm bounds

        // ensure that building is not occupied
        let mut building: Building = get!(
            world,
            (outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y),
            Building
        );

        assert!(!building.is_active(), "space is occupied");

        // set building 
        building.entity_id = world.uuid().into();
        building.category = category;
        building.outer_entity_id = outer_entity_id;
        match produce_resource_type {
            Option::Some(resource_type) => {
                assert!(
                    building.category == BuildingCategory::Resource,
                    "resource type should not be specified"
                );
                building.produced_resource_type = resource_type;
            },
            Option::None => {
                assert!(
                    building.category != BuildingCategory::Resource,
                    "resource type must be specified"
                );
                building.produced_resource_type = building.produced_resource();
            }
        }

        set!(world, (building));

        // make payment for building
        BuildingImpl::make_payment(
            world, building.outer_entity_id, building.category, building.produced_resource_type
        );

        // start production related to building
        building.start_production(world);

        // increase building type count for realm

        let mut building_quantity: BuildingQuantityv2 = get!(
            world, (outer_entity_id, building.category), BuildingQuantityv2
        );
        building_quantity.value += 1;
        set!(world, (building_quantity));

        let mut population = get!(world, outer_entity_id, Population);
        let population_config = PopulationConfigTrait::get(world, building.category);

        // [check] If Workers hut

        // [check] Population
        population.assert_within_capacity();

        // increase population
        population.increase_population(population_config.population);

        // increase capacity
        // Only worker huts do this right now.
        population.increase_capacity(population_config.capacity);

        // set population
        set!(world, (population));

        building
    }


    fn destroy(
        world: IWorldDispatcher, outer_entity_id: u128, inner_coord: Coord
    ) -> BuildingCategory {
        get!(world, outer_entity_id, Owner).assert_caller_owner();

        // check that the outer entity has a position
        let outer_entity_position = get!(world, outer_entity_id, Position);
        outer_entity_position.assert_not_zero();

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

        // decrease building type count for realm
        let mut building_quantity: BuildingQuantityv2 = get!(
            world, (outer_entity_id, building.category), BuildingQuantityv2
        );
        building_quantity.value -= 1;
        set!(world, (building_quantity));

        // remove building 
        building.entity_id = 0;
        building.category = BuildingCategory::None;
        building.outer_entity_id = 0;

        set!(world, (building));

        // decrease population
        let mut population = get!(world, outer_entity_id, Population);
        let population_config = PopulationConfigTrait::get(world, building.category);

        // [check] If Workers hut
        // You cannot delete a workers hut unless you have capacity
        // Otherwise there is an exploit where you can delete a workers hut and increase capacity
        if (building.category == BuildingCategory::WorkersHut) {
            population.decrease_capacity(population_config.capacity);
            population.assert_within_capacity();
        }

        // decrease population
        population.decrease_population(population_config.population);

        // set population
        set!(world, (population));

        building.category
    }

    fn make_payment(
        world: IWorldDispatcher, entity_id: u128, category: BuildingCategory, resource_type: u8
    ) {
        let building_config: BuildingConfig = BuildingConfigImpl::get(
            world, category, resource_type
        );
        let mut index = 0;
        loop {
            if index == building_config.resource_cost_count {
                break;
            }

            let resource_cost: ResourceCost = get!(
                world, (building_config.resource_cost_id, index), ResourceCost
            );
            let mut resource = ResourceImpl::get(world, (entity_id, resource_cost.resource_type));
            resource.burn(resource_cost.amount);
            resource.save(world);
            index += 1;
        };
    }

    fn is_active(self: Building) -> bool {
        self.entity_id != 0
    }
}
