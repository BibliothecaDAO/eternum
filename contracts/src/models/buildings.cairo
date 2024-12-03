use core::poseidon::poseidon_hash_span;
use core::zeroable::Zeroable;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::alias::ID;
use s0_eternum::constants::{ResourceTypes, POPULATION_CONFIG_ID, WORLD_CONFIG_ID};
use s0_eternum::models::config::{
    TickConfig, TickImpl, TickTrait, ProductionConfig, BuildingConfig, BuildingConfigImpl,
    BuildingCategoryPopConfigTrait, PopulationConfig, BuildingGeneralConfig
};
use s0_eternum::models::owner::{EntityOwner, EntityOwnerTrait};
use s0_eternum::models::population::{Population, PopulationTrait};
use s0_eternum::models::position::{Coord, Position, Direction, PositionTrait, CoordTrait};
use s0_eternum::models::production::{
    Production, ProductionInput, ProductionRateTrait, ProductionInputImpl, ProductionInputTrait
};
use s0_eternum::models::realm::Realm;
use s0_eternum::models::resources::ResourceTrait;
use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use s0_eternum::utils::math::{PercentageImpl, PercentageValueImpl};

//todo we need to define border of innner hexes

#[derive(PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct Building {
    #[key]
    outer_col: u32,
    #[key]
    outer_row: u32,
    #[key]
    inner_col: u32,
    #[key]
    inner_row: u32,
    category: BuildingCategory,
    produced_resource_type: u8,
    bonus_percent: u32,
    entity_id: ID,
    outer_entity_id: ID,
    paused: bool,
}

#[derive(PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingQuantityv2 {
    #[key]
    entity_id: ID,
    #[key]
    category: BuildingCategory,
    value: u8
}


#[derive(PartialEq, Copy, Drop, Serde, Introspect)]
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
            BuildingCategory::TradingPost => 9,
            BuildingCategory::WorkersHut => 10,
            BuildingCategory::WatchTower => 11,
            BuildingCategory::Walls => 12,
            BuildingCategory::Storehouse => 13,
        }
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
            BuildingCategory::TradingPost => 0,
            BuildingCategory::WorkersHut => 0,
            BuildingCategory::WatchTower => 0,
            BuildingCategory::Walls => 0,
            BuildingCategory::Storehouse => 0,
        }
    }

    fn boost_adjacent_building_production_by(self: Building) -> u32 {
        match self.category {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource => 0,
            BuildingCategory::Farm => PercentageValueImpl::_10().try_into().unwrap(), // 10%
            BuildingCategory::FishingVillage => 0,
            BuildingCategory::Barracks => 0,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => 0,
            BuildingCategory::Stable => 0,
            BuildingCategory::TradingPost => 0,
            BuildingCategory::WorkersHut => 0,
            BuildingCategory::WatchTower => 0,
            BuildingCategory::Walls => 0,
            BuildingCategory::Storehouse => 0,
        }
    }


    fn start_production(ref self: Building, ref world: WorldStorage) {
        if self.is_resource_producer() {
            let tick = TickImpl::get_default_tick_config(ref world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource = ResourceImpl::get(
                ref world, (self.outer_entity_id, produced_resource_type)
            );

            let mut resource_production: Production = world.read_model((self.outer_entity_id, produced_resource_type));
            // increase production building count by 1
            resource_production.increase_building_count();

            // receive bonuses from surrounding buildings that give bonuses
            self.update_bonuses_received(ref resource_production, ref produced_resource, ref world, delete: false);

            // add this building's contribution to global production rate
            resource_production
                .increase_production_rate(ref produced_resource, @tick, self.production_amount(ref world));

            // make payment for production by increasing input resources consumption rates
            let production_config: ProductionConfig = world.read_model(produced_resource_type);
            let mut count = 0;
            loop {
                if count == production_config.input_count {
                    break;
                }

                let production_input: ProductionInput = world.read_model((produced_resource_type, count));
                let (input_resource_type, mut input_resource_amount) = (
                    production_input.input_resource_type, production_input.input_resource_amount
                );

                /// only 10% of lords cost will be consumed during production of donkey
                /// if the realm has a wonder
                if input_resource_type == ResourceTypes::LORDS {
                    if resource_production.resource_type == ResourceTypes::DONKEY {
                        let realm: Realm = world.read_model(self.outer_entity_id);
                        if realm.has_wonder {
                            input_resource_amount =
                                ((input_resource_amount.into() * PercentageValueImpl::_10())
                                    / PercentageValueImpl::_100())
                                .try_into()
                                .unwrap();
                        }
                    }
                }

                let mut input_resource: Resource = ResourceImpl::get(
                    ref world, (self.outer_entity_id, input_resource_type)
                );
                let mut input_production: Production = world.read_model((self.outer_entity_id, input_resource_type));

                input_production.increase_consumption_rate(ref input_resource, @tick, input_resource_amount);

                input_resource.save(ref world);
                world.write_model(@input_production);

                count += 1;
            };

            // reset the time that materials used for production will finish
            let first_input_finish_tick = ProductionInputImpl::first_input_finish_tick(@resource_production, ref world);
            resource_production.set__input_finish_tick(ref produced_resource, @tick, first_input_finish_tick);
            produced_resource.save(ref world);

            world.write_model(@resource_production);
        }

        if self.is_adjacent_building_booster() {
            // give out bonuses to surrounding buildings if this building is a bonus supplier
            self.update_bonuses_supplied(ref world, delete: false);
        }

        world.write_model(@self);
    }


    fn stop_production(ref self: Building, ref world: WorldStorage) {
        if self.is_resource_producer() {
            let tick = TickImpl::get_default_tick_config(ref world);
            let produced_resource_type = self.produced_resource();
            let mut produced_resource: Resource = ResourceImpl::get(
                ref world, (self.outer_entity_id, produced_resource_type)
            );

            let mut resource_production: Production = world.read_model((self.outer_entity_id, produced_resource_type));

            // remove this building's contribution from global production rate
            resource_production
                .decrease_production_rate(ref produced_resource, @tick, self.production_amount(ref world));

            // decrease production building count by 1
            resource_production.decrease_building_count();

            // stop receiving bonuses from surrounding buildings that give bonuses
            self.update_bonuses_received(ref resource_production, ref produced_resource, ref world, delete: true);

            // stop payment for production by decreasing input resources consumption rates
            let production_config: ProductionConfig = world.read_model(produced_resource_type);
            let mut count = 0;
            loop {
                if count == production_config.input_count {
                    break;
                }

                let production_input: ProductionInput = world.read_model((produced_resource_type, count));
                let (input_resource_type, mut input_resource_amount) = (
                    production_input.input_resource_type, production_input.input_resource_amount
                );

                /// only 10% of lords cost will be consumed during production of donkey
                /// if the realm has a wonder
                if input_resource_type == ResourceTypes::LORDS {
                    if resource_production.resource_type == ResourceTypes::DONKEY {
                        let realm: Realm = world.read_model(self.outer_entity_id);
                        if realm.has_wonder {
                            input_resource_amount =
                                ((input_resource_amount.into() * PercentageValueImpl::_10())
                                    / PercentageValueImpl::_100())
                                .try_into()
                                .unwrap();
                        }
                    }
                }

                let mut input_resource: Resource = ResourceImpl::get(
                    ref world, (self.outer_entity_id, input_resource_type)
                );
                let mut input_production: Production = world.read_model((self.outer_entity_id, input_resource_type));

                input_production.decrease_consumption_rate(ref input_resource, @tick, input_resource_amount);

                count += 1;
                input_resource.save(ref world);
                world.write_model(@input_production);
            };

            // reset the time that materials used for production will finish
            let first_input_finish_tick = ProductionInputImpl::first_input_finish_tick(@resource_production, ref world);
            resource_production.set__input_finish_tick(ref produced_resource, @tick, first_input_finish_tick);
            produced_resource.save(ref world);
            world.write_model(@resource_production);
        }

        if self.is_adjacent_building_booster() {
            // take back bonuses given to surrounding buildings if this building is a bonus supplier
            self.update_bonuses_supplied(ref world, delete: true);
        }
    }

    fn production_amount(self: @Building, ref world: WorldStorage) -> u128 {
        if (*self).exists() == false {
            return 0;
        }

        let produced_resource_type = (*self).produced_resource();
        let production_config: ProductionConfig = world.read_model(produced_resource_type);

        let bonus_amount: u128 = (production_config.amount * (*self.bonus_percent).into())
            / PercentageValueImpl::_100().into();

        production_config.amount + bonus_amount
    }


    fn update_bonuses_received(
        ref self: Building,
        ref resource_production: Production,
        ref produced_resource: Resource,
        ref world: WorldStorage,
        delete: bool
    ) {
        // get bonuses from all buildings surronding this building if the offer boosts
        let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

        let produced_resource_type = self.produced_resource();
        let mut produced_resource: Resource = world.read_model((self.outer_entity_id, produced_resource_type));
        let mut resource_production: Production = world.read_model((self.outer_entity_id, produced_resource_type));
        let tick_config: TickConfig = TickImpl::get_default_tick_config(ref world);

        if delete {
            // remove this building's contribution from global resource production
            let building_production_amount: u128 = self.production_amount(ref world);
            resource_production
                .decrease_production_rate(ref produced_resource, @tick_config, building_production_amount);

            // clear building bonus
            self.bonus_percent = 0;
        } else {
            let mut bonus_percent = self.get_bonus_from(building_coord.neighbor(Direction::East), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::NorthEast), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::NorthWest), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::West), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::SouthWest), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::SouthEast), ref world);

            // set new bonus percent
            self.bonus_percent = bonus_percent;

            // add this building's contribution to global resource production
            let building_production_amount: u128 = self.production_amount(ref world);
            resource_production
                .increase_production_rate(ref produced_resource, @tick_config, building_production_amount);
        }
    }


    fn update_bonuses_supplied(self: @Building, ref world: WorldStorage, delete: bool) {
        let self = *self;

        if self.is_adjacent_building_booster() {
            let self_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

            self.update_bonus_supplied_to(self_coord.neighbor(Direction::East), ref world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::NorthEast), ref world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::NorthWest), ref world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::West), ref world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::SouthWest), ref world, delete);
            self.update_bonus_supplied_to(self_coord.neighbor(Direction::SouthEast), ref world, delete);
        }
    }


    fn get_bonus_from(ref self: Building, giver_inner_coord: Coord, ref world: WorldStorage) -> u32 {
        // only get bonuses from buildings that are active (not paused)
        let bonus_giver_building: Building = world
            .read_model((self.outer_col, self.outer_row, giver_inner_coord.x, giver_inner_coord.y));
        if bonus_giver_building.paused {
            return 0;
        } else {
            return bonus_giver_building.boost_adjacent_building_production_by();
        }
    }


    fn update_bonus_supplied_to(self: Building, receiver_inner_coord: Coord, ref world: WorldStorage, delete: bool) {
        let mut bonus_receiver_building: Building = world
            .read_model((self.outer_col, self.outer_row, receiver_inner_coord.x, receiver_inner_coord.y));
        if bonus_receiver_building.exists()
            && !bonus_receiver_building.paused // only give bonus to active buildings
            && bonus_receiver_building.is_resource_producer() {
            let bonus_receiver_produced_resource_type = bonus_receiver_building.produced_resource();
            let mut bonus_receiver_produced_resource: Resource = world
                .read_model((self.outer_entity_id, bonus_receiver_produced_resource_type));
            let mut bonus_receiver_resource_production: Production = world
                .read_model((self.outer_entity_id, bonus_receiver_produced_resource_type));
            let tick_config: TickConfig = TickImpl::get_default_tick_config(ref world);

            // remove old building's contribution to global resource production
            let bonus_receiver_old_production_amount: u128 = bonus_receiver_building.production_amount(ref world);
            bonus_receiver_resource_production
                .decrease_production_rate(
                    ref bonus_receiver_produced_resource, @tick_config, bonus_receiver_old_production_amount
                );

            if delete {
                bonus_receiver_building.bonus_percent -= self.boost_adjacent_building_production_by();
            } else {
                bonus_receiver_building.bonus_percent += self.boost_adjacent_building_production_by();
            }
            world.write_model(@bonus_receiver_building);

            // update building's contribution to global resource production
            let bonus_receiver_new_production_amount: u128 = bonus_receiver_building.production_amount(ref world);
            bonus_receiver_resource_production
                .increase_production_rate(
                    ref bonus_receiver_produced_resource, @tick_config, bonus_receiver_new_production_amount
                );
            bonus_receiver_produced_resource.save(ref world);
            world.write_model(@bonus_receiver_resource_production);
        }
    }
}

#[generate_trait]
impl BuildingImpl of BuildingTrait {
    fn center() -> Coord {
        Coord { x: 10, y: 10 }
    }

    /// Create a new building on a structure
    ///
    fn create(
        ref world: WorldStorage,
        outer_entity_id: ID,
        category: BuildingCategory,
        produce_resource_type: Option<u8>,
        inner_coord: Coord,
    ) -> (Building, BuildingQuantityv2) {
        // check that the entity has a position
        let outer_entity_position: Position = world.read_model(outer_entity_id);
        outer_entity_position.assert_not_zero();

        // todo@credence: ensure that the bounds are within the inner realm bounds

        // ensure that building is not occupied
        let mut building: Building = world
            .read_model((outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y));

        assert!(!building.exists(), "space is occupied");

        // set building
        building.entity_id = world.dispatcher.uuid();
        building.category = category;
        building.outer_entity_id = outer_entity_id;
        match produce_resource_type {
            Option::Some(resource_type) => {
                assert!(building.category == BuildingCategory::Resource, "resource type should not be specified");
                building.produced_resource_type = resource_type;
            },
            Option::None => {
                assert!(building.category != BuildingCategory::Resource, "resource type must be specified");
                building.produced_resource_type = building.produced_resource();
            }
        }

        world.write_model(@building);

        // start production related to building
        building.start_production(ref world);

        // increase building type count for realm

        let mut building_quantity: BuildingQuantityv2 = world.read_model((outer_entity_id, building.category));
        building_quantity.value += 1;
        world.write_model(@building_quantity);

        let mut population: Population = world.read_model(outer_entity_id);
        let building_category_population_config = BuildingCategoryPopConfigTrait::get(ref world, building.category);
        let population_config: PopulationConfig = world.read_model(POPULATION_CONFIG_ID);

        // increase population
        population
            .increase_population(building_category_population_config.population, population_config.base_population);

        // increase capacity
        // Only worker huts do this right now.
        population.increase_capacity(building_category_population_config.capacity);

        // [check] Population
        population.assert_within_capacity(population_config.base_population);

        // set population
        world.write_model(@population);

        (building, building_quantity)
    }

    /// Pause building production without removing the building
    ///
    /// When you pause production, the building stops producing resources,
    /// stops consuming resources, stops giving bonuses to adjacent buildings,
    /// and stops receiving bonuses from adjacent buildings.
    ///
    fn pause_production(ref world: WorldStorage, outer_entity_id: ID, inner_coord: Coord) {
        let entity_owner: EntityOwner = world.read_model(outer_entity_id);
        entity_owner.assert_caller_owner(world);

        // check that the outer entity has a position
        let outer_entity_position: Position = world.read_model(outer_entity_id);
        outer_entity_position.assert_not_zero();

        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");
        assert!(building.paused == false, "building production is already paused");

        // stop building production
        building.stop_production(ref world);
        building.paused = true;
        world.write_model(@building);
    }

    /// Restart building production without removing the building
    ///
    /// When you restart production, the building resumes producing resources,
    /// resumes giving bonuses to adjacent buildings, and resumes consuming resources.
    ///
    fn resume_production(ref world: WorldStorage, outer_entity_id: ID, inner_coord: Coord) {
        let entity_owner: EntityOwner = world.read_model(outer_entity_id);
        entity_owner.assert_caller_owner(world);

        // check that the outer entity has a position
        let outer_entity_position: Position = world.read_model(outer_entity_id);
        outer_entity_position.assert_not_zero();

        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");

        assert!(building.exists(), "building is not active");
        assert!(building.paused, "building production is not paused");

        // restart building production
        building.start_production(ref world);
        building.paused = false;
        world.write_model(@building);
    }

    /// Destroy building and remove it from the structure
    ///
    fn destroy(ref world: WorldStorage, outer_entity_id: ID, inner_coord: Coord) -> BuildingCategory {
        let entity_owner: EntityOwner = world.read_model(outer_entity_id);
        entity_owner.assert_caller_owner(world);

        // check that the outer entity has a position
        let outer_entity_position: Position = world.read_model(outer_entity_id);
        outer_entity_position.assert_not_zero();

        // ensure that inner coordinate is occupied
        let mut building: Building = world
            .read_model((outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y));
        assert!(building.entity_id != 0, "building does not exist");

        // stop production related to building
        if !building.paused {
            building.stop_production(ref world);
        }

        // decrease building type count for realm
        let mut building_quantity: BuildingQuantityv2 = world.read_model((outer_entity_id, building.category));
        building_quantity.value -= 1;
        world.write_model(@building_quantity);

        // decrease population
        let mut population: Population = world.read_model(outer_entity_id);
        let building_category_population_config = BuildingCategoryPopConfigTrait::get(ref world, building.category);

        // [check] If Workers hut
        // You cannot delete a workers hut unless you have capacity
        // Otherwise there is an exploit where you can delete a workers hut and increase capacity
        if (building.category == BuildingCategory::WorkersHut) {
            let population_config: PopulationConfig = world.read_model(POPULATION_CONFIG_ID);
            population.decrease_capacity(building_category_population_config.capacity);
            population.assert_within_capacity(population_config.base_population);
        }

        // decrease population
        population.decrease_population(building_category_population_config.population);

        // set population
        world.write_model(@population);

        let destroyed_building_category = building.category;

        // remove building
        world.erase_model(@building);

        destroyed_building_category
    }

    fn make_payment(self: Building, building_quantity: BuildingQuantityv2, ref world: WorldStorage) {
        let building_general_config: BuildingGeneralConfig = world.read_model(WORLD_CONFIG_ID);
        let building_config: BuildingConfig = BuildingConfigImpl::get(
            ref world, self.category, self.produced_resource_type
        );
        let mut index = 0;
        loop {
            if index == building_config.resource_cost_count {
                break;
            }

            // calculate cost of building based on the formula:
            // Cost = Base + (Base * Rate * (N - 1)²)
            // Where:
            //  Base = The cost of the first building
            //  Rate = How quickly the cost goes up (a small number like 0.1 or 0.2)
            //  N = Which number building this is (1st, 2nd, 3rd, etc.)
            //
            let resource_cost: ResourceCost = world.read_model((building_config.resource_cost_id, index));
            let mut resource: Resource = ResourceImpl::get(
                ref world, (self.outer_entity_id, resource_cost.resource_type)
            );
            let percentage_additional_cost = PercentageImpl::get(
                resource_cost.amount, building_general_config.base_cost_percent_increase.into()
            );
            let scale_factor = building_quantity.value - 1;
            let total_cost = resource_cost.amount
                + (scale_factor.into() * scale_factor.into() * percentage_additional_cost);
            resource.burn(total_cost);
            resource.save(ref world);
            index += 1;
        };
    }

    fn exists(self: Building) -> bool {
        self.entity_id.is_non_zero()
    }
}
