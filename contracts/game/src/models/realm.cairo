use alexandria_math::{BitShift, pow};
use core::array::SpanTrait;
use core::traits::Into;
use s1_eternum::models::config::{WorldConfigUtilImpl};
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;

#[generate_trait]
pub impl RealmNameAndAttrsDecodingImpl of RealmNameAndAttrsDecodingTrait {
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
                Option::None => { break; },
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


/// References to what each id maps to.
/// These exactly match what is in the Realms L2 contracts (bibliothecadao/lordship repository).
///
#[generate_trait]
pub impl RealmReferenceImpl of RealmReferenceTrait {
    fn resource_mapping(num: felt252) -> ByteArray {
        match num {
            0 => panic!("zero resource"),
            1 => "Stone",
            2 => "Coal",
            3 => "Wood",
            4 => "Copper",
            5 => "Ironwood",
            6 => "Obsidian",
            7 => "Gold",
            8 => "Silver",
            9 => "Mithral",
            10 => "Alchemical Silver",
            11 => "Cold Iron",
            12 => "Deep Crystal",
            13 => "Ruby",
            14 => "Diamonds",
            15 => "Hartwood",
            16 => "Ignium",
            17 => "Twilight Quartz",
            18 => "True Ice",
            19 => "Adamantine",
            20 => "Sapphire",
            21 => "Ethereal Silica",
            22 => "Dragonhide",
            _ => panic!("max resource num exceeded"),
        }
    }

    fn order_mapping(num: felt252) -> ByteArray {
        match num {
            0 => panic!("zero order"),
            1 => "The Order of Giants",
            2 => "The Order of Perfection",
            3 => "The Order of Rage",
            4 => "The Order of the Fox",
            5 => "The Order of the Twins",
            6 => "The Order of Fury",
            7 => "The Order of Reflection",
            8 => "The Order of Detection",
            9 => "The Order of Skill",
            10 => "The Order of Brilliance",
            11 => "The Order of Protection",
            12 => "The Order of Power",
            13 => "The Order of Titans",
            14 => "The Order of Vitriol",
            15 => "The Order of Anger",
            16 => "The Order of Enlightenment",
            _ => panic!("max order num exceeded"),
        }
    }


    fn wonder_mapping(num: felt252) -> ByteArray {
        match num {
            0 => panic!("zero wonder"),
            1 => "None",
            2 => "The Eternal Orchard",
            3 => "The Glowing Geyser",
            4 => "The Pearl Summit",
            5 => "The Pearl River",
            6 => "Altar Of Divine Will",
            7 => "The Fading Yew",
            8 => "Pantheon Of Chaos",
            9 => "The Ancient Lagoon",
            10 => "The Exalted Basin",
            11 => "The Amaranthine Rock",
            12 => "The Pale Pillar",
            13 => "The Mythic Trees",
            14 => "Sanctum Of The Oracle",
            15 => "The Ancestral Willow",
            16 => "The Pale Vertex",
            17 => "Cathedral Of Agony",
            18 => "The Omen Graves",
            19 => "The Crying Oak",
            20 => "The Perpetual Ridge",
            21 => "The Sanctified Fjord",
            22 => "Altar Of Perfection",
            23 => "The Argent Catacombs",
            24 => "The Mirror Grotto",
            25 => "The Mother Grove",
            26 => "The Dark Mountain",
            27 => "The Origin Oasis",
            28 => "The Cerulean Reliquary",
            29 => "Sanctum Of Purpose",
            30 => "Altar Of The Void",
            31 => "Pagoda Of Fortune",
            32 => "The Weeping Willow",
            33 => "Synagogue Of Collapse",
            34 => "Mosque Of Mercy",
            35 => "The Perpetual Fjord",
            36 => "The Ethereal Isle",
            37 => "The Azure Lake",
            38 => "The Celestial Vertex",
            39 => "The Exalted Maple",
            40 => "The Oracle Pool",
            41 => "Infinity Spire",
            42 => "The Exalted Geyser",
            43 => "The Glowing Pinnacle",
            44 => "The Ancestral Trees",
            45 => "The Immortal Hot Spring",
            46 => "The Pure Stone",
            47 => "The Cerulean Chamber",
            48 => "Sanctuary Of The Ancients",
            49 => "The Solemn Catacombs",
            50 => "The Devout Summit",
            51 => "Sky Mast",
            _ => panic!("max wonder num exceeded"),
        }
    }
}
// #[cfg(test)]
// mod test_realm_name_and_attrs_decode_impl {
//     use super::{RealmNameAndAttrsDecodingImpl};

//     fn DATA_ONE() -> felt252 {
//         0x53746f6c736c69010102011a1108060708
//     }

//     fn DATA_TWO() -> felt252 {
//         0x5165756a7165756a776f75770107040301281915060c09
//     }

//     #[test]
//     fn test_decode_name_and_attrs_one() {
//         let (name, region, cities, harbors, rivers, wonder, order, resources) =
//         RealmNameAndAttrsDecodingImpl::decode(
//             DATA_ONE(),
//         );
//         assert_eq!(name, 'Stolsli');
//         assert_eq!(region, 6);
//         assert_eq!(cities, 8);
//         assert_eq!(harbors, 17);
//         assert_eq!(rivers, 26);
//         assert_eq!(wonder, 1);
//         assert_eq!(order, 1);
//         assert_eq!(resources, array![1, 2]); // stone and coal
//     }

//     #[test]
//     fn test_decode_name_and_attrs_two() {
//         let (name, region, cities, harbors, rivers, wonder, order, resources) =
//         RealmNameAndAttrsDecodingImpl::decode(
//             DATA_TWO(),
//         );
//         assert_eq!(name, 'Qeujqeujwouw');
//         assert_eq!(region, 6);
//         assert_eq!(cities, 21);
//         assert_eq!(harbors, 25);
//         assert_eq!(rivers, 40);
//         assert_eq!(wonder, 1);
//         assert_eq!(order, 7);
//         assert_eq!(resources, array![1, 3, 4]); // stone, wood, copper
//     }
// }

// #[cfg(test)]
// mod test_realm_resources_impl {
//     use starknet::contract_address_const;
//     use super::{Realm, RealmResourcesImpl, RealmResourcesTrait};

//     fn mock_realm() -> Realm {
//         Realm { entity_id: 1, realm_id: 1, order: 0, level: 0, produced_resources: 0, has_wonder: false }
//     }

//     #[test]
//     fn test_pack_resource_types_empty() {
//         let resource_types: Array<u8> = array![];
//         let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert_eq!(packed, 0, "Packing an empty array should return 0");
//     }

//     #[test]
//     fn test_pack_resource_types_single() {
//         let resource_types: Array<u8> = array![42];
//         let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert_eq!(packed, 42, "Packing a single element should return its value");
//     }

//     #[test]
//     fn test_pack_unpack_resource_types() {
//         let resource_types: Array<u8> = array![1, 2, 3, 55, 128, 33, 122, 122];
//         let resource_types_reversed: Array<u8> = array![122, 122, 33, 128, 55, 3, 2, 1];
//         let packed = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
//         assert_eq!(unpacked, resource_types_reversed.span(), "Unpacked resources should match the original");
//     }

//     #[test]
//     #[should_panic(expected: "resources are too many to be packed into a u128")]
//     fn test_pack_resource_types_overflow() {
//         let resource_types: Array<u8> = array![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
//         RealmResourcesImpl::pack_resource_types(resource_types.span());
//     }

//     #[test]
//     fn test_unpack_resource_types_zero() {
//         let packed: u128 = 0;
//         let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
//         let expected: Array<u8> = array![];
//         assert_eq!(unpacked, expected.span(), "Unpacking zero should return an empty array");
//     }

//     #[test]
//     fn test_unpack_resource_types_max_value() {
//         let packed: u128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF; // max u128 value
//         let unpacked = RealmResourcesImpl::unpack_resource_types(packed);
//         let expected: Array<u8> = array![
//             255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
//         ];
//         assert_eq!(unpacked, expected.span(), "Unpacked resources should match maximum packed value");
//     }

//     #[test]
//     fn test_contains_resource_present() {
//         let resource_types: Array<u8> = array![10, 20, 30, 40];
//         let mut realm = mock_realm();
//         realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert!(realm.produces_resource(20), "Resource 20 should be present");
//     }

//     #[test]
//     fn test_contains_resource_absent() {
//         let resource_types: Array<u8> = array![10, 20, 30, 40];
//         let mut realm = mock_realm();
//         realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert!(!realm.produces_resource(50), "Resource 50 should not be present");
//     }

//     #[test]
//     fn test_contains_resource_empty() {
//         let mut realm = mock_realm();
//         assert!(!realm.produces_resource(10), "No resources should be present in an empty pack");
//     }

//     #[test]
//     fn test_contains_resource_multiple_occurrences() {
//         let resource_types: Array<u8> = array![10, 20, 10, 30];
//         let mut realm = mock_realm();
//         realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert!(realm.produces_resource(10), "Resource 10 should be present");
//         assert!(realm.produces_resource(20), "Resource 20 should be present");
//         assert!(realm.produces_resource(30), "Resource 30 should be present");
//         assert!(!realm.produces_resource(40), "Resource 40 should not be present");
//     }

//     #[test]
//     fn test_contains_resource_max_value() {
//         let resource_types: Array<u8> = array![255, 127, 128];
//         let mut realm = mock_realm();
//         realm.produced_resources = RealmResourcesImpl::pack_resource_types(resource_types.span());
//         assert!(realm.produces_resource(255), "Resource 255 should be present");
//         assert!(realm.produces_resource(127), "Resource 127 should be present");
//         assert!(realm.produces_resource(128), "Resource 128 should be present");
//     }
// }


