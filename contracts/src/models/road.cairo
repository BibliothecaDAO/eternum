use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::ROAD_CONFIG_ID;
use eternum::models::config::{RoadConfig};
use eternum::models::position::Coord;


#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Road {
    #[key]
    start_coord_x: u128,
    #[key]
    start_coord_y: u128,
    #[key]
    end_coord_x: u128,
    #[key]
    end_coord_y: u128,
    usage_count: u32
}


#[generate_trait]
impl RoadImpl of RoadTrait {
    #[inline(always)]
    fn get(world: IWorldDispatcher, start_coord: Coord, end_coord: Coord) -> Road {
        let mut road = get!(world, (start_coord.x, start_coord.y, end_coord.x, end_coord.y), Road);
        if road.usage_count == 0 {
            road = get!(world, (end_coord.x, end_coord.y, start_coord.x, start_coord.y,), Road);
        }
        road
    }

    #[inline(always)]
    fn use_road(
        world: IWorldDispatcher, travel_time: u64, start_coord: Coord, end_coord: Coord
    ) -> u64 {
        let mut new_travel_time = travel_time;
        let mut road = Self::get(world, start_coord, end_coord);
        if road.usage_count > 0 {
            let road_config = get!(world, ROAD_CONFIG_ID, RoadConfig);

            new_travel_time = travel_time / road_config.speed_up_by;
            road.usage_count -= 1;
            set!(world, (road));
        }

        new_travel_time
    }
}

#[cfg(test)]
mod tests {
    use core::array::ArrayTrait;
    use core::serde::Serde;

    use dojo::world::IWorldDispatcherTrait;
    use eternum::models::position::{Coord};
    use eternum::models::road::{Road, RoadImpl, RoadTrait};

    use eternum::utils::testing::world::spawn_eternum;

    #[test]
    #[available_gas(3000000000000)]
    fn test_get_road() {
        let world = spawn_eternum();

        let start_coord = Coord { x: 20, y: 30 };
        let end_coord = Coord { x: 40, y: 50 };
        let usage_count = 44;

        set!(
            world,
            (Road {
                start_coord_x: start_coord.x,
                start_coord_y: start_coord.y,
                end_coord_x: end_coord.x,
                end_coord_y: end_coord.y,
                usage_count
            })
        );

        let road = RoadImpl::get(world, start_coord, end_coord);
        assert(road.usage_count == usage_count, 'usage count should be 33');

        let road = RoadImpl::get(world, end_coord, start_coord); // reverse order
        assert(road.usage_count == usage_count, 'usage count should be 33');
    }
}
