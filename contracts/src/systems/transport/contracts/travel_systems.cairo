#[dojo::contract]
mod travel_systems {
    
    use eternum::alias::ID;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::position::{Coord, CoordTrait, Position};
    use eternum::models::owner::Owner;
    use eternum::models::road::RoadImpl;
    use eternum::models::config::RoadConfig;

    use eternum::constants::ROAD_CONFIG_ID;
    
    use eternum::systems::transport::interface::travel_systems_interface::{
        ITravelSystems
    };


    #[external(v0)]
    impl TravelSystemsImpl of ITravelSystems<ContractState> {

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
        fn travel(
            self: @ContractState, world: IWorldDispatcher, 
            travelling_entity_id: ID, destination_coord: Coord
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
            assert(travelling_entity_arrival_time.arrives_at <= ts, 'entity is in transit');


            let travelling_entity_position = get!(world, travelling_entity_id, Position);
            let travelling_entity_coord: Coord = travelling_entity_position.into();
            assert(travelling_entity_coord != destination_coord, 'entity is at destination');
            
            InternalTravelSystemsImpl::travel(world,
                travelling_entity_id, travelling_entity_movable, 
                travelling_entity_coord, destination_coord
            );
        }        
    }

    #[generate_trait]
    impl InternalTravelSystemsImpl of InternalTravelSystemsTrait {

        fn travel(
            world: IWorldDispatcher, transport_id: ID, transport_movable: Movable, 
            from_coord: Coord, to_coord: Coord
        ){
            let travel_time = from_coord.calculate_travel_time(
                to_coord, transport_movable.sec_per_km
            );

            // reduce travel time if there is a road
            let travel_time = RoadImpl::use_road(
                world, travel_time, from_coord, to_coord
                );
    
            set!(world,(
                ArrivalTime {
                    entity_id: transport_id,
                    arrives_at: starknet::get_block_timestamp() + travel_time
                },
                Position {
                    entity_id: transport_id,
                    x: to_coord.x,
                    y: to_coord.y
                }
            ));
        }

    }
}