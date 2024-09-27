use eternum::alias::ID;

#[dojo::interface]
trait IBuildingContract<TContractState> {
    fn create(
        ref world: IWorldDispatcher,
        entity_id: ID,
        directions: Span<eternum::models::position::Direction>,
        building_category: eternum::models::buildings::BuildingCategory,
        produce_resource_type: Option<u8>
    );
    fn pause_production(ref world: IWorldDispatcher, entity_id: ID, building_coord: eternum::models::position::Coord);
    fn resume_production(ref world: IWorldDispatcher, entity_id: ID, building_coord: eternum::models::position::Coord);
    fn destroy(ref world: IWorldDispatcher, entity_id: ID, building_coord: eternum::models::position::Coord);
}

#[dojo::contract]
mod building_systems {
    use eternum::alias::ID;
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::{EntityOwner, EntityOwnerCustomTrait}, order::Orders,
        position::{Coord, CoordTrait, Position, PositionCustomTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingCustomImpl}, production::{Production, ProductionRateTrait},
        realm::{Realm, RealmCustomImpl}
    };

    #[abi(embed_v0)]
    impl BuildingContractImpl of super::IBuildingContract<ContractState> {
        fn create(
            ref world: IWorldDispatcher,
            entity_id: ID,
            mut directions: Span<eternum::models::position::Direction>,
            building_category: BuildingCategory,
            produce_resource_type: Option<u8>,
        ) {
            // ensure only realms can make buildings
            let realm: Realm = get!(world, entity_id, Realm);
            assert!(realm.realm_id != 0, "entity is not a realm");

            // ensure caller owns the realm
            get!(world, entity_id, EntityOwner).assert_caller_owner(world);

            // ensure buildings can't be made outside
            // the range of what the realm level allows
            let directions_count = directions.len();
            assert!(directions_count > 0, "building cant be made at the center");
            assert!(directions_count <= realm.max_level().into() + 1, "building outside of max bound");
            assert!(directions_count <= realm.level.into() + 1, "building outside of what realm level allows");

            // ensure that the realm produces the resource
            if produce_resource_type.is_some() {
                let resource_type: u8 = produce_resource_type.unwrap();
                let realm_produces_resource = realm.has_resource(resource_type);
                assert!(realm_produces_resource, "realm does not produce specified resource");
            }

            // get the location of the building
            let mut building_coord: Coord = BuildingCustomImpl::center();
            loop {
                match directions.pop_front() {
                    Option::Some(direction) => { building_coord = building_coord.neighbor(*direction); },
                    Option::None => { break; }
                }
            };

            // create the building
            let building: Building = BuildingCustomImpl::create(
                world, entity_id, building_category, produce_resource_type, building_coord
            );

            // make payment for building
            BuildingCustomImpl::make_payment(
                world, building.outer_entity_id, building.category, building.produced_resource_type
            );
        }
        fn pause_production(ref world: IWorldDispatcher, entity_id: ID, building_coord: Coord) {
            BuildingCustomImpl::pause_production(world, entity_id, building_coord);
        }
        fn resume_production(ref world: IWorldDispatcher, entity_id: ID, building_coord: Coord) {
            BuildingCustomImpl::resume_production(world, entity_id, building_coord);
        }
        fn destroy(ref world: IWorldDispatcher, entity_id: ID, building_coord: Coord) {
            BuildingCustomImpl::destroy(world, entity_id, building_coord);
        }
    }
}
