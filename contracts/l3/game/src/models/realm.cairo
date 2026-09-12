use alexandria_math::{BitShift, pow};
use core::array::SpanTrait;
use core::traits::Into;
use crate::models::config::WorldConfigUtilImpl;

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
        }

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
        }

        return res.span();
    }
}


/// References to what each id maps to.
/// These exactly match what is in the Realms L2 contracts (bibliothecadao/lordship repository).
///
#[generate_trait]
pub impl RealmReferenceImpl of RealmReferenceTrait {
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
