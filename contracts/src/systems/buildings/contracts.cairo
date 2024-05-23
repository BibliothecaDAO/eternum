#[dojo::interface]
trait IBuildingContract<TContractState> {
    fn create(
        entity_id: u128,
        building_coord: eternum::models::position::Coord,
        building_category: eternum::models::buildings::BuildingCategory,
        produce_resource_type: Option<u8>
    );
    fn destroy(entity_id: u128, building_coord: eternum::models::position::Coord);
}

#[dojo::contract]
mod building_systems {
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::Owner, order::Orders,
        position::{Coord, Position, PositionTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingImpl},
        production::{Production, ProductionRateTrait}, realm::{Realm, RealmImpl}
    };

    #[abi(embed_v0)]
    impl BuildingContractImpl of super::IBuildingContract<ContractState> {
        fn create(
            world: IWorldDispatcher,
            entity_id: u128,
            building_coord: Coord,
            building_category: BuildingCategory,
            produce_resource_type: Option<u8>,
        ) {
            let realm: Realm = get!(world, entity_id, Realm);
            assert!(realm.realm_id != 0, "entity is not a realm");
            if produce_resource_type.is_some() {
                let resource_type: u8 = produce_resource_type.unwrap();
                let realm_produces_resource = realm.has_resource(resource_type);
                assert!(realm_produces_resource, "realm does not produce specified resource");
            }

            // todo: check that entity is a realm
            let building: Building = BuildingImpl::create(
                world, entity_id, building_category, produce_resource_type, building_coord
            );

            // make payment for building
            BuildingImpl::make_payment(
                world, building.outer_entity_id, building.category, building.produced_resource_type
            );
        }

        fn destroy(world: IWorldDispatcher, entity_id: u128, building_coord: Coord) {
            BuildingImpl::destroy(world, entity_id, building_coord);
        }
    }
}
