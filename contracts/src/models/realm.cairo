use alexandria_math::{BitShift, pow};
use array::SpanTrait;
use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::config::RealmMaxLevelConfig;
use starknet::ContractAddress;
use traits::Into;


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Realm {
    #[key]
    entity_id: ID,
    realm_id: ID,
    level: u8,
    produced_resources: u128
}


#[generate_trait]
impl RealmCustomImpl of RealmCustomTrait {
    fn max_level(self: Realm, world: IWorldDispatcher) -> u8 {
        get!(world, WORLD_CONFIG_ID, RealmMaxLevelConfig).max_level
    }

    fn assert_is_set(self: Realm) {
        assert(self.realm_id != 0, 'Entity is not a realm');
    }
}

#[generate_trait]
impl RealmNameAndAttrsDecodingImpl of RealmNameAndAttrsDecodingTrait {
    fn BYTE_LEN() -> u256 {
        8 // a byte is 8 bits
    }

    fn MASK_1_BYTE() -> u256 {
        0xff
    }

    fn decode(name_and_attrs: felt252) -> (felt252, u8, u8, u8, u8, u8, u8, Array<u8>) {
        let original_name_and_attrs: u256 = name_and_attrs.into();
        let attrs_len: u256 = original_name_and_attrs & Self::MASK_1_BYTE();

        // remove name length and attrs length from name_and_attrs
        let realm_name_and_attrs: u256 = BitShift::shr(original_name_and_attrs, 2 * Self::BYTE_LEN());

        let attrs_mask: u256 = pow(2, Self::BYTE_LEN() * attrs_len) - 1;
        let attributes: u256 = realm_name_and_attrs & attrs_mask;

        let mut attrs_arr: Span<u8> = Self::_encoded_attributes_to_array(attributes);
        let region: u8 = *attrs_arr.pop_front().unwrap();
        let cities: u8 = *attrs_arr.pop_front().unwrap();
        let harbors: u8 = *attrs_arr.pop_front().unwrap();
        let rivers: u8 = *attrs_arr.pop_front().unwrap();
        let wonder: u8 = *attrs_arr.pop_back().unwrap();
        let order: u8 = *attrs_arr.pop_back().unwrap();

        // resources available on realm
        let mut resources = array![];
        loop {
            match attrs_arr.pop_front() {
                Option::Some(resource) => { resources.append(*resource); },
                Option::None => { break; }
            }
        };

        // realm name
        let name: felt252 = BitShift::shr(realm_name_and_attrs, Self::BYTE_LEN() * attrs_len).try_into().unwrap();

        return (name, region, cities, harbors, rivers, wonder, order, resources);
    }

    fn _encoded_attributes_to_array(mut value: u256) -> Span<u8> {
        let mut res: Array<u8> = array![];
        while (value > 0) {
            let byte: u8 = (value & Self::MASK_1_BYTE()).try_into().unwrap();
            res.append(byte);

            value = BitShift::shr(value, 8);
        };

        return res.span();
    }
}


#[generate_trait]
impl RealmResourcesImpl of RealmResourcesTrait {
    fn PACKING_TOTAL_BITS_AVAILABLE() -> u8 {
        128 // 128 bits available for all resources
    }

    fn PACKING_MAX_BITS_PER_RESOURCE() -> u8 {
        8 // 8 bits available per resource
    }

    fn PACKING_MASK_SIZE() -> u8 {
        0xFF // max value for a u8
    }

    fn pack_resource_types(resource_types: Span<u8>) -> u128 {
        // ensure all resources can be packed into a u128
        let max_resources: u8 = Self::PACKING_TOTAL_BITS_AVAILABLE() / Self::PACKING_MAX_BITS_PER_RESOURCE();
        assert!(resource_types.len() <= max_resources.into(), "resources are too many to be packed into a u128");

        // pack the resources into a u128
        let mut produced_resources: u128 = 0;
        for resource_type in resource_types {
            // ensure resource type is not zero
            assert!((*resource_type).is_non_zero(), "resource type is zero");

            // shift left to make space for the new resource
            let masked_produced_resources = BitShift::shl(
                produced_resources, Self::PACKING_MAX_BITS_PER_RESOURCE().into()
            );

            // add the new resource
            let new_produced_resources = masked_produced_resources | (*resource_type).into();

            // update the packed value
            produced_resources = new_produced_resources;
        };
        produced_resources
    }


    fn unpack_resource_types(mut produced_resources: u128) -> Span<u8> {
        // Iterate over each resource type
        let mut resource_types = array![];
        while produced_resources > 0 {
            // extract the first 8 bits
            let resource_type = produced_resources & Self::PACKING_MASK_SIZE().into();
            resource_types.append(resource_type.try_into().unwrap());

            // shift right by 8 bits
            produced_resources = BitShift::shr(produced_resources, Self::PACKING_MAX_BITS_PER_RESOURCE().into());
        };

        resource_types.span()
    }

    fn produces_resource(self: Realm, check_resource_type: u8) -> bool {
        let mut packed = self.produced_resources;
        let mut contains_resource = false;
        while packed > 0 {
            // extract the first 8 bits
            let resource_type: u8 = (packed & Self::PACKING_MASK_SIZE().into()).try_into().unwrap();
            if resource_type == check_resource_type {
                contains_resource = true;
                break;
            }
            // shift right by 8 bits
            packed = BitShift::shr(packed, Self::PACKING_MAX_BITS_PER_RESOURCE().into());
        };
        contains_resource
    }
}


#[cfg(test)]
mod tests {
    use super::{RealmResourcesImpl, RealmResourcesTrait, Realm};

    fn test_realm() -> Realm {
        Realm { entity_id: 1, realm_id: 1, level: 0, produced_resources: 0, }
    }


    #[test]
    fn test_pack_resource_types_empty() {
        let resource_types: Array<u8> = array![];
        let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert_eq!(packed, 0, "Packing an empty array should return 0");
    }

    #[test]
    fn test_pack_resource_types_single() {
        let resource_types: Array<u8> = array![42];
        let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert_eq!(packed, 42, "Packing a single element should return its value");
    }

    #[test]
    fn test_pack_unpack_resource_types() {
        let resource_types: Array<u8> = array![1, 2, 3, 55, 128, 33, 122, 122];
        let resource_types_reversed: Array<u8> = array![122, 122, 33, 128, 55, 3, 2, 1];
        let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
        let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
        assert_eq!(unpacked, resource_types_reversed.span(), "Unpacked resources should match the original");
    }

    #[test]
    #[should_panic(expected: "resources are too many to be packed into a u128")]
    fn test_pack_resource_types_overflow() {
        let resource_types: Array<u8> = array![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        RealmResourcesImpl::pack_resource_types(resource_types.span());
    }

    #[test]
    fn test_unpack_resource_types_zero() {
        let packed: u128 = 0;
        let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
        let expected: Array<u8> = array![];
        assert_eq!(unpacked, expected.span(), "Unpacking zero should return an empty array");
    }

    #[test]
    fn test_unpack_resource_types_max_value() {
        let packed: u128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // max u128 value
        let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
        let expected: Array<u8> = array![
            255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
        ];
        assert_eq!(unpacked, expected.span(), "Unpacked resources should match maximum packed value");
    }


    #[test]
    fn test_contains_resource_present() {
        let resource_types: Array<u8> = array![10, 20, 30, 40];
        let mut realm = test_realm();
        realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert!(realm.produces_resource(20), "Resource 20 should be present");
    }

    #[test]
    fn test_contains_resource_absent() {
        let resource_types: Array<u8> = array![10, 20, 30, 40];
        let mut realm = test_realm();
        realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert!(!realm.produces_resource(50), "Resource 50 should not be present");
    }

    #[test]
    fn test_contains_resource_empty() {
        let mut realm = test_realm();
        assert!(!realm.produces_resource(10), "No resources should be present in an empty pack");
    }

    #[test]
    fn test_contains_resource_multiple_occurrences() {
        let resource_types: Array<u8> = array![10, 20, 10, 30];
        let mut realm = test_realm();
        realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert!(realm.produces_resource(10), "Resource 10 should be present");
        assert!(realm.produces_resource(20), "Resource 20 should be present");
        assert!(realm.produces_resource(30), "Resource 30 should be present");
        assert!(!realm.produces_resource(40), "Resource 40 should not be present");
    }

    #[test]
    fn test_contains_resource_max_value() {
        let resource_types: Array<u8> = array![255, 0, 127, 128];
        let mut realm = test_realm();
        realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
        assert!(realm.produces_resource(255), "Resource 255 should be present");
        assert!(realm.produces_resource(127), "Resource 127 should be present");
        assert!(realm.produces_resource(128), "Resource 128 should be present");
    }
}
