use eternum::alias::ID;
use eternum::models::position::Coord;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IRoadSystems {
    fn create(entity_id: u128, start_coord: Coord, end_coord: Coord, usage_count: usize);
}
