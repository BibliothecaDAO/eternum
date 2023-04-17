use super::alias::ID;
use starknet::ContractAddress;

#[derive(Component)]
struct Realm {
    realm_id: ID, // OG Realm Id
    owner: ContractAddress,
    resource_ids: ID, // hash of ids
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    // TODO: resources
    wonder: u8, // TODO: maybe its own component?
    order: u8 // TODO: use consts for orders, somewhere    
}

// TODO: custom serde?
