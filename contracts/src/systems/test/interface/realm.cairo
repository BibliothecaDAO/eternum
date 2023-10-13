use eternum::alias::ID;
use starknet::ContractAddress;
use eternum::models::position::Position;
use dojo::world::IWorldDispatcher;


#[starknet::interface]
trait IRealmSystems<TContractState> {
    fn create(
        self: @TContractState, 
        world: IWorldDispatcher,
        realm_id: u128, 
        owner: ContractAddress, 
        resource_types_packed: u128, 
        resource_types_count: u8, 
        cities: u8, harbors: u8, 
        rivers: u8, regions: u8, 
        wonder: u8, 
        order: u8, 
        position: Position
    ) -> ID;
}