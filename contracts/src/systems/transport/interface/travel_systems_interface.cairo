use eternum::alias::ID;
use eternum::models::position::Coord;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITravelSystems<TContractState> {
    fn travel(
        self: @TContractState, world: IWorldDispatcher, 
        travelling_entity_id: ID, destination_coord: Coord
    );
}