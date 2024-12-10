use s0_eternum::alias::ID;

#[starknet::interface]
trait IBuildingContract<TContractState> {
    fn create(
        ref self: TContractState,
        entity_id: ID,
        directions: Span<s0_eternum::models::position::Direction>,
        building_category: s0_eternum::models::buildings::BuildingCategory,
        produce_resource_type: Option<u8>
    );
    fn pause_production(ref self: TContractState, entity_id: ID, building_coord: s0_eternum::models::position::Coord);
    fn resume_production(ref self: TContractState, entity_id: ID, building_coord: s0_eternum::models::position::Coord);
    fn destroy(ref self: TContractState, entity_id: ID, building_coord: s0_eternum::models::position::Coord);
}

#[dojo::contract]
mod building_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::DEFAULT_NS;
    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::{
        resources::{Resource, ResourceCost}, owner::{EntityOwner, EntityOwnerTrait}, order::Orders,
        position::{Coord, CoordTrait, Position, PositionTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingImpl}, production::{Production, ProductionRateTrait},
        realm::{Realm, RealmImpl, RealmResourcesTrait}
    };

    #[abi(embed_v0)]
    impl BuildingContractImpl of super::IBuildingContract<ContractState> {
        fn create(
            ref self: ContractState,
            entity_id: ID,
            mut directions: Span<s0_eternum::models::position::Direction>,
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
                    Option::None => { break; }
                }
            };

            // todo: check that entity is a realm
            let (building, building_quantity) = BuildingImpl::create(
                ref world, entity_id, building_category, produce_resource_type, building_coord
            );

            // pay one time cost of the building
            building.make_payment(building_quantity, ref world);
        }

        fn pause_production(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::pause_production(ref world, entity_id, building_coord);
        }

        fn resume_production(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::resume_production(ref world, entity_id, building_coord);
        }

        fn destroy(ref self: ContractState, entity_id: ID, building_coord: Coord) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            // SeasonImpl::assert_season_is_not_over(world);

            BuildingImpl::destroy(ref world, entity_id, building_coord);
        }
    }
}
