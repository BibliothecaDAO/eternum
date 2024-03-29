use eternum::alias::ID;
use eternum::models::position::Coord;
use eternum::models::position::Direction;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait ITravelSystems {
    fn travel(
        travelling_entity_id: ID, destination_coord: Coord
    );

    fn travel_hex(
        travelling_entity_id: ID, directions: Span<Direction>
    );
}