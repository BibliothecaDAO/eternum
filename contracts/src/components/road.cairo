use eternum::alias::ID;
use eternum::components::position::Coord;

use dojo::world::{Context, IWorldDispatcher, IWorldDispatcherTrait};


#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Road {
    #[key]
    start_coord: Coord,
    #[key]
    end_coord: Coord,
    usage_count: u32
}



trait RoadTrait {
    /// Get Road component using set of coordinates
    fn get(ctx: Context, start_coord: Coord, end_coord: Coord) -> Road;
    /// Calculate travel time when using road
    fn travel_time(self:Road, travel_time: u64) -> u64;
    /// Reduce road usage count by 1
    fn travel(self: Road, ctx: Context);
}



impl RoadImpl of RoadTrait {

    #[inline(always)]
    fn get(ctx: Context, start_coord: Coord, end_coord: Coord) -> Road {
        let mut road = get!(ctx.world, (start_coord, end_coord), Road);
        if road.usage_count == 0 {
            road = get!(ctx.world, (end_coord, start_coord), Road);
        }
        road
    }


    #[inline(always)]
    fn travel_time(self: Road, travel_time: u64) -> u64 {
        travel_time / 2
    }


    #[inline(always)]
    fn travel(self: Road, ctx: Context) {
        let usage_count = self.usage_count - 1;
        set!(ctx.world, 
            Road {
               start_coord: self.start_coord,
               end_coord: self.end_coord,
               usage_count: usage_count
            }
        )
    }
}