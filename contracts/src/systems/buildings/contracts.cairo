#[dojo::interface]
trait IBuildingContract<TContractState> {
    fn create(
        ref world: IWorldDispatcher,
        entity_id: u128,
        building_coord: eternum::models::position::Coord,
        building_category: eternum::models::buildings::BuildingCategory,
        produce_resource_type: Option<u8>
    );
    fn destroy(
        ref world: IWorldDispatcher,
        entity_id: u128,
        building_coord: eternum::models::position::Coord
    );
}

#[dojo::contract]
mod building_systems {
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::{EntityOwner, EntityOwnerCustomTrait},
        order::Orders, position::{Coord, Position, PositionCustomTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingCustomImpl},
        production::{Production, ProductionRateTrait}, realm::{Realm, RealmCustomImpl}
    };

    #[abi(embed_v0)]
    impl BuildingContractImpl of super::IBuildingContract<ContractState> {
        fn create(
            ref world: IWorldDispatcher,
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

            get!(world, entity_id, EntityOwner).assert_caller_owner(world);

            // todo: check that entity is a realm
            let building: Building = BuildingCustomImpl::create(
                world, entity_id, building_category, produce_resource_type, building_coord
            );

            // make payment for building
            BuildingCustomImpl::make_payment(
                world, building.outer_entity_id, building.category, building.produced_resource_type
            );
        }

        fn destroy(ref world: IWorldDispatcher, entity_id: u128, building_coord: Coord) {
            BuildingCustomImpl::destroy(world, entity_id, building_coord);
        }
    }
}
