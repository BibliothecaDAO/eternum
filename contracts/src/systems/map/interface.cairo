use dojo::world::IWorldDispatcher;
use eternum::models::position::{Coord, Direction};


#[starknet::interface]
trait IMapSystems<TContractState> {
    fn explore(
        self: @TContractState, world: IWorldDispatcher, 
        realm_entity_id: u128,  from_coord: Coord, direction: Direction
    );
}
