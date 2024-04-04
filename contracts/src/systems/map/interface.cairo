use eternum::models::position::{Coord, Direction};


#[dojo::interface]
trait IMapSystems {
    fn explore(unit_id: u128, direction: Direction);
}
