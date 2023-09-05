#[system]
mod CreateRoad {
    
    use eternum::components::position::{Coord};
    use eternum::components::road::{Road, RoadImpl};
    
    use dojo::world::Context;

    fn execute(ctx: Context, start_coord: Coord, end_coord: Coord, usage_count: u32) {
        let road = RoadImpl::get(ctx.world, start_coord, end_coord);
        assert(road.usage_count == 0, 'road already exists');
        
        set!(ctx.world, (
            Road {
                start_coord,
                end_coord,
                usage_count
            }
        ));
    }
}



#[cfg(test)]
mod tests {
    use eternum::components::position::{Coord};
    use eternum::components::road::{Road, RoadImpl};
    
    use eternum::utils::testing::spawn_eternum;

    use dojo::world::IWorldDispatcherTrait;

    use core::array::ArrayTrait;
    use core::serde::Serde;

    #[test]
    #[available_gas(3000000000000)]  
    fn test_create() {
        let world = spawn_eternum();

        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};
        
        let mut calldata = array![];
        Serde::serialize(@end_coord, ref calldata); // end first because order should not matter
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@33, ref calldata);
        world.execute('CreateRoad', calldata);

        let road = RoadImpl::get(world, start_coord, end_coord);
        assert(road.usage_count == 33, 'usage count should be 33');
    }


    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('road already exists','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_already_exists() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());
        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};
        set!(world, ( 
            Road {
                start_coord,
                end_coord,
                usage_count: 44
            })
        );

        let mut calldata = array![];
        Serde::serialize(@end_coord, ref calldata); // end first because order should not matter
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@1, ref calldata);
        world.execute('CreateRoad', calldata);
    
    }
}
