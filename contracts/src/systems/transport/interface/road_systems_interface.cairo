use eternum::alias::ID;
use eternum::models::position::Coord;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IRoadSystems<TContractState> {
        fn create(
            self:@TContractState, world: IWorldDispatcher, 
            entity_id: u128, start_coord: Coord, end_coord: Coord, usage_count: usize
        );
}