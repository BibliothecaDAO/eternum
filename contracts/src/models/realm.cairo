use array::SpanTrait;
use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::RealmMaxLevelConfig;
use eternum::utils::unpack::unpack_resource_types;
use starknet::ContractAddress;
use traits::Into;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Realm {
    #[key]
    entity_id: ID,
    realm_id: ID,
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
    order: u8,
    level: u8,
}


#[generate_trait]
impl RealmCustomImpl of RealmCustomTrait {
    fn max_level(self: Realm, world: IWorldDispatcher) -> u8 {
        get!(world, WORLD_CONFIG_ID, RealmMaxLevelConfig).max_level
    }

    fn has_resource(self: Realm, resource_type: u8) -> bool {
        let mut resource_types: Span<u8> = unpack_resource_types(self.resource_types_packed, self.resource_types_count);
        let mut has_resource = false;
        loop {
            match resource_types.pop_front() {
                Option::Some(v) => { if resource_type == *v {
                    has_resource = true;
                    break ();
                }; },
                Option::None(_) => { break (); },
            };
        };
        has_resource
    }

    fn assert_is_set(self: Realm) {
        assert(self.realm_id != 0, 'Entity is not a realm');
    }
}
