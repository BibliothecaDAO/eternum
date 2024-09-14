use eternum::alias::ID;

#[dojo::interface]
trait IRealmSystems {
    fn create(
        ref world: IWorldDispatcher,
        realm_name: felt252,
        realm_id: ID,
        resource_types_packed: u128,
        resource_types_count: u8,
        cities: u8,
        harbors: u8,
        rivers: u8,
        regions: u8,
        wonder: u8,
        order: u8,
        position: eternum::models::position::Position
    ) -> ID;
    fn mint_starting_resources(ref world: IWorldDispatcher, config_id: ID, entity_id: ID) -> ID;
}


#[dojo::contract]
mod realm_systems {
    use core::poseidon::poseidon_hash_span;
    use core::traits::Into;

    use eternum::alias::ID;

    use eternum::constants::REALM_ENTITY_TYPE;
    use eternum::constants::{WORLD_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID, MAX_REALMS_PER_ADDRESS};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::config::{CapacityConfigCategory};
    use eternum::models::config::{RealmFreeMintConfig, HasClaimedStartingResources};
    use eternum::models::event::{SettleRealmData, EventType};
    use eternum::models::map::Tile;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::movable::Movable;
    use eternum::models::name::{AddressName};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::QuantityTracker;
    use eternum::models::realm::{Realm, RealmCustomTrait};
    use eternum::models::resources::{DetachedResource, Resource, ResourceCustomImpl, ResourceCustomTrait};
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;


    use starknet::ContractAddress;


    #[abi(embed_v0)]
    impl RealmSystemsImpl of super::IRealmSystems<ContractState> {
        fn mint_starting_resources(ref world: IWorldDispatcher, config_id: ID, entity_id: ID) -> ID {
            get!(world, (entity_id), Realm).assert_is_set();

            let mut claimed_resources = get!(world, (entity_id, config_id), HasClaimedStartingResources);

            assert(!claimed_resources.claimed, 'already claimed');

            // get index
            let config_index = REALM_FREE_MINT_CONFIG_ID + config_id.into();

            let realm_free_mint_config = get!(world, config_index, RealmFreeMintConfig);
            let mut index = 0;
            loop {
                if index == realm_free_mint_config.detached_resource_count {
                    break;
                }

                let mut detached_resource = get!(
                    world, (realm_free_mint_config.detached_resource_id, index), DetachedResource
                );
                let mut realm_resource = ResourceCustomImpl::get(
                    world, (entity_id.into(), detached_resource.resource_type)
                );

                realm_resource.add(detached_resource.resource_amount);
                realm_resource.save(world);

                index += 1;
            };

            claimed_resources.claimed = true;
            set!(world, (claimed_resources));

            entity_id.into()
        }

        fn create(
            ref world: IWorldDispatcher,
            realm_name: felt252,
            realm_id: ID,
            resource_types_packed: u128,
            resource_types_count: u8,
            cities: u8,
            harbors: u8,
            rivers: u8,
            regions: u8,
            wonder: u8,
            order: u8,
            position: Position,
        ) -> ID {
            // ensure that the coord is not occupied by any other structure
            let coord: Coord = position.into();
            let structure_count: StructureCount = get!(world, coord, StructureCount);
            structure_count.assert_none();

            let entity_id = world.uuid();
            let caller = starknet::get_caller_address();

            // Ensure that caller does not have more than `MAX_REALMS_PER_ADDRESS`

            let caller_realm_quantity_arr = array![caller.into(), REALM_ENTITY_TYPE.into()];
            let caller_realm_quantity_key = poseidon_hash_span(caller_realm_quantity_arr.span());
            let mut caller_realms_quantity = get!(world, caller_realm_quantity_key, QuantityTracker);
            assert(caller_realms_quantity.count < MAX_REALMS_PER_ADDRESS.into(), 'max num of realms settled');

            caller_realms_quantity.count += 1;
            set!(world, (caller_realms_quantity));

            set!(
                world,
                (
                    Owner { entity_id: entity_id.into(), address: caller },
                    EntityOwner { entity_id: entity_id.into(), entity_owner_id: entity_id.into() },
                    Structure {
                        entity_id: entity_id.into(),
                        category: StructureCategory::Realm,
                        created_at: starknet::get_block_timestamp()
                    },
                    StructureCount { coord, count: 1 },
                    CapacityCategory { entity_id: entity_id.into(), category: CapacityConfigCategory::Structure },
                    Realm {
                        entity_id: entity_id.into(),
                        realm_id,
                        resource_types_packed,
                        resource_types_count,
                        cities,
                        harbors,
                        rivers,
                        regions,
                        wonder,
                        order,
                    },
                    Position { entity_id: entity_id.into(), x: position.x, y: position.y, },
                    EntityMetadata { entity_id: entity_id.into(), entity_type: REALM_ENTITY_TYPE, }
                )
            );

            let mut tile: Tile = get!(world, (position.x, position.y), Tile);
            if tile.explored_at == 0 {
                // set realm's position tile to explored
                InternalMapSystemsImpl::explore(world, entity_id.into(), position.into(), array![(1, 0)].span());
            }

            emit!(
                world,
                (SettleRealmData {
                    id: world.uuid(),
                    event_id: EventType::SettleRealm,
                    entity_id,
                    owner_name: get!(world, starknet::get_caller_address(), AddressName).name,
                    realm_name,
                    resource_types_packed,
                    resource_types_count,
                    cities,
                    harbors,
                    rivers,
                    regions,
                    wonder,
                    order,
                    x: position.x,
                    y: position.y,
                    timestamp: starknet::get_block_timestamp(),
                }),
            );

            entity_id.into()
        }
    }
}
