#[dojo::contract]
mod caravan_systems {
    use eternum::alias::ID;
    use eternum::models::metadata::ForeignKey;
    use eternum::models::caravan::CaravanMembers;
    use eternum::models::inventory::Inventory;
    use eternum::models::weight::Weight;
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Position, PositionTrait, Coord, CoordTrait};
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::road::RoadImpl;
    use eternum::systems::transport::interface::caravan_systems_interface::{
        ICaravanSystems
    };

    use starknet::ContractAddress;

    use core::poseidon::poseidon_hash_span;


    #[external(v0)]
    impl CaravanSystemsImpl of ICaravanSystems<ContractState>{
        /// Create a caravan entity
        ///
        /// # Arguments
        ///
        /// * `entity_ids` - The list of transport units used to create the caravan
        ///
        fn create(self: @ContractState, world: IWorldDispatcher, entity_ids: Array<ID>) -> ID {
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
                    assert(entity_owner_id.entity_owner_id == entity_owner.entity_owner_id, 'entities not same entity owner');
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
                set!(world, (
                    Movable { 
                        entity_id, 
                        sec_per_km: movable.sec_per_km, 
                        blocked: true,
                        round_trip: false,
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
            set!(world, (
                    Owner {
                        entity_id: caravan_id, 
                        address: caller, 
                    }, 
                    EntityOwner {
                        entity_id: caravan_id,
                        entity_owner_id: entity_owner_id.entity_owner_id,
                    },
                    Movable {
                        entity_id: caravan_id, 
                        sec_per_km: average_speed, 
                        blocked: false, 
                        round_trip: false,
                        intermediate_coord_x: 0,  
                        intermediate_coord_y: 0,  
                    }, 
                    Capacity {
                        entity_id: caravan_id, 
                        weight_gram: total_capacity, 
                    }, 
                    CaravanMembers {
                        entity_id: caravan_id, 
                        key: entities_key.into(), 
                        count: length
                    }, 
                    Inventory {
                        entity_id: caravan_id, 
                        items_key: world.uuid().into(), 
                        items_count: 0
                    }, 
                    Position {
                        entity_id: caravan_id, 
                        x: entity_position.x, 
                        y: entity_position.y
                    }
                )
            );
            caravan_id
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
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp(), 
                        'transport has not arrived'
            );
        }

        fn check_capacity( world: IWorldDispatcher, transport_id: ID, weight: u128) {

            let transport_weight = get!(world, transport_id, Weight);

            let transport_capacity = get!(world, transport_id, Capacity);
            let transport_quantity = get!(world, transport_id, Quantity);

            assert(
                transport_capacity
                    .can_carry_weight(
                            transport_id, 
                            transport_quantity.get_value(), 
                            transport_weight.value + weight
                        ),
                'not enough capacity'
            );
        }


        fn get_travel_time(
            world: IWorldDispatcher, transport_id: ID, from_pos: Position, to_pos: Position, 
            ) -> (u64, u64) {

            let (caravan_movable, caravan_position) 
                = get!(world, transport_id, (Movable, Position));
            let mut one_way_trip_time 
                = from_pos.calculate_travel_time(
                    to_pos, caravan_movable.sec_per_km
                    );
                    
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
            assert(transport_arrival_time.arrives_at <= starknet::get_block_timestamp(),
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