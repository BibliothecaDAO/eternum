//! # Collectibles Utility Functions
//!
//! This module provides utility functions for bit manipulation, metadata generation,
//! and base64 encoding used by the Realms Collectible contract.

use alexandria_math::{BitShift, pow};
use core::byte_array::ByteArrayTrait;
use graffiti::json::Builder;
use graffiti::json::JsonImpl;

const BYTE_LEN: u128 = 8; // a byte is 8 bits
const MASK_1_BYTE: u128 = 0xff;


/// Converts a u128 value into an array of u8 bytes by extracting each byte sequentially.

/// # How it works:
/// 1. Takes a u128 value that contains packed u8 bytes
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
///
/// # Arguments
/// * `value` - The packed u128 value containing byte data
///
/// # Returns
/// * `Array<u8>` - Array of 16 bytes in LSB-first order
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
///
/// # Arguments
/// * `bytes` - Span of u8 bytes to pack (should be 16 bytes for full u128)
///
/// # Returns
/// * `u128` - Packed value with bytes in MSB-first order
fn pack_bytes_to_u128_full(mut bytes: Span<u8>) -> u128 {
    let mut result: u128 = 0;
    while bytes.len() > 0 {
        let byte: u8 = *bytes.pop_back().unwrap();
        result = BitShift::shl(result, BYTE_LEN);
        result = result + byte.into();
    };

    return result;
}

/// Generates OpenSea-compatible JSON metadata and encodes it as a base64 data URI
///
/// This function creates a complete NFT metadata JSON structure following the OpenSea standard,
/// then encodes it as a base64 data URI that can be returned from the `tokenURI` function.
///
/// # Arguments
/// * `name` - The collection name (e.g., "Realms Collectible")
/// * `description` - The collection description
/// * `token_id` - The specific token ID being described
/// * `attrs_data` - Array of (trait_type, trait_value) pairs for attributes
/// * `ipfs_cid` - IPFS content identifier for the token image
///
/// # Returns
/// * `ByteArray` - Complete data URI in format: `data:application/json;base64,{encoded_json}`
///
/// # JSON Structure
/// The generated JSON follows this structure:
/// ```json
/// {
///   "name": "Collection Name #123",
///   "description": "Collection description",
///   "image": "ipfs://QmIPFSCID",
///   "attributes": [
///     {"trait_type": "Rarity", "value": "Legendary"},
///     {"trait_type": "Element", "value": "Fire"}
///   ]
/// }
/// ```
pub fn make_json_and_base64_encode_metadata(
    name: ByteArray,
    description: ByteArray,
    token_id: u256,
    mut attrs_data: Array<(ByteArray, ByteArray)>,
    ipfs_cid: ByteArray,
) -> ByteArray {
    let mut attrs: Array<ByteArray> = array![];
    while attrs_data.len() > 0 {
        let (trait_type_name, trait_value_name) = attrs_data.pop_front().unwrap();
        attrs.append(JsonImpl::new().add("trait_type", trait_type_name).add("value", trait_value_name).build());
    };

    // construct full metadata
    let metadata = JsonImpl::new()
        .add("name", format!("{} #{}", name, token_id))
        .add("description", description)
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
/// # Base64 Character Set
/// Uses the standard base64 character set: A-Z, a-z, 0-9, +, /
/// with = for padding
fn bytes_base64_encode(_bytes: ByteArray) -> ByteArray {
    let mut char_set = get_base64_char_set();
    char_set.append('+');
    char_set.append('/');
    encode_bytes(_bytes, char_set.span())
}

/// Internal function that performs the actual base64 encoding
///
/// # Arguments
/// * `bytes` - Input bytes to encode
/// * `base64_chars` - Character set to use for encoding
///
/// # Returns
/// * `ByteArray` - Base64 encoded string
///
/// # Algorithm
/// 1. Groups input bytes into chunks of 3 (24 bits)
/// 2. Splits each 24-bit chunk into four 6-bit values
/// 3. Maps each 6-bit value to a base64 character
/// 4. Adds padding ('=') for incomplete final chunks
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


/// Returns the standard base64 character set (A-Z, a-z, 0-9)
///
/// # Returns
/// * `Array<u8>` - Array of 62 base64 characters (excludes + and / which are added separately)
///
/// # Character Set
/// - A-Z: 26 uppercase letters
/// - a-z: 26 lowercase letters
/// - 0-9: 10 digits
/// Total: 62 characters (+ and / added by caller for full 64-character set)
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
