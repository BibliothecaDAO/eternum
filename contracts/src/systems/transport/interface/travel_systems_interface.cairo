use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::models::position::Direction;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait ITravelSystems<TContractState> {
    fn travel(
        self: @TContractState, world: IWorldDispatcher, 
        travelling_entity_id: ID, destination_coord: Coord
    );

    fn travel_instant(
        self: @TContractState, world: IWorldDispatcher, 
        travelling_entity_id: ID, directions: Span<Direction>
    );
}