use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord, Direction};
use s1_eternum::models::resource::production::building::BuildingCategory;
use s1_eternum::models::resource::production::production::{ProductionStrategyImpl};

#[starknet::interface]
trait IProductionContract<TContractState> {
    /// Create and Destroy Buildings
    fn create_building(
        ref self: TContractState,
        entity_id: ID,
        directions: Span<Direction>,
        building_category: BuildingCategory,
        produce_resource_type: Option<u8>,
    );
    fn destroy_building(ref self: TContractState, entity_id: ID, building_coord: Coord);

    /// Pause and Resume Building Production
    fn pause_building_production(ref self: TContractState, entity_id: ID, building_coord: Coord);
    fn resume_building_production(ref self: TContractState, entity_id: ID, building_coord: Coord);

    fn burn_other_resources_for_labor_production(
        ref self: TContractState, entity_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
    );

    fn burn_labor_resources_for_other_production(
        ref self: TContractState, from_entity_id: ID, labor_amounts: Span<u128>, produced_resource_types: Span<u8>,
    );

    fn burn_other_predefined_resources_for_resources(
        ref self: TContractState,
        from_entity_id: ID,
        produced_resource_types: Span<u8>,
        production_tick_counts: Span<u128>,
    );
}

#[dojo::contract]
mod production_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureCategory, StructureImpl, StructureTrait};
    use s1_eternum::models::{
        owner::{EntityOwner, EntityOwnerTrait}, position::{Coord, CoordTrait, Direction, Position, PositionTrait},
        realm::{Realm, RealmImpl, RealmResourcesTrait},
        resource::production::building::{Building, BuildingCategory, BuildingImpl},
        resource::production::production::{Production, ProductionStrategyImpl, ProductionTrait},
        resource::resource::{ResourceList},
    };

    #[abi(embed_v0)]
    impl ProductionContractImpl of super::IProductionContract<ContractState> {
        fn create_building(
            ref self: ContractState,
            entity_id: ID,
            mut directions: Span<s1_eternum::models::position::Direction>,
            building_category: BuildingCategory,
            produce_resource_type: Option<u8>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // ensure only realms can make buildings
            let realm: Realm = world.read_model(entity_id);
            assert!(realm.realm_id != 0, "entity is not a realm");

            // ensure caller owns the realm
            let entity_owner: EntityOwner = world.read_model(entity_id);
            entity_owner.assert_caller_owner(world);

            // ensure buildings can't be made outside
            // the range of what the realm level allows
            let directions_count = directions.len();
            assert!(directions_count > 0, "building cant be made at the center");
            assert!(directions_count <= realm.max_level(world).into() + 1, "building outside of max bound");
            assert!(directions_count <= realm.level.into() + 1, "building outside of what realm level allows");

            // ensure that the realm produces the resource
            if produce_resource_type.is_some() {
                let resource_type: u8 = produce_resource_type.unwrap();
                assert!(realm.produces_resource(resource_type), "realm does not produce specified resource");
            }

            // check if season is over
            SeasonImpl::assert_season_is_not_over(world);

            let mut building_coord: Coord = BuildingImpl::center();
            loop {
                match directions.pop_front() {
                    Option::Some(direction) => { building_coord = building_coord.neighbor(*direction); },
                    Option::None => { break; },
                }
            };

            // todo: check that entity is a realm
            let (building, building_quantity) = BuildingImpl::create(
                ref world, entity_id, building_category, produce_resource_type, building_coord,
            );

            // pay one time cost of the building
            building.make_payment(building_quantity, ref world);
        }


        fn destroy_building(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::destroy(ref world, entity_id, building_coord);
        }

        fn pause_building_production(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::pause_production(ref world, entity_id, building_coord);
        }

        fn resume_building_production(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::resume_production(ref world, entity_id, building_coord);
        }

        /// Burn other resource for production of labor
        fn burn_other_resources_for_labor_production(
            ref self: ContractState, entity_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let entity_owner: EntityOwner = world.read_model(entity_id);
            entity_owner.assert_caller_owner(world);

            // ensure entity is a structure
            let entity_structure: Structure = world.read_model(entity_id);
            assert!(entity_structure.category == StructureCategory::Realm, "structure is not a realm");

            assert!(
                resource_types.len() == resource_amounts.len(),
                "resource types and resource amounts must be the same length",
            );

            for i in 0..resource_types.len() {
                ProductionStrategyImpl::burn_other_resource_for_labor_production(
                    ref world, entity_id, *resource_types.at(i), *resource_amounts.at(i),
                );
            }
        }

        // Burn production labor resource and add to production
        fn burn_labor_resources_for_other_production(
            ref self: ContractState, from_entity_id: ID, labor_amounts: Span<u128>, produced_resource_types: Span<u8>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let entity_owner: EntityOwner = world.read_model(from_entity_id);
            entity_owner.assert_caller_owner(world);

            let entity_structure: Structure = world.read_model(from_entity_id);
            assert!(entity_structure.category == StructureCategory::Realm, "structure is not a realm");

            assert!(
                labor_amounts.len() == produced_resource_types.len(),
                "labor and produced resource types must be the same length",
            );

            for i in 0..labor_amounts.len() {
                ProductionStrategyImpl::burn_labor_resource_for_other_production(
                    ref world, from_entity_id, *labor_amounts.at(i), *produced_resource_types.at(i),
                );
            }
        }


        // Burn other predefined resources for resource
        // e.g. Wood, Stone, Coal for Gold
        fn burn_other_predefined_resources_for_resources(
            ref self: ContractState,
            from_entity_id: ID,
            produced_resource_types: Span<u8>,
            production_tick_counts: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let entity_owner: EntityOwner = world.read_model(from_entity_id);
            entity_owner.assert_caller_owner(world);

            let entity_structure: Structure = world.read_model(from_entity_id);
            assert!(entity_structure.category == StructureCategory::Realm, "structure is not a realm");

            assert!(
                produced_resource_types.len() == production_tick_counts.len(),
                "produced resource types and production tick counts must be the same length",
            );

            for i in 0..produced_resource_types.len() {
                ProductionStrategyImpl::burn_other_predefined_resources_for_resource(
                    ref world, from_entity_id, *produced_resource_types.at(i), *production_tick_counts.at(i),
                );
            }
        }
    }
}
