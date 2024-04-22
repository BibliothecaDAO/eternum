use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::position::Coord;

#[dojo::interface]
trait IRoadSystems {
    fn create(entity_id: u128, start_coord: Coord, end_coord: Coord, usage_count: usize);
}
