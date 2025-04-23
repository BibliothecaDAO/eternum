use s1_eternum::alias::ID;
use s1_eternum::models::position::{Direction};
use starknet::ContractAddress;

#[starknet::interface]
pub trait IVillageSystems<T> {
    fn create(ref self: T, village_owner: ContractAddress, connected_realm: ID, direction: Direction) -> ID;
}

#[dojo::contract]
pub mod village_systems {
    use core::num::traits::Zero;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcherTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{SeasonConfigImpl, VillageControllerConfig, WorldConfigUtilImpl};

    use s1_eternum::models::map::{TileOccupier};
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::position::{Direction, NUM_DIRECTIONS};
    use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
        StructureMetadataStoreImpl, StructureOwnerStoreImpl,
    };
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::systems::utils::village::{iVillageImpl, iVillageResourceImpl};
    use starknet::ContractAddress;
    use super::super::super::super::models::position::CoordTrait;

    #[abi(embed_v0)]
    impl VillageSystemsImpl of super::IVillageSystems<ContractState> {
        fn create(
            ref self: ContractState, village_owner: ContractAddress, connected_realm: ID, direction: Direction,
        ) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

            // ensure village owner is non zero
            assert!(village_owner.is_non_zero(), "village owner can't be zero");

            // ensure caller is authorized
            let caller = starknet::get_caller_address();
            let village_controller_config: VillageControllerConfig = WorldConfigUtilImpl::get_member(
                world, selector!("village_controller_config"),
            );
            let mut caller_authorized: bool = false;
            for address in village_controller_config.addresses {
                if *address == caller {
                    caller_authorized = true;
                    break;
                }
            };
            assert!(caller_authorized, "caller not authorized to create village");

            // ensure connected entity is a realm
            let connected_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, connected_realm);
            assert!(connected_structure.category == StructureCategory::Realm.into(), "connected entity is not a realm");

            // update village count for the realm
            let mut connected_structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
                ref world, connected_realm,
            );
            connected_structure_metadata.villages_count += 1;
            StructureMetadataStoreImpl::store(connected_structure_metadata, ref world, connected_realm);

            // ensure there can't be more than 6 villages per realm
            assert!(
                connected_structure_metadata.villages_count <= NUM_DIRECTIONS,
                "connected realm already has {} villages",
                NUM_DIRECTIONS,
            );

            // make village parameters
            let village_id: ID = world.dispatcher.uuid();
            let mut village_coord: Coord = connected_structure.coord();
            for _ in 0..iVillageImpl::village_realm_distance() {
                village_coord = village_coord.neighbor(direction);
            };

            let village_resources: Span<u8> = array![iVillageResourceImpl::random(village_owner, world)].span();

            // set village metadata
            let mut villiage_metadata: StructureMetadata = Default::default();
            villiage_metadata.village_realm = connected_realm;

            // create village
            iStructureImpl::create(
                ref world,
                village_coord,
                village_owner,
                village_id,
                StructureCategory::Village,
                village_resources,
                villiage_metadata,
                TileOccupier::Village,
            );

            // grant starting resources
            iStructureImpl::grant_starting_resources(ref world, village_id);

            // place castle building
            BuildingImpl::create(
                ref world,
                village_id,
                StructureCategory::Village.into(),
                village_coord,
                BuildingCategory::ResourceLabor,
                BuildingImpl::center(),
            );

            village_id.into()
        }
    }
}
