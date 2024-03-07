use dojo::world::IWorldDispatcher;
use eternum::models::position::{Coord, Direction};


#[starknet::interface]
trait IMapSystems<TContractState> {
    fn explore(
        self: @TContractState, world: IWorldDispatcher, 
        unit_id: u128, direction: Direction
    );
}
