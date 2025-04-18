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
        use_simple: bool,
    );
    fn destroy_building(ref self: TContractState, structure_id: ID, building_coord: Coord);

    /// Pause and Resume Building Production
    fn pause_building_production(ref self: TContractState, structure_id: ID, building_coord: Coord);
    fn resume_building_production(ref self: TContractState, structure_id: ID, building_coord: Coord);

    fn burn_resource_for_labor_production(
        ref self: TContractState, structure_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
    );

    fn burn_labor_for_resource_production(
        ref self: TContractState,
        from_structure_id: ID,
        production_cycles: Span<u128>,
        produced_resource_types: Span<u8>,
    );

    fn burn_resource_for_resource_production(
        ref self: TContractState,
        from_structure_id: ID,
        produced_resource_types: Span<u8>,
        production_cycles: Span<u128>,
    );
}

#[dojo::contract]
mod production_systems {
    use dojo::world::WorldStorage;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{SeasonConfigImpl};
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureResourcesImpl, StructureResourcesPackedStoreImpl,
    };
    use s1_eternum::models::{
        owner::{OwnerAddressTrait}, position::{Coord, CoordTrait},
        resource::production::building::{BuildingCategory, BuildingImpl, BuildingProductionImpl},
        resource::production::production::{ProductionStrategyImpl},
    };

    use starknet::ContractAddress;
    use super::super::super::super::models::resource::production::building::BuildingProductionTrait;

    #[abi(embed_v0)]
    impl ProductionContractImpl of super::IProductionContract<ContractState> {
        fn create_building(
            ref self: ContractState,
            structure_id: ID,
            mut directions: Span<s1_eternum::models::position::Direction>,
            building_category: BuildingCategory,
            use_simple: bool,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // ensure season is not over
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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
                structure_base.category,
                structure_base.coord(),
                building_category,
                building_coord,
            );

            // ensure that the structure produces the resource
            if !building.allowed_for_all_realms_and_villages() {
                let building_produces_resource: u8 = building.produced_resource();
                let structure_resources_packed: u128 = StructureResourcesPackedStoreImpl::retrieve(
                    ref world, structure_id,
                );
                assert!(
                    StructureResourcesImpl::produces_resource(structure_resources_packed, building_produces_resource),
                    "You can't erect the requested building on this structure",
                );
            }

            // pay one time cost of the building
            building.make_payment(building_count, ref world, use_simple);
        }


        fn destroy_building(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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

            BuildingImpl::destroy(
                ref world, structure_id, structure_base.category, structure_base.coord(), building_coord,
            );
        }

        fn pause_building_production(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_main_game_started_and_grace_period_not_elapsed();

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

            BuildingImpl::pause_production(ref world, structure_base.category, structure_base.coord(), building_coord);
        }

        fn resume_building_production(ref self: ContractState, structure_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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

            BuildingImpl::resume_production(ref world, structure_base.category, structure_base.coord(), building_coord);
        }

        /// Burn other resource for production of labor
        fn burn_resource_for_labor_production(
            ref self: ContractState, structure_id: ID, resource_types: Span<u8>, resource_amounts: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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
                ProductionStrategyImpl::burn_resource_for_labor_production(
                    ref world, structure_id, *resource_types.at(i), *resource_amounts.at(i),
                );
            }
        }

        // Burn production labor resource and add to production
        fn burn_labor_for_resource_production(
            ref self: ContractState,
            from_structure_id: ID,
            production_cycles: Span<u128>,
            produced_resource_types: Span<u8>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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
                production_cycles.len() == produced_resource_types.len(),
                "labor and produced resource types must be the same length",
            );

            for i in 0..production_cycles.len() {
                ProductionStrategyImpl::burn_labor_for_resource_production(
                    ref world, from_structure_id, *production_cycles.at(i), *produced_resource_types.at(i),
                );
            }
        }


        // Burn other predefined resources for resource
        // e.g. Wood, Stone, Coal for Gold
        fn burn_resource_for_resource_production(
            ref self: ContractState,
            from_structure_id: ID,
            produced_resource_types: Span<u8>,
            production_cycles: Span<u128>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

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
                produced_resource_types.len() == production_cycles.len(),
                "produced resource types and production tick cycles must be the same length",
            );

            for i in 0..produced_resource_types.len() {
                ProductionStrategyImpl::burn_resource_for_resource_production(
                    ref world, from_structure_id, *produced_resource_types.at(i), *production_cycles.at(i),
                );
            }
        }
    }
}
