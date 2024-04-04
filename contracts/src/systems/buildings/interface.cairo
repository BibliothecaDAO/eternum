use eternum::alias::ID;
use starknet::ContractAddress;
use eternum::models::position::Position;
use dojo::world::IWorldDispatcher;


#[dojo::interface]
trait IBuildingsSystems {
    fn create(realm_entity_id: u128, building_type: u8);
    fn destroy(realm_entity_id: u128);
}
