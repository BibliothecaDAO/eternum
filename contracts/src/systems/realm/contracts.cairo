#[dojo::contract]
mod realm_systems {
    use core::poseidon::poseidon_hash_span;
    use core::traits::Into;

    use eternum::alias::ID;

    use eternum::constants::REALM_ENTITY_TYPE;
    use eternum::constants::{
        WORLD_CONFIG_ID, REALM_FREE_MINT_CONFIG_ID, SOLDIER_ENTITY_TYPE, MAX_REALMS_PER_ADDRESS
    };
    use eternum::models::capacity::Capacity;
    use eternum::models::combat::TownWatch;
    use eternum::models::config::{CapacityConfig, RealmFreeMintConfig};
    use eternum::models::map::Tile;
    use eternum::models::metadata::EntityMetadata;
    use eternum::models::movable::Movable;
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::Position;
    use eternum::models::quantity::QuantityTracker;
    use eternum::models::realm::Realm;
    use eternum::models::resources::{DetachedResource, Resource, ResourceImpl, ResourceTrait};
    use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;

    use eternum::systems::realm::interface::IRealmSystems;

    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl RealmSystemsImpl of IRealmSystems<ContractState> {
        fn create(
            world: IWorldDispatcher,
            realm_id: u128,
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
            let entity_id = world.uuid();
            let caller = starknet::get_caller_address();

            // Ensure that caller does not have more than `MAX_REALMS_PER_ADDRESS`

            let caller_realm_quantity_arr = array![caller.into(), REALM_ENTITY_TYPE.into()];
            let caller_realm_quantity_key = poseidon_hash_span(caller_realm_quantity_arr.span());
            let mut caller_realms_quantity = get!(
                world, caller_realm_quantity_key, QuantityTracker
            );
            assert(
                caller_realms_quantity.count < MAX_REALMS_PER_ADDRESS.into(),
                'max num of realms settled'
            );

            caller_realms_quantity.count += 1;
            set!(world, (caller_realms_quantity));

            set!(
                world,
                (
                    Owner { entity_id: entity_id.into(), address: caller },
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

            // setup realm's town watch 
            let combat_town_watch_id = world.uuid().into();
            let combat_unit_capacity = get!(
                world, (WORLD_CONFIG_ID, SOLDIER_ENTITY_TYPE), CapacityConfig
            )
                .weight_gram;

            set!(
                world,
                (
                    TownWatch { entity_id: entity_id.into(), town_watch_id: combat_town_watch_id, },
                    Owner { entity_id: combat_town_watch_id, address: caller },
                    EntityOwner {
                        entity_id: combat_town_watch_id, entity_owner_id: entity_id.into()
                    },
                    Position { entity_id: combat_town_watch_id, x: position.x, y: position.y },
                    Capacity { entity_id: combat_town_watch_id, weight_gram: combat_unit_capacity },
                    Movable {
                        entity_id: combat_town_watch_id,
                        sec_per_km: 0,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: 0,
                        start_coord_y: 0,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    },
                )
            );

            // mint intial resources to realm
            let realm_free_mint_config = get!(
                world, REALM_FREE_MINT_CONFIG_ID, RealmFreeMintConfig
            );
            let mut index = 0;
            loop {
                if index == realm_free_mint_config.detached_resource_count {
                    break;
                }

                let mut detached_resource = get!(
                    world, (realm_free_mint_config.detached_resource_id, index), DetachedResource
                );
                let mut realm_resource = ResourceImpl::get(
                    world, (entity_id.into(), detached_resource.resource_type)
                );

                realm_resource.balance += detached_resource.resource_amount;
                realm_resource.save(world);

                index += 1;
            };

            let mut tile: Tile = get!(world, (position.x, position.y), Tile);
            if tile.explored_at == 0 {
                // set realm's position tile to explored
                InternalMapSystemsImpl::explore(
                    world, entity_id.into(), position.into(), array![].span()
                );
            }

            entity_id.into()
        }
    }
}
