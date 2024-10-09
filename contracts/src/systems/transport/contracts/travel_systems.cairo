#[dojo::interface]
trait ITravelSystems {
    fn travel(
        ref world: IWorldDispatcher,
        travelling_entity_id: eternum::alias::ID,
        destination_coord: eternum::models::position::Coord
    );
    fn travel_hex(
        ref world: IWorldDispatcher,
        travelling_entity_id: eternum::alias::ID,
        directions: Span<eternum::models::position::Direction>
    );
}

#[dojo::contract]
mod travel_systems {
    use eternum::alias::ID;

    use eternum::constants::{WORLD_CONFIG_ID, TravelTypes};
    use eternum::models::combat::Army;
    use eternum::models::config::{MapConfigImpl, TravelStaminaCostConfig, TravelFoodCostConfigImpl};

    use eternum::models::hyperstructure::SeasonCustomImpl;
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::order::{Orders, OrdersCustomTrait};
    use eternum::models::owner::{Owner, EntityOwner, EntityOwnerCustomTrait};
    use eternum::models::position::{Coord, Position, TravelTrait, CoordTrait, Direction};
    use eternum::models::quantity::{Quantity,};
    use eternum::models::realm::Realm;
    use eternum::models::stamina::StaminaCustomImpl;
    use eternum::models::weight::Weight;

    use starknet::ContractAddress;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    #[dojo::model]
    struct Travel {
        #[key]
        destination_coord_x: u32,
        #[key]
        destination_coord_y: u32,
        #[key]
        owner: ContractAddress,
        entity_id: ID,
        travel_time: u64,
        travel_path: Span<Coord>,
        timestamp: u64,
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
        fn travel(ref world: IWorldDispatcher, travelling_entity_id: ID, destination_coord: Coord) {
            SeasonCustomImpl::assert_season_is_not_over(world);

            // todo@security prevent free transport units from travelling
            get!(world, travelling_entity_id, EntityOwner).assert_caller_owner(world);

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
                world, travelling_entity_id, travelling_entity_movable, travelling_entity_coord, destination_coord
            );
        }


        fn travel_hex(ref world: IWorldDispatcher, travelling_entity_id: ID, directions: Span<Direction>) {
            SeasonCustomImpl::assert_season_is_not_over(world);

            get!(world, travelling_entity_id, EntityOwner).assert_caller_owner(world);

            let travelling_entity_movable = get!(world, travelling_entity_id, Movable);
            assert(travelling_entity_movable.sec_per_km != 0, 'entity has no speed');
            assert(travelling_entity_movable.blocked == false, 'entity is blocked');

            let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
            let ts = starknet::get_block_timestamp();
            assert(travelling_entity_arrival_time.arrives_at <= ts.into(), 'entity is in transit');

            let travelling_entity_position = get!(world, travelling_entity_id, Position);
            let travelling_entity_coord: Coord = travelling_entity_position.into();

            let num_moves = directions.len().try_into().unwrap();
            let mut stamina_cost = get!(world, (WORLD_CONFIG_ID, TravelTypes::TRAVEL), TravelStaminaCostConfig).cost;
            stamina_cost = stamina_cost * num_moves;

            StaminaCustomImpl::handle_stamina_costs(travelling_entity_id, stamina_cost, world);

            let transport_owner_entity = get!(world, travelling_entity_id, EntityOwner);

            let army = get!(world, travelling_entity_id, Army);

            TravelFoodCostConfigImpl::pay_travel_cost(world, transport_owner_entity, army.troops, directions.len());

            InternalTravelSystemsImpl::travel_hex(world, travelling_entity_id, travelling_entity_coord, directions);
        }
    }

    #[generate_trait]
    pub impl InternalTravelSystemsImpl of InternalTravelSystemsTrait {
        fn assert_tile_explored(world: IWorldDispatcher, coord: Coord) {
            let mut tile: Tile = get!(world, (coord.x, coord.y), Tile);
            assert(tile.explored_by_id != 0, 'tile not explored');
        }

        fn travel_hex(world: IWorldDispatcher, transport_id: ID, from_coord: Coord, mut directions: Span<Direction>) {
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
                Self::assert_tile_explored(world, to_coord);

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
                    ArrivalTime { entity_id: transport_id, arrives_at: starknet::get_block_timestamp().into() },
                    Position { entity_id: transport_id, x: to_coord.x, y: to_coord.y }
                )
            );

            // emit travel event
            let entityOwner = get!(world, transport_id, EntityOwner);
            emit!(
                world,
                (Travel {
                    destination_coord_x: to_coord.x,
                    destination_coord_y: to_coord.y,
                    travel_time: 0,
                    travel_path: travel_path.span(),
                    owner: entityOwner.owner_address(world),
                    entity_id: transport_id,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }


        fn travel(
            world: IWorldDispatcher, transport_id: ID, transport_movable: Movable, from_coord: Coord, to_coord: Coord
        ) {
            // ensure destination tile is explored
            Self::assert_tile_explored(world, to_coord);

            let mut travel_time = from_coord.calculate_travel_time(to_coord, transport_movable.sec_per_km);

            let current_position = get!(world, transport_id, Position);

            set!(
                world,
                (
                    ArrivalTime {
                        entity_id: transport_id, arrives_at: starknet::get_block_timestamp().into() + travel_time
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
            let owner = get!(world, transport_id, Owner);
            emit!(
                world,
                (Travel {
                    destination_coord_x: to_coord.x,
                    destination_coord_y: to_coord.y,
                    travel_time,
                    travel_path: array![from_coord, to_coord].span(),
                    owner: owner.address,
                    entity_id: transport_id,
                    timestamp: starknet::get_block_timestamp()
                })
            );
        }

        fn check_owner(world: IWorldDispatcher, transport_id: ID, addr: ContractAddress) {
            let transport_owner_addr: Owner = get!(world, transport_id, Owner);
            if (transport_owner_addr.address != addr) {
                let transport_owner_entity: EntityOwner = get!(world, transport_id, EntityOwner);
                assert(transport_owner_entity.owner_address(world) == addr, 'not transport owner');
            }
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
                transport_arrival_time.arrives_at <= starknet::get_block_timestamp().into(), 'transport has not arrived'
            );
        }
    }
}
