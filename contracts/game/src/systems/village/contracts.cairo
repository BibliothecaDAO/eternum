use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};

#[starknet::interface]
pub trait IVillageSystems<T> {
    fn create(ref self: T, connected_realm: ID, direction: Direction) -> ID;
}

#[dojo::contract]
pub mod village_systems {
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, WORLD_CONFIG_ID};

    use s1_eternum::models::map::{TileOccupier};
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::position::{Direction};
    use s1_eternum::models::season::Season;
    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureImpl,
        StructureOwnerStoreImpl,
    };
    use s1_eternum::models::village::{VillageResourceImpl};
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::structure::IStructureImpl;
    use starknet::ContractAddress;
    use super::super::super::super::models::position::CoordTrait;

    #[abi(embed_v0)]
    impl VillageSystemsImpl of super::IVillageSystems<ContractState> {
        fn create(ref self: ContractState, connected_realm: ID, direction: Direction) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut season: Season = world.read_model(WORLD_CONFIG_ID);
            season.assert_has_started();
            SeasonImpl::assert_season_is_not_over(world);

            // todo: add payment

            // ensure connected entity is a realm
            let connected_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, connected_realm);
            assert!(connected_structure.category == StructureCategory::Realm.into(), "connected entity is not a realm");

            // make village parameters
            let village_id: ID = world.dispatcher.uuid();
            let village_coord: Coord = connected_structure.coord().neighbor(direction).neighbor(direction);
            let village_owner: ContractAddress = starknet::get_caller_address();
            let village_resources: Span<u8> = array![VillageResourceImpl::random(village_owner, world)].span();

            // create village
            IStructureImpl::create(
                ref world,
                village_coord,
                village_owner,
                village_id,
                StructureCategory::Village,
                false,
                village_resources,
                Default::default(),
                TileOccupier::Village,
            );

            village_id.into()
        }
    }
}
