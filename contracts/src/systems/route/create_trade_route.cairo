#[system]
mod CreateTradeRoute{
    use eternum::components::position::{Coord, Position};
    use eternum::components::usage::Usage;
    use eternum::components::trade::TradeRoute;
    use traits::Into;

    use dojo::world::Context;

    fn execute(ctx: Context, from: Coord, to: Coord) {
        let from_position = Position {
            entity_id: ctx.world.uuid().into(),
            x: from.x,
            y: from.y,
        };

        let to_position = Position {
            entity_id: ctx.world.uuid().into(),
            x: to.x,
            y: to.y,
        };
        
        let trade_route = TradeRoute {
            entity_id: ctx.world.uuid().into(),
            from_position_id: from_position.entity_id,
            to_position_id: to_position.entity_id,
        };

        set!(ctx.world, (
            Usage {
                entity_id: trade_route.entity_id,
                count: 32, // arbitrary
            },
            trade_route,
            from_position,
            to_position
        ));
    }

}
