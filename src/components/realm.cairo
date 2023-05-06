use array::ArrayTrait;
use traits::Into;
use eternum::alias::ID;
use starknet::ContractAddress;
use option::OptionTrait;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use eternum::utils::unpack::unpack_resource_ids;
use debug::PrintTrait;

#[derive(Component)]
struct Realm {
    realm_id: ID, // OG Realm Id
    // TODO: no need for owner ? since we use Owner component
    owner: ContractAddress,
    // packed resource ids of realm
    resource_ids_packed: u128, // max 16 resources
    resource_ids_count: u8,
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    wonder: u8,
    order: u8
}


trait RealmTrait {
    fn is_owner(self: Realm, address: ContractAddress) -> bool;
    fn has_resource(self: Realm, resource_id: u8) -> bool;
}

impl RealmImpl of RealmTrait {
    fn is_owner(self: Realm, address: ContractAddress) -> bool {
        if (self.owner == address) {
            return true;
        } else {
            return false;
        }
    }

    fn has_resource(self: Realm, resource_id: u8) -> bool {
        let mut resource_ids: Array<u8> = unpack_resource_ids(
            self.resource_ids_packed, self.resource_ids_count
        );
        let mut index = 0_usize;
        let has_resource = loop {
            if index == self.resource_ids_count.into() {
                break false;
            };
            if resource_id == *resource_ids[index] {
                break true;
            };
            index += 1;
        };
        has_resource
    }
}
