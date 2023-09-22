#[system]
mod Travel {
    
    use eternum::alias::ID;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::position::{Position, PositionTrait};
    use eternum::components::owner::Owner;
    use eternum::components::road::RoadImpl;
    use eternum::components::config::RoadConfig;

    use eternum::constants::ROAD_CONFIG_ID;

    use dojo::world::Context;

    use core::traits::Into;
    
    fn execute(ctx: Context, travelling_entity_id: ID, destination_entity_id: ID) {

        let travelling_entity_owner = get!(ctx.world, travelling_entity_id, Owner);
        assert(travelling_entity_owner.address == ctx.origin, 'not owner of entity');

        let travelling_entity_movable = get!(ctx.world, travelling_entity_id, Movable);      
        assert(travelling_entity_movable.sec_per_km != 0, 'entity has no speed');  
        assert(travelling_entity_movable.blocked == false, 'entity is blocked');  
        
        let travelling_entity_arrival_time = get!(ctx.world, travelling_entity_id, ArrivalTime);
        let ts = starknet::get_block_timestamp();
        assert(travelling_entity_arrival_time.arrives_at <= ts, 'entity is in transit');


        let travelling_entity_position = get!(ctx.world, travelling_entity_id, Position);
        let destination_position = get!(ctx.world, destination_entity_id, Position);

        let mut travel_time = travelling_entity_position.calculate_travel_time(
            destination_position, travelling_entity_movable.sec_per_km
        );
        
        // reduce travel time if a road exists
        let mut road = RoadImpl::get(ctx.world, travelling_entity_position.into(), destination_position.into());
        if road.usage_count > 0 {
            let road_config = get!(ctx.world, ROAD_CONFIG_ID, RoadConfig);
            
            travel_time = travel_time / road_config.speed_up_by;
            road.usage_count -= 1;

            set!(ctx.world, (road));
        }

    
        set!(ctx.world,(
            ArrivalTime {
                entity_id: travelling_entity_id,
                arrives_at: ts + travel_time
            },
            Position {
                entity_id: travelling_entity_id,
                x: destination_position.x,
                y: destination_position.y
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
        
        
        let travelling_entity_id = 11_u64;
        let travelling_entity_position = Position { 
            x: 100_000, 
            y: 200_000, 
            entity_id: travelling_entity_id.into()
        };

        set!(world, (travelling_entity_position));
        set!(world, (
            Owner { 
                address: contract_address_const::<'travelling_entity'>(), 
                entity_id: travelling_entity_id.into()
            }
        ));

        let destination_entity_id = 12_u64;
        let destination_entity_position = Position { 
            x: 900_000, 
            y: 100_000, 
            entity_id: destination_entity_id.into()
        };
        set!(world, (destination_entity_position));


        (world, travelling_entity_id, destination_entity_id,
         travelling_entity_position, destination_entity_position )
    }





    #[test]
    #[available_gas(30000000000000)]
    fn test_travel() {
        
        let (world, 
            travelling_entity_id, destination_entity_id,
            _, destination_entity_position
         ) = setup();

        set!(world, (
            Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false
            }
        ));

        
        // travelling entity travels
        starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());

        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);

        
        // verify arrival time and position of travelling_entity 
        let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
        let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

        assert(travelling_entity_arrival_time.arrives_at == 800, 'arrival time not correct');

        assert(new_travelling_entity_position.x == destination_entity_position.x, 'position x is not correct');
        assert(new_travelling_entity_position.y == destination_entity_position.y, 'position y is not correct');

    }


    #[test]
    #[available_gas(30000000000000)]
    fn test_travel_with_road(){
                
        let (world, 
            travelling_entity_id, destination_entity_id,
            travelling_entity_position, destination_entity_position
         ) = setup();

        set!(world, (

            RoadConfig {
                config_id: ROAD_CONFIG_ID, 
                fee_resource_type: ResourceTypes::STONE,
                fee_amount: 10,
                speed_up_by: 2
             },
             Road {
                start_coord_x: travelling_entity_position.x,
                start_coord_y: travelling_entity_position.y,
                end_coord_x: destination_entity_position.x,
                end_coord_y: destination_entity_position.y,
                usage_count: 2
             },
            Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false
            }

        ));

        
        // travelling entity travels
        starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());

        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);

        
        // verify arrival time and position of travelling_entity 
        let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
        let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

        assert(travelling_entity_arrival_time.arrives_at == 800 / 2 , 'arrival time not correct');

        assert(new_travelling_entity_position.x == destination_entity_position.x, 'position x is not correct');
        assert(new_travelling_entity_position.y == destination_entity_position.y, 'position y is not correct');

        // verify road usage count
        let road = RoadImpl::get(world, travelling_entity_position.into(), destination_entity_position.into());
        assert(road.usage_count == 1, 'road usage count not correct');

    }



    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owner of entity','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
        
        let (world, 
            travelling_entity_id, destination_entity_id,
            _, _
         ) = setup();
        
        starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());
        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity has no speed','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_no_speed() {
        
        let (world, 
            travelling_entity_id, destination_entity_id,
            _, _
         ) = setup();
        
        starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity is blocked','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_blocked() {
        
        let (world, 
            travelling_entity_id, destination_entity_id,
            _, _
         ) = setup();
        
        set!(world, (
            Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: true
            }
        ));

        starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('entity is in transit','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_in_transit() {
        
        let (world, 
            travelling_entity_id, destination_entity_id,
            _, _
         ) = setup();
        
        set!(world, (
            Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false
            },
            ArrivalTime {
                entity_id: travelling_entity_id.into(),
                arrives_at: 100
            }
        ));

        starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
        let mut calldata = array![];
        Serde::serialize(@travelling_entity_id, ref calldata);
        Serde::serialize(@destination_entity_id, ref calldata);
        world.execute('Travel', calldata);
    }


}