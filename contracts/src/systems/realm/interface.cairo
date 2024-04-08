use eternum::alias::ID;
use starknet::ContractAddress;
use eternum::models::position::Position;


#[dojo::interface]
trait IRealmSystems {
    fn create(
        realm_id: u128,
        resource_types_packed: u128,
        resource_types_count: u8,
        cities: u8,
        harbors: u8,
        rivers: u8,
        regions: u8,
        wonder: u8,
        order: u8,
        position: Position
    ) -> ID;
}
