use alexandria_math::{BitShift, pow};
use core::byte_array::ByteArrayTrait;
use graffiti::json::Builder;
use graffiti::json::JsonImpl;

const BYTE_LEN: u128 = 8; // a byte is 8 bits
const MASK_1_BYTE: u128 = 0xff;


/// Converts a u256 value into an array of u8 bytes by extracting each byte sequentially.

/// # How it works:
/// 1. Takes a u256 value that contains packed u8 bytes
/// 2. Uses bitwise AND with MASK_1_BYTE (0xff) to extract the least significant byte
/// 3. Right-shifts the value by 8 bits to move to the next byte
/// 4. Repeats until all non-zero bytes are extracted
/// 5. Returns the bytes as a Span<u8> in the order they were packed (LSB first)
///
/// # Examples:
///
/// ## Example: Basic usage with a simple value
/// ```cairo
/// let packed_value: u128 = 0x00000000000000000000000001020304;
/// // Packed bytes: [4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
/// let result = unpack_u128_to_bytes_full(packed_value);
/// // result is: [4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
/// ```
fn unpack_u128_to_bytes_full(mut value: u128) -> Array<u8> {
    let mut res: Array<u8> = array![];
    for _ in 0..16_u8 {
        let byte: u8 = (value & MASK_1_BYTE).try_into().unwrap();
        res.append(byte);

        value = BitShift::shr(value, BYTE_LEN);
    };

    return res;
}

/// Converts an array of u8 bytes into a packed u128 value.

/// # How it works:
/// 1. Takes an Array<u8> containing bytes to pack
/// 2. Iterates through each byte from left to right
/// 3. Left-shifts the accumulated result by 8 bits
/// 4. Adds the current byte to the least significant position
/// 5. Returns the packed u128 value
///
/// # Examples:
///
/// ## Example: Basic usage with a simple array
/// ```cairo
/// let bytes: Span<u8> = array![4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].span();
/// let result = pack_bytes_to_u128_full(bytes);
/// // result is: 0x00000000000000000000000001020304
/// ```
fn pack_bytes_to_u128_full(mut bytes: Span<u8>) -> u128 {
    let mut result: u128 = 0;
    while bytes.len() > 0 {
        let byte: u8 = *bytes.pop_back().unwrap();
        result = BitShift::shl(result, BYTE_LEN);
        result = result + byte.into();
    };

    return result;
}


pub fn make_json_and_base64_encode_metadata(
    mut attrs_data: Array<(ByteArray, ByteArray)>, ipfs_cid: ByteArray,
) -> ByteArray {
    let mut attrs: Array<ByteArray> = array![];
    while attrs_data.len() > 0 {
        let (trait_type_name, trait_value_name) = attrs_data.pop_front().unwrap();
        attrs.append(JsonImpl::new().add("trait_type", trait_type_name).add("value", trait_value_name).build());
    };

    // construct full metadata
    let metadata = JsonImpl::new() // .add("name", name_str)
        .add("image", format!("ipfs://{}", ipfs_cid))
        .add_array("attributes", attrs.span());
    format!("data:application/json;base64,{}", bytes_base64_encode(metadata.build()))
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
