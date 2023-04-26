use array::ArrayTrait;
use traits::Into;
use eternum::alias::ID;
use starknet::ContractAddress;
use option::OptionTrait;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use eternum::utils::unpack::unpack_resource_ids;

#[derive(Component)]
struct Realm {
    realm_id: ID, // OG Realm Id
    owner: ContractAddress,
    resource_ids_hash: ID, // hash of ids
    // packed resource ids of realm
    resource_ids_packed: u256,
    resource_ids_count: usize,
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    // TODO: resources
    wonder: u8, // TODO: maybe its own component?
    order: u8 // TODO: use consts for orders, somewhere    
}


trait RealmTrait {
    fn is_owner(self: Realm, address: ContractAddress) -> bool;
    fn has_resource(self: Realm, resource_id: felt252) -> bool;
}

impl RealmImpl of RealmTrait {
    fn is_owner(self: Realm, address: ContractAddress) -> bool {
        if (self.owner == address) {
            return true;
        } else {
            return false;
        }
    }

    fn has_resource(self: Realm, resource_id: felt252) -> bool {
        let mut resource_ids: Array<u256> = unpack_resource_ids(
            self.resource_ids_packed, self.resource_ids_count
        );
        let mut index = 0;
        let has_resource = loop {
            if index == self.resource_ids_count {
                break false;
            };
            if resource_id.into() == *resource_ids[index] {
                break true;
            };
            index += 1;
        };
        has_resource
    }
}
