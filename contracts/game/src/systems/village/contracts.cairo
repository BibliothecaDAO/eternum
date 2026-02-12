use crate::alias::ID;
use crate::models::position::Direction;

#[starknet::interface]
pub trait IVillageSystems<T> {
    fn create(ref self: T, village_pass_token_id: u16, connected_realm_entity_id: ID, direction: Direction) -> ID;
    fn receive_army_grant(ref self: T, village_id: ID);
}

#[dojo::contract]
pub mod village_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        SeasonConfigImpl, TickImpl, VillageTokenConfig, VillageTroopConfig, WorldConfigUtilImpl,
    };
    use crate::models::map::TileOccupier;
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::{Coord, Direction, NUM_DIRECTIONS};
    use crate::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata,
        StructureMetadataStoreImpl, StructureOwnerStoreImpl, StructureVillageSlots, VillageTroop,
    };
    use crate::system_libraries::structure_libraries::structure_creation_library::{
        IStructureCreationlibraryDispatcherTrait, structure_creation_library,
    };
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::structure::iStructureImpl;
    use crate::systems::utils::village::{iVillageImpl, iVillageResourceImpl};
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::village::{IVillagePassDispatcher, IVillagePassDispatcherTrait};
    use super::super::super::super::models::position::CoordTrait;

    #[abi(embed_v0)]
    impl VillageSystemsImpl of super::IVillageSystems<ContractState> {
        fn create(
            ref self: ContractState, village_pass_token_id: u16, connected_realm_entity_id: ID, direction: Direction,
        ) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

            // recieve the nft from the caller
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let village_token_config: VillageTokenConfig = WorldConfigUtilImpl::get_member(
                world, selector!("village_pass_config"),
            );
            IVillagePassDispatcher { contract_address: village_token_config.token_address }
                .transfer_from(caller, this, village_pass_token_id.into());

            // ensure connected entity is a realm
            let connected_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, connected_realm_entity_id,
            );
            assert!(connected_structure.category == StructureCategory::Realm.into(), "connected entity is not a realm");

            // update village count for the realm
            let mut connected_structure_metadata: StructureMetadata = StructureMetadataStoreImpl::retrieve(
                ref world, connected_realm_entity_id,
            );
            connected_structure_metadata.villages_count += 1;
            StructureMetadataStoreImpl::store(connected_structure_metadata, ref world, connected_realm_entity_id);

            // ensure there can't be more than 6 villages per realm
            assert!(
                connected_structure_metadata.villages_count <= NUM_DIRECTIONS,
                "connected realm already has {} villages",
                NUM_DIRECTIONS,
            );

            // ensure the slot is available
            let mut slot_available = false;
            let mut new_directions_left: Array<Direction> = array![];
            let mut structure_village_slots: StructureVillageSlots = world.read_model(connected_realm_entity_id);
            for slot_direction in structure_village_slots.directions_left {
                if *slot_direction == direction {
                    slot_available = true;
                } else {
                    new_directions_left.append(*slot_direction);
                }
            }
            assert!(slot_available, "the chosen slot is not available");

            // remove the used village slot from available slots
            if new_directions_left.len().is_zero() {
                world.erase_model(@structure_village_slots);
            } else {
                structure_village_slots.directions_left = new_directions_left.span();
                world.write_model(@structure_village_slots);
            }

            // make village parameters
            let village_id: ID = world.dispatcher.uuid();
            let mut village_coord: Coord = connected_structure.coord();
            for _ in 0..iVillageImpl::village_realm_distance() {
                village_coord = village_coord.neighbor(direction);
            }

            let village_resources: Span<u8> = array![iVillageResourceImpl::random(caller, world)].span();

            // set village metadata
            let mut villiage_metadata: StructureMetadata = Default::default();
            villiage_metadata.village_realm = connected_realm_entity_id;

            // create village
            let structure_creation_library = structure_creation_library::get_dispatcher(@world);
            structure_creation_library
                .make_structure(
                    world,
                    village_coord,
                    caller,
                    village_id,
                    StructureCategory::Village,
                    village_resources,
                    villiage_metadata,
                    TileOccupier::Village,
                    false,
                );

            // grant starting resources (no troops — troops come from receive_army_grant)
            structure_creation_library.grant_starting_resources_only(world, village_id, village_coord);

            // place castle building
            BuildingImpl::create(
                ref world,
                caller,
                village_id,
                StructureCategory::Village.into(),
                village_coord,
                BuildingCategory::ResourceLabor,
                BuildingImpl::center(),
            );

            AchievementTrait::progress(
                world, caller.into(), Tasks::VILLAGE_SETTLEMENT, 1, starknet::get_block_timestamp(),
            );

            village_id
        }

        fn receive_army_grant(ref self: ContractState, village_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns the village
            let village_owner = StructureOwnerStoreImpl::retrieve(ref world, village_id);
            village_owner.assert_caller_owner();

            // ensure structure is a village
            let village_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, village_id);
            assert!(village_base.category == StructureCategory::Village.into(), "structure is not a village");

            // ensure army grant hasn't been claimed yet
            let village_troop: VillageTroop = world.read_model(village_id);
            assert!(!village_troop.claimed, "army grant already claimed");

            // ensure troop claim delay has passed (uses created_at from structure_base)
            let village_troop_config: VillageTroopConfig = WorldConfigUtilImpl::get_member(
                world, selector!("village_troop_config"),
            );
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick = tick.current();
            let claimable_at = tick.at(village_base.created_at.into()) + village_troop_config.troop_delay_ticks.into();
            assert!(current_tick >= claimable_at, "army grant cannot be claimed yet");

            // grant starting troop resources using the existing library function
            let village_coord = village_base.coord();
            let structure_creation_library = structure_creation_library::get_dispatcher(@world);
            structure_creation_library.grant_starting_troop_resources(world, village_id, village_coord);

            // mark as claimed
            world.write_model(@VillageTroop { village_id, claimed: true });
        }
    }
}
