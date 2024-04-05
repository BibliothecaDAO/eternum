#[dojo::contract]
mod building_systems {
    use eternum::alias::ID;
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::Owner, hyperstructure::HyperStructure,
        realm::Realm, order::Orders, position::{Coord, Position, PositionTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingCategoryTrait, BuildingImpl},
        production::{Production, ProductionRateTrait}
    };
    use eternum::systems::buildings::interface::IBuildingContract;

    #[abi(embed_v0)]
    impl BuildingContractImpl of IBuildingContract<ContractState> {
        fn create(
            self: @ContractState, world: IWorldDispatcher, entity_id: u128,
            building_coord: Coord, building_category: BuildingCategory,
        ) {
            // todo: check that entity is a realm
            BuildingImpl::create(world, entity_id, building_category, building_coord);
        }
        
        fn destroy(
            self: @ContractState, world: IWorldDispatcher, entity_id: u128, building_coord: Coord,
        ) {
            BuildingImpl::destroy(world, entity_id, building_coord);
        }
    }
}
