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
    ) -> ID;
    fn upgrade_level(ref world: IWorldDispatcher, realm_id: ID);
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
    use eternum::models::config::{CapacityConfigCategory, RealmLevelConfig, SettlementConfig, SettlementConfigImpl};
    use eternum::models::config::{RealmFreeMintConfig, HasClaimedStartingResources};
    use eternum::models::event::{SettleRealmData, EventType};

    use eternum::models::hyperstructure::SeasonCustomImpl;
    use eternum::models::map::Tile;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::movable::Movable;
    use eternum::models::name::{AddressName};
    use eternum::models::owner::{Owner, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::QuantityTracker;
    use eternum::models::realm::{Realm, RealmCustomTrait, RealmCustomImpl};
    use eternum::models::resources::{DetachedResource, Resource, ResourceCustomImpl, ResourceCustomTrait};
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;

    use starknet::ContractAddress;


    #[abi(embed_v0)]
    impl RealmSystemsImpl of super::IRealmSystems<ContractState> {
        fn mint_starting_resources(ref world: IWorldDispatcher, config_id: ID, entity_id: ID) -> ID {
            SeasonCustomImpl::assert_season_is_not_over(world);

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
        ) -> ID {
            SeasonCustomImpl::assert_season_is_not_over(world);

            // ensure that the coord is not occupied by any other structure
            let timestamp = starknet::get_block_timestamp();
            let mut found_coords = false;
            let mut coord: Coord = Coord { x: 0, y: 0 };
            let mut settlement_config = get!(world, WORLD_CONFIG_ID, SettlementConfig);
            while (!found_coords) {
                coord = settlement_config.get_next_settlement_coord(timestamp);
                let structure_count: StructureCount = get!(world, coord, StructureCount);
                if structure_count.is_none() {
                    found_coords = true;
                }
            };
            // save the new config
            set!(world, (settlement_config));

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
                        entity_id: entity_id.into(), category: StructureCategory::Realm, created_at: timestamp,
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
                        level: 0
                    },
                    Position { entity_id: entity_id.into(), x: coord.x, y: coord.y, },
                    EntityMetadata { entity_id: entity_id.into(), entity_type: REALM_ENTITY_TYPE, }
                )
            );

            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            if tile.explored_at == 0 {
                // set realm's position tile to explored
                InternalMapSystemsImpl::explore(world, entity_id.into(), coord, array![(1, 0)].span());
            }

            let owner_address = starknet::get_caller_address();
            emit!(
                world,
                (SettleRealmData {
                    id: world.uuid(),
                    event_id: EventType::SettleRealm,
                    entity_id,
                    owner_address,
                    owner_name: get!(world, owner_address, AddressName).name,
                    realm_name,
                    resource_types_packed,
                    resource_types_count,
                    cities,
                    harbors,
                    rivers,
                    regions,
                    wonder,
                    order,
                    x: coord.x,
                    y: coord.y,
                    timestamp,
                }),
            );

            entity_id.into()
        }


        fn upgrade_level(ref world: IWorldDispatcher, realm_id: ID) {
            // ensure caller owns the realm
            get!(world, realm_id, EntityOwner).assert_caller_owner(world);

            // ensure entity is a realm
            let mut realm = get!(world, realm_id, Realm);
            realm.assert_is_set();

            // ensure realm is not already at max level
            assert(realm.level < realm.max_level(world), 'realm is already at max level');

            // make payment to upgrade to next level
            let next_level = realm.level + 1;
            let realm_level_config = get!(world, next_level, RealmLevelConfig);
            let required_resources_id = realm_level_config.required_resources_id;
            let required_resource_count = realm_level_config.required_resource_count;
            let mut index = 0;
            loop {
                if index == required_resource_count {
                    break;
                }

                let mut required_resource = get!(world, (required_resources_id, index), DetachedResource);

                // burn resource from realm
                let mut realm_resource = ResourceCustomImpl::get(world, (realm_id, required_resource.resource_type));
                realm_resource.burn(required_resource.resource_amount);
                realm_resource.save(world);
                index += 1;
            };

            // set new level
            realm.level = next_level;
            set!(world, (realm));
        }
    }
}
