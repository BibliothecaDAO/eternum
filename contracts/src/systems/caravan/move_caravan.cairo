#[system]
mod MoveCaravan {
    
    use eternum::alias::ID;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::position::{Position, PositionTrait};
    use eternum::components::owner::Owner;
    use eternum::components::road::RoadImpl;
    use eternum::components::config::RoadConfig;

    use eternum::constants::ROAD_CONFIG_ID;

    use dojo::world::Context;

    use core::traits::Into;
    
    fn execute(ctx: Context, caravan_id: ID, destination_entity_id: ID) {

        let caravan_owner = get!(ctx.world, caravan_id, Owner);
        assert(caravan_owner.address == ctx.origin, 'not owner of caravan');

        let caravan_movable = get!(ctx.world, caravan_id, Movable);      
        assert(caravan_movable.sec_per_km != 0, 'not a caravan');  
        assert(caravan_movable.blocked == false, 'caravan is blocked');  
        
        let caravan_arrival_time = get!(ctx.world, caravan_id, ArrivalTime);
        let ts = starknet::get_block_timestamp();
        assert(caravan_arrival_time.arrives_at < ts, 'caravan is in transit');


        let caravan_position = get!(ctx.world, caravan_id, Position);
        let destination_position = get!(ctx.world, destination_entity_id, Position);

        let mut travel_time = caravan_position.calculate_travel_time(
            destination_position, caravan_movable.sec_per_km
        );
        
        // reduce travel time if a road exists
        let mut road = RoadImpl::get(ctx.world, caravan_position.into(), destination_position.into());
        if road.usage_count > 0 {
            let road_config = get!(ctx.world, ROAD_CONFIG_ID, RoadConfig);
            
            travel_time = travel_time / road_config.speed_up_by;
            road.usage_count -= 1;

            set!(ctx.world, (road));
        }

    
        set!(ctx.world,(
            ArrivalTime {
                entity_id: caravan_id,
                arrives_at: ts + travel_time
            },
            Position {
                entity_id: caravan_id,
                x: destination_position.x,
                y: destination_position.y
            }
        ));

    }        
}

