use eternum::alias::ID;
use starknet::ContractAddress;
use eternum::models::position::Position;
use dojo::world::IWorldDispatcher;


#[starknet::interface]
trait IBuildingsSystems<TContractState> {
    fn create(
        self: @TContractState, world: IWorldDispatcher, realm_entity_id: u128, building_type: u8
    );
    fn destroy(self: @TContractState, world: IWorldDispatcher, realm_entity_id: u128);
}
