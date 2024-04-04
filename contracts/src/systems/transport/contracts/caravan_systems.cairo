#[dojo::contract]
mod caravan_systems {
    use eternum::alias::ID;
    use eternum::models::metadata::ForeignKey;
    use eternum::models::caravan::CaravanMembers;
    use eternum::models::realm::Realm;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::inventory::Inventory;
    use eternum::models::weight::Weight;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, PositionTrait, Coord, TravelTrait};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::road::RoadImpl;
    use eternum::systems::transport::interface::caravan_systems_interface::{ICaravanSystems};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };

    use eternum::systems::leveling::contracts::leveling_systems::{
        InternalLevelingSystemsImpl as leveling
    };

    use eternum::constants::{LevelIndex};

    use starknet::ContractAddress;

    use core::poseidon::poseidon_hash_span;


    #[abi(embed_v0)]
    impl CaravanSystemsImpl of ICaravanSystems<ContractState> {
        /// Create a caravan entity
        ///
        /// # Arguments
        ///
        /// * `entity_ids` - The list of transport units used to create the caravan
        ///
        fn create(world: IWorldDispatcher, entity_ids: Array<ID>) -> ID {
            // speed
            let mut total_speed: u128 = 0_u128;
            let mut total_quantity: u128 = 0_u128;
            // capacity
            let mut total_capacity: u128 = 0_u128;

            // get key to write each entity of the caravan
            let entities_key = world.uuid();
            // get caravan id
            let caravan_id: ID = world.uuid().into();

            let mut entity_position: Position = Position { entity_id: caravan_id, x: 0, y: 0 };

            let entity_owner_id = get!(world, (*entity_ids[0]), EntityOwner);

            let caller = starknet::get_caller_address();

            let mut index = 0;
            // loop over the entities to
            // - sum speed and capacity
            // - check that all positions are identical
            // - assert owner is caller
            // - assert entity is not already blocked (e.g. by another caravan)

            let length = entity_ids.len();
            loop {
                if index == length {
                    break ();
                }
                let entity_id: u128 = *entity_ids[index];

                // assert that they are movable
                // assert that they have a capacity component
                let (movable, capacity, position, quantity) = get!(
                    world, (entity_id), (Movable, Capacity, Position, Quantity)
                );

                // assert that they are all at the same position when index > 0
                // if index == 0, then initialize position as the first entity position
                if index != 0 {
                    assert(entity_position.x == position.x, 'entities not same position');
                    assert(entity_position.y == position.y, 'entities not same position');

                    // check owner entity_id is the same for all
                    let entity_owner = get!(world, (entity_id), EntityOwner);
                    assert(
                        entity_owner_id.entity_owner_id == entity_owner.entity_owner_id,
                        'entities not same entity owner'
                    );
                } else {
                    entity_position = position;
                }

                // assert that caller is the owner of the entities
                let owner = get!(world, (entity_id), Owner);
                assert(caller == owner.address, 'entity is not owned by caller');

                // assert that they are not blocked
                assert(movable.blocked == false, 'entity is blocked');

                // set entity in the caravan
                let foreign_key_arr = array![caravan_id.into(), entities_key.into(), index.into()];
                let foreign_key = poseidon_hash_span(foreign_key_arr.span());
                set!(world, (ForeignKey { foreign_key, entity_id }));

                // set the entity as blocked so that it cannot be used in another caravan
                set!(
                    world,
                    (Movable {
                        entity_id,
                        sec_per_km: movable.sec_per_km,
                        blocked: true,
                        round_trip: false,
                        start_coord_x: 0,
                        start_coord_y: 0,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    })
                );

                // TODO: add the Caravan component to each entity
                // so that when we know it's in a caravan
                let quantity: u128 = quantity.get_value();
                total_speed += movable.sec_per_km.into() * quantity;
                total_quantity += quantity;
                total_capacity += capacity.weight_gram * quantity;
                index += 1;
            };
            // DISCUSS: i created a getAverageSpeed system but
            // it would mean that we'd have to loop 2x over the entities

            // DISCUSS: i could also create a new CheckAllSamePosition system that checks
            // if a list of entities are at the same position, but again that would be 
            // an extra loop
            let average_speed = total_speed / total_quantity;
            let average_speed: u16 = average_speed.try_into().unwrap();

            // set the caravan entity
            set!(
                world,
                (
                    Owner { entity_id: caravan_id, address: caller, },
                    EntityOwner {
                        entity_id: caravan_id, entity_owner_id: entity_owner_id.entity_owner_id,
                    },
                    Movable {
                        entity_id: caravan_id,
                        sec_per_km: average_speed,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: 0,
                        start_coord_y: 0,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    },
                    Capacity { entity_id: caravan_id, weight_gram: total_capacity, },
                    CaravanMembers {
                        entity_id: caravan_id, key: entities_key.into(), count: length
                    },
                    Inventory {
                        entity_id: caravan_id, items_key: world.uuid().into(), items_count: 0
                    },
                    Position { entity_id: caravan_id, x: entity_position.x, y: entity_position.y }
                )
            );
            caravan_id
        }


        /// Disassemble a caravan entity
        ///
        /// # Arguments
        ///
        /// * `caravan_id` - The caravan entity id
        ///
        /// # Returns
        ///
        /// * `transport_ids` - The id of transport units used to form the caravan
        ///
        fn disassemble(world: IWorldDispatcher, caravan_id: ID) -> Span<ID> {
            // ensure that caller is the owner
            let caravan_owner = get!(world, caravan_id, Owner);
            let caller = starknet::get_caller_address();
            assert(caravan_owner.address == caller, 'caller not owner');

            // ensure that it is a caravan
            let caravan_members = get!(world, caravan_id, CaravanMembers);
            assert(caravan_members.count > 0, 'not a caravan');

            // ensure that its inventory is empty
            let caravan_inventory = get!(world, caravan_id, Inventory);
            assert(caravan_inventory.items_count == 0, 'inventory not empty');

            // ensure that it is not blocked
            let caravan_movable = get!(world, caravan_id, Movable);
            assert(caravan_movable.blocked == false, 'caravan is blocked');

            // ensure that it is not in transit
            let caravan_arrival_time = get!(world, caravan_id, ArrivalTime);
            assert(
                caravan_arrival_time.arrives_at <= starknet::get_block_timestamp().into(),
                'caravan in transit'
            );

            // ensure that caravan is at home position
            let caravan_position = get!(world, caravan_id, Position);
            let owner_entity = get!(world, caravan_id, EntityOwner);
            let owner_position = get!(world, owner_entity.entity_owner_id, Position);
            assert(caravan_position.x == owner_position.x, 'mismatched positions');
            assert(caravan_position.y == owner_position.y, 'mismatched positions');

            let mut index = 0;
            let mut transport_ids = array![];
            loop {
                if index == caravan_members.count {
                    break;
                }

                // get transport id
                let foreign_key_arr = array![
                    caravan_id.into(), caravan_members.key.into(), index.into()
                ];
                let foreign_key = poseidon_hash_span(foreign_key_arr.span());
                let mut foreign_key = get!(world, foreign_key, ForeignKey);
                let transport_id = foreign_key.entity_id;

                // unblock the transport
                let mut transport_movable = get!(world, transport_id, Movable);
                transport_movable.blocked = false;
                set!(world, (transport_movable));

                // delete foreign key
                foreign_key.entity_id = 0;
                set!(world, (foreign_key));

                // add transport id to array
                transport_ids.append(transport_id);

                index += 1;
            };

            // reset all caravan components
            set!(
                world,
                (
                    Owner { entity_id: caravan_id, address: Zeroable::zero(), },
                    EntityOwner { entity_id: caravan_id, entity_owner_id: 0, },
                    Movable {
                        entity_id: caravan_id,
                        sec_per_km: 0,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: 0,
                        start_coord_y: 0,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    },
                    Capacity { entity_id: caravan_id, weight_gram: 0, },
                    CaravanMembers { entity_id: caravan_id, key: 0, count: 0 },
                    Inventory { entity_id: caravan_id, items_key: 0, items_count: 0 },
                    Position { entity_id: caravan_id, x: 0, y: 0 }
                )
            );

            return transport_ids.span();
        }
    }


    #[generate_trait]
    impl InternalCaravanSystemsImpl of InternalCaravanSystemsTrait {
        fn check_owner(world: IWorldDispatcher, transport_id: ID, addr: ContractAddress) {
            let transport_owner = get!(world, transport_id, Owner);
            assert(transport_owner.address == addr, 'not caravan owner');
        }


        fn check_position(world: IWorldDispatcher, transport_id: ID, owner_id: ID) {
            let transport_position = get!(world, transport_id, Position);
            let owner_position = get!(world, owner_id, Position);
            assert(transport_position.x == owner_position.x, 'mismatched positions');
            assert(transport_position.y == owner_position.y, 'mismatched positions');
        }

        fn check_arrival_time(world: IWorldDispatcher, transport_id: ID) {
            let transport_arrival_time = get!(world, transport_id, ArrivalTime);
            assert(
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp().into(),
                'transport has not arrived'
            );
        }

        fn check_capacity(world: IWorldDispatcher, transport_id: ID, weight: u128) {
            let transport_weight = get!(world, transport_id, Weight);

            let transport_capacity = get!(world, transport_id, Capacity);
            let transport_quantity = get!(world, transport_id, Quantity);

            assert(
                transport_capacity
                    .can_carry_weight(
                        transport_quantity.get_value(), transport_weight.value + weight
                    ),
                'not enough capacity'
            );
        }


        fn get_travel_time(
            world: IWorldDispatcher, transport_id: ID, from_pos: Position, to_pos: Position
        ) -> (u64, u64) {
            let (caravan_movable, caravan_position) = get!(
                world, transport_id, (Movable, Position)
            );
            let mut one_way_trip_time = from_pos
                .calculate_travel_time(to_pos, caravan_movable.sec_per_km);

            // check if entity owner is a realm and apply bonuses if it is
            let entity_owner = get!(world, (transport_id), EntityOwner);
            let realm = get!(world, entity_owner.entity_owner_id, Realm);

            if realm.cities > 0 {
                one_way_trip_time =
                    InternalTravelSystemsImpl::use_travel_bonus(
                        world, @realm, @entity_owner, one_way_trip_time
                    );
            }

            let round_trip_time: u64 = 2 * one_way_trip_time;
            // reduce round trip time if there is a road
            let round_trip_time = RoadImpl::use_road(
                world, round_trip_time, caravan_position.into(), to_pos.into()
            );
            // update one way trip time incase round_trip_time was reduced
            one_way_trip_time = round_trip_time / 2;

            (round_trip_time, one_way_trip_time)
        }


        fn block(world: IWorldDispatcher, transport_id: ID) {
            let mut transport_movable = get!(world, transport_id, Movable);
            assert(transport_movable.blocked == false, 'transport is blocked');

            let transport_arrival_time = get!(world, transport_id, ArrivalTime);
            assert(
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp().into(),
                'transport in transit'
            );

            // update transport movable
            transport_movable.blocked = true;
            set!(world, (transport_movable))
        }


        fn unblock(world: IWorldDispatcher, transport_id: ID) {
            let mut transport_movable = get!(world, transport_id, Movable);
            assert(transport_movable.blocked == true, 'transport not blocked');

            // update transport movable
            transport_movable.blocked = false;
            set!(world, (transport_movable))
        }
    }
}
