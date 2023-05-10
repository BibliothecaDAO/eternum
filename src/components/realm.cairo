use traits::Into;
use eternum::alias::ID;
use starknet::ContractAddress;
use eternum::utils::unpack::unpack_resource_ids;

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
    fn has_resource(self: Realm, resource_id: u8) -> bool;
}

impl RealmImpl of RealmTrait {
    fn has_resource(self: Realm, resource_id: u8) -> bool {
        let mut resource_ids: Span<u8> = unpack_resource_ids(
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
