#[dojo::interface]
trait ITravelSystems {
    fn travel(
        travelling_entity_id: eternum::alias::ID,
        destination_coord: eternum::models::position::Coord
    );
    fn travel_hex(
        travelling_entity_id: eternum::alias::ID,
        directions: Span<eternum::models::position::Direction>
    );
}

#[dojo::contract]
mod travel_systems {
    use eternum::alias::ID;

    use eternum::constants::{ROAD_CONFIG_ID, REALM_LEVELING_CONFIG_ID, LevelIndex};
    use eternum::models::capacity::{Capacity, CapacityTrait};
    use eternum::models::config::{RoadConfig, LevelingConfig};
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::level::{Level, LevelTrait};
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::order::{Orders, OrdersTrait};
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::{Coord, Position, TravelTrait, CoordTrait, Direction};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::road::RoadImpl;
    use eternum::models::tick::{TickMove, TickMoveTrait};
    use eternum::models::weight::Weight;

    use eternum::systems::leveling::contracts::leveling_systems::{
        InternalLevelingSystemsImpl as leveling
    };
    use starknet::ContractAddress;

    #[derive(Drop, starknet::Event)]
    struct Travel {
        #[key]
        destination_coord_x: u128,
        #[key]
        destination_coord_y: u128,
        #[key]
        realm_entity_id: u128,
        entity_id: u128,
        travel_time: u64,
        travel_path: Span<Coord>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Travel: Travel,
    }

    #[abi(embed_v0)]
    impl TravelSystemsImpl of super::ITravelSystems<ContractState> {
        /// Travel to a destination
        ///
        /// This system can be called to move an entity from
        /// its current location to another coordinate on the map. It 
        //  is however crucial that the entity has all the necessary 
        //  models or components allowing it to move (i.e it must be movable)
        ///
        /// # Arguments
        ///
        /// * `travelling_entity_id` - The ID of the entity that is travelling
        /// * `destination_coord` - The coordinate to travel to
        ///
        fn travel(world: IWorldDispatcher, travelling_entity_id: ID, destination_coord: Coord) {
            // todo@security prevent free transport units from travelling
            // only caravans should be able to travel

            let travelling_entity_owner = get!(world, travelling_entity_id, Owner);
            assert(
                travelling_entity_owner.address == starknet::get_caller_address(),
                'not owner of entity'
            );

            let travelling_entity_movable = get!(world, travelling_entity_id, Movable);
            assert(travelling_entity_movable.sec_per_km != 0, 'entity has no speed');
            assert(travelling_entity_movable.blocked == false, 'entity is blocked');

            let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
            let ts = starknet::get_block_timestamp();
            assert(travelling_entity_arrival_time.arrives_at <= ts.into(), 'entity is in transit');

            let travelling_entity_position = get!(world, travelling_entity_id, Position);
            let travelling_entity_coord: Coord = travelling_entity_position.into();
            assert(travelling_entity_coord != destination_coord, 'entity is at destination');

            InternalTravelSystemsImpl::travel(
                world,
                travelling_entity_id,
                travelling_entity_movable,
                travelling_entity_coord,
                destination_coord
            );
        }


        fn travel_hex(
            world: IWorldDispatcher, travelling_entity_id: ID, directions: Span<Direction>
        ) {
            let travelling_entity_owner = get!(world, travelling_entity_id, Owner);
            assert(
                travelling_entity_owner.address == starknet::get_caller_address(),
                'not owner of entity'
            );

            let travelling_entity_movable = get!(world, travelling_entity_id, Movable);
            assert(travelling_entity_movable.sec_per_km != 0, 'entity has no speed');
            assert(travelling_entity_movable.blocked == false, 'entity is blocked');

            let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
            let ts = starknet::get_block_timestamp();
            assert(travelling_entity_arrival_time.arrives_at <= ts.into(), 'entity is in transit');

            let travelling_entity_position = get!(world, travelling_entity_id, Position);
            let travelling_entity_coord: Coord = travelling_entity_position.into();

            InternalTravelSystemsImpl::travel_hex(
                world, travelling_entity_id, travelling_entity_coord, directions
            );
        }
    }

    #[generate_trait]
    impl InternalTravelSystemsImpl of InternalTravelSystemsTrait {
        fn assert_tile_explored(world: IWorldDispatcher, coord: Coord) {
            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            assert(tile.explored_by_id != 0, 'tile not explored');
        }


        fn use_travel_bonus(
            world: IWorldDispatcher, realm: @Realm, entity_owner: @EntityOwner, travel_time: u64
        ) -> u64 {
            // get realm level bonus
            let realm_level_bonus = leveling::get_realm_level_bonus(
                world, (*entity_owner).entity_owner_id, LevelIndex::TRAVEL
            )
                .try_into()
                .unwrap();

            // get order hyperstructure bonus
            let realm_order = get!(world, (*realm).order, Orders);
            let realm_order_bonus = realm_order.get_bonus_multiplier().try_into().unwrap();

            // apply bonuses

            let new_travel_time = ((travel_time
                * 100
                * realm_order.get_bonus_denominator().try_into().unwrap()
                / (realm_level_bonus * (100 + realm_order_bonus))));

            return new_travel_time;
        }

        fn travel_hex(
            world: IWorldDispatcher,
            transport_id: ID,
            from_coord: Coord,
            mut directions: Span<Direction>
        ) {
            // check and update tick move steps
            let mut tick_move: TickMove = get!(world, transport_id, TickMove);
            tick_move.add(world, directions.len().try_into().unwrap());

            // get destination coordinate
            let mut travel_path = array![from_coord];
            let mut to_coord = from_coord;
            let mut index = 0;
            loop {
                if index == directions.len() {
                    break;
                }
                // update destination to  next tile
                to_coord = to_coord.neighbor(*directions.at(index));

                // ensure tile is explored
                InternalTravelSystemsImpl::assert_tile_explored(world, to_coord);

                // add coord to travel path 
                travel_path.append(to_coord);

                index += 1;
            };

            let mut transport_movable: Movable = get!(world, transport_id, Movable);
            transport_movable.blocked = false;
            transport_movable.round_trip = false;
            transport_movable.intermediate_coord_x = 0;
            transport_movable.intermediate_coord_y = 0;

            set!(world, (transport_movable));
            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: transport_id, arrives_at: starknet::get_block_timestamp().into()
                    },
                    Position { entity_id: transport_id, x: to_coord.x, y: to_coord.y }
                )
            );

            // emit travel event 
            let entity_owner = get!(world, transport_id, EntityOwner);
            emit!(
                world,
                (
                    Event::Travel(
                        Travel {
                            destination_coord_x: to_coord.x,
                            destination_coord_y: to_coord.y,
                            travel_time: 0,
                            travel_path: travel_path.span(),
                            realm_entity_id: entity_owner.entity_owner_id,
                            entity_id: transport_id
                        }
                    ),
                )
            );
        }


        fn travel(
            world: IWorldDispatcher,
            transport_id: ID,
            transport_movable: Movable,
            from_coord: Coord,
            to_coord: Coord
        ) {
            // ensure destination tile is explored
            InternalTravelSystemsImpl::assert_tile_explored(world, to_coord);

            let mut travel_time = from_coord
                .calculate_travel_time(to_coord, transport_movable.sec_per_km);

            // check if entity owner is a realm and apply bonuses if it is
            let entity_owner = get!(world, (transport_id), EntityOwner);
            let realm = get!(world, entity_owner.entity_owner_id, Realm);

            if realm.cities > 0 {
                travel_time =
                    InternalTravelSystemsImpl::use_travel_bonus(
                        world, @realm, @entity_owner, travel_time
                    );
            }

            // reduce travel time if there is a road
            let travel_time = RoadImpl::use_road(world, travel_time, from_coord, to_coord);

            let current_position = get!(world, transport_id, Position);

            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: transport_id,
                        arrives_at: starknet::get_block_timestamp().into() + travel_time
                    },
                    Position { entity_id: transport_id, x: to_coord.x, y: to_coord.y },
                    Movable {
                        entity_id: transport_id,
                        sec_per_km: transport_movable.sec_per_km,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: current_position.x,
                        start_coord_y: current_position.y,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    }
                )
            );

            // emit travel event 
            let entity_owner = get!(world, transport_id, EntityOwner);
            emit!(
                world,
                (
                    Event::Travel(
                        Travel {
                            destination_coord_x: to_coord.x,
                            destination_coord_y: to_coord.y,
                            travel_time,
                            travel_path: array![from_coord, to_coord].span(),
                            realm_entity_id: entity_owner.entity_owner_id,
                            entity_id: transport_id
                        }
                    ),
                )
            );
        }

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
    }
}
