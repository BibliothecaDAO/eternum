use array::ArrayTrait;
use traits::Into;
use eternum::alias::ID;
use starknet::ContractAddress;
use quaireaux_math::fast_power::fast_power;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;

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
}

impl RealmImpl of RealmTrait {
    fn is_owner(self: Realm, address: ContractAddress) -> bool {
        if (self.owner == address) {
            return true;
        } else {
            return false;
        }
    }
}
