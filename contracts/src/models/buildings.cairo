use eternum::models::position::CoordTrait;
use core::zeroable::Zeroable;
use eternum::models::production::{
    Production, ProductionRateTrait, ProductionConfig,
    ProductionBonusPercentageImpl
};
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::owner::Owner;
use eternum::models::owner::EntityOwner;
use eternum::constants::ResourceTypes;
use eternum::models::position::{Coord, Position, Direction};
use core::poseidon::poseidon_hash_span as hash;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};

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

#[derive(PartialEq, Copy, Drop, Serde, PrintTrait, Introspect)]
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
    fn is_resource_producer(self: BuildingCategory) -> bool {
        let produced_resource = self.produced_resource();
        return produced_resource.is_non_zero();
    }
    
    fn is_production_multiplier(self: BuildingCategory) -> bool {
        let multiplier = self.production_multiplier();
        return multiplier.is_non_zero();
    }

    fn produced_resource(self: BuildingCategory) -> u8 {
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

    fn production_multiplier(self: BuildingCategory) -> u128 {
        match self {
            BuildingCategory::None => 0,
            BuildingCategory::Castle => 0,
            BuildingCategory::Resource(_type) => 0,
            BuildingCategory::Farm => ProductionBonusPercentageImpl::_10(), // 10%
            BuildingCategory::FishingVillage => 0,
            BuildingCategory::Barracks => 0,
            BuildingCategory::Market => 0,
            BuildingCategory::ArcheryRange => 0,
            BuildingCategory::Stable => 0,
        }
    }
}

#[generate_trait]
impl BuildingImpl of BuildingTrait {



    fn create(
        world: IWorldDispatcher,
        outer_entity_id: u128,
        category: BuildingCategory,
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
        let mut building : Building
            = get!(world, 
                (outer_entity_position.x, outer_entity_position.y, inner_coord.x, inner_coord.y), Building);
        
        assert!(!building.is_occupied(), "building is occupied");
        
        // set building 
        building.entity_id = world.uuid().into();
        building.category = category;
        building.outer_entity_id = outer_entity_id;

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





    fn start_production(ref self: Building, world: IWorldDispatcher ) {

        if self.category.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.category.produced_resource();
            let mut produced_resource: Resource 
                = get!(world, (self.outer_entity_id, produced_resource_type), Resource);

            // add resource production settings
            let production_config: ProductionConfig = get!(world, produced_resource_type, ProductionConfig);
            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production);
            resource_production.set_rate(production_config.amount_per_tick);
            resource_production.increase_building_count(ref produced_resource, @tick);


            // make payment for production

            // increase consumption rate of first material
            let mut material_one_production: Production = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_1), Production
            );
            let mut material_one_resource: Resource = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_1), Resource
            );
            material_one_production
                .increase_consumption_rate(
                    ref material_one_resource, @tick, production_config.cost_resource_type_1_amount);

            // increase consumption rate of second material
            let mut material_two_production: Production = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_2), Production
            );
            let mut material_two_resource: Resource = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_2), Resource
            );
            material_two_production
                .increase_consumption_rate(
                    ref material_two_resource, @tick, production_config.cost_resource_type_2_amount);


            // set the time that time that production stops because materials run out
            resource_production
                .set_materials_exhaustion_tick(
                    ref material_one_production, ref material_one_resource, @tick);

            resource_production
                .set_materials_exhaustion_tick(
                    ref material_two_production, ref material_two_resource, @tick);

            set!(world, (produced_resource));
            set!(world, (resource_production));
            set!(world, (material_one_production));
            set!(world, (material_two_production));
        }

        // receive bonuses from surrounding buildings that give bonuses
        self.update_bonuses_received(world, true);
        // give out bonuses to surrounding buildings if this building is a bonus supplier
        self.update_bonuses_supplied(world, true);

        set!(world, (building));

    }


    fn stop_production(ref self: Building, world: IWorldDispatcher ) {

        if self.category.is_resource_producer() {
            let tick = TickImpl::get(world);
            let produced_resource_type = self.category.produced_resource();
            let mut produced_resource: Resource 
                = get!(world, (self.outer_entity_id, produced_resource_type), Resource);

            // stop resource production
            let production_config: ProductionConfig = get!(world, produced_resource_type, ProductionConfig);
            let mut resource_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production);
            resource_production.decrease_building_count(ref produced_resource, @tick);

            // stop payment for production 

            // decrease consumption rate of first material
            let mut material_one_production: Production = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_1), Production
            );
            let mut material_one_resource: Resource = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_1), Resource
            );
            material_one_production
                .decrease_consumption_rate(
                    ref material_one_resource, @tick, production_config.cost_resource_type_1_amount);

            // decrease consumption rate of second material
            let mut material_two_production: Production = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_2), Production
            );
            let mut material_two_resource: Resource = get!(
                world, (self.outer_entity_id, production_config.cost_resource_type_2), Resource
            );
            material_two_production
                .decrease_consumption_rate(
                    ref material_two_resource, @tick, production_config.cost_resource_type_2_amount);

            
            // reset the time that time that production stops because materials run out
            resource_production
                .set_materials_exhaustion_tick(
                    ref material_one_production, ref material_one_resource, @tick); 
            resource_production
                .set_materials_exhaustion_tick(
                    ref material_two_production, ref material_two_resource, @tick);

            set!(world, (produced_resource));
            set!(world, (resource_production));
            set!(world, (material_one_production));
            set!(world, (material_two_production));
        }

        // stop receiving bonus from surrounding buildings
        self.update_bonuses_received(world, false);
        // stop giving out bonuses to surrounding buildings 
        // if this building is a bonus supplier
        self.update_bonuses_supplied(world, false);

        set!(world, (building));

    }


    

    fn update_bonuses_received(self: @Building, world: IWorldDispatcher, sign: bool) {
        // get bonuses from all buildings surronding this building if the offer boosts
        let building_coord: Coord = Coord { x: *self.inner_col, y: *self.inner_row };

        if self.category.is_resource_producer() {
            let produced_resource_type = self.category.produced_resource();
            let mut building_production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );

            self._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::East), world, sign);
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::NorthEast), world, sign);
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::NorthWest), world, sign);
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::West), world, sign);
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::SouthWest), world, sign);
            self
                ._update_bonus_received_from(
                    ref building_production, building_coord.neighbor(Direction::SouthEast), world, sign);
        }       
    }


    fn update_bonuses_supplied(self: Building, world: IWorldDispatcher, sign: bool) {
        // remove bonus from surrounding buildings if building is a boost multiplier
        // e.g if building is a farm
        if self.category.is_production_multiplier() {
            let building_coord: Coord = Coord { x: self.inner_col, y: self.inner_row };

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::East), world, sign);

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::NorthEast), world, sign);

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::NorthWest), world, sign);

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::West), world, sign);

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::SouthWest), world, sign);

            self._update_bonus_supplied_to(
                building_coord.neighbor(Direction::SouthEast), world, sign);
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
            production
                .increase_boost_percentage(building_at_coord.category.production_multiplier());
        } else {
            production
                .decrease_boost_percentage(building_at_coord.category.production_multiplier());
        }
    }

    fn _update_bonus_supplied_to(
        self: Building, inner_coord: Coord, world: IWorldDispatcher, sign: bool
    ) {
        let building_at_coord: Building = get!(
            world, (self.outer_col, self.outer_row, inner_coord.x, inner_coord.y), Building
        );
        if building_at_coord.category.is_resource_producer() {
            let produced_resource_type = self.category.produced_resource();
            let mut production: Production = get!(
                world, (self.outer_entity_id, produced_resource_type), Production
            );
            if sign {
                production.increase_boost_percentage(self.category.production_multiplier());
            } else {
                production.decrease_boost_percentage(self.category.production_multiplier());
            }

            set!(world, (production));
        }
    }

    fn is_occupied(self: Building) -> bool {
        self.entity_id != 0
    }

}
