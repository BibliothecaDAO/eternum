#[system]
mod Travel {
    
    use eternum::alias::ID;
    use eternum::components::movable::{Movable, NewMovable};
    use eternum::components::position::{Coord, CoordTrait, Position, PositionTrait};
    use eternum::components::owner::Owner;
    use eternum::components::road::RoadImpl;
    use eternum::components::config::RoadConfig;

    use eternum::constants::ROAD_CONFIG_ID;

    use dojo::world::Context;

    use core::traits::Into;
    
    fn execute(ctx: Context, entity_id: ID, last_stop_coord: Coord, round_trip: bool) {

        let entity_owner = get!(ctx.world, entity_id, Owner);
        assert(entity_owner.address == ctx.origin, 'not owner of entity');

        let entity_movable = get!(ctx.world, entity_id, NewMovable);      
        assert(entity_movable.sec_per_km != 0, 'entity has no speed');  
        assert(entity_movable.blocked == false, 'entity is blocked');  

        let ts = starknet::get_block_timestamp();
        assert(entity_movable.arrival_time <= ts, 'entity is in transit');


        let entity_coord: Coord = (get!(ctx.world, entity_id, Position)).into();

        let mut travel_time = entity_coord.measure_travel_time(
            last_stop_coord, entity_movable.sec_per_km
        );
        if round_trip {travel_time *=  2;}
        
        // reduce travel time if a road exists
        let mut road = RoadImpl::get(ctx.world, entity_coord, last_stop_coord);
        if road.usage_count > 0 {
            let road_config = get!(ctx.world, ROAD_CONFIG_ID, RoadConfig);
            
            travel_time = travel_time / road_config.speed_up_by;
            road.usage_count -= 1;

            set!(ctx.world, (road));
        }


        if round_trip == false {
            set!(ctx.world,(
                Position {
                    entity_id: entity_id,
                    x: last_stop_coord.x,
                    y: last_stop_coord.y
                }
            ));
        }

        set!(ctx.world,(
            NewMovable {
                entity_id: entity_id,
                sec_per_km: entity_movable.sec_per_km,
                blocked: entity_movable.blocked,

                departure_time: ts,
                arrival_time: ts + travel_time,

                last_stop_coord_x: last_stop_coord.x,
                last_stop_coord_y: last_stop_coord.y,
                round_trip
            }
        ));

    }        
}




#[cfg(test)]
mod tests {
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::RoadConfig;
    use eternum::components::road::{Road, RoadImpl};
    
    

    use eternum::constants::ResourceTypes;
    use eternum::constants::ROAD_CONFIG_ID;

    use eternum::utils::testing::spawn_eternum;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;

    use core::traits::Into;
    use core::serde::Serde;

    fn setup() -> (IWorldDispatcher, u64, u64, Position, Position) {
        let world = spawn_eternum();
        
        // set as executor
        starknet::testing::set_contract_address(world.executor());
        
        
        let entity_id = 11_u64;
        let entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: entity_id.into()
        };

        set!(world, (entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'entity'>(), 
                entity_id: entity_id.into()
            }
        ));

        let last_stop_coord_entity_id = 12_u64;
        let last_stop_coord_entity_position = Position { 
            x: 900_000, 
            y: 100_000, 
            entity_id: last_stop_coord_entity_id.into()
        };
        set!(world, (last_stop_coord_entity_position));


        (world, entity_id, last_stop_coord_entity_id,
         entity_position, last_stop_coord_entity_position )
    }





    #[test]
    #[available_gas(30000000000000)]
    fn test_travel() {
        
        let (world, 
            entity_id, last_stop_coord_entity_id,
            _, last_stop_coord_entity_position
         ) = setup();

        set!(world, (
            Movable {
                entity_id: entity_id.into(),
                sec_per_km: 10,
                blocked: false
            }
        ));

        
        // travelling entity travels
        starknet::testing::set_contract_address(contract_address_const::<'entity'>());

        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);

        
        // verify arrival time and position of entity 
        let entity_arrival_time = get!(world, entity_id, ArrivalTime);
        let new_entity_position = get!(world, entity_id, Position);

        assert(entity_arrival_time.arrival_time == 800, 'arrival time not correct');

        assert(new_entity_position.x == last_stop_coord_entity_position.x, 'position x is not correct');
        assert(new_entity_position.y == last_stop_coord_entity_position.y, 'position y is not correct');

    }


    #[test]
    #[available_gas(30000000000000)]
    fn test_travel_with_road(){
                
        let (world, 
            entity_id, last_stop_coord_entity_id,
            entity_position, last_stop_coord_entity_position
         ) = setup();

        set!(world, (

            RoadConfig {
                config_id: ROAD_CONFIG_ID, 
                fee_resource_type: ResourceTypes::STONE,
                fee_amount: 10,
                speed_up_by: 2
             },
             Road {
                start_coord_x: entity_position.x,
                start_coord_y: entity_position.y,
                end_coord_x: last_stop_coord_entity_position.x,
                end_coord_y: last_stop_coord_entity_position.y,
                usage_count: 2
             },
            Movable {
                entity_id: entity_id.into(),
                sec_per_km: 10,
                blocked: false
            }

        ));

        
        // travelling entity travels
        starknet::testing::set_contract_address(contract_address_const::<'entity'>());

        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);

        
        // verify arrival time and position of entity 
        let entity_arrival_time = get!(world, entity_id, ArrivalTime);
        let new_entity_position = get!(world, entity_id, Position);

        assert(entity_arrival_time.arrival_time == 800 / 2 , 'arrival time not correct');

        assert(new_entity_position.x == last_stop_coord_entity_position.x, 'position x is not correct');
        assert(new_entity_position.y == last_stop_coord_entity_position.y, 'position y is not correct');

        // verify road usage count
        let road = RoadImpl::get(world, entity_position.into(), last_stop_coord_entity_position.into());
        assert(road.usage_count == 1, 'road usage count not correct');

    }



    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owner of entity','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
        
        let (world, 
            entity_id, last_stop_coord_entity_id,
            _, _
         ) = setup();
        
        starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity has no speed','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_no_speed() {
        
        let (world, 
            entity_id, last_stop_coord_entity_id,
            _, _
         ) = setup();
        
        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity is blocked','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_blocked() {
        
        let (world, 
            entity_id, last_stop_coord_entity_id,
            _, _
         ) = setup();
        
        set!(world, (
            Movable {
                entity_id: entity_id.into(),
                sec_per_km: 10,
                blocked: true
            }
        ));

        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity is in transit','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_in_transit() {
        
        let (world, 
            entity_id, last_stop_coord_entity_id,
            _, _
         ) = setup();
        
        set!(world, (
            Movable {
                entity_id: entity_id.into(),
                sec_per_km: 10,
                blocked: false
            },
            ArrivalTime {
                entity_id: entity_id.into(),
                arrival_time: 100
            }
        ));

        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@last_stop_coord_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


}