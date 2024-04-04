use dojo::world::IWorldDispatcher;

use eternum::models::realm_layout::BuildingCategory;
use eternum::models::position::{Coord, Position, Direction};

#[starknet::interface]
trait IInnerHex<TContractState> {
    fn build_building(
        self: @TContractState,
        world: IWorldDispatcher,
        entity_id: u128,
        inner_coord: Coord,
        building: BuildingCategory,
    );
    fn destroy_building(
        self: @TContractState, world: IWorldDispatcher, entity_id: u128, inner_coord: Coord,
    );
    fn start_production(
        self: @TContractState, world: IWorldDispatcher, entity_id: u128, resource_type: u8,
    );
    fn stop_production(
        self: @TContractState, world: IWorldDispatcher, entity_id: u128, resource_type: u8,
    );
}
