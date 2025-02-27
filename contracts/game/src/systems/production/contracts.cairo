use s1_eternum::alias::ID;
use s1_eternum::models::position::{Coord, Direction};
use s1_eternum::models::resource::production::building::BuildingCategory;
use s1_eternum::models::resource::production::production::{ProductionStrategyImpl};

#[starknet::interface]
trait IProductionContract<TContractState> {
    /// Create and Destroy Buildings
    fn create_building(
        ref self: TContractState,
        structure_id: ID,
        directions: Span<Direction>,
        building_category: BuildingCategory,
        requested_resource_type: Option<u8>,
    );
    fn destroy_building(ref self: TContractState, structure_id: ID, building_coord: Coord);

    /// Pause and Resume Building Production
    fn pause_building_production(ref self: TContractState, structure_id: ID, building_coord: Coord);
    fn resume_building_production(ref self: TContractState, structure_id: ID, building_coord: Coord);

    fn burn_other_resources_for_labor_production(
        ref self: TContractState, structure_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
    );

    fn burn_labor_resources_for_other_production(
        ref self: TContractState, from_structure_id: ID, labor_amounts: Span<u128>, produced_resource_types: Span<u8>,
    );

    fn burn_other_predefined_resources_for_resources(
        ref self: TContractState,
        from_structure_id: ID,
        produced_resource_types: Span<u8>,
        production_tick_counts: Span<u128>,
    );
}

#[dojo::contract]
mod production_systems {
    use dojo::world::WorldStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureResourcesImpl, StructureResourcesPackedStoreImpl,
    };
    use s1_eternum::models::{
        owner::{OwnerAddressTrait}, position::{Coord, CoordTrait},
        resource::production::building::{BuildingCategory, BuildingImpl},
        resource::production::production::{ProductionStrategyImpl},
    };
    use starknet::ContractAddress;


    #[abi(embed_v0)]
    impl ProductionContractImpl of super::IProductionContract<ContractState> {
        fn create_building(
            ref self: ContractState,
            structure_id: ID,
            mut directions: Span<s1_eternum::models::position::Direction>,
            building_category: BuildingCategory,
            requested_resource_type: Option<u8>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // ensure season is not over
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // ensure structure is either a structure or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "Only structures and villages may create buildings",
            );

            // ensure buildings can't be made outside
            // the range of what the structure level allows
            let directions_count = directions.len();
            assert!(directions_count > 0, "building cant be made at the center");
            assert!(directions_count <= structure_base.max_level(world).into() + 1, "building outside of max bound");
            assert!(
                directions_count <= structure_base.level.into() + 1, "building outside of what structure level allows",
            );

            // ensure that the structure produces the resource
            if requested_resource_type.is_some() {
                let structure_resources_packed: u128 = StructureResourcesPackedStoreImpl::retrieve(
                    ref world, structure_id,
                );
                assert!(
                    StructureResourcesImpl::produces_resource(
                        structure_resources_packed, requested_resource_type.unwrap(),
                    ),
                    "structure does not produce specified resource",
                );
            }

            let mut building_coord: Coord = BuildingImpl::center();
            loop {
                match directions.pop_front() {
                    Option::Some(direction) => { building_coord = building_coord.neighbor(*direction); },
                    Option::None => { break; },
                }
            };

            let (building, building_count) = BuildingImpl::create(
                ref world,
                structure_id,
                structure_base.coord(),
                building_category,
                requested_resource_type,
                building_coord,
            );

            // pay one time cost of the building
            building.make_payment(building_count, ref world);
        }


        fn destroy_building(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            BuildingImpl::destroy(ref world, structure_id, structure_base.coord(), building_coord);
        }

        fn pause_building_production(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            BuildingImpl::pause_production(ref world, structure_base.coord(), building_coord);
        }

        fn resume_building_production(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            BuildingImpl::resume_production(ref world, structure_base.coord(), building_coord);
        }

        /// Burn other resource for production of labor
        fn burn_other_resources_for_labor_production(
            ref self: ContractState, structure_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            assert!(
                resource_types.len() == resource_amounts.len(),
                "resource types and resource amounts must be the same length",
            );

            for i in 0..resource_types.len() {
                ProductionStrategyImpl::burn_other_resource_for_labor_production(
                    ref world, structure_id, *resource_types.at(i), *resource_amounts.at(i),
                );
            }
        }

        // Burn production labor resource and add to production
        fn burn_labor_resources_for_other_production(
            ref self: ContractState,
            from_structure_id: ID,
            labor_amounts: Span<u128>,
            produced_resource_types: Span<u8>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            structure_owner.assert_caller_owner();

            assert!(
                labor_amounts.len() == produced_resource_types.len(),
                "labor and produced resource types must be the same length",
            );

            for i in 0..labor_amounts.len() {
                ProductionStrategyImpl::burn_labor_resource_for_other_production(
                    ref world, from_structure_id, *labor_amounts.at(i), *produced_resource_types.at(i),
                );
            }
        }


        // Burn other predefined resources for resource
        // e.g. Wood, Stone, Coal for Gold
        fn burn_other_predefined_resources_for_resources(
            ref self: ContractState,
            from_structure_id: ID,
            produced_resource_types: Span<u8>,
            production_tick_counts: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure structure is a realm or village
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure caller owns the structure
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            structure_owner.assert_caller_owner();

            assert!(
                produced_resource_types.len() == production_tick_counts.len(),
                "produced resource types and production tick counts must be the same length",
            );

            for i in 0..produced_resource_types.len() {
                ProductionStrategyImpl::burn_other_predefined_resources_for_resource(
                    ref world, from_structure_id, *produced_resource_types.at(i), *production_tick_counts.at(i),
                );
            }
        }
    }
}
