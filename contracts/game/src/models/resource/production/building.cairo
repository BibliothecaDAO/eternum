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
use s0_eternum::models::resource::production::production::{
    Production, ProductionTrait
};
use s0_eternum::models::realm::Realm;
use s0_eternum::models::resource::resource::ResourceTrait;
use s0_eternum::models::resource::resource::{Resource, ResourceImpl, ResourceCost};
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
    fn update_production(ref self: Building, ref world: WorldStorage, stop: bool) {
        // update produced resource balance before updating production
        let produced_resource_type = self.produced_resource();
        let mut produced_resource: Resource 
            = ResourceImpl::get(ref world, (self.outer_entity_id, produced_resource_type));
        produced_resource.save(ref world);


        let mut resource_production: Production 
            = world.read_model((self.outer_entity_id, produced_resource_type));

        match stop {
            true => {

                // ensure production amount is gotten BEFORE updating 
                // bonus received percent so production rate is decreased correctly
                let production_amount = self.production_amount(ref world);

                // update bonus received percent
                self.update_bonus_received_percent(ref world, delete: true);

                // decrease building count
                resource_production.decrease_building_count();

                // decrease production rate
                resource_production.decrease_production_rate(production_amount);

            },
            false => {

                // update bonus received percent
                self.update_bonus_received_percent(ref world, delete: false);

                // ensure production amount is gotten AFTER updating 
                // bonus received percent so production rate is increased correctly
                let production_amount = self.production_amount(ref world);
                assert!(production_amount.is_non_zero(), "resource cannot be produced");

                // increase building count
                resource_production.increase_building_count();

                // increase production rate
                resource_production.increase_production_rate(production_amount);
            }
        }
        // save production
        world.write_model(@resource_production);

        // todo add event here
    }


    fn start_production(ref self: Building, ref world: WorldStorage) {
        if self.is_resource_producer() {
            self.update_production(ref world, stop: false);
        }

        if self.is_adjacent_building_booster() {
            // give out bonuses to surrounding buildings
            self.update_bonuses_supplied(ref world, delete: false);
        }
        world.write_model(@self);
    }


    fn stop_production(ref self: Building, ref world: WorldStorage) {
        if self.is_resource_producer() {
            self.update_production(ref world, stop: true);
        }

        if self.is_adjacent_building_booster() {
            // remove bonuses it gave to surrounding buildings
            self.update_bonuses_supplied(ref world, delete: true);
        }
        world.write_model(@self);
    }

    fn production_amount(self: @Building, ref world: WorldStorage) -> u128 {
        if (*self).exists() == false {
            return 0;
        }

        let produced_resource_type = (*self).produced_resource();
        let production_config: ProductionConfig = world.read_model(produced_resource_type);
        let bonus_amount: u128 = (production_config.produced_amount * (*self.bonus_percent).into())
            / PercentageValueImpl::_100().into();

        production_config.produced_amount + bonus_amount
    }


    fn update_bonus_received_percent(
        ref self: Building,
        ref world: WorldStorage,
        delete: bool
    ) {
       
        if delete {
            // clear building bonus
            self.bonus_percent = 0;
        } else {

             // get bonuses from all buildings surronding this building if the offer boosts
            let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };
            let mut bonus_percent = self.get_bonus_from(building_coord.neighbor(Direction::East), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::NorthEast), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::NorthWest), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::West), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::SouthWest), ref world);
            bonus_percent += self.get_bonus_from(building_coord.neighbor(Direction::SouthEast), ref world);

            // set new bonus percent
            self.bonus_percent = bonus_percent;
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


    fn update_bonus_supplied_to(self: Building, receiver_inner_coord: Coord, ref world: WorldStorage, delete: bool) {
        let mut recipient_building: Building = world
            .read_model((self.outer_col, self.outer_row, receiver_inner_coord.x, receiver_inner_coord.y));
        if recipient_building.exists() // only when building exists at the location
            && !recipient_building.paused // only give bonus to active buildings
            && recipient_building.is_resource_producer() { // only give bonus to resource producers

            // get the resource that the building produces
            let recipient_produced_resource_type = recipient_building.produced_resource();
            let mut recipient_building_resource: Resource 
                = ResourceImpl::get(ref world, (self.outer_entity_id, recipient_produced_resource_type));
            
            // ensure harvest is done on the resource before we modify its production
            recipient_building_resource.save(ref world);

            // get production related to the building
            let mut recipient_production: Production = world
                .read_model((self.outer_entity_id, recipient_produced_resource_type));

            // remove the recipient building's contribution from global resource production
            // first so that we can recalculate and add the new production rate
            let recipient_production_amount: u128 = recipient_building.production_amount(ref world);
            recipient_production.decrease_production_rate(recipient_production_amount);

            // update the recipient building's bonus percent
            if delete {
                recipient_building.bonus_percent -= self.boost_adjacent_building_production_by();
            } else {
                recipient_building.bonus_percent += self.boost_adjacent_building_production_by();
            }
            world.write_model(@recipient_building);

            // get the building's new production amount
            let recipient_building_new_production_amount: u128 
                = recipient_building.production_amount(ref world);

            // update the global resource production to reflect the new production rate
            recipient_production
                .increase_production_rate(recipient_building_new_production_amount);
            world.write_model(@recipient_production);
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
