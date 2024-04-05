use dojo::world::IWorldDispatcher;

use eternum::models::buildings::BuildingCategory;
use eternum::models::position::{Coord, Position, Direction};

#[starknet::interface]
trait IBuildingContract<TContractState> {
    fn create(
        self: @TContractState, world: IWorldDispatcher, entity_id: u128,
        building_coord: Coord, building_category: BuildingCategory,
    );
    fn destroy(
        self: @TContractState, world: IWorldDispatcher, entity_id: u128,
        building_coord: Coord, building_category: BuildingCategory,    
    );

}
