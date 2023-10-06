use starknet::ContractAddress;
use traits::Into;
use array::SpanTrait;
use eternum::alias::ID;
use eternum::utils::unpack::unpack_resource_types;

#[derive(Model, Copy, Drop, Serde)]
struct Realm {
    #[key]
    entity_id: u128,
    realm_id: u128,
    // OG Realm Id
    // TODO: no need for owner ? since we use Owner component
    // packed resource ids of realm
    resource_types_packed: u128, // max 16 resources
    resource_types_count: u8,
    cities: u8,
    harbors: u8,
    rivers: u8,
    regions: u8,
    wonder: u8,
    order: u8
}


trait RealmTrait {
    fn has_resource(self: Realm, resource_type: u8) -> bool;
}

impl RealmImpl of RealmTrait {
    fn has_resource(self: Realm, resource_type: u8) -> bool {
        let mut resource_types: Span<u8> = unpack_resource_types(
            self.resource_types_packed, self.resource_types_count
        );
        let mut has_resource = false;
        loop {
            match resource_types.pop_front() {
                Option::Some(v) => {
                    if resource_type == *v {
                        has_resource = true;
                        break ();
                    };
                },
                Option::None(_) => {
                    break ();
                },
            };
        };
        has_resource
    }
}
