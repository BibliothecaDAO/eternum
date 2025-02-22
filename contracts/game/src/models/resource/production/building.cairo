use alexandria_math::U128BitShift;
use core::num::traits::zero::Zero;
use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcherTrait};

use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{
    BuildingCategoryPopConfigTrait, BuildingConfig, BuildingConfigImpl, BuildingGeneralConfig, CapacityConfig,
    PopulationConfig, ProductionConfig, TickImpl, WorldConfigUtilImpl,
};
use s1_eternum::models::owner::{OwnerAddressTrait};
use s1_eternum::models::position::{Coord, CoordTrait, Direction, Position, PositionTrait};
use s1_eternum::models::resource::production::production::{Production, ProductionTrait};
use s1_eternum::models::resource::resource::{ResourceList};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{StructureBase, StructureBaseStoreImpl, StructureImpl};
use s1_eternum::models::weight::{Weight, WeightImpl, WeightTrait};
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl};
//todo we need to define border of innner hexes

#[derive(PartialEq, Copy, Drop, Serde)]
#[dojo::model]
pub struct Building {
    #[key]
    pub outer_col: u32,
    #[key]
    pub outer_row: u32,
    #[key]
    pub inner_col: u32,
    #[key]
    pub inner_row: u32,
    pub category: BuildingCategory,
    pub produced_resource_type: u8,
    pub bonus_percent: u32,
    pub entity_id: ID,
    pub outer_entity_id: ID,
    pub paused: bool,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct StructureBuildings {
    #[key]
    pub entity_id: ID,
    pub building_count: u128,
    // population
    pub population: Population,
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
pub struct Population {
    pub current: u32,
    pub max: u32,
}

#[generate_trait]
pub impl PopulationImpl of PopulationTrait {
    fn increase_population(ref self: Population, amount: u32, base_population: u32) -> u32 {
        self.current += amount;
        self.assert_within_capacity(base_population);
        self.current
    }
    fn decrease_population(ref self: Population, amount: u32) -> u32 {
        if amount > self.current {
            self.current = 0;
        } else {
            self.current -= amount;
        }

        self.current
    }
    fn assert_within_capacity(ref self: Population, base_population: u32) {
        assert(self.max + base_population >= self.current, 'Population exceeds capacity')
    }
    fn increase_capacity(ref self: Population, amount: u32) -> u32 {
        self.max += amount;
        self.max
    }
    fn decrease_capacity(ref self: Population, amount: u32) -> u32 {
        self.max -= amount;

        // sanity
        if (self.max < 0) {
            self.max = 0;
        }
        self.max
    }
}


#[generate_trait]
pub impl BuildingCategoryCountImpl of BuildingCategoryCountTrait {
    fn building_count(self: BuildingCategory, packed: u128) -> u8 {
        let category_felt: felt252 = self.into();
        let category: u128 = category_felt.try_into().unwrap();

        // the packed value contains the counts of all categories
        // and can take up to 8 bits for each category. so we can store
        // up to 128 / 8 = 16 categories
        let mask: u128 = 0xFF; // al 8 bits set to 1
        let shift_amount = (category - 1) * 8;
        let count: u128 = U128BitShift::shr(packed, shift_amount) & mask;
        count.try_into().unwrap()
    }

    fn set_building_count(self: BuildingCategory, packed: u128, count: u8) -> u128 {
        assert!(count <= 255, "count must be able to fit in a u8");

        let category_felt: felt252 = self.into();
        let category: u128 = category_felt.try_into().unwrap();

        // Each category takes 8 bits
        let shift_amount = (category - 1) * 8;
        let mask: u128 = U128BitShift::shl(0xFF, shift_amount); // 8 bits set to 1, shifted to position
        let shifted_count: u128 = U128BitShift::shl(count.into(), shift_amount);
        let new_packed: u128 = (packed & ~mask) | shifted_count;
        new_packed
    }
}

#[derive(PartialEq, Copy, Drop, Serde, Introspect)]
pub enum BuildingCategory {
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

pub impl BuildingCategoryIntoFelt252 of Into<BuildingCategory, felt252> {
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
pub impl BuildingPerksImpl of BuildingPerksTrait {
    fn grant_capacity_bonus(self: Building, ref world: WorldStorage, add: bool) {
        if self._is_storage_capacity_booster() {
            self._boost_storage_capacity(ref world, add);
        }

        if self._is_explorer_capacity_booster() {
            self._boost_explorer_capacity(ref world, add);
        }
    }

    fn _is_storage_capacity_booster(self: Building) -> bool {
        match self.category {
            BuildingCategory::Storehouse => true,
            _ => false,
        }
    }

    fn _is_explorer_capacity_booster(self: Building) -> bool {
        match self.category {
            BuildingCategory::Barracks => true,
            BuildingCategory::Stable => true,
            BuildingCategory::ArcheryRange => true,
            _ => false,
        }
    }

    fn _boost_storage_capacity(self: Building, ref world: WorldStorage, add: bool) {
        let capacity_config: CapacityConfig = WorldConfigUtilImpl::get_member(world, selector!("capacity_config"));
        let capacity: u128 = capacity_config.storehouse_boost_capacity.into() * RESOURCE_PRECISION;
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);
        if add {
            structure_weight.add_capacity(capacity);
        } else {
            structure_weight.deduct_capacity(capacity);
        }
        structure_weight.store(ref world, self.outer_entity_id);
    }

    fn _boost_explorer_capacity(self: Building, ref world: WorldStorage, add: bool) {
        let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, self.outer_entity_id);
        if add {
            structure_base.troop_max_explorer_count += 1;
        } else {
            structure_base.troop_max_explorer_count -= 1;

            // ensure explorer count does not exceed troop capacity
            assert!(
                structure_base.troop_explorer_count <= structure_base.troop_max_explorer_count,
                "delete an explorer troop unit before removing this building",
            );
        }
        StructureBaseStoreImpl::store(ref structure_base, ref world, self.outer_entity_id);
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
            BuildingCategory::Castle => ResourceTypes::LABOR,
            BuildingCategory::Resource => self.produced_resource_type,
            BuildingCategory::Farm => ResourceTypes::WHEAT,
            BuildingCategory::FishingVillage => ResourceTypes::FISH,
            BuildingCategory::Barracks => ResourceTypes::KNIGHT_T2,
            BuildingCategory::Market => ResourceTypes::DONKEY,
            BuildingCategory::ArcheryRange => ResourceTypes::CROSSBOWMAN_T2,
            BuildingCategory::Stable => ResourceTypes::PALADIN_T2,
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
    fn update_production(ref self: Building, ref world: WorldStorage, ref structure_weight: Weight, stop: bool) {
        // update produced resource balance before updating production
        let produced_resource_type = self.produced_resource();
        let produced_resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, produced_resource_type);
        let mut produced_resource = SingleResourceStoreImpl::retrieve(
            ref world,
            self.outer_entity_id,
            produced_resource_type,
            ref structure_weight,
            produced_resource_weight_grams,
            true,
        );

        let mut production: Production = produced_resource.production;

        match stop {
            true => {
                // ensure production amount is gotten BEFORE updating
                // bonus received percent so production rate is decreased correctly
                let production_amount = self.production_amount(ref world);

                // update bonus received percent
                self.update_bonus_received_percent(ref world, delete: true);

                // decrease building count
                production.decrease_building_count();

                // decrease production rate
                production.decrease_production_rate(production_amount.try_into().unwrap());
            },
            false => {
                // update bonus received percent
                self.update_bonus_received_percent(ref world, delete: false);

                // ensure production amount is gotten AFTER updating
                // bonus received percent so production rate is increased correctly
                let production_amount = self.production_amount(ref world);
                assert!(production_amount.is_non_zero(), "resource cannot be produced");

                // increase building count
                production.increase_building_count();

                // increase production rate
                production.increase_production_rate(production_amount.try_into().unwrap());
            },
        }
        // save production
        produced_resource.production = production;
        produced_resource.store(ref world);
        // todo add event here
    }


    fn start_production(ref self: Building, ref world: WorldStorage) {
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);

        if self.is_resource_producer() {
            self.update_production(ref world, ref structure_weight, stop: false);
        }

        if self.is_adjacent_building_booster() {
            // give out bonuses to surrounding buildings
            self.update_bonuses_supplied(ref world, ref structure_weight, delete: false);
        }
        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);

        // update building
        world.write_model(@self);
    }


    fn stop_production(ref self: Building, ref world: WorldStorage) {
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);

        if self.is_resource_producer() {
            self.update_production(ref world, ref structure_weight, stop: true);
        }

        if self.is_adjacent_building_booster() {
            // remove bonuses it gave to surrounding buildings
            self.update_bonuses_supplied(ref world, ref structure_weight, delete: true);
        }
        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);

        // update building
        world.write_model(@self);
    }

    fn production_amount(self: @Building, ref world: WorldStorage) -> u128 {
        if (*self).exists() == false {
            return 0;
        }

        let produced_resource_type = (*self).produced_resource();
        let production_config: ProductionConfig = world.read_model(produced_resource_type);
        let bonus_amount: u128 = (production_config.amount_per_building_per_tick * (*self.bonus_percent).into())
            / PercentageValueImpl::_100().into();

        production_config.amount_per_building_per_tick + bonus_amount
    }


    fn update_bonus_received_percent(ref self: Building, ref world: WorldStorage, delete: bool) {
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


    fn update_bonuses_supplied(self: @Building, ref world: WorldStorage, ref structure_weight: Weight, delete: bool) {
        let self = *self;

        if self.is_adjacent_building_booster() {
            let self_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::East), ref structure_weight, ref world, delete,
                );
            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::NorthEast), ref structure_weight, ref world, delete,
                );
            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::NorthWest), ref structure_weight, ref world, delete,
                );
            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::West), ref structure_weight, ref world, delete,
                );
            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::SouthWest), ref structure_weight, ref world, delete,
                );
            self
                .update_bonus_supplied_to(
                    self_coord.neighbor(Direction::SouthEast), ref structure_weight, ref world, delete,
                );
        }
    }


    fn update_bonus_supplied_to(
        self: Building,
        receiver_inner_coord: Coord,
        ref structure_weight: Weight,
        ref world: WorldStorage,
        delete: bool,
    ) {
        let mut recipient_building: Building = world
            .read_model((self.outer_col, self.outer_row, receiver_inner_coord.x, receiver_inner_coord.y));
        if recipient_building.exists() // only when building exists at the location
            && !recipient_building.paused // only give bonus to active buildings
            && recipient_building.is_resource_producer() { // only give bonus to resource producers
            // get the resource that the building produces
            let recipient_produced_resource_type = recipient_building.produced_resource();
            let recipient_resource_weight_grams: u128 = ResourceWeightImpl::grams(
                ref world, recipient_produced_resource_type,
            );
            let mut recipient_building_resource = SingleResourceStoreImpl::retrieve(
                ref world,
                self.outer_entity_id,
                recipient_produced_resource_type,
                ref structure_weight,
                recipient_resource_weight_grams,
                true,
            );

            // remove the recipient building's contribution from global resource production
            // first so that we can recalculate and add the new production rate
            let recipient_building_resource_production_amount: u128 = recipient_building.production_amount(ref world);
            let mut recipient_building_resource_production: Production = recipient_building_resource.production;
            recipient_building_resource_production
                .decrease_production_rate(recipient_building_resource_production_amount.try_into().unwrap());

            // update the recipient building's bonus percent
            if delete {
                recipient_building.bonus_percent -= self.boost_adjacent_building_production_by();
            } else {
                recipient_building.bonus_percent += self.boost_adjacent_building_production_by();
            }
            world.write_model(@recipient_building);

            // update the global resource production to reflect the new production rate
            recipient_building_resource_production
                .increase_production_rate(recipient_building.production_amount(ref world).try_into().unwrap());
            recipient_building_resource.production = recipient_building_resource_production;
            recipient_building_resource.store(ref world);
        }
    }
}

#[generate_trait]
pub impl BuildingImpl of BuildingTrait {
    fn center() -> Coord {
        Coord { x: 10, y: 10 }
    }

    /// Create a new building on a structure
    ///
    fn create(
        ref world: WorldStorage,
        outer_entity_id: ID,
        outer_entity_coord: Coord,
        category: BuildingCategory,
        produce_resource_type: Option<u8>,
        inner_coord: Coord,
    ) -> (Building, u8) {
        // todo@credence: ensure that the bounds are within the inner realm bounds

        // ensure that building is not occupied
        let mut building: Building = world
            .read_model((outer_entity_coord.x, outer_entity_coord.y, inner_coord.x, inner_coord.y));

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
            },
        }

        world.write_model(@building);

        // start production related to building
        building.start_production(ref world);

        // give capacity bonus
        building.grant_capacity_bonus(ref world, true);

        // increase building type count for structure
        let structure_building_ptr = Model::<StructureBuildings>::ptr_from_keys(outer_entity_id);
        let mut all_categories_quantity_packed: u128 = world
            .read_member(structure_building_ptr, selector!("building_count"));
        let new_building_category_count: u8 = category.building_count(all_categories_quantity_packed) + 1;
        all_categories_quantity_packed = category
            .set_building_count(all_categories_quantity_packed, new_building_category_count);
        world.write_member(structure_building_ptr, selector!("building_count"), all_categories_quantity_packed);

        // increase population
        let mut population: Population = world
            .read_member(Model::<StructureBuildings>::ptr_from_keys(outer_entity_id), selector!("population"));
        let building_category_population_config = BuildingCategoryPopConfigTrait::get(ref world, building.category);
        let population_config: PopulationConfig = WorldConfigUtilImpl::get_member(
            world, selector!("population_config"),
        );

        // increase population
        population
            .increase_population(building_category_population_config.population, population_config.base_population);

        // increase capacity
        // Only worker huts do this right now.
        population.increase_capacity(building_category_population_config.capacity);

        // [check] Population
        population.assert_within_capacity(population_config.base_population);

        // set population
        world
            .write_member(
                Model::<StructureBuildings>::ptr_from_keys(outer_entity_id), selector!("population"), population,
            );

        // todo:  increase structure weight when certain buildings are built

        (building, new_building_category_count)
    }

    /// Pause building production without removing the building
    ///
    /// When you pause production, the building stops producing resources,
    /// stops consuming resources, stops giving bonuses to adjacent buildings,
    /// and stops receiving bonuses from adjacent buildings.
    ///
    fn pause_production(ref world: WorldStorage, outer_entity_id: ID, inner_coord: Coord) {
        let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, outer_entity_id);
        structure.owner.assert_caller_owner();

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
        let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, outer_entity_id);
        structure.owner.assert_caller_owner();

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
        let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, outer_entity_id);
        structure.owner.assert_caller_owner();

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

        // remove granted capacity bonus
        building.grant_capacity_bonus(ref world, false);

        // decrease building type count for realm
        let structure_building_ptr = Model::<StructureBuildings>::ptr_from_keys(outer_entity_id);
        let mut all_categories_quantity_packed: u128 = world
            .read_member(structure_building_ptr, selector!("building_count"));
        let new_building_category_count: u8 = building.category.building_count(all_categories_quantity_packed) - 1;
        all_categories_quantity_packed = building
            .category
            .set_building_count(all_categories_quantity_packed, new_building_category_count);
        world.write_member(structure_building_ptr, selector!("building_count"), all_categories_quantity_packed);

        // decrease population
        let mut population: Population = world
            .read_member(Model::<StructureBuildings>::ptr_from_keys(outer_entity_id), selector!("population"));
        let building_category_population_config = BuildingCategoryPopConfigTrait::get(ref world, building.category);

        // [check] If Workers hut
        // You cannot delete a workers hut unless you have capacity
        // Otherwise there is an exploit where you can delete a workers hut and increase capacity
        if (building.category == BuildingCategory::WorkersHut) {
            let population_config: PopulationConfig = WorldConfigUtilImpl::get_member(
                world, selector!("population_config"),
            );
            population.decrease_capacity(building_category_population_config.capacity);
            population.assert_within_capacity(population_config.base_population);
        }

        // decrease population
        population.decrease_population(building_category_population_config.population);

        // set population
        world
            .write_member(
                Model::<StructureBuildings>::ptr_from_keys(outer_entity_id), selector!("population"), population,
            );

        let destroyed_building_category = building.category;

        // remove building
        world.erase_model(@building);

        // todo: decrease structure weight when certain buildings are destroyed

        destroyed_building_category
    }

    fn make_payment(self: Building, building_count: u8, ref world: WorldStorage) {
        let building_general_config: BuildingGeneralConfig = WorldConfigUtilImpl::get_member(
            world, selector!("building_general_config"),
        );
        let building_config: BuildingConfig = BuildingConfigImpl::get(
            ref world, self.category, self.produced_resource_type,
        );
        let mut index = 0;

        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, self.outer_entity_id);
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
            let resource_cost: ResourceList = world.read_model((building_config.resource_cost_id, index));

            let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_cost.resource_type);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world,
                self.outer_entity_id,
                resource_cost.resource_type,
                ref structure_weight,
                resource_weight_grams,
                true,
            );

            let percentage_additional_cost = PercentageImpl::get(
                resource_cost.amount, building_general_config.base_cost_percent_increase.into(),
            );
            let scale_factor = building_count - 1;
            let total_cost = resource_cost.amount
                + (scale_factor.into() * scale_factor.into() * percentage_additional_cost);

            // spend resource
            resource.spend(total_cost, ref structure_weight, resource_weight_grams);

            // update resource
            resource.store(ref world);

            index += 1;
        };

        // update structure weight
        structure_weight.store(ref world, self.outer_entity_id);
    }

    fn exists(self: Building) -> bool {
        self.entity_id.is_non_zero()
    }
}
