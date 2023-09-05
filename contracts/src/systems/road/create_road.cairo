#[system]
mod CreateRoad{
    use eternum::components::position::{Coord};
    use eternum::components::usage::Usage;
    use eternum::components::owner::Owner;
    use eternum::components::road::Road;
    
    use core::traits::Into;
    use core::poseidon::poseidon_hash_span;

    use dojo::world::Context;

    fn execute(ctx: Context, start_coord: Coord, end_coord: Coord, usage_count: u32) {

        let road = get!(ctx.world, (start_coord, end_coord), Road);
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
