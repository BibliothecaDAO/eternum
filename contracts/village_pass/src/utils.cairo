use alexandria_math::{BitShift, pow};
use core::byte_array::ByteArrayTrait;
use graffiti::json::Builder;
use graffiti::json::JsonImpl;

const BYTE_LEN: u256 = 8; // a byte is 8 bits
const MASK_1_BYTE: u256 = 0xff;
const MASK_2_BYTES: u256 = 0xffff;

const URL_PART_LEN: u32 = 23; // i.e 46 /2

fn encoded_attributes_to_array(mut value: u256) -> Span<u8> {
    let mut res: Array<u8> = array![];
    while (value > 0) {
        let byte: u8 = (value & MASK_1_BYTE).try_into().unwrap();
        res.append(byte);

        value = BitShift::shr(value, 8);
    };

    return res.span();
}


pub fn make_json_and_base64_encode_metadata(url: ByteArray) -> ByteArray {
    // construct full metadata
    let metadata = JsonImpl::new()
        .add("name", "Eternum Village [Season 1]")
        .add("image", format!("https://gateway.pinata.cloud/ipfs/{}", url));
    format!("data:application/json;base64,{}", bytes_base64_encode(metadata.build()))
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


/// Convert bytes array to base64 encoded bytes array
///
/// # Arguments
/// * `bytes` - the bytes array to be encoded
///
/// # Returns
/// * `ByteArray` - the base64 encoded bytes array
///                 e.g. "aGVsbG8gd29ybGQ="
///

fn bytes_base64_encode(_bytes: ByteArray) -> ByteArray {
    let mut char_set = get_base64_char_set();
    char_set.append('+');
    char_set.append('/');
    encode_bytes(_bytes, char_set.span())
}


fn encode_bytes(mut bytes: ByteArray, base64_chars: Span<u8>) -> ByteArray {
    let mut result: ByteArray = "";
    if bytes.len() == 0 {
        return result;
    }
    let mut p: u8 = 0;
    let c = bytes.len() % 3;
    if c == 1 {
        p = 2;
        bytes.append_byte(0_u8);
        bytes.append_byte(0_u8);
    } else if c == 2 {
        p = 1;
        bytes.append_byte(0_u8);
    }

    let mut i = 0;
    let bytes_len = bytes.len();
    let last_iteration = bytes_len - 3;
    loop {
        if i == bytes_len {
            break;
        }
        let n: u32 = (bytes.at(i).unwrap()).into()
            * 65536 | (bytes.at(i + 1).unwrap()).into()
            * 256 | (bytes.at(i + 2).unwrap()).into();
        let e1 = (n / 262144) & 63;
        let e2 = (n / 4096) & 63;
        let e3 = (n / 64) & 63;
        let e4 = n & 63;

        if i == last_iteration {
            if p == 2 {
                result.append_byte(*base64_chars[e1]);
                result.append_byte(*base64_chars[e2]);
                result.append_byte('=');
                result.append_byte('=');
            } else if p == 1 {
                result.append_byte(*base64_chars[e1]);
                result.append_byte(*base64_chars[e2]);
                result.append_byte(*base64_chars[e3]);
                result.append_byte('=');
            } else {
                result.append_byte(*base64_chars[e1]);
                result.append_byte(*base64_chars[e2]);
                result.append_byte(*base64_chars[e3]);
                result.append_byte(*base64_chars[e4]);
            }
        } else {
            result.append_byte(*base64_chars[e1]);
            result.append_byte(*base64_chars[e2]);
            result.append_byte(*base64_chars[e3]);
            result.append_byte(*base64_chars[e4]);
        }

        i += 3;
    };
    result
}


// use alexandria_encoding::base64::get_base64_char_set;
fn get_base64_char_set() -> Array<u8> {
    let mut result = array![
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'q',
        'r',
        's',
        't',
        'u',
        'v',
        'w',
        'x',
        'y',
        'z',
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
    ];
    result
}
