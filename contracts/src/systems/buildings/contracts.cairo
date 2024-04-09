#[dojo::contract]
mod building_systems {
    use eternum::alias::ID;
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::Owner, hyperstructure::HyperStructure,
        realm::Realm, order::Orders, position::{Coord, Position, PositionTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingImpl},
        production::{Production, ProductionRateTrait}
    };
    use eternum::systems::buildings::interface::IBuildingContract;

    #[abi(embed_v0)]
    impl BuildingContractImpl of IBuildingContract<ContractState> {
        fn create(
            world: IWorldDispatcher,
            entity_id: u128,
            building_coord: Coord,
            building_category: BuildingCategory,
            produce_resource_type: Option<u8>,
        ) {
            // todo: check that entity is a realm
            BuildingImpl::create(
                world, entity_id, building_category, produce_resource_type, building_coord
            );
        }

        fn destroy(world: IWorldDispatcher, entity_id: u128, building_coord: Coord) {
            BuildingImpl::destroy(world, entity_id, building_coord);
        }
    }
}
